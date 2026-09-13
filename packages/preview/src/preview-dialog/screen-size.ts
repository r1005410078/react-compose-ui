import {
  COMPOSE_SCENE_SIZE_PRESETS,
  findComposeSceneSizePreset,
  formatComposeAspectRatio,
  formatComposeSceneSize,
  type ComposeCanvasViewport,
  type ComposeSceneSizePreset,
  type ComposeSize,
} from '@compose-ui/core'
import type { ComposePreviewFit } from '../compose-preview'
import type { ComposeHostBoxSize } from '../host-box'

/**
 * 预览目标的种类。
 *
 * @remarks
 * 由宿主显式给出而 **MUST NOT 从文档反推**：一份不带导航端口的页面文档与一份组件文档在
 * 结构上完全一样（都是单根 Frame 的 `ComposeDocument`），反推必然在其中一种上判错。
 *
 * @public
 */
export type ComposePreviewTargetKind = 'scene' | 'component'

/**
 * 目标种类决定的默认 `fit`。
 *
 * @remarks
 * 场景**就是那块屏的全部内容**，换一块屏时它该等比**铺满**（`cover`）；组件**只是屏上的
 * 一个零件**，换一块屏时它该原大摆在中间（`none`）——把一个 88 × 132 的符号拉伸去填满
 * 1920 × 1080 是荒唐的。这是两种目标之间唯一的实质分叉，其余差别都是文案。
 *
 * 铺满取 `cover` 而不是 `contain`：屏幕比例与场景不同时，`contain` 会在两条边留出台面的
 * 棋盘格，而**这块屏上本来不会有那两条边**——交付出去的大屏是整块亮着的。代价是超出的那一
 * 圈被裁掉，因此它是等比裁切而不是 `fill` 的两轴各自拉伸：拉伸会改变每一个图形的形状，
 * 而那是用户从未画过的样子。裁掉多少由窗口比例决定，要看完整的场景就把屏幕尺寸选成场景
 * 自己的尺寸——那一档 `cover` 与 `contain` 给出同一个答案。
 *
 * @internal
 */
export function defaultFitForTargetKind(kind: ComposePreviewTargetKind): ComposePreviewFit {
  return kind === 'component' ? 'none' : 'cover'
}

/** 台面四周留给画板的余量（CSS 像素）。 */
const STAGE_PADDING = 32
/** 一次「放大 / 缩小」的倍率；与画布的 `STAGE_ZOOM_STEP` 取同一个数。 */
export const PREVIEW_ZOOM_STEP = 1.2
/** 视图缩放的合法区间。 @internal */
export const PREVIEW_ZOOM_RANGE = { min: 0.05, max: 8 } as const

/** 视图缩放的离散动作；`reset` 是回到 100% 而不是回到初始取景。 @internal */
export type ComposePreviewZoomIntent = 'in' | 'out' | 'reset'

/**
 * 把一块屏适配进台面：等比缩放到刚好放下，并居中。
 *
 * @remarks
 * **上限是 100%，适应窗口不放大。** 预览的基准是真实像素，把 88 × 132 的组件放大到六倍
 * 之后看到的既不是它交付出去的样子，也不是任何人见过的样子；要看细节用放大按钮，那是
 * 用户的显式选择。这是对画布「适配选择」的有意偏离——那里适配的是编辑目标，不是交付形态。
 *
 * @param padding - 屏幕四周留出的台面余量（px）。整屏形态传 0：那里台面就是视口，留白等于
 * 把 1:1 变成 98%，而「默认就是真像素」正是那个形态存在的理由。
 * @returns 台面还没量出来（宽高为 0）时返回 `null`，表示不该改变取景：除以 0 会给出
 * `Infinity`，钳制之后是上限而不是「不动」。
 * @internal
 */
export function fitPreviewViewport(
  screenSize: ComposeSize,
  stageSize: ComposeHostBoxSize | null,
  padding: number = STAGE_PADDING,
): ComposeCanvasViewport | null {
  if (!stageSize || stageSize.width <= 0 || stageSize.height <= 0) return null
  if (screenSize.width <= 0 || screenSize.height <= 0) return null
  const available = {
    width: Math.max(1, stageSize.width - padding * 2),
    height: Math.max(1, stageSize.height - padding * 2),
  }
  const zoom = Math.min(
    1,
    Math.max(
      PREVIEW_ZOOM_RANGE.min,
      Math.min(available.width / screenSize.width, available.height / screenSize.height),
    ),
  )
  return {
    zoom,
    offset: {
      x: (stageSize.width - screenSize.width * zoom) / 2,
      y: (stageSize.height - screenSize.height * zoom) / 2,
    },
  }
}

/**
 * 以台面中心为锚点做一次离散缩放。
 *
 * @remarks
 * 锚点固定在中心而不是指针位置：按钮与键盘都没有可信的指针坐标。
 *
 * @internal
 */
export function zoomPreviewViewport(
  viewport: ComposeCanvasViewport,
  stageSize: ComposeHostBoxSize | null,
  intent: ComposePreviewZoomIntent,
): ComposeCanvasViewport {
  const requested = intent === 'reset'
    ? 1
    : intent === 'in' ? viewport.zoom * PREVIEW_ZOOM_STEP : viewport.zoom / PREVIEW_ZOOM_STEP
  const zoom = Math.min(PREVIEW_ZOOM_RANGE.max, Math.max(PREVIEW_ZOOM_RANGE.min, requested))
  const anchor = stageSize
    ? { x: stageSize.width / 2, y: stageSize.height / 2 }
    : { x: 0, y: 0 }
  // 绕锚点缩放：保持锚点的屏幕坐标不变。这里的「世界」就是屏幕像素空间，因此换算是一步代数。
  const world = { x: (anchor.x - viewport.offset.x) / viewport.zoom, y: (anchor.y - viewport.offset.y) / viewport.zoom }
  return { zoom, offset: { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom } }
}

/** 屏幕尺寸下拉的一项。 @internal */
export interface ComposeScreenSizeOption {
  readonly value: string
  readonly label: string
  readonly size: ComposeSize
}

/**
 * 把一个尺寸格式化成下拉里的一行，形如 `1920 × 1080 · Full HD · 16:9`。
 *
 * @remarks
 * 通名来自 {@link findComposeSceneSizePreset}，**查不到时标为「自定义」而不是留空**：
 * 空着读起来像漏了一列，而「自定义」回答了用户真正会问的那句「为什么这一条没有名字」。
 * 这不是组件的特例——把场景设成 1000 × 800 同样落在这一档。
 *
 * @internal
 */
export function formatScreenSizeOptionLabel(size: ComposeSize, customName: string): string {
  const preset = findComposeSceneSizePreset(size)
  const ratio = formatComposeAspectRatio(size)
  const name = preset?.name || customName
  return [formatComposeSceneSize(size), name, ratio].filter(Boolean).join(' · ')
}

/**
 * 屏幕尺寸下拉的两组候选。
 *
 * @remarks
 * 第一组恰好一项——**预览目标自身的尺寸**，也就是「回到 1:1」。第二组是
 * {@link COMPOSE_SCENE_SIZE_PRESETS}，与画布上的尺寸胶囊、Inspector 是同一份清单；
 * 目标尺寸恰好等于某个预设时那一项从第二组里去掉，否则同一个尺寸会出现两行。
 *
 * @internal
 */
export function buildScreenSizeOptions(
  targetSize: ComposeSize,
  customName: string,
  presets: readonly ComposeSceneSizePreset[] = COMPOSE_SCENE_SIZE_PRESETS,
): { readonly target: ComposeScreenSizeOption; readonly presets: readonly ComposeScreenSizeOption[] } {
  return {
    target: {
      value: screenSizeValue(targetSize),
      label: formatScreenSizeOptionLabel(targetSize, customName),
      size: targetSize,
    },
    presets: presets
      .filter((preset) =>
        preset.size.width !== targetSize.width || preset.size.height !== targetSize.height)
      .map((preset) => ({
        value: screenSizeValue(preset.size),
        label: formatScreenSizeOptionLabel(preset.size, customName),
        size: preset.size,
      })),
  }
}

/** 下拉项的稳定 value；不面向用户显示。 @internal */
export function screenSizeValue(size: ComposeSize): string {
  return `${size.width}x${size.height}`
}

/** 横竖互换。 @internal */
export function swapScreenSize(size: ComposeSize): ComposeSize {
  return { width: size.height, height: size.width }
}

/**
 * 把「场景映射进这块屏」这件事格式化成尺寸胶囊上的一行。
 *
 * @remarks
 * 屏幕与目标一致时只写一个尺寸加 `1:1`——那是最常见也最该一眼读出的一档。不一致时写
 * `屏幕 ← 目标 · 比例`，因为此刻用户最该知道的是**两者不是一回事**，以及差了多少。
 * 用符号而不是词，是为了让这一行在任何 locale 下都是同一串；词由 `aria-label` 承担。
 *
 * @internal
 */
export function formatScreenMapping(
  screenSize: ComposeSize,
  targetSize: ComposeSize,
  scale: number,
): string {
  const screen = formatComposeSceneSize(screenSize)
  if (screenSize.width === targetSize.width && screenSize.height === targetSize.height) {
    return `${screen} · 1:1`
  }
  const percent = Math.round(scale * 100)
  return `${screen} ← ${formatComposeSceneSize(targetSize)} · ${percent === 100 ? '1:1' : `${percent}%`}`
}
