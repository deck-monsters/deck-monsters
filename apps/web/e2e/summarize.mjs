#!/usr/bin/env node
/*
 * Turn Playwright's JSON report into a Markdown table: one row per test, one column per
 * project, with the numbers each test recorded through `measure()` (e2e/lab.ts).
 *
 *   node e2e/summarize.mjs [e2e/.results/report.json] [--failing]
 *
 * The baseline in docs/reference/feed-stability-baseline.md was built from this output.
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const failingOnly = args.includes('--failing');
const path = args.find((a) => !a.startsWith('--')) ?? 'e2e/.results/report.json';
const report = JSON.parse(readFileSync(path, 'utf8'));

/** @type {Map<string, Map<string, { status: string, measures: string[] }>>} */
const rows = new Map();
const projects = new Set();

function walk(suite, file) {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const result = t.results?.[t.results.length - 1];
      const status = t.status === 'skipped' ? 'skipped' : (result?.status ?? t.status);
      const measures = (t.annotations ?? [])
        .concat(result?.annotations ?? [])
        .filter((a) => a.type === 'measure')
        .map((a) => a.description);
      const key = `${file} › ${spec.title}`;
      if (!rows.has(key)) rows.set(key, new Map());
      rows.get(key).set(t.projectName, { status, measures: [...new Set(measures)] });
      projects.add(t.projectName);
    }
  }
  for (const child of suite.suites ?? []) walk(child, file);
}
for (const suite of report.suites ?? []) walk(suite, suite.file ?? suite.title);

const cols = [...projects].sort();
const counts = { passed: 0, failed: 0, skipped: 0, other: 0 };
const lines = [`| Test | ${cols.join(' | ')} | Measured |`, `|---|${cols.map(() => '---').join('|')}|---|`];
for (const [key, byProject] of [...rows].sort(([a], [b]) => a.localeCompare(b))) {
  const cells = cols.map((p) => byProject.get(p)?.status ?? '—');
  for (const c of cells) {
    if (c === '—') continue;
    if (c in counts) counts[c] += 1;
    else counts.other += 1;
  }
  if (failingOnly && !cells.some((c) => c !== 'passed' && c !== 'skipped' && c !== '—')) continue;
  const measured = cols
    .map((p) => {
      const m = byProject.get(p)?.measures ?? [];
      return m.length ? `${p}: ${m.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('; ');
  lines.push(`| ${key.replaceAll('|', '\\|')} | ${cells.join(' | ')} | ${measured.replaceAll('|', '\\|')} |`);
}
console.log(lines.join('\n'));
console.log(`\n${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped${counts.other ? `, ${counts.other} other` : ''}.`);
