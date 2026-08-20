import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../architecture-map/scripts/architecture-sync.mjs', import.meta.url))

test('--check fails when the generated file records unclaimed sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'architecture-check-'))
  mkdirSync(join(root, 'src', 'architecture'), { recursive: true })
  writeFileSync(join(root, 'src', 'mapped.ts'), 'export const mapped = true\n')
  writeFileSync(join(root, 'src', 'unclaimed.ts'), 'export const unclaimed = true\n')
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
    join(root, 'src', 'architecture', 'coverage.json'),
    JSON.stringify({ mapped: { owns: ['src/mapped.ts'] } }),
  )

  const env = { ...process.env, ARCH_ROOT: `${root}/` }
  const sync = spawnSync(process.execPath, [script], { env, encoding: 'utf8' })
  assert.equal(sync.status, 0, sync.stderr)
  assert.match(
    readFileSync(join(root, 'src', 'architecture', 'measured.generated.ts'), 'utf8'),
    /src\/unclaimed\.ts/,
  )

  const check = spawnSync(process.execPath, [script, '--check'], { env, encoding: 'utf8' })
  assert.equal(check.status, 1)
  assert.match(check.stdout, /1 file\(s\) no module claims/)
  assert.doesNotMatch(check.stdout, /architecture — up to date/)
})
