import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, relative, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist'])
const GENERATED_ROOT_OUTPUTS = new Set([
  'CARDS.md',
  'DMG.md',
  'MONSTERS.md',
  'PLAYER_HANDBOOK.md',
])

// Task 3 removes these completed migration artifacts after their useful facts move elsewhere.
export const MIGRATION_ALLOWLIST = new Set([
  '.superpowers/sdd/task-1-brief.md: broken relative link ./missing.md',
  '.superpowers/sdd/task-1-brief.md: broken relative link docs/current.md#current-contract',
  '.superpowers/sdd/task-1-brief.md: broken relative link docs/current/',
  '.superpowers/sdd/task-1-brief.md: broken relative link docs/roadmap/20-workspace-layout.md',
  'AGENTS.md: required-reading routes may not target roadmap/archive/superpowers plans',
  'docs/roadmap/10b-bugs-fixed.md: shipped plan has no actionable remainder',
  'docs/roadmap/23-pixel-fight-stage.md: shipped plan has no actionable remainder',
  'docs/roadmap/22-small-leftovers.md: broken relative link ../archive/roadmap/03-auth-and-identity.md#phase-2--google--apple-oauth',
  'docs/roadmap/22-small-leftovers.md: broken relative link ../archive/roadmap/06a-web-app.md#phase-3--polish-theming-and-mobile-refinement',
  'docs/roadmap/24-pixel-monsters-everywhere.md: shipped plan has no actionable remainder',
  'docs/superpowers/plans/2026-09-23-documentation-lifecycle-reset.md: broken relative link ./missing.md',
  'docs/superpowers/plans/2026-09-23-documentation-lifecycle-reset.md: broken relative link docs/current.md#current-contract',
  'docs/superpowers/plans/2026-09-23-documentation-lifecycle-reset.md: broken relative link docs/current/',
  'docs/superpowers/plans/2026-09-23-documentation-lifecycle-reset.md: broken relative link docs/roadmap/20-workspace-layout.md',
])

export function findMarkdownLinks(markdown) {
  return [...markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map(([, target]) => target)
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
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function hasHeading(path, fragment) {
  const markdown = await readFile(path, 'utf8')
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
    const markdown = await readFile(sourcePath, 'utf8')
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
  return findMarkdownLinks(markdown).some((target) =>
    /(?:^|\/)(?:roadmap|archive\/roadmap|superpowers)(?:\/|$)/.test(target),
  )
    ? ['AGENTS.md: required-reading routes may not target roadmap/archive/superpowers plans']
    : []
}

function hasCompletedStatus(markdown) {
  return /^\s*(?:\*\*)?Status(?:\*\*)?:\s*(?:\*\*)?\s*(?:Done|Complete(?:d)?|Shipped)\b/im.test(markdown)
}

export function checkSuperpowersLifecycle(path, markdown) {
  if (path.startsWith('docs/superpowers/') && hasCompletedStatus(markdown)) {
    return [`${path}: completed artifact must be deleted or archived`]
  }

  return []
}

export function checkRoadmapLifecycle(path, markdown) {
  if (!path.startsWith('docs/roadmap/') || !hasCompletedStatus(markdown)) return []

  const remainder = markdown.match(/^## Actionable remainder\s*$([\s\S]*?)(?=^## |\Z)/im)
  if (remainder && /^\s*[-*]\s+\[ \]\s+/m.test(remainder[1])) return []

  return [`${path}: shipped plan has no actionable remainder`]
}

function isAllowed(finding) {
  return MIGRATION_ALLOWLIST.has(finding)
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

  return findings.filter((finding) => !isAllowed(finding))
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
