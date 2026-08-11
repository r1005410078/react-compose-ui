import type { StageRulerTick } from '@compose-ui/stage-engine'

/** 带数字刻度的上边界；比细刻度更长以形成层级。 */
export const RULER_TICK_TOP = 12

/** 细刻度的上边界；只保留贴近内容区的一小段。 */
export const RULER_MINOR_TICK_TOP = 17

/** 数字基线距标尺顶部的距离。 */
const RULER_LABEL_BASELINE = 11

/** 选区区间条所在的高度。 */
const SELECTION_BAR_TOP = 20

/** 选区端点竖线的上边界。 */
const SELECTION_CAP_TOP = 14

/** 标尺绘制使用的颜色；由容器 CSS 自定义属性提供，保持主题可覆盖。 */
export interface RulerPalette {
  readonly tick: string
  readonly tickMajor: string
  readonly label: string
  readonly selection: string
  readonly selectionLabel: string
  readonly selectionShadow: string
  readonly cursor: string
}

/** 单条标尺一次绘制所需的全部输入。 */
export interface RulerPaintInput {
  readonly axis: 'x' | 'y'
  readonly ticks: readonly StageRulerTick[]
  /** 标尺的 CSS 像素尺寸。 */
  readonly size: { readonly width: number; readonly height: number }
  readonly devicePixelRatio: number
  readonly palette: RulerPalette
  /** 选区在本轴上的屏幕区间与尺寸文本；无选区时为空。 */
  readonly selection: {
    readonly start: number
    readonly end: number
    readonly label: string
  } | null
  /** 指针在本轴上的屏幕位置；指针离开时为空。 */
  readonly cursor: number | null
}

/*
 * 纵向标尺整体旋转 90° 后复用同一套绘制代码：旋转后「沿轴方向」永远是 x，「厚度方向」永远
 * 是 y，避免每处几何都写两遍并因此产生两轴不一致的偏差。
 */
function applyAxisTransform(
  ctx: CanvasRenderingContext2D,
  input: RulerPaintInput,
) {
  if (input.axis === 'x') return
  ctx.translate(0, 0)
  ctx.rotate(Math.PI / 2)
  ctx.translate(0, -input.size.width)
}

/** 沿轴方向的可绘制长度。 */
function axisLength(input: RulerPaintInput) {
  return input.axis === 'x' ? input.size.width : input.size.height
}

/** 厚度方向的尺寸。 */
function axisThickness(input: RulerPaintInput) {
  return input.axis === 'x' ? input.size.height : input.size.width
}

/**
 * 绘制一条标尺。
 *
 * @remarks
 * 所有沿轴坐标都以 `[position, position + 1)` 的 1 CSS px 带绘制，与画布网格的
 * `linear-gradient(色 1px, transparent 1px)` 语义一致；这是标尺与网格能够严格对齐的前提。
 * 数字以该带的中心（`position + 0.5`）居中，不再左对齐。
 */
export function paintRuler(ctx: CanvasRenderingContext2D, input: RulerPaintInput): void {
  const { devicePixelRatio: dpr, palette } = input
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, input.size.width, input.size.height)
  ctx.save()
  applyAxisTransform(ctx, input)

  const thickness = axisThickness(input)
  const length = axisLength(input)

  ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  for (const tick of input.ticks) {
    if (tick.screen < -length || tick.screen > length * 2) continue
    // 细刻度短、带数字的刻度长；主网格线上的刻度用更亮的颜色，形成三级层次。
    const top = tick.label ? RULER_TICK_TOP : RULER_MINOR_TICK_TOP
    ctx.fillStyle = tick.major ? palette.tickMajor : palette.tick
    ctx.fillRect(tick.screen, top, 1, thickness - top)
    if (!tick.label) continue
    ctx.fillStyle = palette.label
    ctx.fillText(tick.label, tick.screen + 0.5, RULER_LABEL_BASELINE)
  }

  if (input.selection) {
    const { start, end, label } = input.selection
    ctx.fillStyle = palette.selection
    ctx.fillRect(start, SELECTION_BAR_TOP, Math.max(0, end - start), 1)
    ctx.fillRect(start, SELECTION_CAP_TOP, 1, thickness - SELECTION_CAP_TOP)
    ctx.fillRect(end, SELECTION_CAP_TOP, 1, thickness - SELECTION_CAP_TOP)
    ctx.fillStyle = palette.selectionLabel
    ctx.fillText(label, (start + end) / 2, RULER_LABEL_BASELINE + 7)
  }

  if (input.cursor !== null) {
    ctx.fillStyle = palette.cursor
    ctx.fillRect(input.cursor, 0, 1, thickness)
  }

  ctx.restore()
}
