import { app } from "electron";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { Config, DEFAULT_CONFIG } from "../shared/types";
import { log } from "./logger";

/**
 * One-shot rebrand migration: copy any config the user had under the old
 * `%APPDATA%\hoverbuddy\` folder into the new `%APPDATA%\mudrik\` (or
 * `Mudrik\` when packaged) folder that Electron now resolves
 * `app.getPath("userData")` to.
 *
 * Runs BEFORE loadConfig on app startup. Safe to run every launch:
 *   - if the new config already exists, does nothing
 *   - if there's no old folder at all, does nothing (fresh install)
 *   - if only the old folder exists, copies config.json + the log file
 *
 * Leaves the old folder on disk so users can still find it if they want
 * to roll back. Can be removed once a few minor releases have shipped.
 */
export function migrateLegacyConfig(): void {
  try {
    const newDir = app.getPath("userData");
    const newConfig = path.join(newDir, "config.json");
    if (fs.existsSync(newConfig)) return; // already migrated or fresh new install

    const legacyDir = path.join(os.homedir(), "AppData", "Roaming", "hoverbuddy");
    const legacyConfig = path.join(legacyDir, "config.json");
    if (!fs.existsSync(legacyConfig)) return; // nothing to migrate

    fs.mkdirSync(newDir, { recursive: true });
    fs.copyFileSync(legacyConfig, newConfig);
    log(`migrateLegacyConfig: copied ${legacyConfig} -> ${newConfig}`);

    // Also carry over the log file so users keep their history on first launch
    // after the rebrand. Best-effort — don't fail migration if this trips.
    const legacyLog = path.join(legacyDir, "hoverbuddy.log");
    const newLog = path.join(newDir, "hoverbuddy.log");
    if (fs.existsSync(legacyLog) && !fs.existsSync(newLog)) {
      try { fs.copyFileSync(legacyLog, newLog); } catch (e: any) {
        log(`migrateLegacyConfig: log copy skipped (${e.message})`);
      }
    }
  } catch (err: any) {
    log(`migrateLegacyConfig FAILED (non-fatal): ${err.message}`);
  }
}

/**
 * Ensure the sandboxed OpenCode agent definition exists in the given working
 * directory. OpenCode 1.4.x discovers agents by scanning `.opencode/agent/`
 * in the CWD, so we copy `readonly.md` out of the packaged resources the
 * first time we see a working dir that doesn't have one. Overwrites on each
 * launch so updated versions of the agent propagate on upgrade.
 */
export function ensureAgentInWorkingDir(workingDir: string): void {
  try {
    // In dev, `process.resourcesPath` points at Electron's own resources —
    // our source agent lives next to the repo root. In a packaged install it
    // points at the NSIS install dir's `resources/.opencode/agent/readonly.md`.
    const packagedSrc = path.join(process.resourcesPath, ".opencode", "agent", "readonly.md");
    const devSrc = path.resolve(__dirname, "..", ".opencode", "agent", "readonly.md");
    const src = fs.existsSync(packagedSrc) ? packagedSrc : devSrc;
    if (!fs.existsSync(src)) {
      log(`ensureAgentInWorkingDir: source agent missing at ${packagedSrc} and ${devSrc}`);
      return;
    }
    const destDir = path.join(workingDir, ".opencode", "agent");
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, "readonly.md");
    fs.copyFileSync(src, dest);
    log(`readonly agent provisioned at ${dest}`);
  } catch (e: any) {
    log(`ensureAgentInWorkingDir FAILED (non-fatal): ${e.message}`);
  }
}

/**
 * Provision an ISOLATED OpenCode config directory under Mudrik's userData
 * so the OpenCode subprocess Mudrik spawns reads OUR config — empty MCPs,
 * no plugins, no skills — instead of the user's global one at
 * `~/.config/opencode/opencode.json`. The user's global config can keep
 * registering Playwright, zai-mcp-server, superpowers, anything else they
 * use for direct `opencode run` invocations; those will simply be invisible
 * to Mudrik's spawn because XDG_CONFIG_HOME is overridden in the spawn env.
 *
 * This is the "stop it from root" fix: relying on the AI to obey prompts
 * is brittle (it kept reaching for playwright_browser_*); cutting off the
 * tool registration before OpenCode even starts is bulletproof.
 *
 * Returns the directory to use as `XDG_CONFIG_HOME`. Per XDG, OpenCode
 * looks for `$XDG_CONFIG_HOME/opencode/opencode.json`, which is the file
 * we write here.
 */
export function ensureIsolatedOpenCodeConfig(workingDir: string): string {
  const xdgConfigHome = path.join(workingDir, "opencode-config");
  try {
    const opencodeDir = path.join(xdgConfigHome, "opencode");
    fs.mkdirSync(opencodeDir, { recursive: true });
    const configPath = path.join(opencodeDir, "opencode.json");
    // Minimal config with explicit empty mcp. Plugins / skills are not set
    // (default empty). Overwrites every launch so updates propagate.
    const minimal = {
      $schema: "https://opencode.ai/config.json",
      mcp: {},
    };
    fs.writeFileSync(configPath, JSON.stringify(minimal, null, 2), "utf-8");
    log(`isolated opencode config provisioned at ${configPath} (XDG_CONFIG_HOME=${xdgConfigHome})`);
  } catch (e: any) {
    log(`ensureIsolatedOpenCodeConfig FAILED (non-fatal): ${e.message}`);
  }
  return xdgConfigHome;
}

/**
 * Default opencode data location. Used after the XDG_DATA_HOME isolation was
 * removed — Mudrik's opencode subprocesses now share the same data dir as a
 * user's standalone `opencode` CLI invocation, so `opencode session list`
 * finds Mudrik's sessions without any env-var gymnastics.
 */
export function getDefaultOpenCodeDataDir(): string {
  const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgData, "opencode");
}

/**
 * One-time migration: move any opencode data that previous Mudrik versions
 * stored under isolated paths to the default opencode data dir. Old paths:
 *   - <workingDir>/opencode-data/opencode/   (original isolation)
 *   - <workingDir>/opencode/                  (intermediate layout)
 * If the default dir already has data (user used the opencode CLI directly
 * before), the old isolated dirs are simply removed — newer Mudrik data
 * is expected to be in the default dir.
 */
export function migrateIsolatedOpenCodeDataToDefault(workingDir: string): void {
  const defaultDataHome = getDefaultOpenCodeDataDir();
  const oldSources = [
    path.join(workingDir, "opencode-data", "opencode"),
    path.join(workingDir, "opencode"),
  ];
  for (const src of oldSources) {
    if (!fs.existsSync(src)) continue;
    try {
      if (!fs.existsSync(defaultDataHome)) {
        fs.mkdirSync(path.dirname(defaultDataHome), { recursive: true });
        fs.cpSync(src, defaultDataHome, { recursive: true });
        log(`Migrated opencode data: ${src} -> ${defaultDataHome}`);
      } else {
        log(`Default opencode data already exists; removing old isolated dir: ${src}`);
      }
      fs.rmSync(src, { recursive: true, force: true });
    } catch (e: any) {
      log(`Migration from ${src} failed: ${e.message}`);
    }
  }
  const oldParent = path.join(workingDir, "opencode-data");
  try { fs.rmdirSync(oldParent); } catch { /* not empty, ignore */ }
}

/**
 * Persisted config lives at `<userData>/config.json`. Writes are atomic
 * (write to `.tmp`, then rename) so a crash mid-write can't leave a
 * corrupt file that bricks startup. Unknown fields from future versions
 * are preserved; missing fields are backfilled from DEFAULT_CONFIG.
 */

let configPath: string | null = null;

function getConfigPath(): string {
  if (configPath) return configPath;
  configPath = path.join(app.getPath("userData"), "config.json");
  return configPath;
}

export function loadConfig(): Config {
  const p = getConfigPath();
  const defaults: Config = {
    ...DEFAULT_CONFIG,
    workingDir: app.getPath("userData"),
  };

  if (!fs.existsSync(p)) {
    log(`Config file not found at ${p} — using defaults`);
    return defaults;
  }

  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      log(`Config at ${p} is not an object — using defaults`);
      return defaults;
    }
    const merged: Config = { ...defaults, ...parsed };
    // Coerce: don't let a missing recentModels strand the UI
    if (!Array.isArray(merged.recentModels) || merged.recentModels.length === 0) {
      merged.recentModels = [merged.model];
    }
    log(`Config loaded from ${p}`);
    return merged;
  } catch (err: any) {
    log(`Config read failed (${err.message}) — using defaults`);
    return defaults;
  }
}

export function saveConfig(config: Config): void {
  const p = getConfigPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tmp, p);
    log(`Config saved to ${p}`);
  } catch (err: any) {
    log(`Config write FAILED (${err.message})`);
  }
}

export function isFirstRun(): boolean {
  return !fs.existsSync(getConfigPath());
}
