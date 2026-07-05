import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// The log file lives next to config.json under Electron's userData folder.
// We can't use `app.getPath("userData")` here because logger.ts is imported
// before app.ready — every module that logs on import would crash. Hardcode
// the path instead (Windows filesystem is case-insensitive, so "mudriknow"
// matches both the dev folder and the packaged "MudrikNow" folder).
const NEW_LOG_DIR = path.join(os.homedir(), "AppData", "Roaming", "mudriknow");
const NEW_LOG_FILE = path.join(NEW_LOG_DIR, "mudriknow.log");
// Pre-rebrand / stale log locations — scanned only for cleanup so we don't
// leave old hoverbuddy.log / mudrik/hoverbuddy.log files lying around.
const LEGACY_LOG_DIRS = [
  path.join(os.homedir(), "AppData", "Roaming", "mudrik"),
  path.join(os.homedir(), "AppData", "Roaming", "hoverbuddy"),
];

function pickLogFile(): string {
  if (fs.existsSync(NEW_LOG_DIR)) return NEW_LOG_FILE;
  return NEW_LOG_FILE; // always prefer the new location (created on first write)
}

const LOG_FILE = pickLogFile();

export function log(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trimEnd());
  try {
    // The dir may not exist yet on a truly first run (logger fires before
    // app.ready creates userData). Create it so appendFileSync doesn't throw.
    fs.mkdirSync(NEW_LOG_DIR, { recursive: true });
    fs.appendFileSync(NEW_LOG_FILE, line);
  } catch { /* can't write to log file */ }
}

/** Delete log files older than `maxAgeMs` in the current log dir AND the
 *  pre-rebrand legacy dirs (mudrik/, hoverbuddy/) so stale logs get cleaned
 *  up too. Called once on app startup. */
export function pruneOldLogs(maxAgeMs: number): void {
  const dirs = [NEW_LOG_DIR, ...LEGACY_LOG_DIRS];
  const now = Date.now();
  for (const dir of dirs) {
    let files: string[];
    try { files = fs.readdirSync(dir); } catch { continue; /* dir absent */ }
    for (const file of files) {
      if (!file.endsWith(".log")) continue;
      const full = path.join(dir, file);
      try {
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(full);
          console.log(`[LOGGER] Pruned old log: ${full}`);
        }
      } catch { /* skip unreadable files */ }
    }
  }
}
