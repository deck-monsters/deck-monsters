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

// Task 3 removes these completed migration artifacts after their useful facts move elsewhere.
export const MIGRATION_ALLOWLIST = new Map([
  ['AGENTS.md: required-reading routes may not target roadmap/archive/superpowers plans', 1],
  ['docs/roadmap/10b-bugs-fixed.md: shipped plan has no actionable remainder', 1],
  ['docs/roadmap/23-pixel-fight-stage.md: shipped plan has no actionable remainder', 1],
  ['docs/roadmap/24-pixel-monsters-everywhere.md: shipped plan has no actionable remainder', 1],
])

export function findMarkdownLinks(markdown) {
  return [...markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map(([, target]) => target)
}

function markdownProse(markdown) {
  let fence

  return markdown
    .split('\n')
    .map((line) => {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1][0]
        else if (fence === fenceMatch[1][0]) fence = undefined
        return ''
      }

      if (fence || /^(?: {4}|\t)/.test(line)) return ''
      return line.replace(/`[^`\n]*`/g, '')
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
  const markdown = markdownProse(await readFile(path, 'utf8'))
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

  const remainder = markdownProse(markdown).match(/^## Actionable remainder\s*$([\s\S]*?)(?=^## |\Z)/im)
  if (remainder && /^\s*[-*]\s+\[ \]\s+/m.test(remainder[1])) return []

  return [`${path}: shipped plan has no actionable remainder`]
}

export function applyMigrationAllowlist(findings, allowlist = MIGRATION_ALLOWLIST) {
  const remainingAllowances = new Map(allowlist)

  return findings.filter((finding) => {
    const remaining = remainingAllowances.get(finding) ?? 0
    if (remaining === 0) return true

    remainingAllowances.set(finding, remaining - 1)
    return false
  })
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

  return applyMigrationAllowlist(findings)
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
