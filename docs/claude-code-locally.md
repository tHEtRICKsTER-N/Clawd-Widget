# Working on Clawd Widget with Claude Code on your PC

This guide is for Windows (PowerShell). You end up with Claude Code running inside your clone of the repo, able to read the code, run the app and the checks, and make changes for you to review.

## 1. What you need

| What | Why | How |
|---|---|---|
| A Claude **Pro, Max, Team or Enterprise** plan (or an Anthropic Console account) | Claude Code isn't included in the free plan | claude.ai → Settings → Billing |
| **Git for Windows** | Git itself, and Git Bash, which Claude Code uses to run commands | https://git-scm.com/downloads/win (defaults are fine) |
| **Node.js 22 LTS** | To build and run the widget (the project needs 20 or newer) | https://nodejs.org → the LTS installer |
| Optional: **GitHub CLI** | So Claude can open pull requests for you | `winget install GitHub.cli`, then `gh auth login` |

Check them in a **new** PowerShell window:

```powershell
git --version
node -v      # v22.x or newer
```

## 2. Install Claude Code

In PowerShell (you don't need to run it as Administrator):

```powershell
irm https://claude.ai/install.ps1 | iex
```

Close PowerShell, open a new window, and check:

```powershell
claude --version
```

If it says `claude` isn't recognized, the install folder isn't on your PATH yet. Restart Windows or see https://code.claude.com/docs/en/troubleshoot-install. `claude doctor` checks the installation. The native install updates itself in the background.

> Prefer windows to terminals? The Claude desktop app for Windows (https://claude.com/download) runs Claude Code too. Open the project folder there instead of steps 3–4.

## 3. Open the project and log in

```powershell
cd E:\Work\Programming\_Specials\Clawd-Widget
git checkout main
git pull
npm install
claude
```

The first time, `claude` opens your browser to log in with your Claude account. After that it starts in the project and reads `CLAUDE.md`, the project's notes for it: the ground rules, the commands and the workflow.

## 4. Things to ask it

Type in plain English. For example:

- `Read PLAN.md and DEVLOG.md and tell me where we are.`
- `Run the playground so I can try it.` It runs `npm run dev`; open http://localhost:5178.
- `Start the desktop widget.` It runs `npm run desktop`.
- `Continue with the next unchecked item in PLAN.md. Work on a new branch, run the checks, and open a PR when it's done.`
- `Clawd's toolbar overlaps the taskbar on my second monitor: find out why and fix it.`
- `Add a theme called "Ocean Night" with these colours: …`
- `Prepare release 1.2.0.`

Claude asks before running commands or editing files, and you approve each one (or allow a kind of command for the session). `Esc` stops it mid-step, and you can then redirect it.

Handy commands inside Claude Code:

| Command | Does |
|---|---|
| `/help` | lists commands |
| `/clear` | starts a fresh conversation (the project notes are read again) |
| `/config` | settings |

## 5. Getting changes onto GitHub

`main` is protected, so changes go through pull requests:

1. Claude works on a branch (ask it to, or say `create a branch for this`).
2. When it's done: `commit this and push the branch`.
3. With the GitHub CLI installed, `open a pull request`. Without it, GitHub shows a **Compare & pull request** button after the push.
4. Wait for the green CI ticks, then merge on GitHub.

## 6. Releasing a new version

1. Ask Claude: `prepare release 1.3.0: bump the version and write the CHANGELOG section, in a PR`. Then merge that PR.
2. Then, in PowerShell:
   ```powershell
   git checkout main
   git pull
   git tag v1.3.0
   git push origin v1.3.0
   ```
3. About 5 minutes later, the Releases page has the new installer, the portable `.exe`, the extension zip and the npm package.

## If something goes wrong

- **`npm install` fails:** check `node -v` (22+), delete the `node_modules` folder and try again.
- **`npm run desktop` is slow the first time:** it's downloading Electron (about 100 MB).
- **Windows says "Windows protected your PC"** for the built `.exe`: the app isn't code-signed. Click **More info → Run anyway**.
- **Claude seems confused about the project:** run `/clear`, then ask it to read `CLAUDE.md` and `PLAN.md` again.
