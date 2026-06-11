# Windows and WSL Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make native Windows PowerShell/CMD and WSL launch and diagnose Codex HUD as close as practical to the macOS CLI path without Docker.

**Architecture:** Keep Codex HUD as a local npm CLI. Make platform handling explicit in native launch, shim generation, doctor readiness, and rendering fallback. Add tests first for Windows and WSL parity risks, then implement the smallest changes that make those tests pass.

**Tech Stack:** TypeScript, Node.js test runner, npm CLI shims, Codex CLI patched status-line command.

---

## File Map

- Modify `src/native-runner.ts`: pass platform into native Codex arg generation and expose dry-run construction for tests.
- Modify `tests/native-runner.test.js`: add Windows and WSL launch-path tests.
- Modify `src/sources/codex.ts`: make doctor readiness stricter and platform-aware.
- Modify `tests/doctor.test.js`: cover missing shim, missing patched Codex, wrong status command, and WSL path mismatch.
- Modify `src/config.ts` and `src/render.ts`: add optional ASCII bar output for weaker Windows terminal paths.
- Modify `tests/config.test.js` and `tests/render.test.js`: cover ASCII bar config.
- Modify `README.md`, `docs/installation.md`, and plugin skill docs: say Windows/WSL are first-class native targets and use doctor for parity checks.

## Tasks

### Task 1: Fix Windows native command injection

- [ ] Add a failing test in `tests/native-runner.test.js` proving the real dry-run launch path on Windows uses `tui.status_line=["command: codex-hud.cmd status"]`.
- [ ] Run `npm test -- tests/native-runner.test.js` and confirm the new test fails.
- [ ] Update `src/native-runner.ts` so `runNativeCodex` passes the effective platform into `buildNativeCodexArgs`.
- [ ] Run `npm test -- tests/native-runner.test.js` and confirm it passes.

### Task 2: Make doctor a real native-HUD readiness gate

- [ ] Add failing tests in `tests/doctor.test.js` for missing shim, missing patched Codex, and missing native status command.
- [ ] Run `npm test -- tests/doctor.test.js` and confirm the new tests fail.
- [ ] Update `src/sources/codex.ts` so `report.ok` requires Codex CLI, `codex-hud`, installed shim, patched Codex, and native status command.
- [ ] Add platform-specific doctor lines for Windows and WSL guidance.
- [ ] Run `npm test -- tests/doctor.test.js` and confirm it passes.

### Task 3: Add Windows-safe rendering fallback

- [ ] Add failing tests in `tests/config.test.js` and `tests/render.test.js` for `colors.barFilled: "#"` and `colors.barEmpty: "-"`.
- [ ] Run the targeted tests and confirm failure if validation rejects the desired values.
- [ ] Update config validation only as needed so ASCII bars are accepted.
- [ ] Run targeted tests and confirm they pass.

### Task 4: Restore docs from compatibility framing to parity framing

- [ ] Update README and installation docs to say the goal is macOS-like native experience on macOS, Linux, WSL, and PowerShell/CMD, with environment-specific commands.
- [ ] Keep a short note that WSL and native Windows installs must remain separate.
- [ ] Update plugin skill docs and plugin descriptions to match.
- [ ] Run plugin validation.

### Task 5: Full verification

- [ ] Run `npm test`.
- [ ] Run `python3 /Users/liuyue/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-hud`.
- [ ] Run `npm --cache /private/tmp/codex-hud-npm-cache pack --dry-run`.
- [ ] Review `git diff` for accidental scope creep.

