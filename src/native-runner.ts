import { spawn } from "node:child_process";
import { chmod, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { shellQuote } from "./tmux-runner.js";

export interface NativeOptions {
  codexArgs: string[];
  codexPath?: string;
  dryRun: boolean;
  platform?: NodeJS.Platform;
}

export interface ShimOptions {
  binDir?: string;
  codexPath?: string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  platform?: NodeJS.Platform;
}

export interface ShimResult {
  changed: boolean;
  path: string;
}

export interface RemoveShimResult {
  path: string;
  removed: boolean;
}

const SHIM_MARKER = "codex-hud shim";

export function parseNativeArgs(args: string[]): NativeOptions {
  const separatorIndex = args.indexOf("--");
  const wrapperArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  const codexArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);
  let codexPath: string | undefined;
  let dryRun = false;

  for (let index = 0; index < wrapperArgs.length; index += 1) {
    const arg = wrapperArgs[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--codex" && wrapperArgs[index + 1]) {
      codexPath = wrapperArgs[index + 1];
      index += 1;
    }
  }

  return { codexArgs, codexPath, dryRun };
}

export function parseShimArgs(args: string[]): ShimOptions {
  let binDir: string | undefined;
  let codexPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bin-dir" && args[index + 1]) {
      binDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--codex" && args[index + 1]) {
      codexPath = args[index + 1];
      index += 1;
    }
  }

  return { binDir, codexPath };
}

export function buildNativeCodexArgs(
  codexArgs: string[],
  options: Pick<ShimOptions, "platform"> = {},
): string[] {
  return [...codexArgs];
}

export function resolveNativeCodexPath(
  explicitPath?: string,
  options: Pick<ShimOptions, "env" | "homeDir" | "platform"> = {},
): string {
  if (explicitPath) return explicitPath;
  const env = options.env ?? process.env;
  if (env.CODEX_HUD_CODEX_PATH) return env.CODEX_HUD_CODEX_PATH;
  const platform = options.platform ?? process.platform;
  const codexBinary = platform === "win32" ? "codex.exe" : "codex";
  return platformPath(platform).join(
    options.homeDir ?? os.homedir(),
    ".codex-hud",
    "native",
    "openai-codex-0.161.0",
    "codex-rs",
    "target",
    "release",
    codexBinary,
  );
}

export async function runNativeCodex(options: NativeOptions): Promise<number> {
  const platform = options.platform ?? process.platform;
  const codexPath = resolveNativeCodexPath(options.codexPath, { platform });
  const args = buildNativeCodexArgs(options.codexArgs, { platform });

  if (options.dryRun) {
    process.stdout.write(`${[codexPath, ...args].map(shellQuote).join(" ")}\n`);
    return 0;
  }

  if (platform !== "darwin") {
    throw new Error("The hardened native release currently supports macOS only; use pane mode on other platforms.");
  }
  if (Number(process.versions.node.split(".")[0]) < 24) {
    throw new Error("Native HUD requires Node.js 24+ for the permission boundary.");
  }
  return await spawnInherited(codexPath, args, {
    ...process.env,
    CODEX_NATIVE_HUD_NODE: process.execPath,
    CODEX_NATIVE_HUD_SCRIPT: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "native-renderer.mjs"),
  });
}

export function defaultShimBinDir(options: Pick<ShimOptions, "env" | "platform"> = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (platform === "win32" && env.APPDATA) {
    return path.win32.join(env.APPDATA, "npm");
  }
  return path.join(os.homedir(), ".local", "bin");
}

export function buildShimScript(options: { codexPath: string; platform?: NodeJS.Platform }): string {
  if (isWindows(options.platform)) {
    return [
      "@echo off",
      `REM ${SHIM_MARKER}`,
      `codex-hud.cmd native --codex ${quoteCmdArg(options.codexPath)} -- %*`,
      "",
    ].join("\r\n");
  }

  return [
    "#!/bin/sh",
    `# ${SHIM_MARKER}`,
    `exec codex-hud native --codex ${shellQuote(options.codexPath)} -- "$@"`,
    "",
  ].join("\n");
}

export async function installCodexShim(options: ShimOptions = {}): Promise<ShimResult> {
  const binDir = options.binDir ?? defaultShimBinDir({ env: options.env, platform: options.platform });
  const shimPath = joinForBase(binDir, options.platform, isWindows(options.platform) ? "codex.cmd" : "codex");
  const backupPath = backupShimPath(shimPath);
  const codexPath = resolveNativeCodexPath(options.codexPath, {
    env: options.env,
    homeDir: options.homeDir,
    platform: options.platform,
  });
  const script = buildShimScript({ codexPath, platform: options.platform });

  await mkdir(binDir, { recursive: true });
  const existing = await readOptionalFile(shimPath);
  if (existing !== undefined) {
    if (!existing.includes(SHIM_MARKER)) {
      if (await readOptionalFile(backupPath) !== undefined) {
        if (await pathsResolveToSameFile(shimPath, backupPath)) {
          await rm(shimPath, { force: true });
        } else {
          throw new Error(`codex already exists at ${shimPath} and backup already exists at ${backupPath}`);
        }
      } else {
        await rename(shimPath, backupPath);
      }
    }
    if (existing === script) {
      return { changed: false, path: shimPath };
    }
  }

  await writeFile(shimPath, script, "utf8");
  await chmod(shimPath, 0o755);
  return { changed: true, path: shimPath };
}

export async function removeCodexShim(options: Pick<ShimOptions, "binDir" | "platform"> = {}): Promise<RemoveShimResult> {
  const binDir = options.binDir ?? defaultShimBinDir({ platform: options.platform });
  const shimPath = joinForBase(binDir, options.platform, isWindows(options.platform) ? "codex.cmd" : "codex");
  const backupPath = backupShimPath(shimPath);
  const existing = await readOptionalFile(shimPath);
  if (existing === undefined || !existing.includes(SHIM_MARKER)) {
    return { path: shimPath, removed: false };
  }

  await rm(shimPath, { force: true });
  if (await readOptionalFile(backupPath) !== undefined) {
    await rename(backupPath, shimPath);
  }
  return { path: shimPath, removed: true };
}

function isWindows(platform: NodeJS.Platform | undefined): boolean {
  return (platform ?? process.platform) === "win32";
}

function platformPath(platform: NodeJS.Platform | undefined): typeof path {
  return isWindows(platform) ? path.win32 : path;
}

export function joinForBase(base: string, platform: NodeJS.Platform | undefined, ...parts: string[]): string {
  if (isWindows(platform) && !isPosixAbsolutePath(base)) {
    return path.win32.join(base, ...parts);
  }
  return path.join(base, ...parts);
}

function isPosixAbsolutePath(value: string): boolean {
  return value.startsWith("/");
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function backupShimPath(shimPath: string): string {
  return `${shimPath}.codex-hud-backup`;
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function pathsResolveToSameFile(left: string, right: string): Promise<boolean> {
  try {
    const [leftStat, rightStat, leftRealPath, rightRealPath] = await Promise.all([
      lstat(left),
      lstat(right),
      realpath(left),
      realpath(right),
    ]);
    if (leftRealPath !== rightRealPath) return false;
    return leftStat.isSymbolicLink() || rightStat.isSymbolicLink();
  } catch {
    return false;
  }
}

function spawnInherited(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
