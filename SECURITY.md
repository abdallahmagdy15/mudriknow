# Security policy

## Threat model

MudrikNow runs an AI model that can observe your screen and synthesize actions which are executed on your desktop. The core invariant is:

**The model affects the desktop only through allow-listed UI-automation actions parsed from its plain-text reply. File writes/edits and arbitrary new tools are blocked outright. By default the model may run a limited set of *read-only* shell commands (system queries, git inspection, log parsing); anything mutating — writes, deletes, process/service changes, network mutation — plus chaining/piping/redirect operators — is blocked and terminates the session. Web search/fetch are allowed for lookups.**

This is enforced in layers:

1. **Sandboxed agent.** MudrikNow spawns OpenCode with `--agent readonly` and provisions `.opencode/agent/readonly.md` into the working directory on startup (runtime-patched when `readOnlyCommandsEnabled` is on). The agent denies `edit`, `write`, `task`, `todowrite`, and `skill`; `webfetch`/`websearch` are always allowed; `bash` is allowed only when `readOnlyCommandsEnabled` is true (the default).
2. **Runtime kill-switch.** `src/main/opencode-client.ts` inspects every JSON event streamed from OpenCode. If a `permission.asked` or `part.tool` event names any disallowed tool the OpenCode subprocess is `SIGKILL`ed, the session is aborted, and the UI shows a "Blocked: model attempted to use X" error. This is the enforcement that matters — the agent file is advisory in OpenCode 1.4.x.
3. **Action allowlist at parse time.** `parseActionsFromResponse` only emits `Action`s whose `type` is in a hardcoded set (`src/main/action-executor.ts#ALLOWED_ACTION_TYPES`). Any other marker — notably legacy `run_command` — is captured in a `blocked` list surfaced to the UI, never executed.
4. **IPC schema validation.** Both `EXECUTE_ACTION` and `RETRY_ACTION` handlers run the renderer-supplied payload through `validateAction`, which coerces fields to the right types and rejects unknown action types. A compromised renderer cannot send a `run_command`-shaped payload to the main process.

Out-of-scope (not defended against):

- A malicious user with local administrator access. MudrikNow runs as the logged-in user.
- A malicious OpenCode binary installed globally via `npm i -g opencode-ai`. We trust the CLI the user has on PATH.
- Screenshot/UIA content being included in the prompt the user authored. Attackers can craft UI content that says "ignore all your rules"; the model is still free to act on any allowed action type, so the blast radius is the allowed action set.

### Read-only command execution (on by default)

By default (`readOnlyCommandsEnabled: true` in `src/shared/types.ts`), the model may run a limited set of read-only shell commands via OpenCode's `bash` tool — diagnostics like `Get-CimInstance`, `Get-Process`, `git status`, log parsing. The user can turn this off in ⚙ settings. Enforcement is **denylist-based** (block known-mutating commands and operators; allow the rest), in three layers:

1. **System prompt + agent rules** (advisory): the patched `readonly.md` tells the model to issue only single, read-only PowerShell cmdlets — no chaining, piping, or redirect. (The agent file is advisory in OpenCode 1.4.x; the kill-switch below is authoritative.)

2. **Kill-switch operator block** (`opencode-client.ts#BLOCKED_OPERATORS`): every bash command string is inspected for `; & | > <`. Any match terminates the session — catches statement chaining (`git log ; del file`), backgrounding (`&`), piping (`dir | sort`), and redirects (`echo > file`). (`^ ( ) % $` are intentionally NOT blocked — common in legitimate paths and PowerShell env syntax (`$env:VAR`), and only enable mutation after an operator that *is* blocked.)

3. **Kill-switch mutating-command denylist** (`opencode-client.ts#MUTATING_COMMANDS`): case-insensitive prefix match (first 1–3 tokens) against a hardcoded list — file mutation (`remove-item`, `set-content`, `out-file`, `new-item`, `copy-item`, `move-item`…), process/service mutation (`stop-process`, `start-process`, `stop-service`, `start-service`…), network mutation (`invoke-webrequest`, `invoke-restmethod`…), system mutation (`restart-computer`, `shutdown`…), cmd.exe aliases (`del`, `rd`, `mkdir`, `copy`, `move`, `ren`, `format`…), external mutating commands (`taskkill`, `reg`, `sc`, `schtasks`, `diskpart`, `net`…), and code execution (`node`, `python`, `cmd`, `powershell`, `pwsh`, `dotnet`…). Any match terminates the session.

**Typical commands that work** (none in the denylist, no blocked operators — illustrative, not exhaustive; the model is denylist-governed, so anything not blocked runs):
- Git: `status`, `log`, `diff`, `show`, `blame`, `reflog`
- System: `Get-CimInstance`, `Get-Process`, `Get-Service`, `tasklist`, `systeminfo`, `ipconfig`, `netstat`, `whoami`
- Files: `Get-Content`, `Select-String`, `where`, `dir`, `tree`
- Packages: `npm list`, `npm ls`

**Accepted risk**: PowerShell environment-variable expansion (`$env:VAR`) is permitted (the `$` character is intentionally not blocked). A malicious env-var value containing a blocked operator could theoretically be injected, but standard Windows env vars (`$env:USERPROFILE`, `$env:APPDATA`, `$env:TEMP`) have safe path values. Accepted for usability — the AI can use natural paths like `dir $env:USERPROFILE\Documents`.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

**Preferred:** use [GitHub Private Vulnerability Reporting](https://github.com/abdallahmagdy15/mudriknow/security/advisories/new) — it keeps the report private to the maintainer and makes it easy to coordinate a fix and CVE if needed.

**Fallback:** email **abdallah.magdy1515@gmail.com**.

Either way, please include:

- A description of the issue and the impact.
- Reproduction steps or a proof-of-concept.
- The MudrikNow version and your Windows build number.

We aim to acknowledge within 72 hours and ship a fix or mitigation within 14 days for high-severity issues. Coordinated disclosure: we'd appreciate you holding public disclosure until a fix is released or 90 days have elapsed, whichever comes first.

## Supported versions

Only the most recent minor release line. Older versions receive no updates.

## Dependencies

- `electron-updater` verifies release artifacts using the signature of `latest.yml` on GitHub Releases.
- The installer is currently **unsigned**. This is a known limitation; users will see a SmartScreen warning on first run. A signing certificate is planned for a future release.
