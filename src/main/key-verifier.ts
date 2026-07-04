/**
 * Real pre-flight API-key verification.
 *
 * MudrikNow does NOT keep a parallel per-provider HTTP test layer. It reuses
 * the OpenCode engine's OWN run path — the same `opencode run --agent
 * readonly` the app uses for real messages — with the candidate key written
 * to an ISOLATED auth.json. If OpenCode streams back text, the key is good;
 * if it emits an error event, the message (at `error.data.message`) is
 * classified (auth / rate / server / …).
 *
 * Why this setup:
 *   - `cwd = workingDir`: OpenCode discovers the `readonly` agent by scanning
 *     `.opencode/agent/` in the CWD. The app provisions it there. Without it,
 *     `opencode run --agent readonly` fails with an empty error.
 *   - `XDG_DATA_HOME` → temp dir with a candidate-only auth.json, so the user's
 *     REAL auth.json never masks a bad candidate key.
 *   - `XDG_CONFIG_HOME` → the app's isolated config (empty MCPs), same as a
 *     real send.
 *   - prompt via stdin (exactly how sendMessage does it).
 *
 * The candidate key is NEVER persisted here — the caller decides what to do
 * with the verdict.
 */
import { spawn, execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { findOpenCodeBin, isNativeOpenCodeBin } from "./opencode-client";
import { buildCleanOpenCodeEnv } from "../shared/providers";
import { pickTestModel, isFreeProvider, Catalog } from "../shared/provider-catalog";
import { classifyError, extractErrorMessage } from "../shared/error-classifier";
import { VerifyResult } from "../shared/types";

const VERIFY_TIMEOUT_MS = 25000;
const TEST_PROMPT = "Reply with exactly one word: ok";

/** Build an isolated env that mirrors a real send but with a candidate-only
 *  auth.json. Returns the env + the temp data dir (caller cleans up). */
function buildVerifyEnv(providerId: string, key: string, isolatedConfigDir: string): { env: NodeJS.ProcessEnv; dataHome: string } {
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), "hb-verify-"));
  fs.mkdirSync(path.join(dataHome, "opencode"), { recursive: true });
  // Candidate-only auth.json — the real auth.json is invisible to this run.
  fs.writeFileSync(
    path.join(dataHome, "opencode", "auth.json"),
    JSON.stringify({ [providerId]: { type: "api", key } }),
  );
  const env = buildCleanOpenCodeEnv(process.env, {});
  env.XDG_CONFIG_HOME = isolatedConfigDir;
  env.XDG_DATA_HOME = dataHome;
  return { env, dataHome };
}

/** Enumerate the provider's models live (works even with a bad key — it's
 *  presence-based, but gives us a real model id to test-run). */
function resolveTestModelLive(bin: string, providerId: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  const isNative = isNativeOpenCodeBin(bin);
  const cmd = isNative ? bin : "node";
  const args = isNative ? ["models", providerId] : [bin, "models", providerId];
  return new Promise((resolve) => {
    execFile(cmd, args, { env, encoding: "utf-8", timeout: 30000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err) { resolve(undefined); return; }
      const lines = stdout.trim().split("\n").map((s) => s.trim()).filter(Boolean);
      const cheap = lines.find((id) => /flash|haiku|nano|mini|small|lite|turbo/i.test(id));
      resolve(cheap || lines[0]);
    });
  });
}

/** Spawn `opencode run --agent readonly --model <full>` (the real send path)
 *  and watch the JSON stream for success (text) or failure (error event). */
function runVerify(bin: string, fullModelId: string, env: NodeJS.ProcessEnv, workingDir: string): Promise<VerifyResult> {
  const isNative = isNativeOpenCodeBin(bin);
  const cmd = isNative ? bin : "node";
  const args = isNative
    ? ["run", "--format", "json", "--model", fullModelId, "--agent", "readonly"]
    : [bin, "run", "--format", "json", "--model", fullModelId, "--agent", "readonly"];
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, cwd: workingDir, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    let resolved = false;
    let lastErr = "";
    const finish = (r: VerifyResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      resolve(r);
    };
    const timer = setTimeout(
      () => finish({ ok: false, category: "INCONCLUSIVE", message: "Verification timed out. You can save the key and try sending a message." }),
      VERIFY_TIMEOUT_MS,
    );
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString("utf-8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: any;
        try { ev = JSON.parse(line); } catch { continue; /* non-JSON log line */ }
        if (ev.type === "text" && ev.part && ev.part.text) {
          finish({ ok: true, message: "Connected." });
        } else if (ev.type === "error") {
          lastErr = extractErrorMessage(ev.error);
        } else if (ev.type === "step_finish" && ev.part && ev.part.reason === "stop" && !lastErr) {
          finish({ ok: true, message: "Connected." });
        }
      }
    });
    child.on("close", () => {
      if (resolved) return;
      if (lastErr) {
        const c = classifyError(lastErr);
        finish({ ok: false, category: c.category, message: c.message });
      } else {
        finish({ ok: false, category: "INCONCLUSIVE", message: "Couldn't confirm the connection. You can save the key and try sending a message." });
      }
    });
    child.on("error", () => finish({ ok: false, category: "UNKNOWN", message: "Couldn't start the OpenCode engine." }));
    // Prompt via stdin — exactly how sendMessage does it.
    try { child.stdin.write(TEST_PROMPT); child.stdin.end(); } catch { /* ignore */ }
  });
}

export async function verifyProviderKey(
  providerId: string,
  key: string,
  catalog: Catalog,
  workingDir: string,
  isolatedConfigDir: string,
): Promise<VerifyResult> {
  const pid = (providerId || "").toLowerCase();
  if (isFreeProvider(pid)) return { ok: true, message: "Free provider — no key needed." };
  const bin = findOpenCodeBin();
  if (!bin) return { ok: false, category: "UNKNOWN", message: "OpenCode engine not found. Install opencode-ai, then try again." };
  const trimmed = (key || "").trim();
  if (!trimmed) return { ok: false, category: "AUTH_MISSING", message: "No API key entered." };

  const { env, dataHome } = buildVerifyEnv(pid, trimmed, isolatedConfigDir);
  try {
    // Resolve a model id: catalog first (fast), live enumeration as fallback.
    let modelId = pickTestModel(pid, catalog);
    if (!modelId) {
      const live = await resolveTestModelLive(bin, pid, env);
      if (live) modelId = live;
    }
    if (!modelId) {
      return { ok: false, category: "AUTH_INVALID", message: "This provider wasn't recognized with that key. Double-check the key and provider." };
    }
    let result = await runVerify(bin, modelId, env, workingDir);
    // Stale catalog model id? Re-resolve from a live enumeration and retry once.
    if (!result.ok && result.category === "MODEL_NOT_FOUND") {
      const live = await resolveTestModelLive(bin, pid, env);
      if (live && live !== modelId) {
        modelId = live;
        result = await runVerify(bin, live, env, workingDir);
      }
    }
    // Transient provider/server or network hiccup → one retry with the same
    // model. Providers (e.g. NVIDIA) intermittently return "Unexpected server
    // error" on a call that succeeds a moment later; without a retry the user
    // sees a misleading failure for a key that actually works.
    if (!result.ok && (result.category === "PROVIDER_DOWN" || result.category === "NETWORK")) {
      result = await runVerify(bin, modelId, env, workingDir);
    }
    return result;
  } finally {
    // Best-effort cleanup (Windows may briefly lock files in the killed
    // subprocess's temp dir — try once, swallow failures).
    try { fs.rmSync(dataHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
