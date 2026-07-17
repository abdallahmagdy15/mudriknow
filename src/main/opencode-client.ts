import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { log } from "./logger";
import { buildCleanOpenCodeEnv } from "../shared/providers";
import { extractErrorMessage } from "../shared/error-classifier";
import { debugLog } from "./debug-timing";

export interface OpenCodeEvent {
  type: string;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    tool?: string;
    callID?: string;
    state?: {
      status?: string;
      input?: Record<string, any>;
      output?: string;
      metadata?: Record<string, any>;
    };
    reason?: string;
    tokens?: { total: number; input: number; output: number; reasoning: number };
  };
  properties?: {
    permission?: string;
    [key: string]: unknown;
  };
  error?: { message: string; data?: any };
  timestamp?: number;
}

export type EventHandler = (event: OpenCodeEvent) => void;

/**
 * Tools that must NEVER execute from a MudrikNow-initiated OpenCode session.
 * The model is limited to text + `<!--ACTION:...-->` markers; anything else is
 * treated as a sandbox breach and terminates the session.
 *
 * Frontmatter permission rules in `.opencode/agent/readonly.md` are not
 * enforced by OpenCode 1.4.x, so this in-process kill-switch is the
 * authoritative enforcement point.
 */
/**
 * Base allowlist — the tools MudrikNow's readonly agent may ALWAYS use.
 * When `readOnlyCommandsEnabled` is true, `bash` is added (with command-
 * string filtering via detectDisallowedBashCommand).
 *
 * Switched from a denylist after the original `*mcp*` substring failed to
 * catch `playwright_browser_navigate` / `playwright_browser_click`
 * (registered via the user's OpenCode global config and named without
 * "mcp"). The AI happily called them mid-guide, did the task itself via
 * browser automation, and never emitted guide_step markers — exactly the
 * leak the sandbox is meant to prevent.
 *
 * If OpenCode adds new built-in read tools, append here. Anything else
 * (edit, write, task, todowrite, skill, ANY MCP server's tools
 * regardless of naming) terminates the session. Users can still register
 * MCP servers in their global OpenCode config — those tools just won't
 * be reachable from inside MudrikNow's subprocess.
 */
const BASE_ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  "read",
  "grep",
  "glob",
  "list",
  "webfetch",
  "websearch",
]);

/** Returns the effective allowlist. When readOnlyCommandsEnabled is true,
 *  `bash` is added for read-only command execution. */
function getAllowedTools(readOnlyCommandsEnabled: boolean): ReadonlySet<string> {
  if (!readOnlyCommandsEnabled) return BASE_ALLOWED_TOOLS;
  return new Set([...BASE_ALLOWED_TOOLS, "bash"]);
}

/**
 * Shell operators that must NEVER appear in a bash command string.
 * OpenCode's bash tool uses PowerShell on Windows — these are the
 * PowerShell operators that enable chaining, piping, redirecting, and
 * arbitrary command invocation. Any of these present → kill immediately.
 *
 * `;` — PowerShell statement separator (like & in cmd.exe)
 * `|` — pipe (can pipe to Set-Content, Out-File, etc.)
 * `>` — redirect / overwrite
 * `<` — input redirect
 * `&` — call operator (can invoke any script/executable: & 'C:\malware.ps1')
 *
 * NOT blocked (intentionally):
 * `^` — cmd.exe escape character; irrelevant in PowerShell
 * `(` `)` — common in legitimate paths (Program Files (x86))
 * `%` — PowerShell alias for ForEach-Object, but only after a pipe (| is blocked)
 * `$` — needed for $env:VAR expansion (PowerShell env var syntax)
 */
const BLOCKED_OPERATORS = [";", "&", "|", ">", "<"] as const;

/**
 * Commands that cause mutation and must NEVER run in read-only mode.
 * The AI is trusted via the system prompt to avoid writes/edits/deletes,
 * but this denylist is a hard safety net for the most dangerous commands.
 *
 * Checked as case-insensitive prefix matches against the first 1-3 tokens.
 * This is NOT exhaustive — the prompt + operator block are the primary
 * defense. The denylist catches accidental use of known mutating commands.
 *
 * MUST stay in sync with the OpenCode pattern permissions in the readonly.md
 * frontmatter (provisioned by config-store.ts#ensureAgentInWorkingDir).
 */
const MUTATING_COMMANDS: readonly string[] = [
  // --- PowerShell file mutation cmdlets ---
  "remove-item", "set-content", "add-content", "out-file",
  "new-item", "copy-item", "move-item", "rename-item",
  "set-item", "clear-content", "clear-item", "set-itemproperty",
  // --- PowerShell process/service mutation ---
  "stop-process", "stop-service", "start-service", "set-service",
  "start-process",
  // --- PowerShell network mutation ---
  "invoke-webrequest", "invoke-restmethod", "invoke-sqlcmd",
  // --- PowerShell system mutation ---
  "restart-computer", "stop-computer", "set-executionpolicy",
  // --- cmd.exe-style aliases (PowerShell aliases them to mutating cmdlets) ---
  "del", "erase", "rd", "rmdir", "mkdir", "md",
  "copy", "move", "ren", "rename", "format",
  // --- External mutating commands ---
  "taskkill", "shutdown", "reg", "sc", "schtasks",
  "diskpart", "cipher", "chkdsk",
  "net",  // net stop, net start, net user, etc.
  // --- Code execution (can run arbitrary mutating code) ---
  "node", "python", "python3", "py",
  "cmd", "powershell", "pwsh",
  "dotnet", "msbuild",
  // --- Package managers (mutate filesystem) ---
  "pip", "yarn", "cargo", "go",
  // --- curl/wget (can POST/PUT) ---
  "curl", "wget", "iwr",
];

/**
 * Git subcommands that mutate the repo — blocked specifically.
 * Read-only git subcommands (status, log, diff, etc.) are allowed.
 */
const MUTATING_GIT_SUBS: ReadonlySet<string> = new Set([
  "push", "commit", "merge", "rebase", "reset", "checkout", "switch",
  "stash", "pull", "clone", "add", "rm", "mv", "init",
  "cherry-pick", "revert", "archive", "bundle",
  "apply", "am", "bisect", "worktree",
]);

/** npm subcommands that mutate — blocked. npm list/ls are read-only. */
const MUTATING_NPM_SUBS: ReadonlySet<string> = new Set([
  "install", "i", "uninstall", "un", "update", "up", "upgrade",
  "rm", "remove", "add", "ci", "dedupe", "prune", "fund", "audit fix",
]);

/** Checks a bash command string against the operator block + mutating-command
 *  denylist. Returns a reason string if disallowed, null if allowed. */
export function detectDisallowedBashCommand(command: string | undefined): string | null {
  if (!command || typeof command !== "string") {
    return "empty or invalid command";
  }
  const cmd = command.trim();
  if (!cmd) return "empty command";

  // Layer 2: operator block — reject if any dangerous operator is present
  for (const op of BLOCKED_OPERATORS) {
    if (cmd.includes(op)) {
      return `command contains blocked operator "${op}"`;
    }
  }

  // Layer 3: mutating-command denylist — check first token(s)
  const tokens = cmd.split(/\s+/);
  const first = (tokens[0] || "").toLowerCase().replace(/\.exe$/i, "");

  // Check single-token mutating commands
  if (MUTATING_COMMANDS.includes(first)) {
    return `command "${first}" is a mutating command`;
  }

  // Check git subcommands
  if (first === "git") {
    const sub = (tokens[1] || "").toLowerCase();
    if (MUTATING_GIT_SUBS.has(sub)) {
      return `git ${sub} is a mutating git subcommand`;
    }
  }

  // Check npm subcommands
  if (first === "npm") {
    const sub = (tokens[1] || "").toLowerCase();
    if (MUTATING_NPM_SUBS.has(sub)) {
      return `npm ${sub} is a mutating npm subcommand`;
    }
  }

  return null; // allowed — not in denylist
}

function isDisallowedToolName(name: string, readOnlyCommandsEnabled: boolean): boolean {
  return !getAllowedTools(readOnlyCommandsEnabled).has(name.toLowerCase());
}

function detectDisallowedTool(event: OpenCodeEvent, readOnlyCommandsEnabled: boolean): string | null {
  if (event.type === "permission.asked") {
    const asked = event.properties?.permission;
    if (typeof asked === "string") {
      if (isDisallowedToolName(asked, readOnlyCommandsEnabled)) return asked;
      // Also check bash command on permission.asked — this fires BEFORE
      // execution, so catching here prevents the command from running.
      if (asked.toLowerCase() === "bash" && readOnlyCommandsEnabled) {
        const command = event.part?.state?.input?.command
          || (event.properties as any)?.input?.command
          || event.part?.state?.metadata?.command
          || (event.properties as any)?.command;
        if (command) {
          const reason = detectDisallowedBashCommand(command);
          if (reason) return `bash:${reason}`;
        }
      }
    }
  }
  const tool = event.part?.tool;
  if (typeof tool === "string") {
    if (isDisallowedToolName(tool, readOnlyCommandsEnabled)) return tool;
    // If bash is allowed, inspect the command string
    if (tool.toLowerCase() === "bash" && readOnlyCommandsEnabled) {
      // Check multiple paths — OpenCode events are inconsistent about where
      // the command lives depending on event phase (running vs completed)
      const command = event.part?.state?.input?.command
        || event.part?.state?.metadata?.command
        || (event.part?.state?.input as any)?.command;
      if (command) {
        const reason = detectDisallowedBashCommand(command);
        if (reason) return `bash:${reason}`;
      } else {
        // Log the event structure for debugging — helps diagnose cases where
        // the command is in a different field than expected
        log(`bash tool event — no command found in structured fields. Event keys: ${JSON.stringify(Object.keys(event.part?.state || {}))}`);
      }
    }
  }
  return null;
}

/**
 * Raw-line safety scan (last-resort backstop for the structured check).
 *
 * IMPORTANT: extract and inspect ONLY the bash command-input value — never the
 * surrounding tool OUTPUT. Read-only commands like `systeminfo` / `tasklist`
 * produce output that legitimately contains operators (e.g. ";" appears in
 * Windows OS-info text), and scanning the whole raw line killed those
 * legitimate queries on their own output. By checking just the command
 * string we still catch a genuinely chained/pipe/redirected command while
 * ignoring whatever the command prints.
 *
 * Only fires when readOnlyCommandsEnabled is true.
 */
function detectDisallowedBashInRawLine(line: string, readOnlyCommandsEnabled: boolean): string | null {
  if (!readOnlyCommandsEnabled) return null;
  // Quick check: must mention bash and a command field
  if (!line.includes('"bash"')) return null;
  if (!line.includes('"command"')) return null;
  // Extract each "command":"..." value and check ONLY those for operators.
  const re = /"command"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    let cmd = m[1];
    try { cmd = JSON.parse('"' + m[1] + '"'); } catch { /* keep raw */ }
    for (const op of BLOCKED_OPERATORS) {
      if (cmd.includes(op)) {
        return `bash:raw command contains blocked operator "${op}"`;
      }
    }
  }
  return null;
}
/** Exported for unit tests (raw-line bash backstop). */
export const _testDetectDisallowedBashInRawLine = detectDisallowedBashInRawLine;

export class OpenCodeClient {
  private sessionId: string | null = null;
  private freshSession: boolean = true;
  private model: string;
  private workingDir: string;
  private activeProcess: ChildProcess | null = null;
  private apiKeys: Record<string, string> = {};
  /**
   * Path to a MudrikNow-controlled `XDG_CONFIG_HOME` directory containing an
   * `opencode/opencode.json` with empty `mcp` (and no plugins/skills). When
   * set, it's injected into the spawn env so the OpenCode subprocess reads
   * OUR config instead of the user's global one — making any MCP servers
   * the user registered (Playwright, zai-mcp-server, etc.) invisible to
   * the AI MudrikNow runs. Provisioned via `ensureIsolatedOpenCodeConfig`.
   */
  private isolatedConfigDir: string | null = null;
  // When true, the bash tool is allowed with read-only command filtering.
  // Read live at event-inspection time so toggling the config flag takes
  // effect on the next message send.
  private readOnlyCommandsEnabled: boolean = false;
  /** Reasoning-effort variant passed as `--variant` to OpenCode. Empty string
   *  = provider default (no `--variant` arg). */
  private modelVariant: string = "";
  // True when the active process was killed via `kill()` (user clicked
  // Stop, or the idle-timeout fired). The close handler uses this to
  // suppress the silent-failure diagnostic — surfacing "model
  // unavailable / API key bad" right after the user deliberately
  // cancelled would be misleading and confusing.
  private killedByUser: boolean = false;

  constructor(
    model: string = "google/gemini-3.1-flash-lite",
    workingDir?: string,
    apiKeys?: Record<string, string>,
    isolatedConfigDir?: string,
    readOnlyCommandsEnabled?: boolean,
  ) {
    this.model = model;
    this.workingDir = workingDir || os.homedir();
    this.apiKeys = apiKeys || {};
    this.isolatedConfigDir = isolatedConfigDir || null;
    this.readOnlyCommandsEnabled = readOnlyCommandsEnabled || false;
    log(`OpenCodeClient created: model=${this.model}, dir=${this.workingDir}, keys=${Object.keys(this.apiKeys).length}, isolatedConfig=${this.isolatedConfigDir || "none"}, readOnlyCommands=${this.readOnlyCommandsEnabled}`);
  }

  updateModel(model: string): void {
    this.model = model;
    log(`Model updated to: ${model}`);
  }

  /** Replace the provider→key map used to inject env vars on spawn. */
  updateApiKeys(apiKeys: Record<string, string>): void {
    this.apiKeys = apiKeys || {};
    log(`API keys updated: providers=[${Object.keys(this.apiKeys).join(", ")}]`);
  }

  /** Toggle read-only command execution. Takes effect on the next message send. */
  updateReadOnlyCommands(enabled: boolean): void {
    this.readOnlyCommandsEnabled = enabled;
    log(`readOnlyCommandsEnabled updated: ${enabled}`);
  }

  /** Set the reasoning-effort variant for the current model. Takes effect on
   *  the next message send. Pass "" to use the provider default. */
  updateModelVariant(variant: string): void {
    this.modelVariant = variant || "";
    log(`Model variant updated: ${this.modelVariant || "(default)"}`);
  }

  resetSession(): void {
    this.sessionId = null;
    this.freshSession = true;
    log("Session reset — next message will start a NEW conversation (no --continue)");
  }

  hasSession(): boolean {
    return this.sessionId !== null;
  }

  setRestoredSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.freshSession = false;
    log(`Restored session: ${sessionId.slice(0, 30)}`);
  }

  sendMessage(prompt: string, onEvent: EventHandler, imageFiles?: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Reset per-send. Set to true by `kill()` if the user (or the idle
      // timeout) terminates the process; the close handler uses it to
      // suppress the "silent failure" diagnostic that would otherwise
      // mislead a deliberate cancellation.
      this.killedByUser = false;
      const opencodeBin = this.findOpenCodeBin();
      if (!opencodeBin) {
        const err = "Could not find opencode binary. Is it installed? (npm i -g opencode-ai)";
        log(err);
        onEvent({ type: "error", error: { message: err } });
        reject(new Error(err));
        return;
      }

      const args: string[] = [
        "run",
        "--format", "json",
        "--model", this.model,
        "--agent", "readonly",
      ];

      if (this.modelVariant) {
        args.push("--variant", this.modelVariant);
      }

      if (this.sessionId) {
        args.push("--session", this.sessionId);
        log(`Reusing session: ${this.sessionId.slice(0, 30)}`);
      } else if (this.freshSession) {
        this.freshSession = false;
        log("Starting new session (no --continue)");
      } else {
        args.push("--continue");
        log("Continuing last session (--continue)");
      }

      if (imageFiles && imageFiles.length > 0) {
        for (const img of imageFiles) {
          args.push("-f", img);
        }
        log(`Image files: ${imageFiles.length} - ${imageFiles.map(f => { const exists = fs.existsSync(f); return `${path.basename(f)}${exists ? "" : " (MISSING!)"}`; }).join(", ")}`);
      }

      const promptSnippet = prompt.slice(0, 80).replace(/\n/g, " ");
      log(`Spawning ${opencodeBin} ${args.join(" ")} (prompt: "${promptSnippet}...")`);

      // Use a minimal env (Windows essentials + provider keys) to avoid
      // the Bun 1.3.13 segfault triggered by Electron/Chromium-injected env
      // vars on Windows. Inheriting process.env wholesale crashes opencode
      // 1.14.x at startup (~1ms in, in the Windows loader).
      const cleanEnv = buildCleanOpenCodeEnv(process.env, this.apiKeys);
      // Override XDG_CONFIG_HOME so the spawn reads our isolated config
      // (no MCPs, no plugins) instead of the user's global one. Cuts off
      // Playwright / zai-mcp-server / any future-registered MCP server
      // before OpenCode ever learns it exists. The kill-switch in
      // detectDisallowedTool stays as a belt-and-suspenders second layer.
      if (this.isolatedConfigDir) {
        cleanEnv.XDG_CONFIG_HOME = this.isolatedConfigDir;
      }

      // opencode-ai ≤1.14.x ships a JS shim — must run via node.
      // opencode-ai ≥1.15.x ships a native binary — spawn directly.
      const isNativeBinary = opencodeBin.endsWith(".exe");
      const proc = isNativeBinary
        ? spawn(opencodeBin, args, {
            cwd: this.workingDir,
            stdio: ["pipe", "pipe", "pipe"],
            env: cleanEnv,
          })
        : spawn("node", [opencodeBin, ...args], {
            cwd: this.workingDir,
            stdio: ["pipe", "pipe", "pipe"],
            env: cleanEnv,
          });

      this.activeProcess = proc;
      let buffer = "";
      let errorOccurred = false;
      let resolved = false;
      const tSpawn = performance.now();
      let firstToken = true;
      // Accumulators for diagnostic when OpenCode bails silently (empty
      // error event, exit 0, no text streamed). Without these we just
      // logged "OpenCode error: undefined" and lost all signal — see
      // session ses_1de8b600cffeQGo3oslUB55e98 where model name
      // "ollama-cloud/kimi-k2.6:cloud" caused an instant provider
      // failure with no message.
      let stderrBuf = "";
      let textWasStreamed = false;
      let lastErrorEvent: any = null;

      proc.stdout!.on("data", (data: Buffer) => {
        buffer += data.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event: OpenCodeEvent = JSON.parse(trimmed);
            if (event.sessionID && !this.sessionId) {
              this.sessionId = event.sessionID;
              this.freshSession = false;
              log(`Captured sessionID: ${this.sessionId.slice(0, 30)}`);
            } else if (event.sessionID && this.sessionId && event.sessionID !== this.sessionId) {
              this.sessionId = event.sessionID;
              this.freshSession = false;
              log(`SessionID updated: ${this.sessionId.slice(0, 30)}`);
            }

            const blockedTool = detectDisallowedTool(event, this.readOnlyCommandsEnabled)
              || detectDisallowedBashInRawLine(trimmed, this.readOnlyCommandsEnabled);
            if (blockedTool) {
              const isBashBlock = blockedTool.startsWith("bash:");
              const msg = isBashBlock
                ? `Blocked: ${blockedTool.slice(5)}. Read-only mode — mutating commands and operators (; & | > <) are not allowed. Session terminated for safety.`
                : `Blocked: model attempted to use the "${blockedTool}" tool. MudrikNow only allows UI action markers. Session terminated for safety.`;
              log(msg);
              if (isBashBlock) {
                this.sessionId = null;
                this.freshSession = true;
                log("Session reset after bash block — next message starts fresh (prevents AI hallucinating from stale pre-block context)");
              }
              try { proc.kill("SIGKILL"); } catch (e: any) { log(`kill failed: ${e.message}`); }
        this.activeProcess = null;
        debugLog("opencode:total", performance.now() - tSpawn);
              errorOccurred = true;
              // Reject (don't resolve) so SEND_PROMPT's catch surfaces the
              // block via a single classified STREAM_ERROR. We deliberately do
              // NOT also emit via onEvent here — the rejection carries the
              // reason and the catch classifies it (BLOCKED) so the user sees
              // one clear "try rephrasing" message, not a duplicate generic
              // "something went wrong".
              if (!resolved) {
                resolved = true;
                reject(new Error(msg));
              }
              return;
            }

            // Track whether ANY text was streamed (so close-handler can
            // distinguish "silent failure" from "graceful empty response").
            if (event.type === "text" && event.part?.text) {
              textWasStreamed = true;
              if (firstToken) {
                firstToken = false;
                debugLog("opencode:first-token", performance.now() - tSpawn);
              }
            }
            // Capture raw error event for close-time diagnostic. Some
            // provider failures (bad model name, auth) come through as
            // {"type":"error","error":{}} with no message — log the raw
            // line so future debugging has SOMETHING to look at.
            if (event.type === "error") {
              lastErrorEvent = event;
              // A real error event means the run failed. Mark errorOccurred
              // so the close handler resolves (error already surfaced via
              // onEvent) instead of rejecting with a misleading "exit:N"
              // that would overwrite the real provider error.
              errorOccurred = true;
              const extracted = extractErrorMessage(event.error);
              if (!extracted) {
                log(`OpenCode error event with no message — raw line: ${trimmed.slice(0, 500)}`);
              }
            }

            onEvent(event);
          } catch {
            log(`Non-JSON line: ${trimmed.slice(0, 100)}`);
          }
        }
      });

      proc.stderr!.on("data", (data: Buffer) => {
        const msg = data.toString("utf-8");
        // Accumulate (capped) for close-time diagnostic surfacing.
        if (stderrBuf.length < 4000) stderrBuf += msg;
        const trimmed = msg.trim();
        if (trimmed) log(`stderr: ${trimmed.slice(0, 200)}`);
      });

      proc.on("error", (err) => {
        log(`Process spawn error: ${err.message}`);
        errorOccurred = true;
        onEvent({ type: "error", error: { message: `Failed to start OpenCode: ${err.message}` } });
        this.activeProcess = null;
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      proc.on("close", (code) => {
        log(`Process exited with code ${code}`);
        if (stderrBuf.trim()) {
          log(`stderr (${stderrBuf.trim().length} chars): ${stderrBuf.trim().slice(0, 500)}`);
        }
        if (buffer.trim()) {
          log(`close buffer (${buffer.trim().length} chars): ${buffer.trim().slice(0, 500)}`);
        }

        if (buffer.trim()) {
          try {
            const event: OpenCodeEvent = JSON.parse(buffer.trim());
            // Same tracking as in stdout handler.
            if (event.type === "text" && event.part?.text) textWasStreamed = true;
            if (event.type === "error") lastErrorEvent = event;
            onEvent(event);
          } catch {}
        }

        this.activeProcess = null;

        // Silent-failure path: OpenCode exited cleanly (code 0) but
        // streamed no text. Either a) it emitted an error event with
        // an empty message field (provider auth/model-name failure
        // — common with mistyped model names like
        // "ollama-cloud/kimi-k2.6:cloud"), b) it crashed without
        // emitting anything useful, or c) the model returned nothing.
        // Surface a useful message including any stderr we captured.
        //
        // BUT skip when the process was killed via `kill()` — the user
        // (or the idle timeout) deliberately cancelled. Surfacing
        // "model unavailable / check API key" after a deliberate Stop
        // is misleading. The caller already showed its own message
        // (Stop button → renders nothing; idle timeout → shows the
        // timeout message).
        if (this.killedByUser) {
          log(`Process was killed by user/timeout — skipping silent-failure diagnostic`);
        } else if (!textWasStreamed && !errorOccurred && (code === 0 || code === null)) {
          const stderrTail = stderrBuf.trim().slice(-800);
          const errorMsgFromEvent = extractErrorMessage(lastErrorEvent?.error);
          let diagnostic: string;
          // Lead with the MOST COMMON cause: transient provider issue.
          // OpenCode internally retries 5xx / network errors; if it
          // still emitted an empty error or exited silently, the
          // retries didn't help. Almost always "try again in a moment"
          // is the right next step — not "your model/API key is bad."
          // Configuration problems are real but rare and we'd usually
          // have a real error message from the provider in that case.
          if (errorMsgFromEvent) {
            diagnostic = errorMsgFromEvent;
          } else if (stderrTail) {
            diagnostic = `OpenCode failed silently. stderr: ${stderrTail}`;
          } else if (lastErrorEvent) {
            // Empty error event — usually a 5xx from the provider that
            // OpenCode couldn't extract a message from after exhausting
            // its retries.
            diagnostic = `Provider returned an error with no details — likely a temporary outage. Please try sending again.\n\nIf this keeps happening: check the model name and API key for "${this.model.split("/")[0]}" in ⚙ Settings.`;
          } else {
            // No error event at all, no text — the subprocess exited
            // cleanly with nothing to say. Same root cause space.
            diagnostic = `No response received. The provider may be temporarily unavailable — please try sending again.\n\nIf this keeps happening: check the model "${this.model}" and the API key for "${this.model.split("/")[0]}" in ⚙ Settings.`;
          }
          log(`Silent-failure diagnostic: ${diagnostic.slice(0, 300)}`);
          onEvent({ type: "error", error: { message: diagnostic } });
          errorOccurred = true;
        }

        if (!errorOccurred && !resolved) {
          resolved = true;
          if (code !== 0 && code !== null) {
            reject(new Error(`exit:${code}`));
          } else {
            resolve();
          }
        } else if (errorOccurred && !resolved) {
          resolved = true;
          resolve(); // error was already surfaced via onEvent
        }
      });

      log(`Writing prompt to stdin (${prompt.length} bytes)`);
      proc.stdin!.write(prompt);
      proc.stdin!.end();
    });
  }

  kill(): void {
    if (this.activeProcess) {
      log("Killing active OpenCode process");
      this.killedByUser = true;
      this.activeProcess.kill();
      this.activeProcess = null;
    }
  }

  private findOpenCodeBin(): string | null {
    return findOpenCodeBin();
  }
}

export function isNativeOpenCodeBin(bin: string): boolean {
  return bin.endsWith(".exe");
}

function getNpmGlobalPrefix(): string | null {
  try {
    const { execSync } = require("child_process");
    const prefix = execSync("npm config get prefix", { encoding: "utf-8" }).trim();
    log(`npm global prefix: ${prefix}`);
    return prefix;
  } catch {
    log("Could not determine npm global prefix");
    return null;
  }
}

export function findOpenCodeBin(): string | null {
  // opencode-ai ≤1.14.x ships a JS shim at bin/opencode (needs node).
  // opencode-ai ≥1.15.x ships a native binary at bin/opencode.exe (spawn directly).
  // We try both so MudrikNow works regardless of which version is installed.
  const candidates = process.platform === "win32"
    ? ["opencode.exe", "opencode"]
    : ["opencode"];

  const basePaths = [
    path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "opencode-ai", "bin"),
    path.join(os.homedir(), ".local", "share", "npm", "node_modules", "opencode-ai", "bin"),
    path.join("/usr", "local", "lib", "node_modules", "opencode-ai", "bin"),
  ];

  for (const base of basePaths) {
    for (const name of candidates) {
      const p = path.join(base, name);
      if (fs.existsSync(p)) {
        log(`Found opencode bin: ${p}`);
        return p;
      }
    }
  }

  const npmGlobalPrefix = getNpmGlobalPrefix();
  if (npmGlobalPrefix) {
    const globalBase = path.join(npmGlobalPrefix, "node_modules", "opencode-ai", "bin");
    for (const name of candidates) {
      const p = path.join(globalBase, name);
      if (fs.existsSync(p)) {
        log(`Found opencode bin via npm prefix: ${p}`);
        return p;
      }
    }
  }

  log("Could not find opencode binary in any known location");
  return null;
}