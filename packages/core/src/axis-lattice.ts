/**
 * 标尺上一条可见刻度。
 *
 * @public
 */
export interface ComposeRulerTick {
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
 * 标尺与画布网格共用的单轴点阵。
 *
 * @remarks
 * 两种渲染必须由同一个点阵产出，否则「同一世界坐标」会因成像规则不同落到不同像素。
 * `stride` 恒为二次幂，因此更稀疏的点阵始终是更密点阵的子集。
 *
 * @public
 */
export interface ComposeAxisLattice {
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
export interface ComposeLatticeBand {
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
}): ComposeAxisLattice {
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
export function latticeLinePosition(lattice: ComposeAxisLattice, world: number): number {
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
export function latticeLineBand(lattice: ComposeAxisLattice, world: number): ComposeLatticeBand {
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
  /** 该轴的视口屏幕偏移。 */
  readonly viewportOffset: number
  /** 当前缩放。 */
  readonly zoom: number
  readonly length: number
  readonly step: number
  readonly offset: number
  readonly primaryLineEvery: number
  readonly devicePixelRatio?: number
}): readonly ComposeRulerTick[] {
  const { viewportOffset, zoom, length, step, offset, primaryLineEvery, devicePixelRatio } = options
  const shared = {
    step,
    offset,
    viewportOffset,
    zoom,
    ...(devicePixelRatio === undefined ? {} : { devicePixelRatio }),
  }
  const lattice = createAxisLattice({ ...shared, minScreenSpacing: RULER_MIN_TICK_SPACING })
  const labelLattice = createAxisLattice({ ...shared, minScreenSpacing: RULER_MIN_LABEL_SPACING })
  // 世界索引先于屏幕位置确定，数字才不会因落点取整而显示成 63.98 这类脏值。
  const worldStart = (0 - viewportOffset) / zoom
  const worldEnd = (length - viewportOffset) / zoom
  const firstIndex = Math.floor((worldStart - offset) / lattice.worldStep) - 1
  const lastIndex = Math.ceil((worldEnd - offset) / lattice.worldStep) + 1
  const labelEvery = Math.round(labelLattice.worldStep / lattice.worldStep)
  const ticks: ComposeRulerTick[] = []
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
