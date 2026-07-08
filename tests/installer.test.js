import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildInstallPlan,
  patchActionFromChecks,
  parseInstallArgs,
  validateNativePatchIntegrity,
} from "../dist/installer.js";

test("parseInstallArgs supports dry-run and explicit native source", () => {
  const parsed = parseInstallArgs([
    "--dry-run",
    "--codex-source",
    "/tmp/openai-codex",
    "--bin-dir",
    "/tmp/bin",
  ]);

  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.codexSource, "/tmp/openai-codex");
  assert.equal(parsed.binDir, "/tmp/bin");
});

test("buildInstallPlan points at patched Codex binary and shim destination", () => {
  const plan = buildInstallPlan({
    codexSource: "/tmp/openai-codex",
    binDir: "/tmp/bin",
    dryRun: true,
  });

  assert.equal(plan.codexSource, "/tmp/openai-codex");
  assert.equal(plan.codexBinary, "/tmp/openai-codex/codex-rs/target/release/codex");
  assert.equal(plan.shimPath, "/tmp/bin/codex");
});

test("buildInstallPlan points at Windows patched Codex binary and cmd shim", () => {
  const plan = buildInstallPlan({
    codexSource: "C:\\Users\\me\\openai-codex",
    binDir: "C:\\Users\\me\\bin",
    dryRun: true,
    platform: "win32",
  });

  assert.equal(plan.codexBinary, "C:\\Users\\me\\openai-codex\\codex-rs\\target\\release\\codex.exe");
  assert.equal(plan.shimPath, "C:\\Users\\me\\bin\\codex.cmd");
});

test("buildInstallPlan defaults to the npm global shim directory on Windows", () => {
  const plan = buildInstallPlan({
    codexSource: "C:\\Users\\me\\openai-codex",
    dryRun: true,
    env: { APPDATA: "C:\\Users\\me\\AppData\\Roaming" },
    platform: "win32",
  });

  assert.equal(plan.shimPath, "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd");
});

test("buildInstallPlan applies bundled Codex patch before building", () => {
  const plan = buildInstallPlan({
    codexSource: "/tmp/openai-codex",
    dryRun: true,
  });

  assert.deepEqual(plan.commands[1], ["git", "apply", "patches/codex-cli-command-statusline.patch"]);
  assert.deepEqual(plan.commands[2], ["cargo", "build", "--release", "-p", "codex-cli"]);
});

test("patchActionFromChecks treats reverse-applicable patch as already installed", () => {
  assert.equal(patchActionFromChecks(true, false), "apply");
  assert.equal(patchActionFromChecks(false, true), "already-applied");
  assert.equal(patchActionFromChecks(false, false), "conflict");
});

test("bundled Codex patch runs command-backed status lines through cmd.exe on Windows", async () => {
  const patch = await readFile("patches/codex-cli-command-statusline.patch", "utf8");

  assert.match(patch, /cfg!\(windows\)/);
  assert.match(patch, /Command::new\("cmd"\)/);
  assert.match(patch, /\.arg\("\/C"\)/);
  assert.match(patch, /Command::new\("sh"\)/);
});

test("bundled Codex patch hunk headers match the patched line counts", async () => {
  const patch = await readFile("patches/codex-cli-command-statusline.patch", "utf8");
  const lines = patch.split("\n");
  let current = null;
  const hunks = [];

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      current = null;
      continue;
    }
    const match = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(line);
    if (match) {
      current = {
        expectedOld: Number(match[1] ?? 1),
        expectedNew: Number(match[2] ?? 1),
        old: 0,
        new: 0,
        header: line,
      };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("\\ No newline")) continue;
    const prefix = line[0];
    if (prefix === " ") {
      current.old += 1;
      current.new += 1;
    } else if (prefix === "-") {
      current.old += 1;
    } else if (prefix === "+") {
      current.new += 1;
    }
  }

  assert.ok(hunks.length > 0);
  for (const hunk of hunks) {
    assert.equal(hunk.old, hunk.expectedOld, hunk.header);
    assert.equal(hunk.new, hunk.expectedNew, hunk.header);
  }
});

test("validateNativePatchIntegrity catches a truncated command status-line patch", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "codex-hud-native-"));
  const chatwidgetDir = path.join(dir, "codex-rs", "tui", "src", "chatwidget");
  await mkdir(chatwidgetDir, { recursive: true });
  await writeFile(
    path.join(chatwidgetDir, "status_surfaces.rs"),
    [
      'const STATUS_LINE_COMMAND_PREFIX: &str = "command:";',
      "fn status_line_command_output(command: &str, cwd: &Path) -> Option<Vec<Line<'static>>> {",
      "    None",
      "}",
      'let output = status_line_command_output("printf");',
      '    .expect("status line output");',
      "",
    ].join("\n"),
    "utf8",
  );

  const errors = await validateNativePatchIntegrity(dir);

  assert.deepEqual(errors, [
    "codex-rs/tui/src/chatwidget/status_surfaces.rs is missing the completed ANSI style assertion",
  ]);
});
