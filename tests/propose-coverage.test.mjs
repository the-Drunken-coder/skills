import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../architecture-map/scripts/propose-coverage.mjs', import.meta.url))

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'coverage-proposal-'))
  const paths = [
    'root.ts',
    'src/direct.ts',
    'src/api/one.ts',
    'src/api/two.ts',
    'src/jobs/one.ts',
    'src/jobs/two.ts',
    'tools/build.ts',
    'tools/release.ts',
  ]
  for (const path of paths) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), `export const value = '${path}'\n`)
  }
  return { root, paths }
}

test('keeps the proposal within target with unique, usable ownership', () => {
  const { root, paths } = fixture()
  const result = spawnSync(process.execPath, [script, '--root', root, '--target', '3'], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)

  const proposal = JSON.parse(result.stdout)
  assert.equal(proposal.totalFiles, paths.length)
  assert.ok(proposal.proposedNodes <= 3)
  assert.equal(new Set(proposal.nodes.map((node) => node.id)).size, proposal.nodes.length)
  assert.ok(proposal.nodes.every((node) => node.owns.every((pattern) => !pattern.endsWith('.ts/**'))))
  assert.ok(proposal.nodes.some((node) => node.owns.includes('root.ts')))
  for (const path of paths) {
    const owners = proposal.nodes.filter((node) =>
      node.owns.some((pattern) => pattern === path || (pattern.endsWith('/**') && path.startsWith(pattern.slice(0, -2)))),
    )
    assert.equal(owners.length, 1, `${path} should have exactly one owner`)
  }
})

test('rejects a missing or non-positive target', () => {
  const { root } = fixture()
  for (const args of [
    ['--root', root, '--target'],
    ['--root', root, '--target', '0'],
    ['--root', root, '--target', 'many'],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /--target must be a positive integer/)
  }
})
