---
name: codex-hud
description: Use when the user wants to inspect, configure, or run Codex HUD for Codex CLI terminal telemetry.
---

# Codex HUD

Codex HUD is a terminal heads-up display for Codex CLI sessions. It surfaces model, reasoning effort, project, git branch, context usage, five-hour usage, weekly usage, active tools, and task progress.

```text
[gpt-5.5 medium] │ codex-hud git:(main*)
Context ████░░░░░░ 42% │ Usage ███████░░░ 68% (resets in 3h 17m) │ Weekly █████████░ 86% (resets in 6d 10h)
Todos 2/5 │ Exec active, Plan x2
```

Codex HUD is local-first. It reads Codex config, Codex session metadata, and git metadata from the user's machine. It should not upload data or display private transcript message bodies.

## Install

Follow the README order. If Node.js/npm or Codex CLI is already installed, skip that step.

### 1. Set Up npm

Codex HUD requires Node.js 18 or newer.

```bash
npm --version
```

### 2. Install Codex CLI

Codex HUD is built for Codex CLI.

```bash
codex --version
```

### 3. Install Codex HUD

Install the package:

```bash
npm install -g @jiawang1209/codex-hud
```

Then install the native HUD adapter. This is the step that makes the normal `codex` command use the full Codex HUD footer. `codex-hud setup` is only a fallback and does not install this adapter.

| Environment | Shim | Footer command |
| --- | --- | --- |
| macOS/Linux/WSL | `codex` | `codex-hud status` |
| Windows PowerShell/CMD | `codex.cmd` | `codex-hud.cmd status` |

macOS/Linux/WSL:

```bash
codex-hud install
codex-hud doctor
codex
```

Windows PowerShell/CMD:

```powershell
codex-hud.cmd install
codex-hud.cmd doctor
where.exe codex
codex.cmd
```

If `codex` still resolves to the official binary after install, put the shim directory before the existing Codex binary in `PATH`.

## Built-In Status Line Fallback

Use this only if the native adapter cannot be built. It does not make `codex` use the full Codex HUD renderer.

```bash
codex-hud setup
codex
```

## HUD Pane Mode

Use a live HUD pane alongside Codex:

```bash
codex-hud run
codex-hud run -- --model gpt-5.5 --sandbox danger-full-access
codex-hud run --terminal tmux
codex-hud run --terminal iterm
codex-hud run --terminal terminal
```

## Commands

| Command | Purpose |
| --- | --- |
| `codex-hud status` | Print one HUD snapshot. |
| `codex-hud watch` | Refresh the HUD until interrupted. |
| `codex-hud run` | Launch Codex with a persistent HUD pane. |
| `codex-hud install` | Recommended: build the native adapter and make `codex` use the full Codex HUD footer. |
| `codex-hud setup` | Fallback only: configure Codex CLI's built-in status line without installing the full HUD adapter. |
| `codex-hud native` | Launch a patched Codex binary with command-backed HUD output. |
| `codex-hud doctor` | Check Codex, Node.js, shim, native adapter, and config readiness. |
| `codex-hud config` | Print the effective Codex HUD config. |
| `codex-hud config init` | Create `~/.codex-hud/config.json`. |

Remove the auto-launch shim:

```bash
codex-hud uninstall-shim
```

## From Source

From the repository root:

```bash
npm install
npm run build
node dist/index.js status
node dist/index.js install --dry-run
node dist/index.js doctor
```
