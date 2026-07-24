import type { ComposeDocument } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import * as stagePackage from './index'

type Point = { x: number; y: number }
type Rect = Point & { width: number; height: number }
type Viewport = Point & { zoom: number }
type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number }

const api = stagePackage as unknown as {
  worldToScreen(point: Point, viewport: Viewport): Point
  screenToWorld(point: Point, viewport: Viewport): Point
  zoomViewportAt(viewport: Viewport, screenPoint: Point, zoom: number): Viewport
  getNodeWorldMatrix(document: ComposeDocument, nodeId: string): Matrix
  applyMatrix(matrix: Matrix, point: Point): Point
  invertMatrix(matrix: Matrix): Matrix
  getNodeWorldBounds(document: ComposeDocument, nodeId: string): Rect
  snapTranslation(
    bounds: Rect,
    delta: Point,
    candidates: { axis: 'x' | 'y'; value: number }[],
    zoom: number,
    disabled?: boolean,
  ): { delta: Point; guides: { axis: 'x' | 'y'; value: number }[] }
  resizeBounds(
    bounds: Rect,
    handle: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw',
    point: Point,
    modifiers?: { shift?: boolean; alt?: boolean },
  ): Rect
  rotationFromPointer(center: Point, start: Point, current: Point, shift?: boolean): number
}

function document(): ComposeDocument {
  return {
    schemaVersion: 1,
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: -400, y: 120, width: 800, height: 600, rotation: 0 },
        childIds: ['group'],
      },
      group: {
        id: 'group',
        kind: 'group',
        name: 'Group',
        visible: true,
        locked: false,
        transform: { x: 100, y: 80, width: 300, height: 200, rotation: 30 },
        childIds: ['component'],
      },
      component: {
        id: 'component',
        kind: 'component',
        name: 'Component',
        visible: true,
        locked: false,
        transform: { x: 40, y: 30, width: 120, height: 60, rotation: -15 },
        componentType: 'text',
        props: {},
      },
    },
  }
}

describe('Stage geometry', () => {
  it('OpenSpec: stage / 受控无限视口 / 更新受控状态 - world 与 screen 负坐标往返', () => {
    const viewport = { x: 320, y: 180, zoom: 1.75 }
    const world = { x: -840.5, y: 230.25 }
    const screen = api.worldToScreen(world, viewport)

    expect(api.screenToWorld(screen, viewport)).toEqual(world)
  })

  it('OpenSpec: stage / 受控无限视口 / 以游标为锚缩放', () => {
    const before = { x: 100, y: 60, zoom: 1 }
    const cursor = { x: 420, y: 260 }
    const world = api.screenToWorld(cursor, before)
    const after = api.zoomViewportAt(before, cursor, 3)

    expect(after.zoom).toBe(3)
    expect(api.worldToScreen(world, after)).toEqual(cursor)
    expect(api.zoomViewportAt(before, cursor, 99).zoom).toBe(8)
    expect(api.zoomViewportAt(before, cursor, 0).zoom).toBe(0.1)
  })

  it('OpenSpec: stage / DOM 与 SVG 分层 Stage / 渲染 Stage 分层 - 嵌套旋转矩阵往返', () => {
    const matrix = api.getNodeWorldMatrix(document(), 'component')
    const local = { x: 32, y: 18 }
    const world = api.applyMatrix(matrix, local)
    const roundTrip = api.applyMatrix(api.invertMatrix(matrix), world)

    expect(roundTrip.x).toBeCloseTo(local.x, 8)
    expect(roundTrip.y).toBeCloseTo(local.y, 8)
    const bounds = api.getNodeWorldBounds(document(), 'component')
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
  })

  it('OpenSpec: stage / 屏幕距离吸附 / 不同 zoom 下保持吸附手感', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 }
    const candidates = [{ axis: 'x' as const, value: 110 }]

    expect(api.snapTranslation(bounds, { x: 4, y: 0 }, candidates, 1)).toEqual({
      delta: { x: 10, y: 0 },
      guides: candidates,
    })
    expect(api.snapTranslation(bounds, { x: 7, y: 0 }, candidates, 2)).toEqual({
      delta: { x: 10, y: 0 },
      guides: candidates,
    })
    expect(api.snapTranslation(bounds, { x: 3, y: 0 }, candidates, 2, true)).toEqual({
      delta: { x: 3, y: 0 },
      guides: [],
    })
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 八向缩放', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 }

    expect(api.resizeBounds(bounds, 'se', { x: 160, y: 100 })).toEqual({
      x: 10,
      y: 20,
      width: 150,
      height: 80,
    })
    expect(api.resizeBounds(bounds, 'e', { x: 140, y: 45 }, { alt: true })).toEqual({
      x: -20,
      y: 20,
      width: 160,
      height: 50,
    })
    expect(api.resizeBounds(bounds, 'se', { x: 160, y: 60 }, { shift: true })).toEqual({
      x: 10,
      y: 20,
      width: 150,
      height: 75,
    })
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 旋转选择', () => {
    const center = { x: 50, y: 50 }
    const start = { x: 50, y: 0 }
    expect(api.rotationFromPointer(center, start, { x: 100, y: 50 })).toBe(90)
    expect(api.rotationFromPointer(center, start, { x: 96, y: 42 }, true) % 15).toBe(0)
  })
})
