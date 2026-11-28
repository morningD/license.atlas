// SPDX-License-Identifier: MulanPSL-2.0

// source-stats 的格式化、回落与 README 替换规则测试：node --test scripts/tests/source-stats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KB_INPUTS, README_FIGURE_RULES, approxFigure, applyReadmeFigures, collectSourceStats, exactFigure,
} from '../lib/source-stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Only the "仓库现状" test reads the committed file; the others use the fixed
// sample below, so they do not change with the real data.
const COMMITTED = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/source-stats.json'), 'utf8'));
const FIGURES = {
  scancode: { licenses: { value: 1673, en: '1,673', zh: '1,673' } },
  blueoak: { rated: { value: 225, en: '225', zh: '225' } },
  github: { license_types: { value: 28, en: '28', zh: '28' } },
  huggingface: {
    models: { value: 3250319, en: '3.2M+', zh: '320 万+' },
    datasets: { value: 1138066, en: '1.1M+', zh: '110 万+' },
  },
  kaggle: { datasets: { value: 713955, en: '713K+', zh: '71.3 万+' }, meta_kaggle_version: '2146' },
};

// A stand-in for the KB checkout: the same file layout with tiny contents.
// Keys of `omit` are left out so that the fallback path can be exercised.
function fakeKb(omit = new Set()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-stats-'));
  const write = (rel, data) => {
    if (omit.has(rel)) return;
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  write(KB_INPUTS.blueoak, {
    ratings: [{ name: 'Model', licenses: [{ id: 'a' }, { id: 'b' }] }, { name: 'Gold', licenses: [{ id: 'c' }] }],
  });
  write(KB_INPUTS.github, { generated_at: '2026-05-12T08:07:17.579Z', counts: { mit: 1, 'apache-2.0': 2, 'gpl-3.0': 3 } });
  write(KB_INPUTS.kaggle, { 'meta-license-tags': { meta_kaggle_version: '2146', total_datasets: 713955 } });
  return {
    dir,
    readKb: (rel) => {
      const file = path.join(dir, rel);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    },
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const NOW = new Date('2026-11-28T02:04:40.497Z');

function collect(kb, extra = {}) {
  return collectSourceStats({
    atlasStats: { by_source: { 'scancode-licensedb.aboutcode.org': 1673 } },
    previous: null,
    readKb: kb.readKb,
    parquetRows: () => 3250319,
    now: NOW,
    ...extra,
  });
}

test('approxFigure: 向下取整，中英文标签都不高于真实值', () => {
  assert.deepEqual(approxFigure(3250319), { value: 3250319, en: '3.2M+', zh: '320 万+' });
  assert.deepEqual(approxFigure(1138066), { value: 1138066, en: '1.1M+', zh: '110 万+' });
  assert.deepEqual(approxFigure(713955), { value: 713955, en: '713K+', zh: '71.3 万+' });
  // 量级边界
  assert.equal(approxFigure(1000000).en, '1M+');
  assert.equal(approxFigure(1000000).zh, '100 万+');
  assert.equal(approxFigure(999999).en, '999K+');
  assert.equal(approxFigure(100000).zh, '10 万+');
  assert.equal(approxFigure(150000).zh, '15 万+');
  // 不足一个取整单位时写精确数：英文从千起取整，中文从十万起取整
  assert.equal(approxFigure(99999).en, '99K+');
  assert.equal(approxFigure(99999).zh, '99,999');
  assert.equal(approxFigure(999).en, '999');
  assert.equal(approxFigure(999).zh, '999');
});

test('exactFigure: 精确计数，带千分位', () => {
  assert.deepEqual(exactFigure(1673), { value: 1673, en: '1,673', zh: '1,673' });
  assert.deepEqual(exactFigure(28), { value: 28, en: '28', zh: '28' });
});

test('collectSourceStats: 输入齐全时各数字取自对应输入', () => {
  const kb = fakeKb();
  try {
    const { stats, notes } = collect(kb);
    assert.deepEqual(notes, []);
    assert.equal(stats.scancode.licenses.value, 1673);
    assert.equal(stats.blueoak.rated.value, 3);
    assert.equal(stats.github.license_types.value, 3);
    assert.deepEqual(stats.huggingface.models, { value: 3250319, en: '3.2M+', zh: '320 万+' });
    assert.equal(stats.kaggle.datasets.value, 713955);
    assert.equal(stats.kaggle.meta_kaggle_version, '2146');
    assert.equal(stats.generated_at, NOW.toISOString());
  } finally {
    kb.cleanup();
  }
});

test('collectSourceStats: 输入缺失时沿用已提交的数字并逐项说明', () => {
  const kb = fakeKb(new Set([KB_INPUTS.blueoak, KB_INPUTS.kaggle]));
  try {
    const { stats, notes } = collect(kb, { previous: FIGURES, parquetRows: () => null });
    assert.deepEqual(stats.blueoak, FIGURES.blueoak);
    assert.deepEqual(stats.huggingface, FIGURES.huggingface);
    assert.deepEqual(stats.kaggle, FIGURES.kaggle);
    // 仍在的输入照常重算
    assert.equal(stats.github.license_types.value, 3);
    assert.deepEqual(notes, [
      'blueoak: input unavailable, keeping the committed figure',
      'huggingface models: input unavailable, keeping the committed figure',
      'huggingface datasets: input unavailable, keeping the committed figure',
      'kaggle: input unavailable, keeping the committed figure',
    ]);
  } finally {
    kb.cleanup();
  }
});

test('collectSourceStats: 既无输入也无已提交数字时为 null', () => {
  const kb = fakeKb(new Set(Object.values(KB_INPUTS)));
  try {
    const { stats, notes } = collect(kb, { parquetRows: () => null });
    assert.equal(stats.blueoak.rated, null);
    assert.equal(stats.kaggle.meta_kaggle_version, null);
    assert.ok(notes.every((note) => note.endsWith('no committed figure')));
  } finally {
    kb.cleanup();
  }
});

test('applyReadmeFigures: README 里的旧数字被换成当前数字', () => {
  const en = applyReadmeFigures(
    'Popularity data comes from HuggingFace Hub (2.8M+ models), GitHub (28 license types), and Kaggle (714K+ datasets via Meta-Kaggle).',
    README_FIGURE_RULES['README.md'],
    FIGURES,
  );
  assert.deepEqual(en.missing, []);
  assert.equal(
    en.content,
    'Popularity data comes from HuggingFace Hub (3.2M+ models), GitHub (28 license types), and Kaggle (713K+ datasets via Meta-Kaggle).',
  );

  const zh = applyReadmeFigures(
    '热度数据来自 HuggingFace Hub（280 万+ 模型）、GitHub（28 种许可证类型）和 Kaggle（通过 Meta-Kaggle 覆盖 71.4 万+ 数据集）。',
    README_FIGURE_RULES['README.zh-CN.md'],
    FIGURES,
  );
  assert.deepEqual(zh.missing, []);
  assert.equal(
    zh.content,
    '热度数据来自 HuggingFace Hub（320 万+ 模型）、GitHub（28 种许可证类型）和 Kaggle（通过 Meta-Kaggle 覆盖 71.3 万+ 数据集）。',
  );
});

test('applyReadmeFigures: 短语被改写或数字缺失时报告规则名，而不是静默跳过', () => {
  const reworded = applyReadmeFigures(
    'Popularity data comes from HuggingFace Hub, GitHub, and Kaggle.',
    README_FIGURE_RULES['README.md'],
    FIGURES,
  );
  assert.equal(reworded.content, 'Popularity data comes from HuggingFace Hub, GitHub, and Kaggle.');
  assert.deepEqual(reworded.missing, ['HuggingFace models', 'GitHub license types', 'Kaggle datasets']);

  const noFigure = applyReadmeFigures('GitHub (28 license types)', README_FIGURE_RULES['README.md'].slice(1, 2), {});
  assert.deepEqual(noFigure.missing, ['GitHub license types']);
});

test('applyReadmeFigures: 规则认得自己写出的每一种标签，重跑不改写（幂等）', () => {
  // 精确计数（GitHub）不会带 "+"；近似数（HuggingFace、Kaggle）才会
  const EXACT = ['3', '999', '1,234'];
  const APPROX = { en: ['3', '999', '2K+', '713K+', '3.2M+'], zh: ['3', '99,999', '71.3 万+', '320 万+'] };
  for (const [file, rules] of Object.entries(README_FIGURE_RULES)) {
    const lang = file === 'README.md' ? 'en' : 'zh';
    for (const rule of rules) {
      const labels = rule.name === 'GitHub license types' ? EXACT : APPROX[lang];
      for (const label of labels) {
        const stats = {
          huggingface: { models: { [lang]: label }, datasets: { [lang]: label } },
          github: { license_types: { [lang]: label } },
          kaggle: { datasets: { [lang]: label } },
        };
        const phrase = rule.template(label);
        const { content, missing } = applyReadmeFigures(phrase, [rule], stats);
        assert.deepEqual(missing, [], `${file} / ${rule.name}: "${phrase}" 不被识别`);
        assert.equal(content, phrase, `${file} / ${rule.name}: "${phrase}" 被改写`);
      }
    }
  }
});

test('仓库现状: 两份 README 的短语都在，数字与已提交的 source-stats 一致', () => {
  for (const [name, rules] of Object.entries(README_FIGURE_RULES)) {
    const readme = fs.readFileSync(path.join(ROOT, name), 'utf8');
    const { content, missing } = applyReadmeFigures(readme, rules, COMMITTED);
    assert.deepEqual(missing, [], `${name} 缺少承载数字的短语`);
    assert.equal(content, readme, `${name} 的数字已过期，运行 node scripts/update-readme-counts.mjs`);
  }
});
