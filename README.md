<div align="center">

<img src="assets/mascot.png" alt="MudrikNow owl mascot" width="180" />

# MudrikNow  ·  <span dir="rtl">مدرك</span>

***Stop pasting screenshots into AI chats.*** **MudrikNow is an open-source Windows AI assistant that sees what you see — and answers, acts, or guides you step-by-step through any task.**

[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0FA8C9?style=flat-square)](https://github.com/abdallahmagdy15/mudriknow/releases)
[![License](https://img.shields.io/badge/license-MIT-18BFE1?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/abdallahmagdy15/mudriknow?style=flat-square\&color=F2A93A\&include_prereleases)](https://github.com/abdallahmagdy15/mudriknow/releases)
[![Preview](https://img.shields.io/badge/status-preview-F2A93A?style=flat-square)](CHANGELOG.md)
[![Website](https://img.shields.io/badge/website-mudriknow-7499C2?style=flat-square)](https://abdallahmagdy15.github.io/mudriknow/)

[Website](https://abdallahmagdy15.github.io/mudriknow/) · [Install](#-install) · [Hotkeys](#%EF%B8%8F-hotkeys) · [About](#-about)

</div>

***

## 🎬 Demo

[**Watch the demo →**](https://abdallahmagdy15.github.io/mudriknow/)

<div align="center"><em>Alt+Space → ask → MudrikNow acts on your desktop</em></div>

***

## ✨ What it does

Press **Alt+Space** anywhere on Windows. MudrikNow scans your active window's UI — every button, field, label, and value — and opens a floating panel on the opposite side of your screen so nothing gets covered. The element you're pointing at becomes the focal anchor. For web apps and Chromium windows, MudrikNow auto-attaches a screenshot, because browser UIA trees can miss page content.

From there: ask, translate, fix, summarize. Or tell it to **act**: type, paste, click, invoke, press shortcuts. Turn on **Auto-Guide** and MudrikNow becomes a teacher — an owl cursor appears on screen and walks you step‑by‑step through any multi‑step task.

## 🚀 Install

1. Install **[Node.js ≥ 20](https://nodejs.org/)**.
2. Install OpenCode (auth optional — keys can live in-app):
   ```bash
   npm i -g opencode-ai
   ```
3. Download the latest `.exe` from [Releases](https://github.com/abdallahmagdy15/mudriknow/releases) and run it.
4. **Connect your AI model.** On first launch MudrikNow opens settings and highlights **Add a model** for you. Pick a provider — **NVIDIA** is recommended (generous free tier; [build.nvidia.com](https://build.nvidia.com/) → API keys) — paste your key, click **Verify**, then choose a model. Any time: **⚙ → Model → Add a model**.

> Installer is **unsigned** — SmartScreen will warn on first launch. *More info → Run anyway*.

**From source:** `git clone https://github.com/abdallahmagdy15/mudriknow && cd mudriknow && npm install && npm start`

> **Windows build prerequisite:** `npm install` requires Visual Studio with the **"Desktop development with C++"** workload (for `robotjs` and `koffi` native compilation). Node.js ≥ 20 LTS recommended. See [`AGENTS.md`](AGENTS.md) for full details.

## ⌨️ Hotkeys

Two global hotkeys put MudrikNow in front of you. Both are rebindable from the ⚙ menu.

| Shortcut     | What happens |
| ------------ | ------------ |
| `Alt+Space`  | Scans the window's UI tree at your cursor. MudrikNow opens on the opposite side of your screen, ready to help. |
| `Alt+X`      | Quick chat — opens the panel instantly without capturing context. For questions that don't need screen awareness. |
| `Esc`        | Cancel: stops streaming or closes the panel. |
| `Enter`      | Send prompt. `Shift+Enter` for newline. |

## 🛠 Features

| <br />                       | <br />                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🪟 **Reads any Windows app** | Uses Windows UI Automation to pick up buttons, fields, text, menus. Works in browsers, Office, IDEs, native dialogs — anywhere accessibility reaches. Auto-screenshot on Chromium apps; Capture Context button works for any app.           |
| ⚡ **Acts for you**           | Type, paste, click, invoke, press keyboard shortcuts — MudrikNow can interact with any accessible element.                                                                                                        |
| 🦉 **Auto-Guide**             | MudrikNow becomes a teacher: an owl cursor appears on screen, points to each target with a speech bubble, and walks you step‑by‑step through multi‑step UI tasks. Toggle in ⚙ settings.                            |
| 💬 **Quick chat mode**        | `Alt+X` opens the panel without capturing context — for questions that don't need screen awareness. MudrikNow is always one keystroke away, even when you just need a quick answer.                                |
| 🔌 **Any LLM**               | 140+ providers via [OpenCode](https://opencode.ai) + [models.dev](https://models.dev) — NVIDIA, Anthropic, OpenAI, Google, DeepSeek, OpenRouter, and more. Pick a provider, paste your key, and **Verify** it works before you trust it.                           |
| 🔒 **Sandboxed**             | No shell commands, no filesystem writes. The AI reads files in your working directory and dispatches an allow-listed set of UI actions. That's the whole capability surface.                                   |

## 🧠 How it works

```
Alt+Space (pointer)
  ↓  hotkey reads cursor position
  ↓  PowerShell UIA script — JSON tree of the active window
  ↓  Chromium/Electron? → auto-captures full-screen screenshot as fallback
  ↓  MudrikNow opens on the opposite side of your screen, ready to chat

Alt+X (quick chat)
  ↓  panel opens instantly — no context capture
  ↓  for questions that don't need screen awareness

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

MudrikNow runs the AI in a sandbox with deliberately narrow capabilities:

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

A senior dev who got tired of pasting screenshots into ChatGPT — so I built MudrikNow on nights and weekends. Open source so you can see (and improve) every line.

- 🐙 GitHub — [@abdallahmagdy15](https://github.com/abdallahmagdy15)
- 🐦 X / Twitter — [@AbdallahMagdyy](https://x.com/AbdallahMagdyy)
- 💼 LinkedIn — [abdallahmagdy15](https://www.linkedin.com/in/abdallahmagdy15/)
- ✉️ `abdallah.magdy1515@gmail.com`

For security issues use **[GitHub Private Vulnerability Reporting](https://github.com/abdallahmagdy15/mudriknow/security/advisories/new)** (or email as fallback) — not public issues.

## 🤝 Contributing

PRs welcome. MudrikNow is TypeScript end-to-end (main, preload, renderer, shared types) — the single source of truth for IPC channels, action types, and config shape lives in [`src/shared/types.ts`](src/shared/types.ts).&#x20;

Setup, build pipeline, and release flow in **[CONTRIBUTING.md](CONTRIBUTING.md)**. Code of Conduct in **[CODE\_OF\_CONDUCT.md](CODE_OF_CONDUCT.md)**.

## 🙏 Acknowledgements

- **[OpenCode](https://opencode.ai)** — handles streaming, providers, auth so MudrikNow doesn't have to.
- **[Electron](https://electronjs.org)** · **[React](https://react.dev)** · **[robotjs](https://github.com/octalmage/robotjs)** · **Windows UI Automation**.

## 📄 License

[MIT](LICENSE) — fork it, modify it, ship it, sell it. Just keep the copyright notice in the LICENSE file.

***

<div align="center"><sub>MudrikNow · <span dir="rtl">مدرك</span> · the aware</sub></div>
