import { describe, expect, it } from 'vitest'
import {
  clampPortalPosition,
  clampDragPreviewPosition,
  crossedDragThreshold,
  resolveAutoScrollVelocity,
  resolveDropGeometry,
} from './drag-model'

describe('scene tree drag model', () => {
  it('starts dragging only after the 5px threshold', () => {
    expect(crossedDragThreshold(10, 10, 13, 14)).toBe(true)
    expect(crossedDragThreshold(10, 10, 12, 14)).toBe(false)
  })

  it('resolves before, inside and after hit zones in content coordinates', () => {
    const base = {
      clientX: 120,
      rectTop: 100,
      rectHeight: 240,
      scrollTop: 48,
      rowDepths: Array.from({ length: 20 }, () => 2),
      startX: 120,
      startDepth: 2,
    }
    expect(resolveDropGeometry({ ...base, clientY: 101 })).toMatchObject({
      hoveredIndex: 2,
      placement: 'before',
      boundaryIndex: 2,
      requestedDepth: 2,
    })
    expect(resolveDropGeometry({ ...base, clientY: 112 })).toMatchObject({
      hoveredIndex: 2,
      placement: 'inside',
      boundaryIndex: 2,
      requestedDepth: 2,
    })
    expect(resolveDropGeometry({ ...base, clientY: 123 })).toMatchObject({
      hoveredIndex: 2,
      placement: 'after',
      boundaryIndex: 3,
      requestedDepth: 2,
    })
  })

  it('quantizes horizontal movement and clamps scrolling to valid edges', () => {
    expect(resolveDropGeometry({
      clientX: 152,
      clientY: 112,
      rectTop: 100,
      rectHeight: 240,
      scrollTop: 0,
      rowDepths: Array.from({ length: 10 }, () => 1),
      startX: 120,
      startDepth: 2,
    })?.requestedDepth).toBe(4)
    expect(resolveAutoScrollVelocity(8, 240, 20, 500)).toBe(-8)
    expect(resolveAutoScrollVelocity(235, 240, 20, 500)).toBe(8)
    expect(resolveAutoScrollVelocity(8, 240, 0, 500)).toBe(0)
  })

  it('keeps portals inside an 8px viewport margin', () => {
    expect(clampPortalPosition(1278, 718, 176, 210, 1280, 720)).toEqual({
      left: 1096,
      top: 502,
    })
    expect(clampPortalPosition(-20, -10, 176, 210, 1280, 720)).toEqual({
      left: 8,
      top: 8,
    })
    expect(clampDragPreviewPosition(1270, 710, true, 1280, 720)).toEqual({
      left: 1236,
      top: 672,
    })
  })
})
