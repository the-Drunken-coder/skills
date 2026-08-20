import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(
  new URL('../architecture-map/scripts/architecture-sync.mjs', import.meta.url),
)

function fixture(output = 'src/measured.generated.ts') {
  const parent = mkdtempSync(join(tmpdir(), 'architecture-sync-'))
  const root = join(parent, 'repo')
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(
    join(root, 'architecture.config.json'),
    JSON.stringify({
      coverage: 'src/coverage.json',
      output,
      sources: ['src/**/*.js'],
      ignore: [],
    }),
  )
  writeFileSync(join(root, 'src/coverage.json'), JSON.stringify({ app: { owns: ['src/app.js'] } }))
  writeFileSync(join(root, 'src/app.js'), 'export const app = true\n')
  return { parent, root }
}

function run(root, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, ARCH_ROOT: root },
    encoding: 'utf8',
  })
}

test('loads config when ARCH_ROOT has no trailing separator', (t) => {
  const { parent, root } = fixture()
  t.after(() => rmSync(parent, { recursive: true, force: true }))

  const result = run(root)

  assert.equal(result.status, 0, result.stderr)
  assert.match(readFileSync(join(root, 'src/measured.generated.ts'), 'utf8'), /'app'/)
})

test('rejects output paths outside the repository', (t) => {
  const { parent, root } = fixture('../outside.ts')
  t.after(() => rmSync(parent, { recursive: true, force: true }))
  const sentinel = join(parent, 'outside.ts')
  writeFileSync(sentinel, 'keep me\n')

  const result = run(root)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /output must stay inside the repository/)
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep me\n')
})

test('rejects absolute paths and file URLs', (t) => {
  const absolute = fixture(join(tmpdir(), 'outside.ts'))
  const url = fixture('file:///tmp/outside.ts')
  t.after(() => {
    rmSync(absolute.parent, { recursive: true, force: true })
    rmSync(url.parent, { recursive: true, force: true })
  })

  for (const root of [absolute.root, url.root]) {
    const result = run(root)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /output must be a relative path inside the repository/)
  }
})
