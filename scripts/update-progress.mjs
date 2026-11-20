#!/usr/bin/env node
// 全量更新进度查看器 + 写入 CLI。
//
// 状态文件（默认 ~/.local/share/license-atlas-update/progress.json）由两方写入：
//   1. KB scripts/update-all.sh 内联 python 埋点（step 级 + HF/GitHub per-source）
//   2. 本脚本 --set（license-atlas 侧 Phase 2-7 由 agent 逐步标记）
// 写入规则（started_at / duration_s / status 语义）两边保持一致，修改任一侧须同步另一侧。
//
// 用法：
//   node scripts/update-progress.mjs                       # 渲染一次 item list + 进度条
//   node scripts/update-progress.mjs --watch               # 每 5s 刷新（实时进度）
//   node scripts/update-progress.mjs --set terms-check running [detail…]
//   node scripts/update-progress.mjs --set build done "334 pages"
//   node scripts/update-progress.mjs --reset               # 开新一轮（全 item 重置 pending）

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const DEFAULT_PROGRESS_FILE = path.join(
  os.homedir(), '.local/share/license-atlas-update/progress.json'
);
export const DEFAULT_KB_DIR = path.resolve(import.meta.dirname, '../../KB');

// 全链路 item 清单（顺序即渲染顺序）。status 权重：done/warn/skipped/failed=1、running=0.5、pending=0。
export const ITEM_ORDER = [
  { id: 'licenses-crawl', label: '标准许可证原文（SPDX/OSI/tldrlegal/CC/OpenMDW…）' },
  { id: 'scancode', label: 'ScanCode LicenseDB 增量' },
  { id: 'hf:models', label: 'HF models parquet（下载+抽取）' },
  { id: 'hf:datasets', label: 'HF datasets parquet' },
  { id: 'hf:license-tags', label: 'HF license-tags 抽取' },
  { id: 'hf:license-trends', label: 'HF license-trends 抽取' },
  { id: 'hf:other-licenses', label: 'HF other-license 模型清单' },
  { id: 'hf:other-license-datasets', label: 'HF other-license 数据集清单' },
  { id: 'hf:gated-licenses', label: 'HF gated 许可证清单' },
  { id: 'gh:license-trends', label: 'GitHub license-trends' },
  { id: 'gh:license-counts', label: 'GitHub license-counts' },
  { id: 'gh:agent-skills', label: 'GitHub agent-skills' },
  { id: 'kaggle', label: 'Kaggle meta-license-tags' },
  { id: 'hf-custom-merge', label: 'HF 自定义许可证去重合并（LLM 审核）' },
  { id: 'gh-custom', label: 'GitHub 自定义许可证增量' },
  { id: 'clean', label: '数据清洗 clean-licenses' },
  { id: 'merge-osi', label: 'OSI review 并入语料' },
  { id: 'terms-check', label: 'Terms 缺口检查与抓取' },
  { id: 'proprietary', label: '专有许可证 LLM 分类' },
  { id: 'sync', label: '同步 cleaned → src/data' },
  { id: 'search-index', label: '搜索索引重建' },
  { id: 'sitemap', label: 'sitemap 重建' },
  { id: 'readme', label: 'README 计数刷新' },
  { id: 'build', label: 'Next.js 构建验证' },
  { id: 'commit-push', label: '提交并推送 GitHub' },
];

const TERMINAL = new Set(['done', 'warn', 'failed', 'skipped']);

export function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function newState(now = new Date()) {
  return { run_id: now.toISOString().replace(/[-:T]/g, '').slice(0, 14), started_at: iso(now), steps: {} };
}

function iso(d) {
  return new Date(d).toISOString();
}

// 与 update-all.sh 内联 python 埋点同语义：首次 running 记 started_at；
// 终态补 duration_s；覆盖式更新（幂等，重复标 done 无副作用）。
export function applySet(state, id, status, detail, now = new Date()) {
  const steps = (state.steps ??= {});
  const s = (steps[id] ??= {});
  if (status === 'running' && !s.started_at) s.started_at = iso(now);
  if (TERMINAL.has(status)) {
    if (s.started_at && s.duration_s == null) {
      s.duration_s = Math.max(0, Math.round((now - new Date(s.started_at)) / 1000));
    }
    if (!s.ended_at) s.ended_at = iso(now);
  }
  s.status = status;
  if (detail !== undefined && detail !== '') s.detail = String(detail);
  state.updated_at = iso(now);
  return state;
}

export function progressPct(state) {
  const all = ITEM_ORDER.map(({ id }) => state?.steps?.[id]?.status);
  const known = all.filter((s) => s && s !== 'pending');
  const weight = known.reduce((acc, s) => acc + (TERMINAL.has(s) ? 1 : s === 'running' ? 0.5 : 0), 0);
  return known.length === 0 ? 0 : weight / all.length;
}

function fmtDur(sec) {
  if (sec == null) return '   -';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

function fmtMB(bytes) {
  return `${(bytes / 1e6).toFixed(0)}MB`;
}

// KB .cache 下的 *.download 断点文件探测（parquet 下载中断恢复时可独立于状态文件显示进度）。
export function detectDownloads(kbDir) {
  const out = {};
  try {
    const cache = path.join(kbDir, 'data/hf-hub-stats/.cache');
    for (const f of fs.readdirSync(cache)) {
      const m = f.match(/^(.+)\.parquet\.download$/);
      if (m) out[m[1]] = fs.statSync(path.join(cache, f)).size;
    }
  } catch {
    /* KB 目录不存在时静默 */
  }
  return out;
}

const GLYPH = { done: '✓', warn: '!', failed: '✗', skipped: '⊘', running: '⏳', pending: '○' };
const COLOR = {
  done: '\x1b[32m', warn: '\x1b[33m', failed: '\x1b[31m',
  skipped: '\x1b[90m', running: '\x1b[36m', pending: '\x1b[90m',
};

export function renderProgress(state, { now = new Date(), color = false, kbDir = DEFAULT_KB_DIR } = {}) {
  const downloads = detectDownloads(kbDir);
  const lines = [];
  const runId = state?.run_id ?? '(no run)';
  const elapsed = state?.started_at ? Math.round((now - new Date(state.started_at)) / 1000) : null;

  lines.push(`LicenseAtlas 全量更新 · run ${runId} · ${state?.updated_at ? 'updated ' + state.updated_at.slice(11, 19) + 'Z' : '尚无运行记录'}`);

  if (!state || Object.keys(state.steps ?? {}).length === 0) {
    const pct = 0;
    lines.push(`${bar(pct, color)} 0% · 全部 ${ITEM_ORDER.length} 项待开始`);
    lines.push('');
    lines.push('  （由 KB update-all.sh 埋点自动写入；atlas 侧用 --set 逐项标记）');
    return lines.join('\n');
  }

  const pct = progressPct(state);
  lines.push(`${bar(pct, color)} ${Math.round(pct * 100)}% · ${fmtDur(elapsed)}`);
  lines.push('');

  for (const { id, label } of ITEM_ORDER) {
    const s = state.steps?.[id];
    const status = s?.status ?? 'pending';
    const g = GLYPH[status] ?? '○';
    const c = color ? (COLOR[status] ?? '') : '';
    const r = color ? '\x1b[0m' : '';
    const dur = TERMINAL.has(status)
      ? s?.duration_s
      : s?.started_at
        ? Math.round((now - new Date(s.started_at)) / 1000)
        : null;
    let detail = s?.detail ? ` · ${s.detail}` : '';
    if (status === 'running' && downloads[id.split(':')[1]]) {
      detail += ` · ⇣ 断点文件 ${fmtMB(downloads[id.split(':')[1]])}`;
    }
    lines.push(`  ${c}${g}${r} ${id.padEnd(26)} ${fmtDur(dur).padStart(7)}  ${label}${detail}`);
  }

  // 状态文件里出现的不明步骤（防御：脚本演进后旧 run 遗留 id）
  const known = new Set(ITEM_ORDER.map((i) => i.id));
  for (const [id, s] of Object.entries(state.steps)) {
    if (!known.has(id) && s?.status && s.status !== 'pending') {
      lines.push(`  ? ${id.padEnd(26)} ${fmtDur(s.duration_s).padStart(7)}  ${s.status}${s.detail ? ' · ' + s.detail : ''}`);
    }
  }
  return lines.join('\n');
}

function bar(pct, color) {
  const W = 24;
  const fill = Math.round(pct * W);
  const b = '█'.repeat(fill) + '░'.repeat(W - fill);
  return color ? `\x1b[35m${b}\x1b[0m` : b;
}

function save(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 1));
}

function main() {
  const argv = process.argv.slice(2);
  let file = DEFAULT_PROGRESS_FILE;
  let kbDir = DEFAULT_KB_DIR;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') file = argv[++i];
    else if (argv[i] === '--kb') kbDir = argv[++i];
    else if (argv[i] === '--set') {
      const [id, status, ...detail] = argv.slice(i + 1);
      if (!id || !status) { console.error('--set 用法: --set <id> <running|done|warn|failed|skipped> [detail…]'); process.exit(2); }
      const state = loadState(file) ?? newState();
      save(file, applySet(state, id, status, detail.join(' ')));
      console.log(renderProgress(state, { color: true, kbDir }));
      return;
    } else if (argv[i] === '--reset') {
      save(file, newState());
      console.log(renderProgress(loadState(file), { color: true, kbDir }));
      return;
    } else if (argv[i] === '--watch') {
      const tick = () => {
        process.stdout.write('\x1b[2J\x1b[H' + renderProgress(loadState(file), { color: true, kbDir }) + '\n');
      };
      tick();
      setInterval(tick, 5000);
      return;
    }
  }
  console.log(renderProgress(loadState(file), { color: process.stdout.isTTY, kbDir }));
}

if (process.argv[1] === import.meta.filename) main();
