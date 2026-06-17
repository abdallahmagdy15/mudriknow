<div align="center">

<img src="assets/mascot.png" alt="Mudrik owl mascot" width="180" />

# Mudrik  ·  <span dir="rtl">مدرك</span>

***Stop pasting screenshots into AI chats.*** **Mudrik is an open-source Windows AI assistant that sees what you see — and answers, acts, or guides you step-by-step through any task.**

[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0FA8C9?style=flat-square)](https://github.com/abdallahmagdy15/mudrik/releases)
[![License](https://img.shields.io/badge/license-MIT-18BFE1?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/abdallahmagdy15/mudrik?style=flat-square\&color=F2A93A\&include_prereleases)](https://github.com/abdallahmagdy15/mudrik/releases)
[![Preview](https://img.shields.io/badge/status-preview-F2A93A?style=flat-square)](CHANGELOG.md)
[![Website](https://img.shields.io/badge/website-mudrik-7499C2?style=flat-square)](https://abdallahmagdy15.github.io/Mudrik/)

[Website](https://abdallahmagdy15.github.io/Mudrik/) · [Install](#-install) · [Hotkeys](#%EF%B8%8F-hotkeys) · [About](#-about)

</div>

***

## 🎬 Demo

[**Watch the demo →**](https://abdallahmagdy15.github.io/Mudrik/)

<div align="center"><em>Alt+Space → ask → Mudrik acts on your desktop</em></div>

***

## ✨ What it does

Press **Alt+Space** anywhere on Windows. Mudrik scans your active window's UI — every button, field, label, and value — and opens a floating panel opposite your cursor so nothing gets covered. The element you're pointing at becomes the focal anchor. For web apps and Chromium windows, Mudrik auto-attaches a screenshot, because browser UIA trees can miss page content.

From there: ask, translate, fix, summarize. Or tell it to **act**: type, paste, click, invoke, press shortcuts. Turn on **Auto-Guide** and Mudrik becomes a teacher — an owl cursor appears on screen and walks you step‑by‑step through any multi‑step task.

## 🚀 Install

1. Install **[Node.js ≥ 20](https://nodejs.org/)**.
2. Install OpenCode (auth optional — keys can live in-app):
   ```bash
   npm i -g opencode-ai
   ```
3. Download the latest `.exe` from [Releases](https://github.com/abdallahmagdy15/mudrik/releases) and run it.
4. Launch → ⚙ → **Model** → pick or type a `provider/model`. Mudrik will prompt for an API key if needed. No terminal.

> Installer is **unsigned** — SmartScreen will warn on first launch. *More info → Run anyway*.

**From source:** `git clone https://github.com/abdallahmagdy15/mudrik && cd mudrik && npm install && npm start`

> **Windows build prerequisite:** `npm install` requires Visual Studio with the **"Desktop development with C++"** workload (for `robotjs` and `koffi` native compilation). Node.js ≥ 20 LTS recommended. See [`AGENTS.md`](AGENTS.md) for full details.

## ⌨️ Hotkeys

Two global hotkeys put Mudrik in front of you. Both are rebindable from the ⚙ menu.

| Shortcut     | What happens |
| ------------ | ------------ |
| `Alt+Space`  | Scans the window's UI tree at your cursor. Mudrik opens opposite your cursor, ready to help. |
| `Ctrl+Space` | Drag to select a screen region. Gives the AI a focused view of exactly what you want it to see. |
| `Esc`        | Cancel: stops streaming, exits area-select, or closes the panel. |
| `Enter`      | Send prompt. `Shift+Enter` for newline. |

## 🛠 Features

| <br />                       | <br />                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🎯 **Cursor-anchored**       | Panel opens opposite your cursor — what you're pointing at stays visible. No app-switching.                                                                                                                   |
| 🪟 **Reads any Windows app** | Uses Windows UI Automation to pick up buttons, fields, text, menus. Works in browsers, Office, IDEs, native dialogs — anywhere accessibility reaches. Chromium apps get an auto-screenshot fallback.           |
| ⚡ **Acts for you**           | Type, paste, click, invoke, press keyboard shortcuts — Mudrik can interact with any accessible element.                                                                                                        |
| 🦉 **Auto-Guide**             | Mudrik becomes a teacher: an owl cursor appears on screen, points to each target with a speech bubble, and walks you step‑by‑step through multi‑step UI tasks. Toggle in ⚙ settings.                            |
| 🖼️ **Area capture**          | Drag a rectangle with `Ctrl+Space` to give the AI a focused visual of a specific region — charts, images, or anything UIA can't describe.                                                                      |
| 🔌 **Any LLM**               | 18 providers out of the box — Anthropic, OpenAI, Google, DeepSeek, OpenRouter, Ollama, and more. Paste your key in settings — no terminal auth dance.                                                           |
| 🔒 **Sandboxed**             | No shell commands, no filesystem writes. The AI reads files in your working directory and dispatches an allow-listed set of UI actions. That's the whole capability surface.                                   |

## 🧠 How it works

```
Alt+Space (pointer)
  ↓  hotkey reads cursor position
  ↓  PowerShell UIA script — JSON tree of the active window
  ↓  Chromium/Electron? → auto-captures full-screen screenshot as fallback
  ↓  Mudrik opens opposite your cursor, ready to chat

Ctrl+Space (area-select)
  ↓  drag a rectangle on screen
  ↓  region screenshot captured
  ↓  Mudrik opens with a focused visual context

Send prompt
  ↓  streamed to `opencode run --agent readonly`
  ↓  tokens render live; <!--ACTION:{...}--> markers parsed
  ↓  actions execute via UIA or robotjs

Auto-Guide mode (opt-in via ⚙)
  ↓  AI emits guide_offer → user accepts
  ↓  owl cursor appears with speech bubble, panel hides
  ↓  owl points → user clicks → AI advances
  ↓  guide_complete → "Done!" → panel returns
```

Full architecture in **[AGENTS.md](AGENTS.md)**.

## 🔒 Privacy & Security

Mudrik runs the AI in a sandbox with deliberately narrow capabilities:

| Capability                                        | Exposed to the model?              |
| ------------------------------------------------- | ---------------------------------- |
| Shell / PowerShell exec                           | ❌ No                              |
| Filesystem **write**                              | ❌ No                              |
| Filesystem **read** (`read`/`grep`/`glob`/`list`) | ✅ Yes (within working directory)  |
| Windows UI Automation                             | ✅ Yes (pre-defined action set)    |
| Keyboard / mouse                                  | ✅ Yes (when UIA can't reach a target) |
| Screen pixels                                     | ✅ Auto on Chromium/Electron · 🖐️ Manual on native apps |

Full threat model + reporting in **[SECURITY.md](SECURITY.md)**.

## 👋 About

Hi, I'm **Abdullah Magdy**.

A senior dev who got tired of pasting screenshots into ChatGPT — so I built Mudrik on nights and weekends. Open source so you can see (and improve) every line.

- 🐙 GitHub — [@abdallahmagdy15](https://github.com/abdallahmagdy15)
- 🐦 X / Twitter — [@AbdallahMagdyy](https://x.com/AbdallahMagdyy)
- 💼 LinkedIn — [abdallahmagdy15](https://www.linkedin.com/in/abdallahmagdy15/)
- ✉️ `abdallah.magdy1515@gmail.com`

For security issues use **[GitHub Private Vulnerability Reporting](https://github.com/abdallahmagdy15/mudrik/security/advisories/new)** (or email as fallback) — not public issues.

## 🤝 Contributing

PRs welcome. Mudrik is TypeScript end-to-end (main, preload, renderer, shared types) — the single source of truth for IPC channels, action types, and config shape lives in [`src/shared/types.ts`](src/shared/types.ts).&#x20;

Setup, build pipeline, and release flow in **[CONTRIBUTING.md](CONTRIBUTING.md)**. Code of Conduct in **[CODE\_OF\_CONDUCT.md](CODE_OF_CONDUCT.md)**.

## 🙏 Acknowledgements

- **[OpenCode](https://opencode.ai)** — handles streaming, providers, auth so Mudrik doesn't have to.
- **[Electron](https://electronjs.org)** · **[React](https://react.dev)** · **[robotjs](https://github.com/octalmage/robotjs)** · **Windows UI Automation**.

## 📄 License

[MIT](LICENSE) — fork it, modify it, ship it, sell it. Just keep the copyright notice in the LICENSE file.

***

<div align="center"><sub>Mudrik · <span dir="rtl">مدرك</span> · the aware</sub></div>
