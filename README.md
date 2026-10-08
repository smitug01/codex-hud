# Codex HUD for Codex 0.161.0 — hardened macOS fork

A native, live, three-row HUD below the Codex composer, using Codex **0.161.0**. This fork ports the display from [Jiawang1209/codex-hud](https://github.com/Jiawang1209/codex-hud) and replaces its shell-based renderer bridge with a bounded, asynchronous, restricted subprocess.

## Use a release

Download the macOS Apple Silicon bundle and `SHA256SUMS` from [Releases](https://github.com/smitug01/codex-hud/releases). Node.js **24+** is required. In the download directory:

```sh
shasum -a 256 -c SHA256SUMS
mkdir codex-hud-native
tar -xzf codex-hud-0.161.0-macos-arm64.tar.gz -C codex-hud-native
```

From your project directory, run the extracted launcher by its absolute path:

```sh
/path/to/codex-hud-native/scripts/codex-hud-native
/path/to/codex-hud-native/scripts/codex-hud-native resume --last
```

Your official `codex`, shell profile and global Codex configuration are not replaced. The launcher uses your existing Codex login/config/session home. To return to the official build, run `codex` normally. The binary is an unofficial, unsigned build.

The HUD reads only the current conversation rollout and receives the current model/effort/branch from Codex. It refreshes every two seconds. It stays below the input while ordinary shortcut/queue hints remain available. Slow or failed rendering reports `HUD unavailable` instead of blocking typing.

## Security

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for findings, mitigations and limits. No intentional data-upload code was found in the inspected upstream HUD, but its original arbitrary `command:` shell bridge was risky and is removed here.

The macOS native HUD subprocess has a cleared environment, bounded input/output, no shell execution, restricted file access, no child processes, no network access, and no filesystem writes. These restrictions apply to HUD; Codex itself continues its normal network and tool operations. Source/build dependencies are not comprehensively audited.

The bundled renderer uses default styling. Custom `~/.codex-hud/config.json` is not loaded in native mode. It omits Git dirty/ahead/behind information and may omit historical activity outside the most recent 4 MiB of the active rollout. Upstream `status`/`run` pane commands remain available but do not share this native security boundary.

## Build and release

```sh
npm ci --ignore-scripts
npm test
```

The committed patch applies to official Codex commit `979011409de0a60b52f179721948e65531d26144` (`rust-v0.161.0`). Build it with Rust 1.95.0:

```sh
git clone --depth 1 --branch rust-v0.161.0 https://github.com/openai/codex.git codex
test "$(git -C codex rev-parse HEAD)" = 979011409de0a60b52f179721948e65531d26144
git -C codex apply ../patches/codex-cli-command-statusline.patch
cd codex/codex-rs
cargo build --locked --release -p codex-cli
cargo test --locked --release -p codex-tui --lib native_hud
cargo test --locked --release -p codex-tui --lib status_surface
```

Use `node dist/index.js native --codex /absolute/path/to/patched/codex --` to launch from a source checkout. Native mode requires macOS and Node.js 24+.

GitHub Actions builds/tests on pushes to `main`, PRs and manual dispatch. A version tag matching `v*-hud.*` additionally publishes a release after the build and tests pass, including SHA-256 checksums and source/build metadata. Publishing to npm is disabled for this fork.

## License

HUD retains its upstream MIT license. Codex source and binary retain their upstream Apache-2.0 license; release bundles include both license files.
