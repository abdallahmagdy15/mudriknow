# Changelog

All notable changes to Mudrik are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.4] - 2026-06-21

### Changed
- **Public features distilled to five headline capabilities.** The README and landing page now present five clearly-ordered features — *Sees the UI under your cursor*, *Acts on elements for you*, *Guides you through multi-step tasks*, *Quick chat without context*, and *Works with any LLM* — instead of the previous seven-row table that buried the headline behind secondary detail (cursor-anchored positioning, area capture). Quick chat mode is now a first-class feature row; web search remains implied under the any-LLM block.
- **Area Capture temporarily hidden.** The Ctrl+Space area-selection hotkey, its settings row, the splash shortcut pill, and the system-prompt mention are all removed from the user-facing surface. `registerArea()` in `src/main/hotkey.ts` is now a no-op that returns success, so the registration call site is unchanged and the full area-selection pipeline (`area-selector.ts`, `area-scanner.ts`) remains on disk for a future re-enable. The welcome dialog and calibrate splash preview now use the Quick-chat hotkey in place of the area hotkey.

## [1.12.3] - 2026-06-21

### Fixed
- **Guide mode killed on transient OpenCode failures.** When a guide follow-up triggered a silent provider failure (OpenCode exited with no text), Mudrik injected "Guide cancelled." and destroyed the active guide. The real AI reply then arrived on Retry, but `guide_step` was rejected because the guide was already dead. `sendFollowUp()` in `src/main/ipc-handlers.ts` now distinguishes empty/failed responses from genuine replies: silent failures keep the guide alive in `awaiting-ai` so Retry continues the walkthrough; replies without guide markers end the guide gracefully using the actual AI text instead of the fake cancellation message. Added `endWithReply()` and `setAwaitingAICaption()` to `GuideController`, plus localized strings in `src/shared/i18n.ts`.

## [1.12.2] - 2026-06-20

### Fixed
- **Web search never worked.** `websearch` was listed as allowed in the agent sandbox, the runtime kill-switch allowlist, and the system prompt — but OpenCode only registers its built-in `websearch` tool when the provider is `opencode/*` OR the `OPENCODE_ENABLE_EXA` environment variable is truthy. Mudrik spawns arbitrary providers (Anthropic, OpenAI, Kimi, DeepSeek, …) and never set that env var, so the tool was absent from the agent's tool map. The model honestly told users "I can't search the web" even though every other layer permitted it. `webfetch` was unaffected (needs no flag). Fixed by setting `OPENCODE_ENABLE_EXA=1` in `buildCleanOpenCodeEnv` (`src/shared/providers.ts`), which is the single env-builder used by all five OpenCode spawn sites. No API key required (Exa hosted MCP). Added a regression test in `src/shared/providers.test.ts`.

## [1.12.1] - 2026-06-19

### Fixed
- **Splash screen not showing on Windows startup.** The splash was skipped when `--hidden` was passed (Windows auto-startup), leaving a bare Electron taskbar icon with no visual feedback. Now the splash shows on every launch regardless of `--hidden` — the flag only suppresses the panel window, not the splash.

## [1.12.0] - 2026-06-19

### Added
- **Auto-expanding chat input.** The chat input grows from 2 lines to a maximum of 5 lines as the user types, then scrolls internally beyond that — no more truncated multi-line prompts.
- **Quick-chat hint overlay with dismiss.** The quick-chat mode hint now appears as an overlay at the top of the messages container with a dismiss X button, instead of a separate banner below the header.
- **Debug screenshot persistence.** In debug mode (non-packaged builds), every captured screenshot is copied to `%TEMP%/hoverbuddy/debug-screenshots/` with a timestamp and grid/nogrid tag, and the path is logged — so you can verify grid accuracy.

### Changed
- **Larger default panel.** Panel width increased from 35% to 38% of the work area, height from 69% to 74% — more room for conversation and options.
- **Thinking/Replying status color.** Replaced the cyan status pill with a warm cream tone (`#8B6F3E`) that harmonizes with the app's gold/orange theme.
- **Guide bubble primary button.** Replaced the hard-to-read orange gradient + white text with a subtle orange-tinted background + dark amber text for clear contrast.
- **Capture/Release buttons.** Capture Context button and captured badge now share consistent height and styling. The release X is now a visible bordered chip with red tint and hover state.
- **Primary color slightly darker.** `--primary` and `--beak` darkened from `#F2A93A` to `#E89423` for better contrast against faded orange backgrounds.
- **Cancel button distinct red.** Guide mode Cancel button now uses clear red (`#dc2626`) instead of the dusty rose that looked orange like the Start Guide button.

### Fixed
- **Guide mode broken since v1.10.0.** The `guide_offer` marker chunk was dropped from `fullResponseText` during streaming detection, so `parseActionsFromResponse` never saw it — no guide offer, no owl cursor, no walkthrough. Fixed by accumulating the chunk before returning.
- **Grid lines washed out by capture overlay.** The cinematic capture overlay's dim was visible in the screenshot, hiding the grid lines. Fixed by hiding the overlay before screenshot capture with an 80ms delay. Grid line alpha also bumped from 50 to 95 for better contrast.
- **Release context wiped the chat.** Clicking the X beside Capture Context reset the opencode session and cleared all messages. Now it only clears the badge/screenshot; the conversation continues as a normal follow-up.
- **"Scanning" top bar in guide mode.** Removed a dead loading bar element that was always visible due to missing CSS.
- **Cancel button text matching.** Guide options no longer rely on fragile text matching for Cancel — the runtime injects a localized Cancel button based on the user's language (en/ar), and the AI is instructed not to include it.
- **"Something else" redundancy.** Removed the "Something else" injected option — the user can type custom text directly in the chat input, making the button redundant.
- **Panel shown during guide walkthrough.** Restored correct behavior: the panel stays hidden during guide steps (owl bubble shows options); it only reappears on cancel/complete.
- **Prompt stale references.** Fixed "Attach Screenshot button" → "Capture Context", "blue owl" → "gold/orange owl", stale `boundsHint` → `uiaBounds`/`guessBounds`, and screenshot availability description.
- **Non-multimodal model detection.** Prompt now instructs the AI to tell the user to switch to a multimodal model if it can't see images.

## [1.11.0] - 2026-06-18

### Added
- **Capture Context button.** A single button replaces the old Attach Screenshot action: it always captures both the UIA element tree at the cursor and a full-screen screenshot with a coordinate grid, covering Chromium/File Explorer/PDF edge cases uniformly. A badge shows when context is captured; an X button releases it.
- **Cinematic capture overlay.** Alt+Space and manual capture now show a lightweight full-screen camera-focus overlay (corner brackets + pulsing focus ring) instead of a panel flash, so capture feels deliberate and polished.
- **Quick Chat mode hint.** When the panel opens without context (Alt+X or tray), a concise dismissible hint tells the user they're in quick-chat mode; the header status pill reflects `Quick chat`, `Watching`, `Thinking`, or `Replying`.
- **Calibration hero preview.** A dev-only window for evaluating the owl mascot at real sizes (logo, splash, tray, pointer) before exporting assets.

### Changed
- **Splash screen is always shown on startup.** The user-facing "Show splash on startup" setting has been removed; the splash is now mandatory.

### Fixed
- **Release context no longer wipes the current chat.** Clicking the X beside Capture Context used to reset the opencode session and clear all visible messages, starting a brand-new chat. It now only clears the captured-context badge and screenshot while preserving the conversation — the next message continues the existing session as a normal follow-up.

## [1.10.0] - 2026-06-18

### Added
- **Instant first step in Auto-Guide.** The AI now emits the first guide_step together with guide_offer in a single response; Mudrik executes it immediately when the user taps Start guide, removing the previous capture + AI round-trip delay.
- **Guide prompt speed-up rules.** Guide mode now instructs the AI to be brief, avoid overthinking, and combine up to two trivially obvious actions into one step (e.g. right-click the file, then click Rename).
- **Localized guide cancellation message.** Guide cancelled. / تم إلغاء الإرشاد. is shown in the chat when the user cancels a guide.

### Changed
- **Pointer hotkey UX.** Alt+Space now shows only a centered Scanning screen spinner overlay while UIA and screenshot capture run; the full panel appears only once the context is ready. This removes the visible panel open-hide-reopen flash and the random highlight rectangle during capture.
- **Suppress guide preamble text.** Once a guide_offer marker is detected in the streamed response, preamble text is no longer rendered as chat bubbles; the guide UI takes over cleanly.

## [1.9.1] — 2026-06-18

### Added
- **Aurora-style UI background.** Subtle, slow-moving cyan/gold gradient layers behind the panel and splash screen, theme-aware for both light and dark modes.
- **Surface aurora tint.** Messages, settings panel, settings sections, and chat input are softly tinted so the aurora background visually bleeds through without real translucency (which breaks the transparent Electron window).
- **Theme-scrolled top shadow.** The messages container's top fade now uses the chat area's own main color for a softer blend in both themes.

### Changed
- **Message bubbles shrink to fit content** instead of spanning the full row width, preventing oversized empty boxes when the panel is maximized.
- **Light-mode orange/gold aurora reduced** to keep the palette subtle on the light background.

## [1.9.0] — 2026-06-17

### Added
- **Startup splash screen.** A lightweight owl-branded welcome overlay appears on launch with quick tips, keyboard shortcuts, and a ready indicator. Click anywhere (or wait ~3.6 s) to dismiss.
- **"Show splash on startup" setting** in ⚙ Behavior — splash can be disabled entirely.
- **Debug splash trigger** in the calibration window for fast UI iteration.
- **Single-instance guard.** Launching a second Mudrik process now shows a native alert ("Mudrik is already running…") and exits instead of starting a duplicate instance.

### Fixed
- **Session cleanup with native `opencode.exe`.** Cleanup now spawns the detected native binary directly instead of routing through `node`, fixing the `MZx` stderr noise and occasional delete failures on `opencode-ai` ≥ 1.15.x.

## [1.7.0] — 2026-06-11

### Fixed
- **"opencode not found" in Settings when opencode-ai >=1.15.x.** The model-validation path used a stale copy of `findOpenCodeBinPath()` that only searched for the JS shim (`opencode`), not the native binary (`opencode.exe`). Extracted a single shared `findOpenCodeBin()` function with comprehensive search paths and `isNativeOpenCodeBin()` helper; fixed all 5 call sites (`VALIDATE_MODEL`, `RESTORE_SESSION`, `GET_RECENT_CHATS`, `cleanupOldSessions`) to auto-detect native vs JS shim and invoke correctly.

### Added
- **Build prerequisites** documented in `AGENTS.md` (Node.js LTS 20-24, Visual Studio "Desktop development with C++" workload for `robotjs`/`koffi` native compilation).
- **Runtime dependency** documented in `AGENTS.md` — `npm i -g opencode-ai` is required; the app searches `%APPDATA%/npm/node_modules/opencode-ai/bin/` for both `opencode.exe` and `opencode`.

## [1.6.0] — 2026-06-10

### Added
- **Quick-chat hotkey (`Alt+X`).** Opens the panel instantly without capturing UIA context, screenshot, or loading spinner. Pure chat mode — no element awareness needed. Rebindable from ⚙ settings.

### Changed
- **Log pruning on startup.** Log files older than 30 days are auto-deleted on every launch to prevent unbounded disk growth.
- **README rewrite.** Tagline updated to include Auto-Guide, hotkeys table tightened, "What it does" refreshed with Chromium auto-screenshot info, features restructured, "How it works" diagram expanded, roadmap removed, privacy table fixed for current screenshot behavior.
- **Website (`docs/`) refreshed** to match README: updated tagline, features, hotkeys (added Alt+X), privacy section. Removed vestigial "Reads files" card, "EN+AR" card, "How it works" code section, version badge, and "signed installer" claim. Nav trimmed to 4 links.

## [1.5.0] — 2026-06-04

### Changed
- **UIA context capture rewritten** — `context-reader.ts` PowerShell script (v22→v28):
  - `GetChildren` uses pure `TreeWalker` instead of `FindAll(Children)` — reliably traverses iframe fragment boundaries
  - `CollectWindowTree` never skips `Document` elements as scaffolding — iframe containers always visible in tree
  - Chromium wake-up always fires (was skipping when main Document already existed, preventing iframe renderer wake)
  - `DpiHelper` C# class simplified to 3 methods (was 7) — removed `EnumChildWindows`, `WakeAllChildren`, `GetClassName`, delegate
  - `TREE_BUDGET_MS` raised from 2500 to 5000ms
  - `TextPattern`/`ValuePattern` removed from `ElDict` for tree-walk elements (only cursor gets deep text via `GetDeepValue`)
  - Fixed missing `"@` here-string terminator that caused entire script to fail
- **Area-scanner** (`area-scanner.ts` v8→v11):
  - `GetChildren` uses pure `TreeWalker`
  - Added UIA focus handler registration for standalone Chromium wake-up
  - `ControlType.Document` added to container types
- **Action executor** (`action-executor-heavy.ts`):
  - `GetChildren` uses pure `TreeWalker` in both find-element (v9→v10) and UIA-action (v4→v5) scripts
- **Calibration tool simplified** — removed multi-strategy diagnostic (desktop scan), restored single-strategy with 50 samples
- **Auto-Guide mode** — Step-by-step walkthroughs with an owl cursor that points to each target and shows step-by-step instructions in a speech bubble. Panel hides during guide sessions. Coordinate grid overlay on screenshots.
- **High-DPI multi-monitor support** — Pixel-perfect coordinates on any display configuration.
- **Timestamp support** — Sessions carry creation timestamps for the recent-chats picker.

### Fixed
- `HasDocumentElement` used invalid `[ControlTypeCondition]::Document` syntax — always threw, causing Chromium wake-up to wait full 2500ms. Fixed to use `PropertyCondition`.
- OOPIF fragment walk from `RootElement` was unnecessary complexity — test proved `TreeWalker` from `FromHandle(hwnd)` already captures iframe content for normal pages
- Area-scanner had no wake-up logic — Chromium returned skeleton tree (5 elements). Added focus handler registration.

## [0.9.0] — 2026-04-24 (Preview)

First public preview release. Pre-v1 — breaking changes possible while the API surface stabilises and we collect feedback.

### Added
- **Multi-provider API key management**. `Config.apiKeys` (provider → key map) injected into OpenCode subprocess env vars via `src/shared/providers.ts`. New `SAVE_API_KEY` IPC + inline "API key for `<provider>`" input in the Model settings section. Per-row ✎ edit + × remove on recent models.
- **Arabic / English i18n** with full RTL support (`Config.lang`, `src/shared/i18n.ts`). Root element flips `dir="rtl"` when Arabic is selected.
- **Frosted glass panel** via native Windows acrylic (`setBackgroundMaterial`) + DWM rounded corners (`DwmSetWindowAttribute` via `koffi`). Electron upgraded 33 → 35.
- **Error boundary** around the React root with a localized crash screen + restart button.
- **Collapsible settings sections** — Model + Hotkeys collapsed by default; Appearance + Behavior expanded. Summary shown in each header.
- **Read-only tool access** for the LLM: `read`, `grep`, `glob`, `list` are now permitted so the model can look up on-disk docs when a question requires them. Write/execute tools (`bash`, `edit`, `write`, `webfetch`, `websearch`, `task`, `todowrite`, `skill`) remain hard-blocked by the runtime kill-switch.
- Contact / About section in README (GitHub, X, LinkedIn, email).
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
- This `CHANGELOG.md`.

### Changed
- README trimmed and restructured for open-source launch.
- `CONTRIBUTING.md` now owns the full Develop + Release pipeline sections.
- Settings dropdown `max-height` tightened to `calc(100vh - 76px)` so it never overflows the panel frame.
- Long stream-error strings (>120 chars) are replaced with a localized friendly message; full error still goes to the renderer console.

### Fixed
- `restoreSessionOnActivate` was ignored on first launch because `CONTEXT_READY` fired before `getConfig()` resolved. Added `configLoadedRef` to gate restore until config is loaded.
- When restore is OFF, messages now clear on every re-activation instead of being kept by the `prev.length > 0` shortcut.

### Removed
- `telemetryEnabled` config field (never wired; removing the placeholder).
- `docs/ROADMAP.md` from the public repo (internal planning lives elsewhere).

## [Internal] — rebrand

### Changed
- HoverBuddy → **Mudrik** (مدرك — Arabic for "perceiver"). User-facing strings, installer artifacts, and config paths migrated. Repo folder stays `hoverbuddy/` for compatibility.
- On-disk config path `%APPDATA%\hoverbuddy\` → `%APPDATA%\mudrik\`, with one-shot migration on first launch.
- Refined owl mascot: steel-blue palette, layered wings, golden eyes, curved ear tufts, circle-shaped blink.

### Added
- Retry button on response errors (`lastPromptRef` captures the last prompt).
- `actionsEnabled` master toggle (replaces `autoClickGuide`). Snapshotted at session start; system prompt advises the user to start a new conversation to change it mid-flow.
- Send button with up-arrow icon in the chat input.
- Option to disable chat-session restoration on popup.

### Fixed
- `robot.keyTap("v", ["control"])` broken on robotjs 0.7.0 — replaced with explicit keyToggle chord + PowerShell fallback.
- Copy-chip state keyed per-chip so duplicate text doesn't toggle every chip.
- Settings dropdown is scrollable and never exceeds panel height.
- Session-history replay preserves `<!--ACTION:...-->` markers (renderer hides them visually).
- Area-capture DPI mismatch (DIPs → physical pixels via `display.scaleFactor`).
- First-activation context-drop race (preload-level buffer replays `CONTEXT_READY`).
- Stale previous-context bug (monotonic `activationSeq` drops superseded reads).
- Auto-screenshot on Alt+Space removed — manual 📸 button only.

[1.12.4]: https://github.com/abdallahmagdy15/mudrik/compare/v1.12.3...v1.12.4
[1.12.3]: https://github.com/abdallahmagdy15/mudrik/compare/v1.12.2...v1.12.3
[1.12.2]: https://github.com/abdallahmagdy15/mudrik/compare/v1.12.1...v1.12.2
[1.12.1]: https://github.com/abdallahmagdy15/mudrik/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/abdallahmagdy15/mudrik/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.7.0...v1.9.0
[1.7.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/abdallahmagdy15/mudrik/compare/v1.0.0...v1.3.0
[1.0.0]: https://github.com/abdallahmagdy15/mudrik/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/abdallahmagdy15/mudrik/releases/tag/v0.9.0

