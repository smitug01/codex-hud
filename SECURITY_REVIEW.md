# Security review: codex-hud native integration for Codex 0.161.0

Scope: the installed upstream npm package `@jiawang1209/codex-hud@0.1.11`, the fork's TypeScript/runtime sources, the original Rust patch, the replacement patch, and the release workflow. This is a targeted source review and regression exercise, not a complete audit of Codex, Rust/Node dependencies, or the operating system.

## Findings in the original integration

| Severity | Finding | Evidence / precondition | Resolution in the native release |
| --- | --- | --- | --- |
| High | Configurable arbitrary shell command runs outside agent tool approval | Original patch in `status_surfaces.rs` executes `command:` through `sh -lc` / `cmd /C`. Someone able to influence an effective status-line config can supply a command. This is an execution capability, not proof of an intentional backdoor. | No `command:` handler is added. The launcher opts in via two absolute executable/script paths, captured once at widget creation; data is JSON over stdin. |
| Medium | UI hang and unbounded output allocation | Original synchronous `Command::output()` runs on the status refresh path with no timeout or output limit. | One asynchronous child per widget, two-second timeout, kill/reap, 16 KiB stdout cap, three rendered rows, two-second refresh interval. |
| Medium | Wrong-session exposure and excess disk reads | Original `findLatestSessionFile` scans session directories, reads whole files, allows ancestor/descendant cwd matches, and falls back to the globally newest session. | Native renderer only receives the active rollout path from Codex, refuses symlinks/nonregular files, reads at most the last 4 MiB, and never scans for another session. |
| Medium | Renderer inherits secrets and broad host access | Original shell and HUD subprocess inherit the complete Codex environment, and have ordinary user file/network permissions. | Clear environment. Node permission model allows only bundle files and the selected rollout, denies child processes/addons/workers/writes. macOS Seatbelt additionally denies network and filesystem writes. Failure to start the sandbox fails closed with an unavailable HUD. |
| Low | Terminal-control injection / misleading identity | Untrusted tool names, directory names and branch text are rendered without removing control characters; model identity is read from global config rather than active runtime state. | Strip controls and bidi overrides from dynamic strings before adding trusted ANSI styles; use current model/effort/branch from Codex. |
| Low | Installing an older Codex without clear version parity | Original installer pins `rust-v0.131.0`, despite a newer official CLI being installed. | Pin 0.161.0 commit `979011409de0a60b52f179721948e65531d26144`; verify before patching; leave official CLI untouched in the release-bundle path. |

## Package provenance

The installed npm package was compared byte-for-byte with the registry tarball: all 41 runtime, source-map, package manifest, and patch files matched. The tarball integrity was verified as `sha512-lC3H3p617Mxh7luBZsD5DVikafembtGj/3bUbuQKrFRrNxJ+N7196ocEfhJ/nLp+kyzGgFJy5iEb1KOuNN4pQw==`. This detects local divergence from the published package, not malicious code already present in the publisher's package. The fork base is upstream commit `53e120d`; source changes after npm 0.1.11 include upstream shim handling fixes.

## Exfiltration / backdoor assessment

No explicit upload, telemetry endpoint, HTTP client, WebSocket client, obfuscated payload loader, `eval`, or npm install lifecycle hook was found in the reviewed HUD runtime. The package has no runtime npm dependencies. The original installer contacts GitHub to clone Codex; Cargo contacts source/package registries while building. Normal Codex itself still communicates with its configured model/services.

This finding means **no intentional exfiltration was identified in the inspected code**, not a proof that every dependency or binary is benign. The hardened macOS HUD has its own network-denied subprocess boundary; this restriction does not apply to the parent Codex process or its ordinary tools.

## Native release boundary

- The trusted launcher and immutable release contents are part of the trust boundary. Someone who can replace the launcher/binary or change the parent process environment already controls local execution; this patch is not protection against a compromised account.
- The renderer receives runtime metadata and can read conversation text in the selected rollout; it is not given auth/config files. JSONL payloads are data, never evaluated, interpolated into shell syntax, or submitted to a model by HUD.
- No shell is involved in Rust-to-renderer execution. The bundled launcher uses quoted arguments and `exec`; it does not use `eval`.
- macOS is the supported hardened native release target. Other platforms retain upstream pane mode; it does not claim the native renderer's Seatbelt boundary.
- The last-4-MiB read can omit older tool/plan/token events. Missing information is omitted instead of reading other sessions. Git dirty/ahead/behind markers are intentionally absent because the native renderer is not permitted to launch Git.
- Output limits bound stdout and session processing; the OS is still responsible for process memory scheduling. Node's permission model is defense in depth, not a general hostile-code sandbox.
- Bundles are unsigned/unnotarized. SHA-256 files verify downloaded bytes against the published release; they do not provide independent publisher authentication.

## Verification and release controls

`tests/native-renderer.test.js` exercises control-character and shell-looking metadata, bounded regular-file reads, symlink rejection, permission-denied reads/writes/subprocesses, macOS network denial, and a renderer started with a cleared environment. Rust tests cover ANSI/multiline output and composer layout/clipping; the release workflow also runs existing status-surface regression tests.

CI checks out a full Codex commit SHA, applies the committed patch, builds with `--locked` and Rust 1.95.0, and checks the binary reports 0.161.0. The upstream tag's lockfile still labels 160 local workspace crates as 0.0.0; the patch corrects those entries to 0.161.0 without changing external dependency versions/checksums. GitHub Actions are pinned to commit SHAs; build jobs have read-only repository permissions and do not persist checkout credentials. Only the post-test release job has write permission, and only tag pushes can publish.

The workflow packages the tested binary, renderer, patch, licenses, review and build metadata. Build failures and failed tests prevent publication.
