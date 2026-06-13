# Agent Workspace Notes

This repository is the public `mudrik` source-code repo. Some directories here are **AI-agent-generated workspace folders** that are intentionally **not committed to this public repository**. They are stored in the private `Mudrik-Plan` repository and exposed here through directory symlinks so local AI agents can read/write them while the real files remain in the private repo.

## Symlinked agent workspace directories

| Path in this repo | Actual location | Purpose |
|---|---|---|
| `.claude/` | `D:\SandBoX\Mudrik-Plan\.claude\` | Claude agent working files / worktrees |
| `.impeccable/` | `D:\SandBoX\Mudrik-Plan\.impeccable\` | Impeccable UI/UX agent outputs |
| `.planning/` | `D:\SandBoX\Mudrik-Plan\.planning\` | Planning agent docs and specs |

## Rules

- These paths are listed in `.gitignore` and must **never** be committed to the public `mudrik` repo.
- Do not delete, move, or convert them to real directories without updating the symlinks in both repos.
- To inspect or edit their contents, work in the `Mudrik-Plan` repo; the symlinks here will reflect the changes.

## Private storage repo

- Path: `D:\SandBoX\Mudrik-Plan`
- Remote: `https://github.com/abdallahmagdy15/Mudrik-Plan.git`
- These directories are tracked (or intended to be tracked) in that private repo.
