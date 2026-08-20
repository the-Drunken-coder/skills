import assert from 'node:assert/strict'
import test from 'node:test'

import {
  pointAtLength,
  polylineLengths,
  sceneBounds,
} from '../architecture-map/assets/core/iso.ts'

test('a one-point polyline stays at its only point', () => {
  const points = [{ x: 12, y: 34 }]
  const { cum } = polylineLengths(points)

  assert.deepEqual(pointAtLength(points, cum, 500), points[0])
})

test('an empty polyline has a stable origin', () => {
  const { cum } = polylineLengths([])

  assert.deepEqual(pointAtLength([], cum, 500), { x: 0, y: 0 })
})

test('an empty scene retains a finite margin-sized view box', () => {
  assert.deepEqual(sceneBounds([], 48), {
    x: -48,
    y: -48,
    width: 96,
    height: 96,
  })
})
