import type { ComposeCanvasSettings } from '@compose-ui/core'
import {
  COMPOSE_LATTICE_FADE_START,
  composeLatticeDetailFade,
  composeLatticeStackedAlpha,
  createAxisLattice,
  type StageViewport,
} from '@compose-ui/stage-engine'

/**
 * 三级网格线**合成后**的不透明度。
 *
 * @remarks
 * 由目标对比度 1.23 / 1.52 / 1.88 反解，而不是手调出来的：此前四组互不相干的 hex+alpha 让
 * 深色的主线比细线强 1.53 倍、浅色只有 1.30 倍——同一份图纸换个主题，「哪条是大格」的读法
 * 就变了。用一条阶梯之后两个主题的对比度最大只差 0.038。
 *
 * 每个主题只留一支墨（`--compose-stage-grid-ink`），层级全部交给不透明度。墨要分主题挑：
 * 同一条阶梯配深色 `#94a3b8`、浅色 `#344054` 才对得齐；浅色若改用场景描边那支更浅的墨，
 * 偏差会从 0.038 涨到 0.174。
 *
 * 上限来自**场景描边**：它是内容的边界，网格是背景的参照，一条和边框一样浓的网格线会被读成
 * 边界。深色描边是同一支墨的 45%，粗格 0.34 只占它的 76%。
 */
const GRID_ALPHA_LADDER = [0.14, 0.24, 0.34] as const

/**
 * 补偿后的不透明度上限。
 *
 * @remarks
 * 正常缩放与常见 dpr 下够不着，它挡的是 dpr 极大时把网格顶到不透明。
 */
const GRID_ALPHA_CEILING = 0.66

interface VisualGridStyle {
  readonly backgroundImage: string
  readonly backgroundSize: string
  readonly backgroundPosition: string
}

interface VisibleGridAxis {
  readonly stride: number
  readonly worldStep: number
  readonly screenStep: number
  readonly screenOffset: number
}

function finiteCssNumber(value: number) {
  const normalized = Object.is(value, -0) ? 0 : value
  return String(Math.round(normalized * 1_000_000) / 1_000_000)
}

/**
 * 计算一条网格轴的可见点阵。
 *
 * @remarks
 * 委托给 stage-engine 的共享 lattice：标尺与网格必须由同一点阵和同一取整规则产出，
 * 否则同一世界坐标会落到不同像素。
 */
export function createVisibleGridAxis(options: {
  readonly step: number
  readonly offset: number
  readonly viewportOffset: number
  readonly zoom: number
  readonly devicePixelRatio?: number
}): VisibleGridAxis {
  const lattice = createAxisLattice({
    ...options,
    minScreenSpacing: COMPOSE_LATTICE_FADE_START,
  })
  return {
    stride: lattice.stride,
    worldStep: lattice.worldStep,
    screenStep: lattice.screenStep,
    screenOffset: lattice.screenOffset,
  }
}

function positiveModulo(value: number, modulus: number) {
  const remainder = value % modulus
  return remainder < 0 ? remainder + modulus : remainder
}

/**
 * 把「合成后要达到的不透明度」换成这一层实际写入的浓度，并按设备像素比补偿墨量。
 *
 * @remarks
 * 墨量 = 浓度 × 宽度。线宽从 1 CSS px 改成一个设备像素之后宽度除以了 dpr，浓度就要乘回来，
 * 否则 2× 屏上网格的存在感直接掉一半——用户会把「变细」读成「变淡」。
 *
 * 天花板同样按**墨量**比而不是浓度比：场景描边仍是 1 CSS px，2× 屏上是两个物理像素，
 * 它的墨量也翻倍，因此粗格占它的比例不变。只比浓度会误判。
 */
function compensated(alpha: number, devicePixelRatio: number) {
  return Math.min(GRID_ALPHA_CEILING, alpha * devicePixelRatio)
}

/** 一支墨 + 一个百分比；墨由主题通过 CSS 自定义属性给出。 */
function gridInk(alpha: number) {
  const percent = finiteCssNumber(Math.max(0, Math.min(1, alpha)) * 100)
  return `color-mix(in srgb, var(--compose-stage-grid-ink, #94a3b8) ${percent}%, transparent)`
}

/** 一层背景：沿某个轴、按某个间距重复的一条线。 */
interface GridLayer {
  readonly axis: 'x' | 'y'
  readonly screenStep: number
  readonly screenOffset: number
  readonly alpha: number
}

export function createVisualGridStyle(
  grid: ComposeCanvasSettings['grid'],
  viewport: StageViewport,
  devicePixelRatio = 1,
): VisualGridStyle {
  const detailX = createVisibleGridAxis({
    step: grid.stepX,
    offset: grid.offsetX,
    viewportOffset: viewport.x,
    zoom: viewport.zoom,
    devicePixelRatio,
  })
  const detailY = createVisibleGridAxis({
    step: grid.stepY,
    offset: grid.offsetY,
    viewportOffset: viewport.y,
    zoom: viewport.zoom,
    devicePixelRatio,
  })

  const ladder = GRID_ALPHA_LADDER.map((alpha) => compensated(alpha, devicePixelRatio))

  /**
   * 主网格**派生**自细档：世界步长恒为细档世界步长乘 `primaryLineEvery` 的幂。
   *
   * 主网格此前是对 `step * primaryLineEvery` 的第二次抽稀调用——两条 stride 各走各的，
   * 「每 N 格一条主线」这个比例因此会漂：20% 变 4 格、10% 变 2 格，5% 时主线与细线完全重合，
   * 大格子在屏幕上消失。派生之后比例是构造出来的，任何缩放下都成立。
   *
   * 两级而不是一级：调研里同行的层间比集中在 4–5，没有任何产品超过 10——要让大格变大，
   * 动作是加一级而不是提高比例。而加一级不需要新字段，网格本来就是自相似的，
   * 「主线的主线」就是层级的定义（tldraw 的 gridSteps 正是 4 的幂）。
   *
   * 派生之后主网格间距恒为细档的 N 与 N² 倍，而细档恒在 4–8px，因此**永远不会过密，
   * 也就永远不需要淡入**——一条淡了一半的主线既不是主线也不是细线。
   */
  const majorLayers = (axis: 'x' | 'y', detail: VisibleGridAxis, viewportOffset: number) =>
    [1, 2].map((power, index): GridLayer => {
      const worldStep = detail.worldStep * grid.primaryLineEvery ** power
      const screenStep = worldStep * viewport.zoom
      return {
        axis,
        screenStep,
        screenOffset: positiveModulo(
          (axis === 'x' ? grid.offsetX : grid.offsetY) * viewport.zoom + viewportOffset,
          screenStep,
        ),
        alpha: composeLatticeStackedAlpha(ladder[index + 1]!, ladder[index]!),
      }
    })

  /**
   * 细线分两档：`stride` 的细档按屏幕间距淡入，`2 × stride` 的骨架档补足差额。
   *
   * 抽稀后细档间距恒在 `[4, 8)`，骨架档因此恒在 `[8, 16)`——**满不透明度的线之间永远隔着
   * 至少 8px**，那才是这次改动的判据。细档满值时骨架档的浓度为 0、根本不画，所以
   * `zoom >= 1` 的输出与改动前逐字相同。
   */
  const detailLayers = (axis: 'x' | 'y', detail: VisibleGridAxis, viewportOffset: number) => {
    const fade = composeLatticeDetailFade(detail.screenStep)
    const detailAlpha = ladder[0]! * fade
    const skeletonStep = detail.screenStep * 2
    return [
      {
        axis,
        screenStep: skeletonStep,
        screenOffset: positiveModulo(
          (axis === 'x' ? grid.offsetX : grid.offsetY) * viewport.zoom + viewportOffset,
          skeletonStep,
        ),
        alpha: composeLatticeStackedAlpha(ladder[0]!, detailAlpha),
      },
      {
        axis,
        screenStep: detail.screenStep,
        screenOffset: detail.screenOffset,
        alpha: detailAlpha,
      },
    ] satisfies GridLayer[]
  }

  // CSS 多背景的首层位于最上方，因此由粗到细写入。所有层共用一支墨，因此叠加次序不影响
  // 合成结果（alpha 合成对次序对称），这个顺序只为读起来与层级一致。
  const layers: GridLayer[] = [
    ...majorLayers('x', detailX, viewport.x).reverse(),
    ...majorLayers('y', detailY, viewport.y).reverse(),
    ...detailLayers('x', detailX, viewport.x),
    ...detailLayers('y', detailY, viewport.y),
  ].filter((layer) => layer.alpha > 0.002)

  // 线宽恒为**一个设备像素**。`1px` 在 2× 屏上是两个物理像素、3× 屏上是三个——屏幕越好线越粗，
  // 而网格线从来就该是一条发丝线。dpr 已经传进来了（首线落点就靠它取整），这里是把它用起来。
  const band = finiteCssNumber(1 / devicePixelRatio)

  return {
    backgroundImage: layers
      .map((layer) => {
        const color = gridInk(layer.alpha)
        return layer.axis === 'x'
          ? `linear-gradient(90deg, ${color} ${band}px, transparent ${band}px)`
          : `linear-gradient(${color} ${band}px, transparent ${band}px)`
      })
      .join(', '),
    backgroundSize: layers
      .map((layer) => (layer.axis === 'x'
        ? `${finiteCssNumber(layer.screenStep)}px 100%`
        : `100% ${finiteCssNumber(layer.screenStep)}px`))
      .join(', '),
    backgroundPosition: layers
      .map((layer) => (layer.axis === 'x'
        ? `${finiteCssNumber(layer.screenOffset)}px 0`
        : `0 ${finiteCssNumber(layer.screenOffset)}px`))
      .join(', '),
  }
}
