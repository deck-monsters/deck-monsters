import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, relative, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIPPED_DIRECTORIES = new Set(['.git', '.superpowers', 'node_modules', 'dist'])
// Agent worktrees (Claude Code `isolation: "worktree"`) are full checkouts of the repo. Scanning
// them checks every doc twice, and their root-generated files would not match the root-only
// generated-output exemption below.
const SKIPPED_PATHS = new Set(['.claude/worktrees'])
const GENERATED_ROOT_OUTPUTS = new Set([
  'CARDS.md',
  'DMG.md',
  'MONSTERS.md',
  'PLAYER_HANDBOOK.md',
])

export function findMarkdownLinks(markdown) {
  return [...markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map(([, target]) => target)
}

function stripInlineCodeSpans(line, preserveContents) {
  let prose = ''
  let cursor = 0

  while (cursor < line.length) {
    const opener = line.slice(cursor).match(/^`+/)
    if (!opener) {
      prose += line[cursor]
      cursor += 1
      continue
    }

    const delimiterLength = opener[0].length
    const contentStart = cursor + delimiterLength
    let scan = contentStart
    let closingStart = -1

    while (scan < line.length) {
      if (line[scan] !== '`') {
        scan += 1
        continue
      }

      const run = line.slice(scan).match(/^`+/)[0]
      if (run.length === delimiterLength) {
        closingStart = scan
        break
      }
      scan += run.length
    }

    if (closingStart === -1) {
      prose += opener[0]
      cursor = contentStart
      continue
    }

    if (preserveContents) prose += line.slice(contentStart, closingStart)
    cursor = closingStart + delimiterLength
  }

  return prose
}

// OKF frontmatter is YAML, not Markdown prose. Strip it before link and
// roadmap-status checks so a `status:` field or a link in the block cannot
// be read as a shipped plan or a broken relative link.
function stripOkfFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return markdown

  const lines = normalized.split('\n')
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') return lines.slice(index + 1).join('\n')
  }

  return markdown
}

function markdownProse(markdown, { preserveInlineCode = false } = {}) {
  let fence
  markdown = stripOkfFrontmatter(markdown)

  return markdown
    .split('\n')
    .map((line) => {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
      if (fence) {
        const closingFence = new RegExp(
          `^ {0,3}${fence.marker}{${fence.length},}[ \\t]*$`,
        )
        if (closingFence.test(line)) fence = undefined
        return ''
      }

      if (fenceMatch) {
        fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length }
        return ''
      }

      if (fence || /^(?: {4}|\t)/.test(line)) return ''
      return stripInlineCodeSpans(line, preserveInlineCode)
    })
    .join('\n')
}

function toRepositoryPath(root, path) {
  return relative(root, path).split(sep).join('/')
}

async function markdownFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childPath = resolve(directory, entry.name)
      if (!SKIPPED_DIRECTORIES.has(entry.name) && !SKIPPED_PATHS.has(toRepositoryPath(root, childPath))) {
        files.push(...(await markdownFiles(root, childPath)))
      }
      continue
    }

    if (
      entry.isFile() &&
      extname(entry.name) === '.md' &&
      !(directory === root && GENERATED_ROOT_OUTPUTS.has(entry.name))
    ) {
      files.push(resolve(directory, entry.name))
    }
  }

  return files
}

function headingSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

async function hasHeading(path, fragment) {
  const markdown = markdownProse(await readFile(path, 'utf8'), { preserveInlineCode: true })
  const usedSlugs = new Map()

  for (const [, rawHeading] of markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const baseSlug = headingSlug(rawHeading)
    const occurrence = usedSlugs.get(baseSlug) ?? 0
    usedSlugs.set(baseSlug, occurrence + 1)
    const slug = occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`
    if (slug === fragment.toLowerCase()) return true
  }

  return false
}

function isIgnoredLink(target) {
  return /^(?:https?:|mailto:|#)/i.test(target)
}

export async function checkMarkdownLinks(root) {
  const findings = []

  for (const sourcePath of await markdownFiles(root)) {
    const markdown = markdownProse(await readFile(sourcePath, 'utf8'))
    const source = toRepositoryPath(root, sourcePath)

    for (const target of findMarkdownLinks(markdown)) {
      if (isIgnoredLink(target)) continue

      const [targetPath, fragment] = target.split('#', 2)
      const resolvedTarget = resolve(dirname(sourcePath), targetPath || '.')
      let targetStats

      try {
        targetStats = await stat(resolvedTarget)
      } catch {
        findings.push(`${source}: broken relative link ${target}`)
        continue
      }

      if (fragment && targetStats.isFile() && !(await hasHeading(resolvedTarget, fragment))) {
        findings.push(`${source}: broken relative link ${target}`)
      }
    }
  }

  return findings
}

export function checkAgentsRoutes(markdown) {
  return findMarkdownLinks(markdownProse(markdown)).some((target) =>
    /(?:^|\/)(?:roadmap|archive\/roadmap|superpowers)(?:\/|$)/.test(target),
  )
    ? ['AGENTS.md: required-reading routes may not target roadmap/archive/superpowers plans']
    : []
}

function hasCompletedStatus(markdown) {
  return /^\s*(?:\*\*)?Status(?:\*\*)?:\s*(?:\*\*)?\s*(?:Done|Complete(?:d)?|Shipped)\b/im.test(
    markdownProse(markdown),
  )
}

export function checkSuperpowersLifecycle(path, markdown) {
  if (path.startsWith('docs/superpowers/') && hasCompletedStatus(markdown)) {
    return [`${path}: completed artifact must be deleted or archived`]
  }

  return []
}

export function checkRoadmapLifecycle(path, markdown) {
  if (!path.startsWith('docs/roadmap/') || !hasCompletedStatus(markdown)) return []
  // The stable ledger stays in the active roadmap and its entries include
  // per-bug "**Status**: Shipped" lines. Frontmatter stripping does not remove
  // those body lines, so this path remains exempt from the shipped-plan rule.
  if (path === 'docs/roadmap/10b-bugs-fixed.md') return []

  // JavaScript has no `\Z`; it matched a literal "Z", so a remainder section at
  // the end of the file (the usual place) was never found. `(?![\s\S])` is end-of-input.
  const remainder = markdownProse(markdown).match(/^## Actionable remainder\s*$([\s\S]*?)(?=^## |(?![\s\S]))/im)
  if (remainder && /^\s*[-*]\s+\[ \]\s+/m.test(remainder[1])) return []

  return [`${path}: shipped plan has no actionable remainder`]
}

const OKF_KEYS = ['type', 'title', 'description', 'status', 'audience', 'tags']
const OKF_TYPES = new Set([
  'Documentation Map',
  'Architecture',
  'Runbook',
  'Reference',
  'Agent Guide',
  'Roadmap',
  'Bug Ledger',
  'Archive',
  'Design',
  'Plan',
])
const OKF_STATUSES = new Set(['stable', 'draft', 'deprecated'])
const PUBLIC_DOCUMENTS = new Set([
  'README.md',
  'ITEMS.md',
  'PLAYER_HANDBOOK.md',
  'MONSTERS.md',
  'CARDS.md',
  'DMG.md',
  'cards.html',
])
// AGENTS.md (and the CLAUDE.md symlink to it) is loaded verbatim into every agent
// session. It stays a plain router: a frontmatter block there costs context in every
// session and tells an agent nothing the first heading does not.
const ROUTER_DOCUMENTS = new Set(['AGENTS.md'])
// Generated root outputs are omitted from the authored Markdown walk. They are
// still public documents, so the checker reads them only for a forbidden block.
const UNWALKED_PUBLIC_DOCUMENTS = [
  'PLAYER_HANDBOOK.md',
  'MONSTERS.md',
  'CARDS.md',
  'DMG.md',
  'cards.html',
]
// Structural checks apply only to the four Markdown ones (cards.html is not Markdown).
// This is a cheap, mechanical safety net — the real "keeps them clean" contract, with
// the semantic run-on-list check this can't do without engine imports, lives in
// packages/engine/src/build/root-docs.test.ts, which `pnpm run build:docs` regenerates
// these files from.
const GENERATED_ROOT_MARKDOWN = ['PLAYER_HANDBOOK.md', 'MONSTERS.md', 'CARDS.md', 'DMG.md']

function isGovernedDocument(path) {
  return path.startsWith('docs/') && path.endsWith('.md')
}

function hasOkfFrontmatter(markdown) {
  return markdown.startsWith('---\n') || markdown.startsWith('---\r\n')
}

function expectedOkf(path) {
  if (path === 'docs/README.md') return { type: 'Documentation Map', status: 'stable' }
  if (path.startsWith('docs/architecture/')) return { type: 'Architecture', status: 'stable' }
  if (path.startsWith('docs/operations/')) return { type: 'Runbook', status: 'stable' }
  if (path.startsWith('docs/reference/')) return { type: 'Reference', status: 'stable' }
  if (path.startsWith('docs/agents/')) return { type: 'Agent Guide', status: 'stable' }
  if (path === 'docs/roadmap/README.md') return { type: 'Roadmap', status: 'stable' }
  if (path === 'docs/roadmap/10b-bugs-fixed.md') return { type: 'Bug Ledger', status: 'stable' }
  if (path.startsWith('docs/roadmap/')) return { type: 'Roadmap', status: 'draft' }
  if (path.startsWith('docs/archive/')) return { type: 'Archive', status: 'deprecated' }
  if (path.startsWith('docs/superpowers/specs/')) return { type: 'Design', status: 'draft' }
  if (path.startsWith('docs/superpowers/plans/')) return { type: 'Plan', status: 'draft' }
  return null
}

function unquoteYaml(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

function readFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return { error: 'missing' }

  const lines = normalized.split('\n')
  const body = []
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') return { lines: body }
    body.push(lines[index])
  }

  return { error: 'unclosed' }
}

function parseFrontmatter(lines) {
  const fields = {}
  const invalid = []

  for (const line of lines) {
    if (line.trim() === '') continue
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!match) {
      invalid.push(line)
      continue
    }
    const [, key, raw] = match
    if (Object.hasOwn(fields, key)) invalid.push(key)
    fields[key] = raw.trim()
  }

  return { fields, invalid }
}

function parseTags(raw) {
  const value = unquoteYaml(raw)
  if (!value.startsWith('[') || !value.endsWith(']')) return null
  const inner = value.slice(1, -1).trim()
  if (inner === '') return []
  return inner.split(',').map((part) => unquoteYaml(part.trim()))
}

function isPlainSentence(description) {
  if (description !== description.trim()) return false
  if (/[*_`[\]#<>]/.test(description) || description.includes('](')) return false
  return /^[^.!?]+[.!?]$/.test(description)
}

export function checkOkfFrontmatter(path, markdown) {
  const publicDocument = PUBLIC_DOCUMENTS.has(path)
  const present = hasOkfFrontmatter(markdown)

  if (publicDocument) {
    return present ? [`${path}: public document must not have OKF frontmatter`] : []
  }
  if (ROUTER_DOCUMENTS.has(path)) {
    return present ? [`${path}: router must not have OKF frontmatter`] : []
  }
  if (!isGovernedDocument(path)) return []
  if (!present) return [`${path}: missing OKF frontmatter`]

  const block = readFrontmatter(markdown)
  if (block.error) return [`${path}: unclosed OKF frontmatter`]

  const { fields, invalid } = parseFrontmatter(block.lines)
  if (invalid.length > 0) return [`${path}: invalid OKF frontmatter`]

  const findings = []
  for (const key of Object.keys(fields)) {
    if (!OKF_KEYS.includes(key)) findings.push(`${path}: unexpected OKF key ${key}`)
  }
  for (const key of OKF_KEYS) {
    if (!Object.hasOwn(fields, key) || unquoteYaml(fields[key]).trim() === '') {
      findings.push(`${path}: missing OKF key ${key}`)
    }
  }

  const expected = expectedOkf(path)
  if (!expected) findings.push(`${path}: no OKF type mapping`)

  if (Object.hasOwn(fields, 'type') && unquoteYaml(fields.type).trim() !== '') {
    const type = unquoteYaml(fields.type)
    if (!OKF_TYPES.has(type)) findings.push(`${path}: unknown OKF type ${type}`)
    else if (expected && type !== expected.type) {
      findings.push(`${path}: OKF type must be ${expected.type}`)
    }
  }

  if (
    Object.hasOwn(fields, 'description') &&
    unquoteYaml(fields.description).trim() !== '' &&
    !isPlainSentence(unquoteYaml(fields.description))
  ) {
    findings.push(`${path}: OKF description must be one sentence without Markdown`)
  }

  if (Object.hasOwn(fields, 'status') && unquoteYaml(fields.status).trim() !== '') {
    const status = unquoteYaml(fields.status)
    if (!OKF_STATUSES.has(status)) {
      findings.push(`${path}: OKF status must be stable, draft, or deprecated`)
    } else if (expected && status !== expected.status) {
      findings.push(`${path}: OKF status must be ${expected.status}`)
    }
  }

  if (
    Object.hasOwn(fields, 'audience') &&
    unquoteYaml(fields.audience).trim() !== '' &&
    unquoteYaml(fields.audience) !== 'internal'
  ) {
    findings.push(`${path}: OKF audience must be internal`)
  }

  if (Object.hasOwn(fields, 'tags') && unquoteYaml(fields.tags).trim() !== '') {
    const tags = parseTags(fields.tags)
    const validTag = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (
      !tags ||
      tags.length < 2 ||
      tags.length > 6 ||
      tags.some((tag) => !validTag.test(tag))
    ) {
      findings.push(`${path}: OKF tags must list 2 to 6 lowercase tags`)
    }
  }

  return findings
}

/**
 * Mechanical structural check for a generated root doc (`PLAYER_HANDBOOK.md`,
 * `MONSTERS.md`, `CARDS.md`, `DMG.md`): balanced and tagged fences, no rule-line or
 * box-drawing characters outside a fence, and a blank line around every heading. These
 * are the shapes of the GitHub-rendering bugs this generator has produced before (see
 * `docs/roadmap/10b-bugs-fixed.md`) — a regression here means someone bypassed the
 * `packages/engine/src/build/markdown.ts` renderers, most likely by hand-editing the
 * file (which `AGENTS.md` already says not to do) or by adding a new section to the
 * generator that skips them.
 */
function checkGeneratedRootMarkdown(repositoryPath, markdown) {
  const findings = []
  const lines = markdown.split('\n')
  let inFence = false
  let fenceCount = 0

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      if (!inFence && line.trim() === '```') {
        findings.push(`${repositoryPath}:${index + 1}: untagged opening fence (use \`\`\`text)`)
      }
      inFence = !inFence
      fenceCount++
      return
    }

    if (inFence) return

    if (/[─═╔║╚╗╝]/.test(line)) {
      findings.push(`${repositoryPath}:${index + 1}: rule-line/box-drawing character outside a fence`)
    }

    if (/^#{1,6}\s/.test(line)) {
      const blankBefore = index === 0 || lines[index - 1] === ''
      const blankAfter = index === lines.length - 1 || lines[index + 1] === ''
      if (!blankBefore || !blankAfter) {
        findings.push(`${repositoryPath}:${index + 1}: heading needs a blank line before and after`)
      }
    }
  })

  if (fenceCount % 2 !== 0) {
    findings.push(`${repositoryPath}: unbalanced \`\`\` fence`)
  }

  return findings
}

export async function checkDocumentation(root) {
  const files = await markdownFiles(root)
  const findings = await checkMarkdownLinks(root)
  const agentsPath = resolve(root, 'AGENTS.md')

  try {
    findings.push(...checkAgentsRoutes(await readFile(agentsPath, 'utf8')))
  } catch {
    // Repositories without an AGENTS.md router have no routes to validate.
  }

  for (const path of files) {
    const markdown = await readFile(path, 'utf8')
    const repositoryPath = toRepositoryPath(root, path)
    findings.push(
      ...checkOkfFrontmatter(repositoryPath, markdown),
      ...checkSuperpowersLifecycle(repositoryPath, markdown),
      ...checkRoadmapLifecycle(repositoryPath, markdown),
    )
  }

  for (const repositoryPath of UNWALKED_PUBLIC_DOCUMENTS) {
    try {
      const markdown = await readFile(resolve(root, repositoryPath), 'utf8')
      findings.push(...checkOkfFrontmatter(repositoryPath, markdown))
      if (GENERATED_ROOT_MARKDOWN.includes(repositoryPath)) {
        findings.push(...checkGeneratedRootMarkdown(repositoryPath, markdown))
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  return findings
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const findings = await checkDocumentation(root)

  if (findings.length > 0) {
    console.error(findings.join('\n'))
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
