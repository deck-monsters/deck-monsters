import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import {
  checkAgentsRoutes,
  checkDocumentation,
  checkMarkdownLinks,
  checkOkfFrontmatter,
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

test('keeps the fixed-bug ledger at its stable active-roadmap path', () => {
  assert.deepEqual(
    checkRoadmapLifecycle('docs/roadmap/10b-bugs-fixed.md', '**Status:** Archive'),
    [],
  )
})

test('skips repository-root .superpowers scratch artifacts', async () => {
  const root = await fixture({
    '.superpowers/sdd/review.md': '[scratch](./missing.md)',
    'docs/a.md': '[missing](./missing.md)',
  })

  assert.deepEqual(await checkMarkdownLinks(root), [
    'docs/a.md: broken relative link ./missing.md',
  ])
})

test('checks Markdown prose but ignores fenced, indented, and inline code examples', async () => {
  const root = await fixture({
    'docs/a.md': [
      '```md',
      '[fenced](./missing.md)',
      '```',
      '    [indented](./missing.md)',
      'Use `[inline](./missing.md)` as an example.',
    ].join('\n'),
  })

  assert.deepEqual(await checkMarkdownLinks(root), [])
  assert.deepEqual(
    checkAgentsRoutes('```md\n[plan](docs/roadmap/20-workspace-layout.md)\n```'),
    [],
  )
  assert.deepEqual(
    checkSuperpowersLifecycle('docs/superpowers/plans/example.md', '```\n**Status:** Done\n```'),
    [],
  )
})

test('validates GitHub-compatible punctuation and duplicate heading slugs', async () => {
  const root = await fixture({
    'docs/a.md': [
      '[punctuation](./target.md#phase-2--google--apple-oauth)',
      '[first duplicate](./target.md#repeat)',
      '[second duplicate](./target.md#repeat-1)',
    ].join('\n'),
    'docs/target.md': '# Phase 2 — Google + Apple OAuth\n# Repeat\n# Repeat',
  })

  assert.deepEqual(await checkMarkdownLinks(root), [])
})

test('ignores shorter nested delimiters inside longer code examples', async () => {
  const root = await fixture({
    'docs/a.md': [
      '````md',
      '```',
      '[fenced](./missing.md)',
      '```',
      '````',
      'Use ``[inline](./missing.md) with `nested` delimiters`` as an example.',
    ].join('\n'),
  })

  assert.deepEqual(await checkMarkdownLinks(root), [])
  assert.deepEqual(
    checkAgentsRoutes('````md\n```\n[plan](docs/roadmap/20-workspace-layout.md)\n```\n````'),
    [],
  )
  assert.deepEqual(
    checkSuperpowersLifecycle(
      'docs/superpowers/plans/example.md',
      '````md\n```\n**Status:** Done\n```\n````\n``**Status:** Done with `nested` delimiters``',
    ),
    [],
  )
})

test('preserves inline code content in linked heading slugs', async () => {
  const root = await fixture({
    'docs/a.md': '[pacing](./target.md#1-fight-pacing-packagesenginesrchelpersdelay-timests)',
    'docs/target.md': '## 1. Fight pacing (`packages/engine/src/helpers/delay-times.ts`)',
  })

  assert.deepEqual(await checkMarkdownLinks(root), [])
})

const validArchitecture = `---
type: Architecture
title: Rooms and identity
description: Room lifecycle, membership, and identity boundaries for one game room.
status: stable
audience: internal
tags: [rooms, identity, scoping]
---

# Rooms and identity
`

test('reports a governed file with no OKF frontmatter', () => {
  assert.deepEqual(checkOkfFrontmatter('docs/architecture/rooms.md', '# Rooms\n'), [
    'docs/architecture/rooms.md: missing OKF frontmatter',
  ])
})

test('rejects an unknown OKF type', () => {
  const markdown = validArchitecture.replace('type: Architecture', 'type: Essay')
  assert.deepEqual(checkOkfFrontmatter('docs/architecture/rooms.md', markdown), [
    'docs/architecture/rooms.md: unknown OKF type Essay',
  ])
})

test('rejects OKF frontmatter on a public root document', () => {
  assert.deepEqual(checkOkfFrontmatter('README.md', validArchitecture), [
    'README.md: public document must not have OKF frontmatter',
  ])
  assert.deepEqual(checkOkfFrontmatter('cards.html', validArchitecture), [
    'cards.html: public document must not have OKF frontmatter',
  ])
})

test('leaves public and package markdown without requiring OKF frontmatter', () => {
  assert.deepEqual(checkOkfFrontmatter('README.md', '# Deck Monsters\n'), [])
  assert.deepEqual(checkOkfFrontmatter('ITEMS.md', '# Items\n'), [])
  assert.deepEqual(checkOkfFrontmatter('packages/engine/README.md', '# Engine\n'), [])
})

test('accepts valid OKF frontmatter on an internal document', () => {
  assert.deepEqual(checkOkfFrontmatter('docs/architecture/rooms-and-identity.md', validArchitecture), [])
})

test('does not treat archive status deprecated as a shipped roadmap', () => {
  const markdown = `---
type: Archive
title: Old plan
description: Historical record of a completed workspace plan.
status: deprecated
audience: internal
tags: [archive, history]
---

# Old plan

**Status:** Shipped
`
  assert.deepEqual(checkOkfFrontmatter('docs/archive/roadmap/old.md', markdown), [])
  assert.deepEqual(checkRoadmapLifecycle('docs/archive/roadmap/old.md', markdown), [])
  assert.deepEqual(checkSuperpowersLifecycle('docs/archive/roadmap/old.md', markdown), [])
})

test('strips OKF frontmatter before link and roadmap-status checks', async () => {
  const markdown = `---
type: Roadmap
title: Example
description: See [missing](./frontmatter.md) in the draft.
status: Shipped
audience: internal
tags: [roadmap, followups]
---

# Example

See [the plan](./body-missing.md).
`
  const root = await fixture({ 'docs/roadmap/example.md': markdown })
  assert.deepEqual(await checkMarkdownLinks(root), [
    'docs/roadmap/example.md: broken relative link ./body-missing.md',
  ])
  assert.deepEqual(checkRoadmapLifecycle('docs/roadmap/example.md', markdown), [])
})

test('keeps the fixed-bug ledger exception when OKF frontmatter is present', () => {
  const markdown = `---
type: Bug Ledger
title: Fixed bugs
description: Root causes for bugs that are already fixed.
status: stable
audience: internal
tags: [bugs, ledger]
---

**Status**: Shipped.
`
  assert.deepEqual(checkOkfFrontmatter('docs/roadmap/10b-bugs-fixed.md', markdown), [])
  assert.deepEqual(checkRoadmapLifecycle('docs/roadmap/10b-bugs-fixed.md', markdown), [])
})

test('repository check fails when a governed file lacks OKF frontmatter', async () => {
  const root = await fixture({
    'docs/architecture/rooms.md': '# Rooms\n',
  })
  assert.deepEqual(await checkDocumentation(root), [
    'docs/architecture/rooms.md: missing OKF frontmatter',
  ])
})
