# AGENTS.md — Mudrik (hoverbuddy)

Compact, high-signal notes for OpenCode sessions working in this repo. For full architecture, threat model, and design specs, see [`CLAUDE.md`](CLAUDE.md).

> **Behavioral guidelines:** Also see [`.opencode/instructions.md`](.opencode/instructions.md).

## Critical Rule: Manual Approval Required

**NEVER commit, submit, push, publish, release, or delete any changes without explicit manual review and approval by the owner/user.** This covers git mutations, publishing, deleting files/branches/resources, PRs, merging, and deploying.

**Approval is per-request only.** *"commit and push now"* grants permission for that **specific action at that moment** — not blanket permission for future commits. Ask again before **every** git mutation unless the user has given a standing instruction.

## Behavioral Guidelines

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- Present multiple interpretations — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.

### 2. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
- Don't "improve" adjacent code, comments, or formatting.
- Match existing style. Don't refactor things that aren't broken.
- Remove only imports/variables/functions that YOUR changes made unused.

### 4. Goal-Driven Execution
- Define success criteria. Loop until verified.
- For multi-step tasks, state a brief plan with verification checks.

### General Coding Behavior
- **NEVER** use credentials, secrets, API keys, or sensitive configurations without explicit user permission.
- Keep comments concise and brief.
- When developing UI, check helper skills like impeccable.

## Update Summary Format
After making project updates, end every response with a bold bullet list:
- **Summary** — root cause, changes, notes
- **Files touched** — every file modified or created, with brief context
- **Pending actions** — manual follow-up needed (deploy, publish, migrate, restart)
- **Changes to review** — checklist of recent requirements/fixes to verify

## Context Gathering

Before any action — gather first; do not judge or assume.

### Every Session Start
- Read harness instruction files: `CLAUDE.md`, `AGENTS.md`, `.opencode/instructions.md`, etc.
- Restore from memory/local state after compaction events.

### Context Index
Maintain `context-index.md` at project root as a map of visible structure + hidden knowledge (codebase structure, hidden docs, conventions). Before every task, check if doc context is needed first. Never infer file contents — read explicitly.

### External Context & Post-Work Updates
When work depends on external context (schemas, APIs, SDKs), proactively offer to fetch and save it locally. After completing features/bugfixes, update requirements/specs/docs accordingly. Do not update README or published docs without offering first.

## Explaining Technical Concepts
- **Tell a technical story** with direct terminology (no metaphors).
- **Use diagrams** — ASCII art, shapes, connected ideas.
- **Organize logically** — parts, dependencies, execution sequence.
- **Emphasize critical, hard-to-assume parts**.

## TODOs
Maintain a side section or dedicated file (`open-items.md`) to track future tasks and reminders. If told to write to todos, just write — don't implement unless explicitly told to.

## Build & run

- `npm run build` — webpack bundles into `dist/`. **Required before launch** because `package.json > main` is `dist/main.js`.
- `npm start` — build + launch (`webpack && electron .`).
- `npm run dev` — webpack watch mode. Re-run `electron .` manually to pick up main/preload changes; renderer changes hot-reload on window reload.
- `npm test` — vitest, `src/**/*.test.ts` only. No linter or formatter is configured.
- `npm run pack:dir` — unsigned unpackaged build (`release/win-unpacked/`). Faster than `dist` for manual QA.
- `npx tsc --noEmit -p .` — standalone typecheck. CI runs this **before** `npm run build`.
- `npx vitest run <path>` — run a single test file (e.g. `src/main/action-executor.test.ts`).

### Build prerequisites (Windows only)

- **Node.js** — any recent LTS (20.x–24.x tested). `package-lock.json` was generated with a specific Node version; if `npm install` fails on native modules, remove `package-lock.json` and retry.
- **Visual Studio "Desktop development with C++" workload** — required because `robotjs` and `koffi` are native C++ modules. `node-gyp` needs the VC++ toolset + Windows SDK. Without it, `npm install` will fail at the `robotjs` compile step with `Could not find any Visual Studio installation to use`.
- **Do NOT use `npx electron .`** directly — it pulls the latest remote Electron version instead of the local `devDependency`. Always use `npm start` or `npm run build && electron .`.

### Runtime dependency (not bundled)

- **`opencode-ai` must be installed globally** — Mudrik spawns the `opencode` CLI binary at runtime. Install via `npm i -g opencode-ai`. The app searches `%APPDATA%/npm/node_modules/opencode-ai/bin/` for both `opencode.exe` (native, ≥1.15.x) and `opencode` (JS shim, ≤1.14.x).

## Architecture (the non-obvious parts)

- **Windows-only, end-to-end**. UIA, PowerShell script embedding, robotjs, GDI+ capture, and `findOpenCodeBin` path resolution are all Windows-specific. Do not add `process.platform` branches unless you are also porting the PowerShell layer.
- **Electron tray app** (`src/main/index.ts`). The panel is a frameless, transparent `BrowserWindow`. `window-all-closed` is suppressed so the tray icon survives.
- **Single-instance lock** — `app.requestSingleInstanceLock()` runs before `whenReady()`. A second launch fails to acquire the lock, short-circuits init, shows a native alert ("Mudrik is already running…") offering to close the running instance, then quits. The first instance logs `second-instance` events.
- **Startup splash** — optional owl-branded welcome overlay (`src/main/splash/`) shown on non-hidden launches when `Config.showSplashOnStartup` is true. Auto-dismisses after ~3.6 s or on click. Disabled on Windows auto-startup (`--hidden`). Has a debug trigger in the calibration window.
- **Nine webpack bundles** (see `webpack.config.js`). The four "core" ones are:
  1. `main.js` (`src/main/index.ts`) — main process.
  2. `preload.js` (`src/preload.ts`) — bridges `ipcRenderer` to renderer as `window.hoverbuddy`.
  3. `area-preload.js` (`src/main/area-preload.ts`) — preload for the fullscreen area-selection overlay.
  4. `renderer.js` (`src/renderer/index.tsx`) — React UI of the panel.
  Plus: guide-overlay preload/renderer, calibrate preload/renderer, splash-renderer.
- **`@shared/*` alias** maps to `src/shared/*`. The single source of truth for IPC event names, `ContextPayload`, `Action`, and `Config` types lives in `src/shared/types.ts`. When adding an IPC channel, add the name to the `IPC` object there, wire it in `src/preload.ts`, and handle it in `src/main/ipc-handlers.ts`.
- **`robotjs` and `koffi` are externals** in the main bundle (native modules).
- **`tsconfig.json` has `strict: true`** — typecheck failures are blocking in CI.
- **`postinstall` auto-prunes** cross-platform native binaries (`linux/`, `mac/` under `app-builder-bin` and `7zip-bin`). Do not remove `scripts/prune-platform-bins.js` from `package.json`.
- **Tests run in `node` environment** (`vitest.config.ts`) — there are no DOM or renderer-process tests.
- **electron-builder outputs to `release/`** (`electron-builder.yml > directories.output`). `asarUnpack` unpacks `robotjs` because its `.node` must load from a real disk path.

## Security & sandbox (never weaken accidentally)

- **Desktop actions are embedded markers, NOT tool calls**. The LLM may use OpenCode's read-only tools (`read`, `grep`, `glob`, `list`) for local file lookup, but **all desktop side effects** (click, type, paste, press keys, guide cursor) must flow through `<!--ACTION:{json}-->` markers in plain text. `parseActionsFromResponse` in `action-executor.ts` extracts them. When editing `SYSTEM_PROMPT` in `src/shared/prompts.ts`, keep this split intact — do NOT introduce a tool-call story for desktop actions, and do NOT widen the runtime tool allowlist.
- **Two-layer sandbox enforcement**:
  1. `.opencode/agent/readonly.md` is copied into the working dir on **every launch** by `config-store.ts#ensureAgentInWorkingDir` (overwrites, so updates propagate after upgrade).
  2. **Runtime kill-switch** (`opencode-client.ts#detectDisallowedTool`): inspects every JSON event streamed from OpenCode. If a `permission.asked` or `part.tool` event names anything outside the allowlist (`read`, `grep`, `glob`, `list`, `webfetch`, `websearch`), the subprocess is `SIGKILL`ed and a `Blocked: model attempted to use X` error surfaces.
- **IPC-level guard**: `validateAction` in `action-executor.ts` sanitizes every renderer-supplied action payload. Never wire a new IPC handler that forwards renderer-supplied actions to an executor without going through `validateAction`.

## Lazy-loaded modules (do not static-import)

- `src/main/guide/` — entirely lazy-loaded via dynamic `import()`. Nothing in this directory is statically referenced anywhere. A static import would pull `mouse-hook` + the overlay window into the cold-start path for users who never use Auto-Guide.
- `src/main/actions/action-executor-heavy.ts` — lazy-loaded for the same reason. The thin dispatcher (`action-executor.ts`) handles `copy_to_clipboard` inline and forwards everything else via `await import("./actions/action-executor-heavy")`.

## PowerShell as the UIA bridge

- `context-reader.ts`, `area-scanner.ts`, `vision.ts`, and `action-executor-heavy.ts` embed PowerShell scripts as string literals and write them to `%TEMP%/hoverbuddy/` on first use (see `powershell-runner.ts`).
- Script file names are versioned (`-v3`, `-v6`, etc.). Bumping the version string forces a rewrite of the cached `.ps1`, which is the mechanism to deploy PowerShell changes to already-installed users.
- Scripts write JSON output to a temp file (`-OutputFile`) rather than stdout. `runPowerShell` reads and deletes this file. Do not switch PS scripts back to stdout without understanding the encoding issues this pattern avoids.

## Config & state

- `Config.actionsEnabled` is the master switch for desktop-interactive actions. It is read **live** at execution time, never cached:
  - `validateAction` / `executeAction` read it directly.
  - The system-prompt `actionsBlock` is built fresh on every non-followup send (every Alt+Space / Ctrl+Space that captures new context, since `setContext` / `setAreaContext` flip `contextNeedsSending = true`).
  - Mid-conversation toggles do **not** auto-trigger a re-send. The new setting lands on the **next context capture**.
- `Config.autoGuideEnabled` follows the same live-read pattern at three layers: `buildSystemPrompt`, `validateAction`, and `executeAction`.
- `Config.apiKeys` is a `provider → key` map persisted in plaintext `config.json`. `buildProviderEnv` in `src/shared/providers.ts` translates it into env vars per the OpenCode convention (`anthropic` → `ANTHROPIC_API_KEY`). Existing shell-level env vars win over config.
- `saveConfig` writes to `%APPDATA%/mudrik/config.json`. `config-store.ts#migrateLegacyConfig` copies `%APPDATA%\hoverbuddy\` → `%APPDATA%\mudrik\` on startup for pre-rebrand installs. Do not rename legacy paths.

## OpenCode client

- `opencode-client.ts` spawns `opencode run --format json --agent readonly` as a child process per message.
- `--continue` or `--session <id>` is used for continuity. `resetSession()` clears the ID so the next send starts fresh. `setRestoredSession(id)` re-attaches.
- `activeProcess` tracks the current child so `STOP_RESPONSE` can `SIGKILL` it mid-stream.
- `findOpenCodeBin` resolves the CLI binary from known npm global paths. This is Windows-specific.

## Context & image lifecycle

- `computeContextHash` in `ipc-handlers.ts` deduplicates context to avoid re-sending the same element when the panel is reopened on the same UI.
- `cleanupImage` deletes the screenshot temp file when context changes. Always funnel image deletion through it rather than `fs.unlink` directly, so the bookkeeping for `currentContext.imagePath` / `areaImagePath` stays consistent.

## Release & CI

- `npm run check:no-env` is a leak guard. It scans `dist/` and `release/` for `.env` files and token-shaped strings (e.g., `OLLAMA_API_KEY`). It runs automatically before `npm run dist` and `npm run release`.
- `.github/workflows/build.yml`: `npm install` → `tsc --noEmit` → `npm run build` → `npm run check:no-env` → `electron-builder --win --dir`.
- `.github/workflows/release.yml`: same, plus `electron-builder --win --publish always` on `v*.*.*` tags.
- **Both workflows pin `runs-on: windows-2022`** — do NOT switch back to `windows-latest`. The `windows-latest` image now ships VS 18 (preview) which breaks node-gyp's Visual Studio detection, causing `robotjs` native compilation to fail. `windows-2022` has VS 2022 only and compiles cleanly.

### Version-bump checklist (when releasing a new version)

When changing the version number, update **all** of these files:

| File | What to change |
|------|----------------|
| `package.json` | `"version"` field |
| `package-lock.json` | **Two** fields: top-level `"version"` and `packages[""].version` |
| `CHANGELOG.md` | Add new `## [X.Y.Z] — YYYY-MM-DD` section at top + add compare link `[X.Y.Z]: ...compare/vPREV...vX.Y.Z` at the bottom |
| `index.html` + `docs/index.html` (on `gh-pages` branch) | Download button label, e.g. `"Mudrik X.Y.Z installer (.exe)"` — update in **both** root `index.html` and `docs/index.html` |
| Git tag `vX.Y.Z` | Create annotated tag and push — this triggers `release.yml` CI to build + publish the installer |

**Do NOT** hardcode the version in `README.md` — it uses a dynamic GitHub release badge. Only the files above need manual updates.

To release: commit the version bump on `master`, push, then `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`. The tag push triggers the release workflow.

## Private planning / development state (junctions to Mudrik-Plan)

Several auto-generated directories exist in the hoverbuddy root but are **not part of the public hoverbuddy repo**. They are tracked by the **private Mudrik-Plan repo** (`D:\SandBoX\Mudrik-Plan`) and surfaced here via **NTFS directory junctions** (Windows symlinks):

| Junction in hoverbuddy | Physical path (Mudrik-Plan) | Purpose |
|--------|--------|---------|
| `.impeccable/` | `D:\SandBoX\Mudrik-Plan\.impeccable` | Impeccable skill state |
| `.planning/` | `D:\SandBoX\Mudrik-Plan\.planning` | Internal planning docs, architecture notes, TODOs |
| `.claude/` | `D:\SandBoX\Mudrik-Plan\.claude` | Claude Code worktrees / session state |

**Rules for agents:**
- These folders are already in hoverbuddy's `.gitignore` — **never stage or commit them into hoverbuddy**.
- Treat them as read/write workspace for internal planning, drafting, and brainstorming.
- If a new skill/plugin creates another root-level folder that should follow the same pattern, add it to Mudrik-Plan, create a junction, and update `.gitignore`.

## Documentation rules

- **Internal docs** (`AGENTS.md`, `CLAUDE.md`, architecture notes, design specs) — auto-update without asking permission. Keep them in sync as part of the same task.
- **Public docs** (`README.md`, `docs/index.html`, `SECURITY.md`, `CONTRIBUTING.md`, release notes) — **never edit without proposing the change and getting explicit user approval first.** Suggest the edit, show what would change, wait for "yes."
- Internal planning docs live in the private Mudrik-Plan repo (`D:\SandBoX\Mudrik-Plan`). Specs at `Mudrik-Plan/docs/specs/`, plans at `Mudrik-Plan/docs/plans/`.

## Architecture deep-dive

### Request flow (pointer hotkey)

```
Alt+Space
  → hotkey.ts                  (global shortcut, robotjs for cursor pos)
  → index.ts#handlePointerActivate
  → context-reader.ts          (spawns powershell running a UIA script → JSON)
  → ipc-handlers.ts#setContext (stores ContextPayload, hashes to dedupe)
  → highlight.ts               (brief frameless overlay around the element)
  → panel window               (created or repositioned near cursor)
  → renderer receives CONTEXT_READY, user types a prompt
  → SEND_PROMPT → opencode-client.ts (spawns `opencode run --format json --agent readonly`)
  → streams JSON events back as STREAM_TOKEN / TOOL_USE / STREAM_DONE
  → action-executor.ts parses <!--ACTION:{...}--> markers from the text
  → EXECUTE_ACTION → UIA/robotjs performs the action, ACTION_RESULT goes back
```

The pointer hotkey captures UIA data only — no screenshot. Vision is opt-in via the renderer's 📸 button (`ATTACH_SCREENSHOT` IPC → `vision.ts#captureAndOptimize`). The area hotkey (`Ctrl+Space`) is pixel-based: `area-selector.ts` (fullscreen overlay drag) + `area-scanner.ts` (captures the region + scans contained UIA elements).

### Desktop actions are embedded markers, not tool calls

Central architectural decision in `src/shared/prompts.ts`. The LLM may use OpenCode's read-only tools (`read`, `grep`, `glob`, `list`) for local file lookup, but **all desktop side effects** (click, type, paste, press keys, guide cursor) must flow through `<!--ACTION:{json}-->` markers in the LLM's plain text. The app parses those markers via `parseActionsFromResponse` in `action-executor.ts`. When editing `SYSTEM_PROMPT`, keep this split intact — do NOT introduce a tool-call story for desktop actions, and do NOT widen the runtime tool allowlist beyond reads.

Action types are defined by the `ActionType` union in `src/shared/types.ts`. Each maps to a handler in `action-executor.ts` that uses either (a) PowerShell UIA scripts for element targeting by `automationId`/`selector`, or (b) `robotjs` for raw keyboard/mouse. UIA is strongly preferred — `click_element` is explicitly documented as "last resort".

### Action gating is live (no snapshot)

`Config.actionsEnabled` is the user's master switch for desktop-interactive actions (everything except `copy_to_clipboard`). It is read **live** in two places, never cached:

1. **Runtime action guards** — `EXECUTE_ACTION`, `RETRY_ACTION` all read `config.actionsEnabled` directly at execution time. Toggling the setting in ⚙ blocks (or unblocks) the very next action attempt, even mid-stream.
2. **System-prompt actionsBlock** — built fresh on every non-followup send (every Alt+Space / Ctrl+Space that captures new context). The block reads `config.actionsEnabled` at that moment.

Mid-conversation toggles do **not** auto-trigger a re-send. The new setting lands on the **next context capture** (Alt+Space / Ctrl+Space). Earlier turns may carry the opposite instruction in their history; the actionsBlock explicitly tells the model to trust the latest block over older ones.

If you add another setting that the model must see, build it into the same actionsBlock-style block so it refreshes naturally on every non-followup send.

### Auto-Guide mode (multi-step UI walkthroughs)

Opt-in feature, off by default (toggle in ⚙ → "Enable Auto-Guide"). When on, the AI walks the user through 3+ step UI tasks instead of doing them itself: shows an owl-wing pointer over each target, waits for the user to click, then captures the new screen state and decides the next step.

`src/main/guide/` is **entirely lazy-loaded** via dynamic `import()` — nothing in this directory is statically referenced anywhere; the modules don't enter the runtime graph until the user toggles the feature on AND the AI emits a `guide_*` marker. Same pattern as `src/main/actions/action-executor-heavy.ts` (lazy-loaded for read-only mode). Keep it that way: a static import here would pull `mouse-hook` + the overlay window into the cold-start path for users who never use the feature.

`buildSystemPrompt({ actionsEnabled, autoGuideEnabled })` in `src/shared/prompts.ts` composes three blocks: `BASE_PROMPT` (always) + `ACTION_PROMPT_FULL`/`ACTION_PROMPT_AWARE` + `GUIDE_PROMPT_FULL`/`GUIDE_PROMPT_AWARE`. The AWARE stubs (~50 words each) keep the model capability-aware when a feature is OFF — it knows the feature exists and can suggest enabling it, without spending tokens on the full instructions. When ON, the model gets the full constitution.

`Config.autoGuideEnabled` is read live at three layers, never cached:
1. `buildSystemPrompt` reads it on every non-followup send (same lifecycle as `actionsEnabled`).
2. `validateAction` in `action-executor.ts` blocks `guide_*` markers if false — the IPC-level guard against a forged renderer payload.
3. `executeAction` reads it from caller-supplied `cfg`, so toggling false mid-stream blocks the next guide marker even after the prompt was built with it true.

`src/main/guide/mouse-hook.ts` uses a Windows global low-level mouse hook (WH_MOUSE_LL) via PowerShell + C# `Add-Type`. It runs **only** during the `STEP_ACTIVE` phase of a guide session — started in `handleStep`, stopped on every transition out of STEP_ACTIVE. Scoped to the foreground HWND so panel clicks don't trigger it.

Full design rationale, state machine, prompt content, and edge cases live in `Mudrik-Plan/docs/specs/2026-05-03-auto-guide-design.md`.

### UIA context capture — how it works

The core capture flow (`context-reader.ts`):

1. **Wake Chromium**: Register a no-op UIA focus event handler → flips `UiaClientsAreListening()` to true in Chrome's process. Then send `WM_GETOBJECT` to the foreground HWND via `SendMessageTimeout`. This triggers Chrome to populate its full accessibility tree.
2. **Poll until stable**: `ShallowCount` (count elements at depth 0+1) every 100ms. Breaks when count stabilizes (same twice in a row) or after 5000ms.
3. **Find deepest element**: `FromPoint(X, Y)` gets the element at cursor, then `FindDeepestElement` drills into containers (Pane/Group/Custom/Document) to find the actual interactive element.
4. **Walk tree**: `CollectWindowTree` uses `TreeWalker.RawViewWalker` (not `FindAll`) to traverse children. `TreeWalker` crosses UIA fragment boundaries that `FindAll` misses — critical for iframes.
5. **Return**: element at cursor + full window tree + visible windows list.

**Key findings from iframe testing (2026-05-20):**

Test page with 7 iframes (srcdoc, local file, external domain, data:, javascript:, about:blank):
- **All 7 iframes had content in the UIA tree** — 254 total elements, 220 clickables
- Cross-origin iframes (example.com, Wikipedia) appear as **named Documents** (e.g. "Example Domain")
- Same-origin iframes appear as **unnamed Documents** but their children ARE in the tree
- `TreeWalker` is essential — `FindAll(Children)` misses iframe content in some Chromium versions
- The `DpiHelper` C# class only needs `SendMessageTimeout` + `GetForegroundWindow` + `SetProcessDPIAware`. `EnumChildWindows`/`WakeAllChildren` were tested and proven unnecessary.

**Known limitation — Dynamics CRM on-premise v8**: The CRM iframe (`contentIFrame0`) appears as `Document "Content Area"` with only 8 nested elements (container scaffolding only). The actual form fields are NOT exposed to UIA. This is a Dynamics-specific rendering issue, not a general iframe problem.

**Deep-dive reference**: `Mudrik-Plan/UIA-Chromium-Expert-Reference.md` — full UIA architecture, Chromium internals, wake-up mechanism, tree walking strategies, edge cases, CDP as alternative.

### API key plumbing

`Config.apiKeys` is a `provider → key` map persisted in `config.json` (plaintext — see comment on the field for the safeStorage trade-off). `src/shared/providers.ts#buildProviderEnv` translates the map into env vars per the convention OpenCode reads (`anthropic` → `ANTHROPIC_API_KEY`, `openai` → `OPENAI_API_KEY`, etc.) and is injected into both `OpenCodeClient.sendMessage` spawns and the `VALIDATE_MODEL` `opencode models` lookup. Existing shell-level env vars win over config — intentional, lets users override without editing the file.

`SAVE_API_KEY` IPC writes a single `provider/key` pair (empty key clears). There is no pre-flight validation — OpenCode has no test endpoint, so a bad key surfaces as a runtime error on first message send. The renderer exposes per-row "edit key" (✎) and "remove model" (×) actions in the settings panel for recovery.

### Config migration

`config-store.ts#migrateLegacyConfig` runs once at startup to copy `%APPDATA%\hoverbuddy\` → `%APPDATA%\mudrik\` for users upgrading across the rebrand. `logger.ts` falls back to the legacy log dir until the migration runs. Do not rename the legacy paths until pre-rebrand installs are presumed extinct.

### Startup sequence & single-instance guard

The main process boot order in `src/main/index.ts`:

1. **Single-instance lock** (`app.requestSingleInstanceLock()`) — runs *before* `whenReady()`. If the lock is not acquired (second launch), the app waits for `whenReady`, shows a native `dialog.showMessageBoxSync` alert ("Mudrik is already running… Use Alt+Space, Ctrl+Space, Alt+X, or the tray icon…"), then `app.quit()`. The first instance registers a `second-instance` handler that logs the event.
2. **`app.whenReady()`** — the primary instance proceeds. If `!gotTheLock` (shouldn't happen in the primary instance, but defensive), it returns early.
3. **Legacy config migration** → `loadConfig` → `ensureAgentInWorkingDir` → `pruneOldLogs(30d)` → `applyTheme` → `applyLoginItemSetting`.
4. **Splash screen** — if `!startedHidden && config.showSplashOnStartup`, `showSplashScreen()` displays the owl-branded overlay. Auto-dismisses after ~3.6 s (`setTimeout` in `splash-window.ts`) or on click. The splash does **not** block app init — it's a fire-and-forget overlay.
5. **First-run welcome dialog** (if `isFirstRun()`) — follows the splash.
6. **Tray + hotkeys + panel** — normal init.

The `--hidden` flag (set by Windows auto-startup) suppresses both the splash and the panel window. The splash is purely cosmetic; all functional init runs regardless.

### Session cleanup

`ipc-handlers.ts` deletes stale opencode sessions on startup via `cleanupOldSessions`. This spawns the detected opencode binary (`opencode.exe` directly for native, `node opencode` for the JS shim) — **not** through a `node` wrapper for the native binary. The previous implementation routed the native `.exe` through `node`, causing `MZx` garbage in stderr (the PE header bytes) and occasional delete failures. The fix in v1.9.0 spawns the native binary directly.

### Windows-only assumptions

This codebase is not cross-platform. UIA, PowerShell script embedding, robotjs build, DPI-aware GDI capture, and `findOpenCodeBin` path resolution are all Windows-specific. Don't add `process.platform` branches unless you're also porting the PS layer.

## Key files

| File | What it owns |
|------|--------------|
| `src/shared/types.ts` | IPC names, `ActionType`, `Config`, `ContextPayload` — single source of truth |
| `src/shared/prompts.ts` | `SYSTEM_PROMPT` template; `buildSystemPrompt()` composes BASE + ACTION + GUIDE blocks |
| `src/shared/providers.ts` | Provider→env-var mapping; `buildCleanOpenCodeEnv` (minimal env to avoid Bun segfaults) |
| `src/preload.ts` | `ipcRenderer` bridge exposed as `window.hoverbuddy` |
| `src/main/ipc-handlers.ts` | All IPC wiring, context formatting, auto-guide lazy init |
| `src/main/index.ts` | Main entry; single-instance lock, splash, window lifecycle, hotkey wiring, tray |
| `src/main/opencode-client.ts` | Spawns and streams from the `opencode` CLI binary |
| `src/main/action-executor.ts` | Marker parsing, validation, thin dispatcher |
| `src/main/config-store.ts` | Config persistence, legacy migration, agent-file provisioning |
| `src/main/splash/splash-window.ts` | Splash screen window lifecycle (create, auto-dismiss, close) |
