import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../architecture-map/scripts/architecture-sync.mjs', import.meta.url))

test('quotes authored node ids and source paths as valid TypeScript strings', () => {
  const root = mkdtempSync(join(tmpdir(), 'generated-architecture-data-'))
  const sourceDir = join(root, 'src')
  const architectureDir = join(sourceDir, 'architecture')
  const output = join(architectureDir, 'measured.generated.ts')
  mkdirSync(architectureDir, { recursive: true })
  writeFileSync(join(sourceDir, "owner's.ts"), 'export const owner = true\n')
  writeFileSync(join(sourceDir, "unclaimed's.ts"), 'export const unclaimed = true\n')
  writeFileSync(
    join(root, 'architecture.config.json'),
    JSON.stringify({
      coverage: 'src/architecture/coverage.json',
      output: 'src/architecture/measured.generated.ts',
      sources: ['src/**/*.ts'],
      ignore: [],
    }),
  )
  writeFileSync(
    join(architectureDir, 'coverage.json'),
    JSON.stringify({ "owner's node": { owns: ["src/owner's.ts"] } }),
  )

  const sync = spawnSync(process.execPath, [script], {
    env: { ...process.env, ARCH_ROOT: `${root}/` },
    encoding: 'utf8',
  })
  assert.equal(sync.status, 0, sync.stderr)

  const generated = readFileSync(output, 'utf8')
  assert.match(generated, /"owner's node":/)
  assert.match(generated, /"src\/unclaimed's\.ts",/)

  const syntax = spawnSync(process.execPath, ['--experimental-strip-types', '--check', output], {
    encoding: 'utf8',
  })
  assert.equal(syntax.status, 0, syntax.stderr)
})
