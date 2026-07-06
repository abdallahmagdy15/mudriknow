# Open Items — MudrikNow

Tracked future work. Add items here as they come up; strike them off (or move to
CHANGELOG) when shipped. Per `AGENTS.md`: when told to write to todos, just
write — don't implement unless explicitly told.

## Next up

### 1. Arabic (RTL) for AI response messages in the chat
- **Problem:** When the UI language is Arabic (`lang === "ar"`), the app shell
  already flips to RTL (`.app[dir="rtl"]`), but the **AI's response message
  bubbles stay LTR** — so Arabic text renders right-aligned-ish but with wrong
  punctuation ordering, reading direction, and code/markdown alignment.
- **Scope:** In the chat render path (`src/renderer/App.tsx` message render +
  `src/renderer/components/ResponseView.tsx` / `Markdown.tsx`), set
  `dir="rtl"` on assistant message containers when `lang === "ar"` (and keep
  `dir="ltr"` on inline code / code blocks so code stays readable). User
  messages: follow the same rule, or auto-detect per-message (Arabic content →
  rtl). Markdown renderer (react-markdown) needs the `dir` on the wrapper.
- **Also consider:** mixed-content messages (Arabic prose + English code) —
  isolate code spans/blocks to LTR via CSS `direction: ltr` on `pre`/`code`.
- **Files likely touched:** `App.tsx` (message list render), `ResponseView.tsx`,
  `Markdown.tsx`, `global.css` (`.message-content[dir="rtl"]` rules).

### 2. Model **variant** selector button beside the chat input
- **Goal:** Add a new button group next to the existing chat-input toggles
  (Capture / Act / Guide) that lets the user pick a **model variant** for the
  current model — e.g. reasoning effort (`high` / `max` / `minimal`) where the
  provider supports it.
- **Context:** OpenCode supports `--variant <effort>` (`opencode run --variant
  high`), and models.dev model metadata exposes available variants. Currently
  MudrikNow spawns without a variant (provider default).
- **Scope:**
  - Surface available variants for the current model: extend `LIST_MODELS`
    (Stage A) to include each model's `variants` (from `opencode models
    --verbose` → `obj.variants`), or a new lightweight IPC.
  - New button in the composer toggle row (its own group, separate from
    Capture/Act/Guide) showing the current variant (or "Default"); click →
    small popover/menu listing variants for the active model. Disabled/hidden
    when the model has no variants.
  - Persist the choice (e.g. `Config.modelVariant`) and pass it as `--variant`
    in `OpenCodeClient.sendMessage` spawn args.
- **Files likely touched:** `src/shared/types.ts` (`Config.modelVariant`,
  `ModelDisplay.variants`, IPC if new), `src/preload.ts`,
  `src/main/opencode-client.ts` (add `--variant` arg),
  `src/main/ipc-handlers.ts` (LIST_MODELS variants + SET_CONFIG),
  `src/renderer/components/ChatInput.tsx` (+ options), `App.tsx`, `global.css`.

## Done (reference)
- v2.1.1 — read-only bash false-positive fix, logging cleanup, BLOCKED error
  clarity, session retention 5→30.
- v2.1.0 — reliable model-connection UX (provider chooser, real key verify,
  forced setup banner, classified errors, NVIDIA-led).
