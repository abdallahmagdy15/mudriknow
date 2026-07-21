# Changelog

All notable changes to MudrikNow are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-07-21

### Added
- **Auto-collapse long user messages.** User messages taller than ~140px collapse into a preview with a soft inner-shadow fade + centered `⋯` indicator. A chevron arrow in the copy actions row (same row, same hover-reveal) expands/collapses with a snappy 0.15s animation. AI responses stay fully rendered. Shadow is theme-aware (fades toward black in light mode, white in dark mode).

### Fixed
- **COPY marker collision with HTML content.** The `<!--COPY:content-->` marker used `-->` as its terminator, so content containing an HTML comment (`<!-- ... -->`) terminated the marker early and leaked raw HTML into the response. Switched to collision-proof `<!--COPY_BEGIN-->content<!--COPY_END-->` markers. Legacy markers still unwrapped for existing sessions.
- **Raw HTML tags no longer vanish.** Stray un-backticked HTML in the model's reply now renders as escaped literal text instead of being silently dropped by the markdown sanitizer.

## [2.1.6] - 2026-07-19

### Removed
- **`migrateLegacyConfig` removed.** The one-shot rebrand migration (`%APPDATA%\hoverbuddy\` → `%APPDATA%\mudriknow\`) has shipped since v1.9.0 and is no longer needed. Previously, any time `mudriknow\config.json` was absent (fresh install, manual reset, testing), the app silently resurrected stale pre-rebrand config from the legacy `hoverbuddy` folder — breaking first-run detection and model setup. Fresh installs now start truly fresh.

## [2.1.5] - 2026-07-17

### Changed
- **Fresh-install default model is now `google/gemini-3.1-flash-lite`** (was `ollama-cloud/gemini-3-flash-preview`). Gemini 3.1 Flash Lite is multimodal (image attachments) and reasoning-capable, on Google AI Studio's free tier (~500 req/day). The setup wizard now leads with Google so new users land on it and are walked through getting a free key.
- Note: unlike the previous keyless default, the new default requires a free Google API key (pasted in the first-run wizard).

## [2.1.4] - 2026-07-17

### Added
- **Chat history load-more.** The Recent Chats popup now lists up to 100 sessions (up from 5). A "Load more" button reveals chats in batches of 10. Each entry shows both the session title and its date.

### Changed
- Session retention cap raised from 30 → 100 (`MAX_SESSIONS`).
- Recent chats popup widened (260→320px) and taller (240→340px) to fit the new two-line entries.

## [2.1.3] - 2026-07-16

### Added
- **Multimodal recommendation tags.** All image-capable models in the picker now show a "Recommended" tag (not just the first one). Recent models list shows a 📷 icon next to models that support images.
- **Splash screen owl** uses `mascot.png`.

## [2.1.2] - 2026-07-06

### Added
- **Arabic RTL per-message.** AI responses now auto-detect their reading direction from content (Arabic-majority → RTL, Latin-majority → LTR), independently of the app language. Code blocks stay LTR inside RTL messages so snippets remain readable.
- **Model variant selector.** A new ⚙ button in the composer (separate group, sliders icon) lets you pick a reasoning-effort variant (`low`/`medium`/`high`) for the current model — persisted through `Config.modelVariant` and passed to OpenCode as `--variant`. Appears for ALL reasoning models (explicit effort options from models.dev win; otherwise a standard set is offered). Variant chip tags in the model picker let you pick a model + variant in one click from ⚙ → Model.
- **Multimodal recommendation.** The model picker now shows a "📷 image support" hint recommending multimodal models — MudrikNow captures screenshots for context, so a model that can see images gives the best experience.

## [2.1.1] - 2026-07-05

### Fixed
- **Read-only queries (system status, etc.) no longer false-positive blocked.** The bash kill-switch's raw-line scan was matching blocked operators (`;` `&` `|` `>` `<`) anywhere in the JSON event line — including the tool's **output**. Commands like `systeminfo` and `tasklist` print output that legitimately contains `;`, which killed the session mid-answer. The scan now extracts and checks **only the command-input value**, so legitimate single commands work while genuinely chained/pipe/redirected commands are still blocked. (Regression test added from a real failing session.)
- **Blocked-action errors are now clear.** A kill-switch termination surfaces as *"The AI tried to run a command that isn't allowed in read-only mode. Try rephrasing your request."* instead of the generic *"Something went wrong"*, and no longer emits a duplicate error.

### Changed
- **Logs now land in `mudriknow/mudriknow.log`** (matching the rebrand) instead of the legacy `mudrik/hoverbuddy.log`; stale logs in the old `mudrik/` and `hoverbuddy/` dirs are cleaned up.
- **More sessions retained** (30, was 5) by the startup cleanup.

## [2.1.0] - 2026-07-05

### Added
- **Reliable AI-model connection UX.** A complete rebuild of how you connect an AI model, so non-technical users can go from install → working model in ~2 minutes.
  - **Provider chooser + live model picker** — pick a provider, then pick a model from its live list (display name, image/reasoning badges, context window, $/1M cost). No more memorizing `provider/model` strings. Powered by OpenCode's own [models.dev](https://models.dev) catalog, so no parallel provider model can drift out of sync.
  - **Real API-key verification** — the **Verify** button runs a tiny authenticated completion through the OpenCode engine in an isolated environment and confirms the key works *before* you trust it. Transient server hiccups are retried automatically.
  - **Forced setup + connection banner** — chat is disabled until your current model's provider is connected; a banner explains why and a pulsing **Add a model** nudge points to the next step. The banner reappears on auth/subscription failures with a **Fix in Settings** action.
  - **Classified errors** — provider errors (which arrive as `APIError.data.message`) are extracted and classified into auth / rate-limit / quota / model-not-found / network / provider-down, each with a clear message. No more cryptic "AI engine crashed (exit code 1)".
- **Manage-provider hub** — from any recent model: change model / edit key / switch provider in one place; plus an inline edit-key button on connected providers.
- **"Load more" pagination** on provider and model lists (search filters across all entries).

### Changed
- **NVIDIA pinned first** in the provider list — generous, genuinely-usable free tier for every user; the setup nudge shows step-by-step key guidance.
- **Recent-models list** now holds up to 8 (was 3) with live connection-status dots.
- **Multi-segment model IDs preserved** (e.g. `nvidia/deepseek-ai/deepseek-v4-flash`) — a verbose-output parser regression that silently dropped the leading provider is fixed and unit-tested.
- Banners use a solid + blurred surface so chat text can't bleed through.

### Fixed
- Provider error messages hidden at `error.data.message` (producing empty errors and misleading "exit code 1" crashes).
- API-key verification failing on flaky providers (now retries transient errors).

## [2.0.0] - 2026-07-02

### Changed
- **Rebrand: Mudrik → MudrikNow.** Product renamed to "MudrikNow" to reflect its quick-access, instant-context philosophy. All user-facing strings, installer artifacts, prompts, and docs updated. Internal identifiers (`window.mudrik`, `%APPDATA%/mudrik/` config path) intentionally unchanged — existing v1.x users upgrade with zero config migration.
- **appId changed** to `com.mudriknow.app`. **Breaking:** auto-update from v1.x will not work — download v2.0.0 manually from [Releases](https://github.com/abdallahmagdy15/mudriknow/releases).
- **System prompt reframed** to emphasize quick-access AI, fast context capture, and productivity — not deep agentic workflows.
- **Read-only commands toggle removed.** The "Allow read-only commands" setting was confusing (disabled implied all commands allowed). Simplified to always-on: the AI always has access to the curated read-only command set (git inspection, system queries, etc.) with the same three-layer kill-switch filtering. Existing users who disabled it are auto-migrated.
- **Arabic localization improved.** Wordmark and chat labels now show `مدرك` in Arabic (instead of English). Tajawal font loaded from Google Fonts for modern, readable Arabic typography. Send button repositioned correctly in RTL layout.
- **Clickable starter prompts.** The empty-state capability chips are now actionable buttons: "Guide me" (enables Auto-Guide + sends a walkthrough request), "Capture" (triggers context capture), and "Explain" (asks the AI about the current element).

### Fixed
- Mojibake in calibrate window title (`â€"` → em dash).

## [1.15.0] - 2026-07-02

### Added
- **Opt-in read-only command execution.** The AI can now run shell commands for analysis and inspection via the `bash` tool, gated behind a config flag (on by default for new installs). Uses a denylist approach: mutating commands (Remove-Item, Set-Content, git push, npm install, node, python, etc.) and shell operators (; & | > <) are blocked; everything else is allowed. Three-layer defense: (1) OpenCode pattern permissions in frontmatter block mutating commands before execution, (2) kill-switch operator block catches chaining/piping/redirecting, (3) kill-switch mutating-command denylist. Session auto-resets on bash block to prevent AI hallucinating from stale pre-block context. Settings toggle in ⚙.

### Changed
- **New default config for fresh installs.** Desktop actions off by default, Auto-Guide on, read-only commands on, launch on startup on, restore chat on popup off.
- **Composer background is now solid** (`--composer-bg`) instead of gradient in both light and dark themes.
- **System prompt updated for PowerShell** (not cmd.exe) — uses `$env:VAR` syntax, documents PowerShell aliases (`dir` = `Get-ChildItem`), and lists blocked operators/mutating commands.

## [1.14.0] - 2026-07-01

### Added
- **Rich Markdown rendering in AI responses.** AI replies now render as formatted Markdown (bold, italic, strikethrough, inline code, fenced code blocks with syntax highlighting via highlight.js, bullet/numbered lists, blockquotes, links, GFM tables) instead of plain monospace text. A new MARKDOWN FORMATTING rule in the system prompt tells the AI to format its main reply body as Markdown. COPY-marker deliverables (code, commands, drafted text) now render as formatted copy-cards that preserve newlines instead of collapsing to a single raw line; clicking a card copies its rendered text. Markdown links open in the system browser via a new https-only openExternal IPC so the panel never navigates away. Syntax token colors are theme-aware via --syntax-* variables (light + dark).
- **Per-message copy control.** Hovering any message reveals a copy action below it. The main button copies the rendered text (what you see); a caret opens a menu with "Copy as Markdown" (the raw Markdown source). User messages get a single copy button. The menu dismisses on outside-click, focus-loss, or Escape. Uses clean stroke-based SVG icons (Lucide-style) instead of Font Awesome glyphs.

### Changed
- **COPY-marker prompt semantics.** COPY markers now wrap only discrete paste-ready snippets (code, commands, drafted emails), not the AI's whole formatted answer/guide/summary — that now lives in the main response body as Markdown. Keeps rich content visible in the chat instead of trapped inside a chip.
- **Chat body background is a static 5-blob radial mesh gradient** (cyan + gold, scattered positions) for a modern look. A drift animation was tried but removed — it forced a per-frame repaint of 5 radial gradients (heavy GPU); the static mesh keeps the vibrance at idle GPU cost.
- **Composer shadow softened** to a macOS-style diffuse tinted lift in both light and dark themes (pure black dropped in favor of the app's navy page-tone; lower alphas, larger blur).
- **Quick-chat alert is now isolated** from the chat body: it floats as a fixed banner below the top bar (absolute, backdrop-filter) instead of scrolling with the messages, so dismissing it no longer shifts the owl/empty-state. Top clearance increased so it never tucks under the bar.
- **Chat body top spacing** tuned (padding + fade-mask) so the first message breathes below the floating header without excess.
- **Renderer webpack resolve.conditionNames** now resolves browser/default exports (not node) so isomorphic deps like vfile pick their browser variant — fixes ReferenceError: require is not defined on panel load (nodeIntegration is off).

### Fixed
- **Panel blank/broken on load after adding react-markdown.** vfile (a unified/remark dependency) resolved its Node variant under webpack's electron-renderer target, emitting raw require("node:path")/"node:process"/"node:url" calls that are undefined in the renderer (context isolation). Fixed via conditionNames so the browser variants are used; bundle verified to contain zero raw require() calls.

## [1.13.2] - 2026-06-28

### Added
- **Auto-Guide owl pointer is now draggable and semi-transparent.** The owl reads at 0.65 opacity so content beneath is visible, and can be grabbed and dragged aside — the speech bubble trails it automatically. Lets the user peek past or move the pointer when it covers something important, including windows that open behind it mid-guide.

### Fixed
- **Auto-Guide bubble buttons not clickable when another window sits behind the overlay.** The bubble rendered on top (screen-saver z-order) but clicks fell through to the window beneath (e.g. Device Manager moved under it). Root cause: click-through toggling relied on Electron's forwarded `mouseenter`, which goes deaf when another window is under the overlay at the bubble's location. Replaced with a main-process cursor poller (≈30 ms) that hit-tests the real cursor position against renderer-reported owl + bubble rects and toggles `setIgnoreMouseEvents` authoritatively. The owl drag uses the same path. Cursor polling is independent of foreground window / z-order, so bubble buttons and owl dragging now work regardless of what is beneath.

## [1.13.1] - 2026-06-27

### Changed
- **One-click context recapture.** The Capture toggle in the composer no longer requires two clicks to refresh context after doing work (release → re-capture). It now always captures/refreshes in a single click. A separate small × button appears next to the pill when context is held, for releasing to quick-chat mode. The capture controls are visually grouped and separated from the Act/Guide feature toggles by a hairline divider. The label flips from "Capture" to "Recapture" when context is already held.

## [1.13.0] - 2026-06-26

### Added
- **Floating composer + floating top bar.** The chat input and the header are now elevated cards floating over a single continuous chat surface, instead of stacked boxed regions. Messages scroll seamlessly behind both bars and fade into them via CSS masks. The composer gains an animated cyan→gold gradient border ring (brightens and speeds up on focus) and a unified 8px rounding across the composer, toggles, send button, and message cards.
- **Inline feature toggles in the composer.** Capture, Act, and Guide toggles sit inside the composer bar. Act ↔ `Config.actionsEnabled` and Guide ↔ `Config.autoGuideEnabled` — the same flags the Settings panel edits — so the two stay in sync. Capture reflects the live context-captured state (click to capture/release), replacing the separate capture badge that sat above the messages.

### Changed
- **Send button** is now a rounded-square gold button (primary-faded → primary-glow on hover), matching the active-toggle coloring; no hover size change or drop shadow.
- **Composer textarea follows the font-size setting** live (was hardcoded at 13px).
- **Focus glow is blue** (cyan) instead of orange.
- **Top shadow removed** from the chat; content fades into the floating header instead.
- **Dark-mode composer surface brightened** (`--composer-bg`) so the card reads as floating above the chat body.
- **Unified 12px outer padding** around the header, composer, and message content.

### Removed
- Standalone context-capture button/badge above the messages (folded into the Capture toggle).

## [1.12.9] - 2026-06-25

### Added
- **"Else" button on guide overlay bubble.** The overlay bubble now shows an "Else" (localized "Something else") button alongside the AI options + Cancel. Clicking it hides the bubble (owl stays pointing) and opens the Mudrik panel with the chat input focused and enabled, so the user can type a custom follow-up instead of picking a predefined option. The panel dock shows the AI options + Cancel (no Else) since the user types directly. No AI round-trip on Else click — the guide stays paused until the user submits. Revived previously-dead `showPanelAndFocusInput` infrastructure.

### Fixed
- **Chat input disabled after guide offer acceptance.** Accepting a guide offer called `setStreaming(true)` in React, but the deferred first step ran locally (no new stream), so `streaming` never reset to `false`. When the panel opened via the Else button, the chat input was disabled and showed a "thinking" state. Fixed by resetting `streaming = false` when the step-active guide state arrives.
- **Empty-state overflow in quick-chat mode.** The `.empty-state` had `height: 100%`, demanding the full `.messages` height even when the quick-chat-hint banner was present. Combined content overflowed → unnecessary scrollbar. Fixed with flexbox layout: `.messages` is now a flex column, `.empty-state` uses `flex: 1` to fill remaining space.
- **Narrower maximized panel width.** The maximize toggle was hardcoded to 900px — wider than needed. Reduced to 780px, closer to the normal panel width (~730px on 1080p).

### Changed
- **GUIDE_PROMPT_FULL updated.** The OPTIONS DESIGN section now tells the AI that the runtime injects both "Else" and "Cancel" buttons, so the AI should not include them in its options array.

## [1.12.8] - 2026-06-24

### Fixed
- **Default Electron page on Windows startup.** If "Launch on startup" was toggled while running Mudrik in dev mode, Electron wrote a registry entry under `electron.app.Electron` pointing to the dev `electron.exe` — but without the app path argument. On next Windows startup, `electron.exe --hidden` had no app to load and showed the default Electron welcome page instead of Mudrik. The packaged `Mudrik.exe` used a separate key (`electron.app.Mudrik`) so both entries coexisted. Fixed in three parts: (1) dev-mode entries now include `app.getAppPath()` as the first arg; (2) the packaged app proactively cleans up stale `electron.app.Electron` entries that reference the project directory on startup; (3) improved startup logging.

## [1.12.7] - 2026-06-24

### Fixed
- **Guide mode no longer refused when desktop actions are off.** When `actionsEnabled=false`, the system prompt listed `guide_to` alongside the other interactive actions as "DISABLED". The model conflated `guide_to` with the `guide_offer` / `guide_step` markers (which are gated by the separate `autoGuideEnabled` flag) and refused to start guide sessions — telling users to enable "Allow desktop actions" even though Auto-Guide was already on. Fixed by dropping `guide_to` from the read-only prompt stub and the runtime actions block, and adding an explicit clarification that Auto-Guide is a separate setting. Runtime blocking of `guide_to` itself is unchanged; only the prompt wording was misleading.

### Changed
- **README & website: panel positioning wording corrected.** The panel opens at a fixed centered position on the left or right half of the screen (cursor only determines which half). Stale "opens opposite your cursor" phrasing — which implied the panel tracks the cursor position — replaced with "opens on the opposite side of your screen" in the README hotkey table, the how-it-works diagram, and the website hotkey table (EN + AR).

## [1.12.6] - 2026-06-21

### Fixed
- **Acrylic fallback when Windows disables transparency.** When the OS disables the native acrylic blur (manual "Transparency effects" toggle off, battery saver, high-contrast mode, or RDP/VM sessions), the v1.12.5 translucent panel had nothing behind it and looked broken — see-through to windows behind, or solid black. Mudrik now detects the active state via the `EnableTransparency` registry value, `powerMonitor.onBatteryPower`, and `nativeTheme.shouldUseHighContrastColors`, and falls back to the pre-1.12.5 opaque background automatically. Detection runs on every panel show and on live power-source / contrast changes, so the panel always looks intentional.

## [1.12.5] - 2026-06-21

### Added
- **Recapture button on the captured-context badge.** When context is already captured, a refresh button (↻) now sits beside the release X. Clicking it re-runs the full capture flow (UIA scan + screenshot with grid) in place — no need to release and recapture. Blue-tinted to distinguish from the red release button. Reuses the existing `capture-context` IPC; `setContext()` cleans up the previous screenshot automatically.

### Changed
- **Translucent panel with native acrylic blur.** Restored the v0.9.0 frosted-glass look: `--bg-panel` is now translucent (60% opaque) in both light and dark themes, so the native Windows acrylic blur — already wired up via `setBackgroundMaterial("acrylic")` but visually inert since the v1.11 aurora redesign — shows through the panel's padding and gaps. Content areas (header, messages, input) remain opaque, creating a floating-cards-on-glass effect. Aurora gradient layers preserved on top. Two stale CSS comments that incorrectly claimed translucency "breaks rendering" have been corrected.

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

[2.0.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.15.0...v2.0.0
[1.15.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.13.2...v1.14.0
[1.13.2]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.13.1...v1.13.2
[1.13.1]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.9...v1.13.0
[1.12.9]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.8...v1.12.9
[1.12.8]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.7...v1.12.8
[1.12.7]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.6...v1.12.7
[1.12.6]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.5...v1.12.6
[1.12.5]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.4...v1.12.5
[1.12.4]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.3...v1.12.4
[1.12.3]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.2...v1.12.3
[1.12.2]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.1...v1.12.2
[1.12.1]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.11.0...v1.12.0
[2.2.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.6...v2.2.0
[2.1.6]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.5...v2.1.6
[2.1.5]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.4...v2.1.5
[2.1.4]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.3...v2.1.4
[2.1.3]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.15.0...v2.0.0
[1.11.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.7.0...v1.9.0
[1.7.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v1.0.0...v1.3.0
[1.0.0]: https://github.com/abdallahmagdy15/mudriknow/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/abdallahmagdy15/mudriknow/releases/tag/v0.9.0

