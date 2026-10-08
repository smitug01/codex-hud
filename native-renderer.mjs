#!/usr/bin/env node
// Native-only renderer: explicit runtime metadata, exact active rollout, no
// network, subprocesses, user config, global session scan, or credential reads.
import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_CONFIG } from './dist/config.js';
import { renderHud } from './dist/render.js';
import { parseSessionJsonl } from './dist/sources/session.js';

export const MAX_ROLLOUT_BYTES = 4 * 1024 * 1024;
export function displayText(value) {
  return typeof value === 'string'
    ? value.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 200)
    : undefined;
}
export async function readActiveRollout(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !file.endsWith('.jsonl')) return '';
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await handle.stat();
    if (!info.isFile()) return '';
    const start = Math.max(0, info.size - MAX_ROLLOUT_BYTES);
    const buffer = Buffer.alloc(Math.min(info.size, MAX_ROLLOUT_BYTES));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } catch { return ''; }
  finally { await handle?.close(); }
}
export async function renderNative(input) {
  const signals = parseSessionJsonl(await readActiveRollout(input.rolloutPath));
  const snapshot = {
    ...signals,
    model: displayText(input.model),
    reasoningEffort: displayText(input.reasoningEffort),
    cwd: typeof input.cwd === 'string' ? input.cwd : '.',
    projectName: displayText(path.basename(typeof input.cwd === 'string' ? input.cwd : '.')),
    git: input.branch ? { branch: displayText(input.branch), isDirty: false, ahead: 0, behind: 0 } : undefined,
    tools: signals.tools.map(tool => ({ ...tool, name: displayText(tool.name) })),
    warnings: [],
  };
  return renderHud({ config: DEFAULT_CONFIG, snapshot, options: { color: true } });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 64 * 1024) throw new Error('HUD input exceeds limit');
  }
  const input = JSON.parse(raw);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid HUD input');
  process.stdout.write(`${await renderNative(input)}\n`);
}
