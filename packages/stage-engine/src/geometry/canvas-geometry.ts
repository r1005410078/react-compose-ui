import type {
  ComposeAxisLattice,
  ComposeCanvasSettings,
  ComposeLatticeBand,
  ComposeRulerTick,
} from '@compose-ui/core'

import type {
  ResizeHandle,
  StageGuide,
  StagePoint,
  StageRect,
  StageViewport,
} from './stage-geometry'

/*
 * 点阵与标尺刻度住在 core：它们只吃 step/offset/viewportOffset/zoom 一串数字，不认识文档，
 * 因此待在本包只是历史位置而不是边界要求。CAD 画布同样需要它们，而 cad-canvas 不得依赖
 * stage-engine。这里保留既有导出名，Stage 侧调用点一行不改。
 */
export {
  createAxisLattice,
  createRulerTicks,
  latticeLineBand,
  latticeLinePosition,
} from '@compose-ui/core'

/** 标尺上一条可见刻度。 @public */
export type StageRulerTick = ComposeRulerTick
/** 标尺与画布网格共用的单轴点阵。 @public */
export type StageAxisLattice = ComposeAxisLattice
/** 一条线在屏幕上占据的 CSS 像素带。 @public */
export type StageLatticeBand = ComposeLatticeBand

/**
 * 自定义滚动条所需的单轴映射。
 *
 * @public
 */
export interface StageScrollAxis {
  /** 虚拟滚动范围允许的最小世界坐标。 */
  readonly min: number
  /** 虚拟滚动范围允许的最大视口起点。 */
  readonly max: number
  /** 当前可视世界矩形在该轴的起点。 */
  readonly value: number
  /** 当前 surface 在该轴覆盖的世界长度。 */
  readonly viewportSize: number
  /** 单调扩展虚拟范围在该轴的总世界长度。 */
  readonly contentSize: number
}

/**
 * 把世界坐标量化到配置网格。
 *
 * @public
 */
export function snapValueToGrid(
  value: number,
  step: number,
  offset: number,
  enabled = true,
): number {
  return enabled ? offset + Math.round((value - offset) / step) * step : value
}

function movingAxes(handle: ResizeHandle) {
  return {
    x: handle.includes('e') || handle.includes('w'),
    y: handle.includes('n') || handle.includes('s'),
  }
}

/**
 * 对 resize 正在拖动的边或角应用智能吸附，并在无智能候选时回退到网格。
 *
 * @public
 */
export function snapResizePoint(options: {
  readonly point: StagePoint
  readonly handle: ResizeHandle
  readonly candidates: readonly StageGuide[]
  readonly canvas: ComposeCanvasSettings
  readonly zoom: number
  readonly disabled?: boolean
}): { readonly point: StagePoint; readonly guides: readonly StageGuide[] } {
  const { point, handle, candidates, canvas, zoom, disabled = false } = options
  if (disabled) return { point, guides: [] }
  const next = { ...point }
  const guides: StageGuide[] = []
  const axes = movingAxes(handle)
  for (const axis of ['x', 'y'] as const) {
    if (!axes[axis]) continue
    const coordinate = point[axis]
    const threshold = 6 / zoom
    let best: { distance: number; guide: StageGuide } | null = null
    for (const guide of candidates) {
      if (guide.axis !== axis) continue
      const distance = Math.abs(guide.value - coordinate)
      const preferred = best
        && distance === best.distance
        && guide.source === 'guide'
        && best.guide.source !== 'guide'
      if (distance <= threshold && (!best || distance < best.distance || preferred)) {
        best = { distance, guide }
      }
    }
    if (best) {
      next[axis] = best.guide.value
      guides.push(best.guide)
    }
    else if (canvas.grid.snapEnabled) {
      next[axis] = snapValueToGrid(
        coordinate,
        axis === 'x' ? canvas.grid.stepX : canvas.grid.stepY,
        axis === 'x' ? canvas.grid.offsetX : canvas.grid.offsetY,
      )
    }
  }
  return { point: next, guides }
}

function union(left: StageRect, right: StageRect): StageRect {
  const x = Math.min(left.x, right.x)
  const y = Math.min(left.y, right.y)
  const maxX = Math.max(left.x + left.width, right.x + right.width)
  const maxY = Math.max(left.y + left.height, right.y + right.height)
  return { x, y, width: maxX - x, height: maxY - y }
}

/**
 * 生成包含节点、原点和当前可视区域的单调扩展滚动范围。
 *
 * @param previous - Stage 会话此前保存的范围；传入后新范围绝不收缩。
 * @param content - 当前所有可见节点的世界包围框。
 * @param visible - surface 当前可见世界矩形。
 * @returns 每边至少预留一个 viewport 的世界范围。
 * @public
 */
export function expandScrollRange(
  previous: StageRect | null,
  content: StageRect | null,
  visible: StageRect,
): StageRect {
  const origin: StageRect = { x: 0, y: 0, width: 0, height: 0 }
  let required = union(visible, origin)
  if (content) required = union(required, content)
  required = {
    x: required.x - visible.width,
    y: required.y - visible.height,
    width: required.width + visible.width * 2,
    height: required.height + visible.height * 2,
  }
  return previous ? union(previous, required) : required
}

/**
 * 把受控 viewport 映射为自定义滚动条的 ARIA 数值域。
 *
 * @public
 */
export function viewportToScrollAxes(
  viewport: StageViewport,
  surface: { readonly width: number; readonly height: number },
  range: StageRect,
): { readonly x: StageScrollAxis; readonly y: StageScrollAxis } {
  const visibleWidth = surface.width / viewport.zoom
  const visibleHeight = surface.height / viewport.zoom
  const visibleX = -viewport.x / viewport.zoom
  const visibleY = -viewport.y / viewport.zoom
  return {
    x: {
      min: range.x,
      max: Math.max(range.x, range.x + range.width - visibleWidth),
      value: visibleX,
      viewportSize: visibleWidth,
      contentSize: range.width,
    },
    y: {
      min: range.y,
      max: Math.max(range.y, range.y + range.height - visibleHeight),
      value: visibleY,
      viewportSize: visibleHeight,
      contentSize: range.height,
    },
  }
}

/**
 * 用滚动条世界坐标更新 viewport 平移，缩放保持不变。
 *
 * @public
 */
export function scrollAxisToViewport(
  viewport: StageViewport,
  axis: 'x' | 'y',
  value: number,
): StageViewport {
  return axis === 'x'
    ? { ...viewport, x: -value * viewport.zoom }
    : { ...viewport, y: -value * viewport.zoom }
}
