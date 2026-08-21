import { describe, expect, it } from 'vitest'
import type { ComposeDocument } from '@compose-ui/core'
import type { StageRect } from '@compose-ui/stage-engine'
import {
  frameScreenBounds,
  mergeCanvasGuides,
  resizeHandlePoints,
  visibleWorldRect,
  worldRectToScreen,
} from './stage-screen-geometry'

const VIEWPORT = { x: 30, y: -10, zoom: 2 }

function boundsSource(boxes: Readonly<Record<string, StageRect>>) {
  return { getWorldBounds: (id: string) => boxes[id] ?? null }
}

function doc(rootIds: readonly string[]): ComposeDocument {
  return { schemaVersion: 7, canvas: {}, rootIds, entities: {} } as unknown as ComposeDocument
}

describe('OpenSpec: stage / 屏幕几何派生可独立求值', () => {
  it('位置含平移，尺寸只乘缩放', () => {
    const screen = worldRectToScreen({ x: 10, y: 10, width: 40, height: 20 }, VIEWPORT)

    expect(screen).toEqual({ x: 50, y: 10, width: 80, height: 40 })
  })

  it('空矩形返回 null 而不是零尺寸矩形', () => {
    expect(worldRectToScreen(null, VIEWPORT)).toBeNull()
    expect(resizeHandlePoints(null)).toBeNull()
  })

  it('逐块场景求边界，求不出包围盒的略过', () => {
    const value = doc(['a', 'pending', 'b'])
    const result = frameScreenBounds(
      value,
      boundsSource({
        a: { x: 0, y: 0, width: 10, height: 10 },
        b: { x: 100, y: 0, width: 10, height: 10 },
      }),
      VIEWPORT,
    )

    // pending 还没求解出包围盒，不该被画成一个零尺寸的框。
    expect(result.map(({ frameId }) => frameId)).toEqual(['a', 'b'])
    expect(result[0]).toEqual({ frameId: 'a', x: 30, y: -10, width: 20, height: 20 })
  })

  it('八个手柄锚在选中框的角与边中点', () => {
    const points = resizeHandlePoints({ x: 0, y: 0, width: 100, height: 40 })!

    expect(points.nw).toEqual([0, 0])
    expect(points.se).toEqual([100, 40])
    expect(points.n).toEqual([50, 0])
    expect(points.w).toEqual([0, 20])
  })

  it('辅助线预览覆盖同 id 的既有线，新建的线追加在后', () => {
    const saved = [
      { id: 'g1', axis: 'x' as const, position: 10 },
      { id: 'g2', axis: 'y' as const, position: 20 },
    ]
    const preview = [
      { id: 'g2', axis: 'y' as const, position: 55 },
      { id: 'draft', axis: 'x' as const, position: 90 },
    ]

    expect(mergeCanvasGuides(saved, preview)).toEqual([
      { id: 'g1', axis: 'x', position: 10 },
      { id: 'g2', axis: 'y', position: 55 },
      { id: 'draft', axis: 'x', position: 90 },
    ])
  })

  it('无预览时原样返回已保存的辅助线', () => {
    const saved = [{ id: 'g1', axis: 'x' as const, position: 10 }]
    expect(mergeCanvasGuides(saved, [])).toEqual(saved)
    expect(mergeCanvasGuides([], [])).toEqual([])
  })

  it('可见世界矩形随缩放反比变化', () => {
    expect(visibleWorldRect(VIEWPORT, { width: 800, height: 600 }))
      .toEqual({ x: -15, y: 5, width: 400, height: 300 })
  })
})
