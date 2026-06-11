# Installation

## Recommended Native HUD

Install Codex HUD from npm:

```bash
npm install -g @jiawang1209/codex-hud
```

Then run `codex-hud install`. This is the step that makes the normal `codex` command use the full Codex HUD footer. `codex-hud setup` is only a fallback and does not install the native adapter.

Codex HUD is designed to provide the same native footer workflow on macOS, Linux, WSL, and Windows PowerShell/CMD without Docker. Each environment gets its own local install, shim, patched Codex binary, and `doctor` check. Keep WSL and native Windows installs separate; do not share npm or Codex paths across that boundary.

`codex-hud install` prepares the native bundle:

- downloads a clean Codex CLI source checkout under `~/.codex-hud/native/openai-codex`
- applies the bundled command-backed status-line patch
- builds the patched Codex binary
- installs a reversible Codex shim

## macOS or Linux

Install prerequisites:

```bash
# macOS
brew install git rust tmux

# Debian/Ubuntu
sudo apt update
sudo apt install -y git cargo tmux
```

Install and verify:

```bash
codex-hud install
codex-hud doctor
which codex
codex
```

The shim is usually installed at `~/.local/bin/codex`. If `which codex` still points to the official Codex binary, put `~/.local/bin` earlier in `PATH`.

## Windows PowerShell or CMD

Use this path when your prompt shows Windows paths such as `C:\Users\<you>\...`.

This is the native Windows path. It uses npm `.cmd` shims so PowerShell execution policy does not block the footer command.

Install prerequisites:

```powershell
winget install Git.Git Rustlang.Rustup
```

Install and verify:

```powershell
npm install -g @jiawang1209/codex-hud
codex-hud.cmd install
codex-hud.cmd doctor
where.exe codex
codex.cmd
```

On native Windows, Codex HUD writes `codex.cmd` in npm's global shim directory under `%APPDATA%\npm`. It injects `codex-hud.cmd status` so PowerShell execution policy does not block npm's `.ps1` shim.

`where.exe codex` should list the Codex HUD shim first, usually:

```text
C:\Users\<you>\AppData\Roaming\npm\codex.cmd
```

If an official `codex.cmd` already exists there, Codex HUD backs it up before installing its own shim and restores the backup during:

```powershell
codex-hud.cmd uninstall-shim
```

Do not use `codex-hud setup` when your goal is to make `codex.cmd` show the full Codex HUD footer. `setup` only configures Codex CLI's built-in status line.

## WSL

Use this path when you are inside WSL Ubuntu/Debian and paths look like `/home/<you>/...`. Treat WSL as Linux, not native Windows.

WSL uses the Linux-style path from inside WSL. Keep the WSL Codex install, WSL npm install, and WSL shim separate from native Windows installs.

Install prerequisites:

```bash
sudo apt update
sudo apt install -y git cargo tmux
```

Install and verify:

```bash
npm install -g @jiawang1209/codex-hud
codex-hud install
which codex
codex-hud doctor
codex
```

The shim is usually installed at `~/.local/bin/codex`. Do not put the Windows `codex.cmd` path into WSL, and do not use the WSL shim from PowerShell.

## Custom Paths

Use custom paths when you already keep a Codex source checkout somewhere else or need a different shim directory:

```bash
codex-hud install --codex-source ~/src/openai-codex --bin-dir ~/.local/bin
```

On Windows PowerShell:

```powershell
codex-hud.cmd install --codex-source "$env:USERPROFILE\src\openai-codex" --bin-dir "$env:APPDATA\npm"
```

## Fallbacks

Use `codex-hud run` if you want an external HUD pane and do not need native in-window footer integration:

```bash
codex-hud run
```

Use `codex-hud setup` only if you cannot build the native adapter and want Codex CLI's built-in status-line items:

```bash
codex-hud setup
codex
```

This fallback does not use the full Codex HUD renderer, so the style and rate-limit percentages can differ from `codex-hud status`.

## ASCII Progress Bars

If your terminal font cannot render block progress bars cleanly, use ASCII bars:

```bash
CODEX_HUD_ASCII=1 codex-hud status
```

On Windows PowerShell:

```powershell
$env:CODEX_HUD_ASCII = "1"
codex-hud.cmd status
```
