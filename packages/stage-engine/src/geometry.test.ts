import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
} from '@compose-ui/core'
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
  decomposeMatrix(
    matrix: Matrix,
    width: number,
    height: number,
  ): { x: number; y: number; width: number; height: number; rotation: number }
  getNodeWorldBounds(document: ComposeDocument, nodeId: string): Rect
  snapTranslation(
    bounds: Rect,
    delta: Point,
    candidates: { axis: 'x' | 'y'; value: number; source?: 'guide' | 'node' }[],
    zoom: number,
    disabled?: boolean,
    grid?: {
      stepX: number
      stepY: number
      offsetX: number
      offsetY: number
      enabled: boolean
    },
  ): { delta: Point; guides: { axis: 'x' | 'y'; value: number }[] }
  createRulerTicks(options: {
    axis: 'x' | 'y'
    viewport: Viewport
    length: number
    step: number
    offset: number
    primaryLineEvery: number
  }): { value: number; screen: number; major: boolean; label?: string }[]
  snapResizePoint(options: {
    point: Point
    handle: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
    candidates: { axis: 'x' | 'y'; value: number; source?: 'guide' | 'node' }[]
    canvas: ComposeDocument['canvas']
    zoom: number
    disabled?: boolean
  }): { point: Point; guides: { axis: 'x' | 'y'; value: number }[] }
  expandScrollRange(previous: Rect | null, content: Rect | null, visible: Rect): Rect
  viewportToScrollAxes(
    viewport: Viewport,
    surface: { width: number; height: number },
    range: Rect,
  ): {
    x: { min: number; max: number; value: number }
    y: { min: number; max: number; value: number }
  }
  scrollAxisToViewport(viewport: Viewport, axis: 'x' | 'y', value: number): Viewport
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
    schemaVersion: 3,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
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
        clipContent: true,
      },
      group: {
        id: 'group',
        kind: 'frame',
        name: 'Nested Frame',
        visible: true,
        locked: false,
        transform: { x: 100, y: 80, width: 300, height: 200, rotation: 30 },
        childIds: ['component'],
        clipContent: false,
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
  it('OpenSpec: stage / 自适应网格标尺与世界原点 / 平移缩放标尺网格', () => {
    const ticks = api.createRulerTicks({
      axis: 'x',
      viewport: { x: 40, y: 0, zoom: 0.25 },
      length: 240,
      step: 8,
      offset: 0,
      primaryLineEvery: 8,
    })

    expect(ticks.some((tick) => tick.value < 0)).toBe(true)
    expect(ticks.every((tick, index) => index === 0
      || tick.screen - ticks[index - 1]!.screen >= 8)).toBe(true)
    expect(ticks.find((tick) => tick.value === 0)).toMatchObject({
      major: true,
      screen: 40,
    })
    const labels = ticks.filter((tick) => tick.label)
    expect(labels.every((tick, index) => index === 0
      || tick.screen - labels[index - 1]!.screen >= 48)).toBe(true)
  })

  // OpenSpec: stage / 直接移动缩放与旋转 / 八向缩放并吸附活动边
  it('OpenSpec: stage / 屏幕距离吸附 / 智能吸附优先', () => {
    const canvas = createDefaultCanvasSettings()
    const smart = api.snapTranslation(
      { x: 3, y: 5, width: 20, height: 20 },
      { x: 0, y: 0 },
      [
        { axis: 'x', value: 4, source: 'node' },
        { axis: 'x', value: 2, source: 'guide' },
      ],
      1,
      false,
      {
        stepX: canvas.grid.stepX,
        stepY: canvas.grid.stepY,
        offsetX: canvas.grid.offsetX,
        offsetY: canvas.grid.offsetY,
        enabled: true,
      },
    )
    expect(smart.delta.x).toBe(-1)
    expect(smart.guides).toEqual([{ axis: 'x', value: 2, source: 'guide' }])

    const grid = api.snapTranslation(
      { x: 11, y: 13, width: 20, height: 20 },
      { x: 3, y: 4 },
      [],
      1,
      false,
      {
        stepX: 8,
        stepY: 8,
        offsetX: 2,
        offsetY: 4,
        enabled: true,
      },
    )
    expect(grid.delta).toEqual({ x: 7, y: 7 })

    const resized = api.snapResizePoint({
      point: { x: 31, y: 29 },
      handle: 'se',
      candidates: [{ axis: 'x', value: 30, source: 'guide' }],
      canvas,
      zoom: 1,
    })
    expect(resized.point).toEqual({ x: 30, y: 32 })
    expect(api.snapResizePoint({
      point: { x: 31, y: 29 },
      handle: 'se',
      candidates: [],
      canvas,
      zoom: 1,
      disabled: true,
    }).point).toEqual({ x: 31, y: 29 })
  })

  it('OpenSpec: stage / 自适应网格标尺与世界原点 / 低缩放不改变原始吸附刻度', () => {
    const canvas = createDefaultCanvasSettings()
    const grid = {
      stepX: canvas.grid.stepX,
      stepY: canvas.grid.stepY,
      offsetX: canvas.grid.offsetX,
      offsetY: canvas.grid.offsetY,
      enabled: true,
    }

    expect(api.snapTranslation(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 13, y: 27 },
      [],
      0.1,
      false,
      grid,
    ).delta).toEqual({ x: 16, y: 24 })
    expect(api.snapResizePoint({
      point: { x: 13, y: 27 },
      handle: 'se',
      candidates: [],
      canvas,
      zoom: 0.1,
    }).point).toEqual({ x: 16, y: 24 })
    expect(stagePackage.snapValueToGrid(13, 8, 0)).toBe(16)
  })

  it('OpenSpec: stage / 无限画布滚动条 / 动态扩展无限范围', () => {
    const visible = { x: -50, y: 25, width: 200, height: 100 }
    const initial = api.expandScrollRange(
      null,
      { x: -400, y: -200, width: 900, height: 500 },
      visible,
    )
    expect(initial.x).toBeLessThanOrEqual(-600)
    expect(initial.x + initial.width).toBeGreaterThanOrEqual(700)

    const expanded = api.expandScrollRange(
      initial,
      { x: 1000, y: 800, width: 10, height: 10 },
      visible,
    )
    expect(expanded.x).toBe(initial.x)
    expect(expanded.width).toBeGreaterThan(initial.width)

    const viewport = { x: 100, y: -50, zoom: 2 }
    const axes = api.viewportToScrollAxes(viewport, { width: 400, height: 200 }, expanded)
    expect(axes.x.value).toBe(-50)
    expect(axes.y.value).toBe(25)
    expect(api.scrollAxisToViewport(viewport, 'x', 75)).toEqual({
      x: -150,
      y: -50,
      zoom: 2,
    })
  })

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

  it('OpenSpec: stage / 直接移动缩放与旋转 / resize 矩阵分解不重复偏移位置', () => {
    expect(api.decomposeMatrix(
      { a: 0.75, b: 0, c: 0, d: 0.5, e: 80, f: 80 },
      960,
      360,
    )).toEqual({
      x: 80,
      y: 80,
      width: 960,
      height: 360,
      rotation: 0,
    })
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 旋转选择', () => {
    const center = { x: 50, y: 50 }
    const start = { x: 50, y: 0 }
    expect(api.rotationFromPointer(center, start, { x: 100, y: 50 })).toBe(90)
    expect(api.rotationFromPointer(center, start, { x: 96, y: 42 }, true) % 15).toBe(0)
  })
})
