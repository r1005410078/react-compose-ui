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
  /** 带宽，恒为**一个设备像素**（`1 / devicePixelRatio` CSS px）。 */
  readonly width: number
}

/**
 * 满不透明度的网格线之间的最小屏幕间距（CSS px）。
 *
 * @remarks
 * 「多近算太密」在这个产品里只有一个数：它同时是画布网格满值线的下限与标尺细刻度的抽稀阈值。
 * 此前网格用 2、标尺用 8，两者共用同一个点阵却对同一个问题各有一套答案——标尺已经抽稀两档
 * 了，画布还在画满。
 *
 * 2 那个数的来历是「1px 线至少留 1px 缝才不会退化成整片填色」，那是**退化的下限**而不是
 * 可读的下限：抽稀后间距恒落在 `[阈值, 2×阈值)`，因此细线间距恒在 2–4px 且全画在满不透明度
 * 上，25% 缩放时正好是 1px 线配 1px 缝。
 *
 * @public
 */
export const COMPOSE_LATTICE_MIN_FULL_SPACING = 8

/**
 * 细档开始退场的屏幕间距（CSS px）。
 *
 * @remarks
 * 淡入区间是 `[T, 2T)`——细档在 `2T` 处才满值，因此它恒为
 * {@link COMPOSE_LATTICE_MIN_FULL_SPACING} 的一半，两者是一对，改一个必须改另一个。
 *
 * 直接把抽稀阈值取成 8 会让 100% 缩放（默认 8 单位网格的间距正好 8px）的细档整档消失。
 * 这次要改的是缩小的那一段，`zoom >= 1` 必须逐像素不变。
 *
 * @public
 */
export const COMPOSE_LATTICE_FADE_START = COMPOSE_LATTICE_MIN_FULL_SPACING / 2

/**
 * 细档的淡入系数：抽稀后的间距恒在 `[T, 2T)`，在这一段里从 0 走到 1。
 *
 * @remarks
 * 只提高间距而不淡入，每次 stride 翻倍会让一半的线**在一帧内**消失。阈值是 2px 时这事发生
 * 在没人看得清的密度里，所以从来没暴露过；让线更早退场之后它就变成一次显眼的闪动。
 * **提高间距与补淡入必须一起做。**
 *
 * @public
 */
export function composeLatticeDetailFade(screenStep: number): number {
  return Math.max(0, Math.min(1, screenStep / COMPOSE_LATTICE_FADE_START - 1))
}

/**
 * 叠在已有墨之上的那一层要写入的不透明度，使合成结果恰好等于 `target`。
 *
 * @remarks
 * 解 `below + b * (1 - below) = target` 得到。两处用它，而它们是同一件事的两个应用：
 * 骨架档（`2 × stride`）补足淡出中的细档，以及每一级主网格补足它下面那一级。
 * 它管的是「下面已经有多少墨了」，跟那层墨是为了淡入还是为了分级无关。
 *
 * `below` 等于 `target` 时返回 0——细档满值时骨架档根本不画，因此放大时的输出与引入淡入
 * 之前逐字相同。少了这一步，两档叠加会让**每隔一根线深一档**。
 *
 * @public
 */
export function composeLatticeStackedAlpha(target: number, below: number): number {
  if (below >= 1) return 0
  return (target - below) / (1 - below)
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
 * 带宽是**一个设备像素**而不是一个 CSS 像素：`1px` 在 2× 屏上是两个物理像素、3× 屏上是三个
 * ——屏幕越好线越粗，而网格线从来就该是一条发丝线。本文件上方的注释一直写着「覆盖……那一个
 * 设备像素列」，实现此前与它不符。
 *
 * @public
 */
export function latticeLineBand(lattice: ComposeAxisLattice, world: number): ComposeLatticeBand {
  return { start: latticeLinePosition(lattice, world), width: 1 / lattice.devicePixelRatio }
}

function finitePrecision(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/**
 * 细刻度之间的最小屏幕间距。
 *
 * @remarks
 * 与画布网格满值线的下限是**同一个数**，因此两者不会对「多密算太密」给出不同答案。
 */
const RULER_MIN_TICK_SPACING = COMPOSE_LATTICE_MIN_FULL_SPACING

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
