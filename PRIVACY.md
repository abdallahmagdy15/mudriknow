# Privacy policy

MudrikNow is an open-source desktop app. The MudrikNow project does not operate a server. The project does not collect, store, or receive your data.

This program does not transfer information to other networked systems, unless the user or the person who installs or operates the program specifically requests it.

## Data that leaves your computer

| When | What | Where it goes |
|---|---|---|
| You send a prompt | Your prompt, the UI Automation context of the active window, and a screenshot of your screen | The AI provider that **you** configured (through the OpenCode CLI). The privacy policy of that provider applies. |
| The app starts or checks for updates | A request for the latest version | GitHub Releases (`github.com/abdallahmagdy15/mudriknow`) |
| You open the model list | A request for the public model catalog | `https://models.dev/api.json` |
| The model uses web search or web fetch | The search query or the URL | The search service or the website |

## Data that stays on your computer

- **Settings and API keys** are in `config.json` in the MudrikNow folder in `%APPDATA%`. The app sends each API key only to its provider.
- **Logs** are in `%APPDATA%\mudriknow\`. The app does not upload them.
- **Screenshots** are temporary files in `%TEMP%`. The app deletes them when the context changes.

## What MudrikNow does not do

- No analytics or telemetry.
- No advertising or tracking.
- No account with the MudrikNow project.

## Contact

Report privacy questions or problems in [GitHub Issues](https://github.com/abdallahmagdy15/mudriknow/issues). For security problems, see [SECURITY.md](SECURITY.md).
