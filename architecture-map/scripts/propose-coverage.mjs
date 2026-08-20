#!/usr/bin/env node
import { globSync, readFileSync } from 'node:fs'

/**
 * A first draft of the map's shape, read off the directory tree.
 *
 * This does not decide anything — it counts, clusters, and hands back a
 * proposal for a person (or the model running the skill) to correct. The
 * clustering rule is deliberately dumb: directories are the unit, because
 * directories are how people already grouped their own code. Anything cleverer
 * invents structure the repo does not have.
 *
 * The cap is the important part. A map of four hundred buildings is a photo of
 * a city from orbit: technically complete, useless. Past the target, the
 * smallest siblings inside a directory are folded into one node that owns the
 * wider glob, so every file stays claimed exactly once and only the *drawing*
 * gets simpler.
 *
 * Usage: node propose-coverage.mjs [--target 22] [--root .]
 */

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}

const ROOT = flag('root', process.cwd())
const TARGET = Number(flag('target', 22))
if (!Number.isInteger(TARGET) || TARGET < 1) {
  console.error('--target must be a positive integer')
  process.exit(1)
}
const SOURCES = ['**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,rb,rs,java,kt,swift,php,cs}']
const SKIP = /(^|\/)(node_modules|\.git|dist|build|out|\.next|vendor|target|__pycache__|coverage)(\/|$)/

function lines(file) {
  try {
    return readFileSync(`${ROOT}/${file}`, 'utf8').split('\n').length
  } catch {
    return 0
  }
}

const files = [...new Set(SOURCES.flatMap((g) => globSync(g, { cwd: ROOT })))]
  .map((f) => f.split('\\').join('/'))
  .filter((f) => !SKIP.test(f))
const locByFile = new Map(files.map((file) => [file, lines(file)]))

/** Group by directory, at increasing depth, until the count fits the target. */
function clusterAt(depth) {
  const groups = new Map()
  for (const file of files) {
    const parts = file.split('/')
    const key = parts.length === 1 ? '.' : parts.slice(0, Math.min(depth, parts.length - 1)).join('/')
    const entry = groups.get(key) ?? { dir: key, count: 0, loc: 0, files: [] }
    entry.count += 1
    entry.loc += locByFile.get(file) ?? 0
    entry.files.push(file)
    groups.set(key, entry)
  }
  return [...groups.values()].sort((a, b) => b.loc - a.loc)
}

// Go as deep as the tree allows without blowing past the target.
let best = clusterAt(1)
for (let depth = 2; depth <= 4; depth++) {
  const next = clusterAt(depth)
  if (next.length > TARGET * 1.6) break
  best = next
}

function parentOf(dir) {
  if (dir === '.') return '.'
  const parts = dir.split('/')
  return parts.length === 1 ? '.' : parts.slice(0, -1).join('/')
}

function contains(parent, dir) {
  return parent === '.' || dir === parent || dir.startsWith(`${parent}/`)
}

// Collapse the smallest branch into the nearest ancestor that combines at
// least two entries. Each replacement reduces the count, so the target is a
// hard cap rather than the point where extra parent buckets start accumulating.
while (best.length > TARGET) {
  best.sort((a, b) => b.loc - a.loc)
  const smallest = best[best.length - 1]
  let parent = parentOf(smallest.dir)
  let members = best.filter((entry) => contains(parent, entry.dir))
  while (members.length < 2 && parent !== '.') {
    parent = parentOf(parent)
    members = best.filter((entry) => contains(parent, entry.dir))
  }

  const memberSet = new Set(members)
  const folded = {
    dir: parent,
    count: members.reduce((sum, entry) => sum + entry.count, 0),
    loc: members.reduce((sum, entry) => sum + entry.loc, 0),
    files: members.flatMap((entry) => entry.files),
    aggregated: true,
  }
  best = [...best.filter((entry) => !memberSet.has(entry)), folded]
}

best.sort((a, b) => b.loc - a.loc)
const idCounts = new Map()
const proposal = best.map((entry) => {
  const baseId = entry.dir.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'root'
  const occurrence = (idCounts.get(baseId) ?? 0) + 1
  idCounts.set(baseId, occurrence)
  const hasDescendant = best.some((other) => other !== entry && contains(entry.dir, other.dir))

  return {
    id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
    dir: entry.dir,
    owns: entry.dir === '.' || hasDescendant ? entry.files : [`${entry.dir}/**`],
    count: entry.count,
    loc: entry.loc,
    sampleFiles: entry.files.slice(0, 6),
    aggregated: Boolean(entry.aggregated),
  }
})

console.log(
  JSON.stringify(
    {
      totalFiles: files.length,
      totalLoc: proposal.reduce((n, p) => n + p.loc, 0),
      target: TARGET,
      proposedNodes: proposal.length,
      /** Top-level directories, the natural first guess at neighborhoods. */
      suggestedGroups: [...new Set(proposal.map((p) => p.dir.split('/')[0]))],
      nodes: proposal,
    },
    null,
    2,
  ),
)
