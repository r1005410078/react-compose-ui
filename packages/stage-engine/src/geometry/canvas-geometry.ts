import type { ComposeCanvasSettings } from '@compose-ui/core'
import type {
  ResizeHandle,
  StageGuide,
  StagePoint,
  StageRect,
  StageViewport,
} from './stage-geometry'

/**
 * 标尺上一条可见刻度。
 *
 * @public
 */
export interface StageRulerTick {
  /** 刻度的世界坐标。 */
  readonly value: number
  /** 相对 surface 起点的屏幕坐标。 */
  readonly screen: number
  /** 是否按主刻度样式绘制。 */
  readonly major: boolean
  /** 需要显示的短标签；非标签刻度不提供该值。 */
  readonly label?: string
}

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
 * 标尺与画布网格共用的单轴点阵。
 *
 * @remarks
 * 两种渲染必须由同一个点阵产出，否则「同一世界坐标」会因成像规则不同落到不同像素。
 * `stride` 恒为二次幂，因此更稀疏的点阵始终是更密点阵的子集。
 *
 * @public
 */
export interface StageAxisLattice {
  /** 相对配置 step 的抽稀倍数；恒为二次幂。 */
  readonly stride: number
  /** 抽稀后的世界间距。 */
  readonly worldStep: number
  /** 抽稀后的屏幕间距。 */
  readonly screenStep: number
  /** 第一条线的屏幕位置，已按设备像素取整；后续线为它加 `screenStep` 的整数倍。 */
  readonly screenOffset: number
  /** 网格配置原点。 */
  readonly offset: number
  /** 当前缩放。 */
  readonly zoom: number
  /** 当前轴的 viewport 屏幕偏移。 */
  readonly viewportOffset: number
  /** 计算落点时使用的设备像素比。 */
  readonly devicePixelRatio: number
}

/** 一条线在屏幕上占据的 CSS 像素带。 @public */
export interface StageLatticeBand {
  /** 左（上）边界的 CSS 像素位置。 */
  readonly start: number
  /** 带宽，恒为 1 CSS px。 */
  readonly width: number
}

function positiveModulo(value: number, modulus: number) {
  const remainder = value % modulus
  return remainder < 0 ? remainder + modulus : remainder
}

function snapToDevicePixel(value: number, devicePixelRatio: number) {
  const normalized = Math.round(value * devicePixelRatio) / devicePixelRatio
  return Object.is(normalized, -0) ? 0 : normalized
}

/**
 * 构造标尺或画布网格使用的单轴点阵。
 *
 * @remarks
 * `minScreenSpacing` 是两种渲染唯一的差异：画布网格按 1px 线不粘连的下限抽稀，标尺按刻度
 * 可读性抽稀。因为 stride 都取二次幂且共用 `step`/`offset`，标尺刻度必然是网格线的子集。
 *
 * @public
 */
export function createAxisLattice(options: {
  readonly step: number
  readonly offset: number
  readonly viewportOffset: number
  readonly zoom: number
  readonly minScreenSpacing: number
  readonly devicePixelRatio?: number
}): StageAxisLattice {
  const {
    step,
    offset,
    viewportOffset,
    zoom,
    minScreenSpacing,
    devicePixelRatio = 1,
  } = options
  if (
    !Number.isFinite(step)
    || step <= 0
    || !Number.isFinite(offset)
    || !Number.isFinite(viewportOffset)
    || !Number.isFinite(zoom)
    || zoom <= 0
    || !Number.isFinite(minScreenSpacing)
    || minScreenSpacing <= 0
    || !Number.isFinite(devicePixelRatio)
    || devicePixelRatio <= 0
  ) {
    throw new RangeError('Axis lattice requires finite coordinates and positive step/zoom/spacing')
  }
  let stride = 1
  while (step * zoom * stride < minScreenSpacing) stride *= 2
  const worldStep = step * stride
  const screenStep = worldStep * zoom
  const screenOffset = snapToDevicePixel(
    positiveModulo(offset * zoom + viewportOffset, screenStep),
    devicePixelRatio,
  )
  return {
    stride,
    worldStep,
    screenStep,
    screenOffset,
    offset,
    zoom,
    viewportOffset,
    devicePixelRatio,
  }
}

/**
 * 求某个世界坐标在点阵上的屏幕落点。
 *
 * @remarks
 * 结果强制回到 `screenOffset + k * screenStep` 的格点上，与 CSS 背景平铺同相；否则标尺按
 * 精确坐标绘制、网格按平铺绘制，二者会随索引累积偏差。
 *
 * @public
 */
export function latticeLinePosition(lattice: StageAxisLattice, world: number): number {
  const raw = world * lattice.zoom + lattice.viewportOffset
  const index = Math.round((raw - lattice.screenOffset) / lattice.screenStep)
  return lattice.screenOffset + index * lattice.screenStep
}

/**
 * 求某个世界坐标对应的 1px 线所覆盖的像素带。
 *
 * @remarks
 * 线以世界坐标为**左边界**向右覆盖 1 CSS px，与 `linear-gradient(色 1px, transparent 1px)`
 * 的语义一致。旧的 SVG `stroke-width: 1` 以坐标为中心，正是恒定半像素错位的来源。
 *
 * @public
 */
export function latticeLineBand(lattice: StageAxisLattice, world: number): StageLatticeBand {
  return { start: latticeLinePosition(lattice, world), width: 1 }
}

function finitePrecision(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/** 细刻度之间的最小屏幕间距；再密就会糊成一片。 */
const RULER_MIN_TICK_SPACING = 8

/** 带数字的刻度之间的最小屏幕间距，保证数字不重叠。 */
const RULER_MIN_LABEL_SPACING = 48

/**
 * 生成随缩放抽稀但保持世界坐标一致的标尺刻度。
 *
 * @remarks
 * 细刻度与数字刻度是同一 {@link createAxisLattice} 的两个阈值：细刻度按 8px 不粘连抽稀，
 * 数字按 48px 可读性抽稀。两者与画布网格共用 step/offset 且 stride 均为二次幂，因此细刻度
 * 必然落在网格线上，数字刻度又必然落在细刻度上。抽稀不改变实际网格吸附刻度。
 *
 * @public
 */
export function createRulerTicks(options: {
  readonly axis: 'x' | 'y'
  readonly viewport: StageViewport
  readonly length: number
  readonly step: number
  readonly offset: number
  readonly primaryLineEvery: number
  readonly devicePixelRatio?: number
}): readonly StageRulerTick[] {
  const { axis, viewport, length, step, offset, primaryLineEvery, devicePixelRatio } = options
  const viewportOffset = axis === 'x' ? viewport.x : viewport.y
  const shared = {
    step,
    offset,
    viewportOffset,
    zoom: viewport.zoom,
    ...(devicePixelRatio === undefined ? {} : { devicePixelRatio }),
  }
  const lattice = createAxisLattice({ ...shared, minScreenSpacing: RULER_MIN_TICK_SPACING })
  const labelLattice = createAxisLattice({ ...shared, minScreenSpacing: RULER_MIN_LABEL_SPACING })
  // 世界索引先于屏幕位置确定，数字才不会因落点取整而显示成 63.98 这类脏值。
  const worldStart = (0 - viewportOffset) / viewport.zoom
  const worldEnd = (length - viewportOffset) / viewport.zoom
  const firstIndex = Math.floor((worldStart - offset) / lattice.worldStep) - 1
  const lastIndex = Math.ceil((worldEnd - offset) / lattice.worldStep) + 1
  const labelEvery = Math.round(labelLattice.worldStep / lattice.worldStep)
  const ticks: StageRulerTick[] = []
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const value = offset + index * lattice.worldStep
    const gridIndex = Math.round((value - offset) / step)
    const labelled = ((index % labelEvery) + labelEvery) % labelEvery === 0
    ticks.push({
      value,
      screen: latticeLinePosition(lattice, value),
      major: gridIndex % primaryLineEvery === 0,
      ...(labelled ? { label: finitePrecision(value) } : {}),
    })
  }
  return ticks
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
