import assert from 'node:assert/strict'
import test from 'node:test'

import { packLayout } from '../architecture-map/assets/core/layout.ts'

test('rejects inputs whose groups are absent from groupOrder', () => {
  assert.throws(
    () => packLayout(
      [
        { item: 'api', group: 'services', size: { w: 2, d: 2 } },
        { item: 'queue', group: 'workers', size: { w: 2, d: 2 } },
      ],
      ['services'],
    ),
    /unknown groups: workers/,
  )
})

test('places every input when all groups are declared', () => {
  const layout = packLayout(
    [
      { item: 'api', group: 'services', size: { w: 2, d: 2 } },
      { item: 'queue', group: 'workers', size: { w: 2, d: 2 } },
    ],
    ['services', 'workers'],
  )

  assert.equal(layout.size, 2)
  assert.ok(layout.has('api'))
  assert.ok(layout.has('queue'))
})
