import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import {
  checkAgentsRoutes,
  checkMarkdownLinks,
  checkRoadmapLifecycle,
  checkSuperpowersLifecycle,
} from './check-docs.mjs'

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'check-docs-'))

  await Promise.all(
    Object.entries(files).map(async ([path, contents]) => {
      const file = join(root, path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, contents)
    }),
  )

  return root
}

test('reports a broken relative markdown link with source and target', async () => {
  const root = await fixture({
    'docs/a.md': '[missing](./missing.md)',
  })
  assert.deepEqual(await checkMarkdownLinks(root), [
    'docs/a.md: broken relative link ./missing.md',
  ])
})

test('accepts repository files, directories, headings, and external links', async () => {
  const root = await fixture({
    'AGENTS.md': [
      '[doc](docs/current.md#current-contract)',
      '[directory](docs/current/)',
      '[web](https://example.com)',
    ].join('\n'),
    'docs/current.md': '# Current Contract',
    'docs/current/.keep': '',
  })
  assert.deepEqual(await checkMarkdownLinks(root), [])
})

test('rejects AGENTS routes to implementation-history plans', () => {
  assert.deepEqual(
    checkAgentsRoutes('[plan](docs/roadmap/20-workspace-layout.md)'),
    ['AGENTS.md: required-reading routes may not target roadmap/archive/superpowers plans'],
  )
})

test('rejects completed artifacts in active superpowers directories', () => {
  assert.deepEqual(
    checkSuperpowersLifecycle('docs/superpowers/plans/done.md', '**Status:** Done'),
    ['docs/superpowers/plans/done.md: completed artifact must be deleted or archived'],
  )
})

test('rejects shipped active roadmaps without an actionable remainder', () => {
  assert.deepEqual(
    checkRoadmapLifecycle('docs/roadmap/24-example.md', '**Status:** Shipped'),
    ['docs/roadmap/24-example.md: shipped plan has no actionable remainder'],
  )
})

test('recognizes a status label whose bold span excludes the colon', () => {
  assert.deepEqual(
    checkRoadmapLifecycle('docs/roadmap/24-example.md', '**Status**: Shipped'),
    ['docs/roadmap/24-example.md: shipped plan has no actionable remainder'],
  )
})
