import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { measure } from '../architecture-map/scripts/architecture-sync.mjs'

function writeCoverage(coverage) {
  const root = `${mkdtempSync(join(tmpdir(), 'coverage-validation-'))}/`
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'entry.ts'), 'export const entry = true\n')
  writeFileSync(join(root, 'coverage.json'), JSON.stringify(coverage))
  return root
}

const config = {
  coverage: 'coverage.json',
  output: 'measured.generated.ts',
  sources: ['src/**/*.ts'],
  ignore: [],
}

test('identifies the node whose owns list is missing', () => {
  const root = writeCoverage({ api: { files: ['src/api/**'] } })

  assert.throws(
    () => measure(root, config),
    /coverage entry "api" must define an owns array/,
  )
})

test('identifies invalid patterns inside a node owns list', () => {
  const root = writeCoverage({ worker: { owns: ['src/worker/**', null] } })

  assert.throws(
    () => measure(root, config),
    /coverage entry "worker" contains an invalid owns pattern/,
  )
})
