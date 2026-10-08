import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { displayText, readActiveRollout, renderNative, MAX_ROLLOUT_BYTES } from '../native-renderer.mjs';
const root = path.resolve(import.meta.dirname, '..');
test('metadata is display data, never shell commands or terminal controls', async () => {
  assert.equal(displayText('hello\x1b\x00\u202eworld'), 'helloworld');
  const output = await renderNative({ model: '$(touch /tmp/HUD-INJECTION)', cwd: '/project\nFAKE', branch: '`echo pwned`' });
  assert.match(output, /\$\(touch/);
  assert.equal(output.split('\n').length, 1);
});
test('only explicit regular rollout is read; symlinks refused; read is bounded', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-test-'));
  try {
    const file = path.join(dir, 'active.jsonl');
    await writeFile(file, 'header\n' + 'x'.repeat(MAX_ROLLOUT_BYTES) + '\n{"payload":{"type":"safe"}}\n');
    assert.equal(await readActiveRollout(file), '{"payload":{"type":"safe"}}\n');
    const link = path.join(dir, 'link.jsonl');
    await symlink(file, link);
    assert.equal(await readActiveRollout(link), '');
    assert.equal(await readActiveRollout(undefined), '');
    assert.equal(await readActiveRollout('relative.jsonl'), '');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('native permission boundary denies arbitrary reads, writes and child execution', () => {
  for (const probe of [
    "require('node:fs').readFileSync('/etc/hosts')",
    "require('node:fs').writeFileSync('/tmp/hud-should-not-write', 'x')",
    "require('node:child_process').execFileSync('/usr/bin/true')",
  ]) {
    const result = spawnSync(process.execPath, ['--permission', '-e', probe], { encoding: 'utf8', env: {} });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_ACCESS_DENIED/);
  }
});
test('macOS sandbox denies network', { skip: process.platform !== 'darwin' }, () => {
  const result = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)(deny network*)(deny file-write*)', process.execPath,
    '-e', "const s=require('node:net').connect(9,'127.0.0.1');s.on('error',e=>{console.log(e.code);process.exit(e.code==='EPERM'?0:1)});"], { encoding: 'utf8', env: {}, timeout: 5000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /EPERM/);
});
test('renderer runs with cleared environment and restricted file access', () => {
  const result = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${root}`, path.join(root, 'native-renderer.mjs')], {
    input: JSON.stringify({ model: 'test-model', reasoningEffort: 'high', cwd: '/tmp/project' }), encoding: 'utf8', env: {},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /test-model high/);
  assert.match(result.stdout, /project/);
});
