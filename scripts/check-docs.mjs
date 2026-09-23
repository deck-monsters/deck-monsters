import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, relative, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIPPED_DIRECTORIES = new Set(['.git', '.superpowers', 'node_modules', 'dist'])
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

function markdownProse(markdown, { preserveInlineCode = false } = {}) {
  let fence

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
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await markdownFiles(root, resolve(directory, entry.name))))
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
  if (path === 'docs/roadmap/10b-bugs-fixed.md') return []

  const remainder = markdownProse(markdown).match(/^## Actionable remainder\s*$([\s\S]*?)(?=^## |\Z)/im)
  if (remainder && /^\s*[-*]\s+\[ \]\s+/m.test(remainder[1])) return []

  return [`${path}: shipped plan has no actionable remainder`]
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
      ...checkSuperpowersLifecycle(repositoryPath, markdown),
      ...checkRoadmapLifecycle(repositoryPath, markdown),
    )
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
