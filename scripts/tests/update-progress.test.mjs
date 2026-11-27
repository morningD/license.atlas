// SPDX-License-Identifier: MulanPSL-2.0

// update-progress.mjs 渲染/写入规则测试：node --test scripts/tests/update-progress.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  ITEM_ORDER, loadState, newState, applySet, progressPct, renderProgress,
} from '../update-progress.mjs';

const T0 = new Date('2026-11-20T12:00:00Z');

function freshRun() {
  const st = newState(T0);
  applySet(st, 'licenses-crawl', 'running', '', T0);
  applySet(st, 'licenses-crawl', 'done', '10 sources', new Date('2026-11-20T12:10:32Z'));
  applySet(st, 'hf:models', 'running', 'downloading', new Date('2026-11-20T12:10:32Z'));
  return st;
}

test('applySet: running 记 started_at，终态补 duration_s，重复幂等', () => {
  const st = newState(T0);
  applySet(st, 'clean', 'running', '', T0);
  assert.equal(st.steps.clean.started_at, '2026-11-20T12:00:00.000Z');
  applySet(st, 'clean', 'done', 'ok', new Date('2026-11-20T12:03:00Z'));
  assert.equal(st.steps.clean.duration_s, 180);
  const before = JSON.stringify(st);
  applySet(st, 'clean', 'done', 'ok', new Date('2026-11-20T12:04:00Z'));
  assert.equal(st.steps.clean.duration_s, 180, '重复终态不重算 duration');
  assert.notEqual(JSON.stringify(st), before); // updated_at 仍刷新
});

test('progressPct: 终态=1、running=0.5、未记录=0，分母为全 item 数', () => {
  const st = freshRun(); // 1 done + 1 running，其余 pending
  const expect = 1.5 / ITEM_ORDER.length;
  assert.equal(progressPct(st), expect);
  assert.equal(progressPct(null), 0);
});

test('renderProgress: 各状态字形齐全，含百分比与时长', () => {
  const st = freshRun();
  applySet(st, 'scancode', 'failed', 'timeout', new Date('2026-11-20T12:11:00Z'));
  const out = renderProgress(st, { now: new Date('2026-11-20T12:12:00Z'), color: false, kbDir: '/nonexistent' });
  assert.match(out, /✓ licenses-crawl/);
  assert.match(out, /⏳ hf:models/);
  assert.match(out, /✗ scancode/);
  assert.match(out, /○ hf:datasets/); // 未记录项渲染为 pending
  assert.match(out, /10m32s/);        // licenses-crawl duration
  assert.match(out, /1m28s/);         // hf:models 运行中时长 (12:10:32→12:12:00)
  assert.match(out, new RegExp(Math.round((2.5 / ITEM_ORDER.length) * 100) + '%'));
});

test('renderProgress: 空状态渲染全景 item list 提示', () => {
  const out = renderProgress(null, { color: false });
  assert.match(out, /0%/);
  assert.match(out, /全部 \d+ 项待开始/);
});

test('CLI --set 端到端：写临时文件、可读回、渲染成功', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prog-'));
  const file = path.join(dir, 'progress.json');
  const script = path.join(import.meta.dirname, '..', 'update-progress.mjs');
  execFileSync(process.execPath, [script, '--file', file, '--set', 'terms-check', 'running'], { stdio: 'pipe' });
  execFileSync(process.execPath, [script, '--file', file, '--set', 'terms-check', 'done', '0 missing'], { stdio: 'pipe' });
  const st = loadState(file);
  assert.equal(st.steps['terms-check'].status, 'done');
  assert.equal(st.steps['terms-check'].detail, '0 missing');
  assert.ok(Number.isFinite(st.steps['terms-check'].duration_s));
  fs.rmSync(dir, { recursive: true, force: true });
});
