# Windows and WSL Parity Design

## Goal

Make Windows PowerShell/CMD and WSL feel as close as practical to the current macOS Codex HUD CLI experience without Docker or a container layer.

## Non-Goals

- Do not introduce Docker.
- Do not merge native Windows and WSL installs into one shared install.
- Do not promise that every terminal renders identically; instead make the runtime, shim, diagnostics, and docs actively support both paths.

## User Experience

macOS remains the reference behavior: `codex-hud install`, `codex-hud doctor`, then `codex` launches a patched Codex binary whose bottom footer is rendered by `codex-hud status`.

WSL should use the same Linux-style commands and should keep all paths inside WSL:

```bash
npm install -g @jiawang1209/codex-hud
codex-hud install
codex-hud doctor
codex
```

PowerShell/CMD should use native Windows shims and should avoid PowerShell `.ps1` execution policy issues:

```powershell
npm install -g @jiawang1209/codex-hud
codex-hud.cmd install
codex-hud.cmd doctor
codex.cmd
```

## Architecture

Codex HUD stays as a local npm CLI. `codex-hud install` builds or reuses a patched Codex checkout under the user's home directory, writes a reversible shim, and configures the patched Codex launch command to call `codex-hud status` from the footer.

Platform behavior is explicit:

- `darwin`, `linux`, and WSL use `codex`, `codex-hud`, and `sh -lc`.
- Native Windows uses `codex.cmd`, `codex-hud.cmd`, and `cmd.exe /C`.
- WSL is detected as Linux for runtime behavior but receives separate diagnostics so users do not mix Windows and WSL paths.

## Components

- `src/native-runner.ts`: builds native Codex args and shim scripts. It must pass the effective platform through every native launch path so Windows gets `codex-hud.cmd status`.
- `src/installer.ts`: builds the install plan and calls shim installation using the same platform model. It should keep native Windows and WSL paths separate.
- `src/sources/codex.ts`: powers `codex-hud doctor`. It should report platform, shim readiness, patched Codex readiness, footer command readiness, and actionable mismatch messages.
- `src/render.ts`: renders HUD output. It should provide a Windows-safe output mode when the terminal cannot reliably render Unicode blocks or ANSI.
- `tests/*.test.js`: lock the Windows and WSL behavior so future releases do not regress.

## Error Handling

`doctor` should fail when the runtime path cannot launch a full native HUD, not only when `codex` is missing. It should distinguish:

- official Codex found before the Codex HUD shim
- `codex-hud` missing from the same environment
- patched Codex binary missing
- shim installed but pointing at a missing binary
- Windows command path using `codex-hud` instead of `codex-hud.cmd`
- WSL install accidentally pointing at Windows paths

## Testing

Testing is local and deterministic. We do not need Windows or Docker for the first implementation pass because most behavior is command construction, shim generation, and doctor classification.

Required tests:

- Windows native args inject `command: codex-hud.cmd status` through the actual `runNativeCodex` path.
- Windows shim generation handles paths with spaces.
- WSL/Linux native args inject `command: codex-hud status`.
- Doctor returns non-ok when shim, patched Codex, or native status command is missing.
- Doctor reports platform-specific guidance for Windows and WSL.
- Renderer can emit an ASCII-safe progress bar mode for terminals that do not support block glyphs reliably.

