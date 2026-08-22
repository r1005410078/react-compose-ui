import type { CadInputPoint } from '../point-input'
import { squaredDistance, type CadBounds } from './cad-segment-geometry'

/** 文字的水平对齐；`position` 是基线上该对齐处的锚点。 @public */
export type CadTextAlign = 'left' | 'center' | 'right'

/**
 * 世界坐标下的一段文字。
 *
 * @remarks
 * `height` 是**字号（em 尺寸）**而不是大写字高：字号是渲染直接要的那个数，也是命中框直接要的
 * 那个数；存大写字高会让渲染除以一个随字体而变的比例、命中再乘回来，同一个猜测被钉进两处。
 *
 * @internal
 */
export interface CadTextShape {
  readonly position: CadInputPoint
  readonly content: string
  readonly height: number
  /** 绕插入点的旋转，度；正为屏幕顺时针，与块插入旋转取同一约定。 */
  readonly rotation: number
  readonly align: CadTextAlign
}

/**
 * 单个字符的前进宽度占字号的比例。
 *
 * @remarks
 * 图面用**等宽字体**渲染，因此这个比例几乎是精确的，而不是一个粗糙的平均。等宽也符合 CAD
 * 惯例——AutoCAD 的默认 `txt.shx` 本来就是等宽的，图纸上的标注本来就该对齐成列。
 *
 * 它与图面 CSS 里的字体栈是**一对不变量**：换掉字体而不换比例，命中框会从字形上慢慢漂开，
 * 而这种偏差在短标签上看不出来，要等到有人写一串长文字才暴露。
 *
 * @internal
 */
export const CAD_TEXT_ADVANCE_RATIO = 0.6

/** 基线以上的高度占字号的比例。 @internal */
export const CAD_TEXT_ASCENT_RATIO = 0.8

/** 基线以下的深度占字号的比例。 @internal */
export const CAD_TEXT_DESCENT_RATIO = 0.2

/** 文字框的宽度（世界单位）。 @internal */
export function cadTextWidth(text: CadTextShape) {
  return text.content.length * text.height * CAD_TEXT_ADVANCE_RATIO
}

/** 对齐决定文字框从锚点向哪一侧展开。 */
function leftOffset(text: CadTextShape) {
  const width = cadTextWidth(text)
  if (text.align === 'center') return -width / 2
  if (text.align === 'right') return -width
  return 0
}

/**
 * 文字框的四角（世界坐标），按左上、右上、右下、左下顺序。
 *
 * @remarks
 * 先在**未旋转**的局部坐标里按对齐与基线摆出四角，再整体绕插入点旋转。反过来先旋转再按对齐
 * 摆放会让对齐方向跟着转，右对齐的文字会往斜上方跑。
 *
 * @internal
 */
export function cadTextCorners(text: CadTextShape): readonly CadInputPoint[] {
  const left = leftOffset(text)
  const right = left + cadTextWidth(text)
  const top = -text.height * CAD_TEXT_ASCENT_RATIO
  const bottom = text.height * CAD_TEXT_DESCENT_RATIO
  const radians = (text.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ].map(([x, y]) => ({
    x: text.position.x + x! * cos - y! * sin,
    y: text.position.y + x! * sin + y! * cos,
  }))
}

/** 文字框的轴对齐包围盒。 @internal */
export function cadTextBounds(text: CadTextShape): CadBounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const { x, y } of cadTextCorners(text)) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * 点到文字的距离平方：**框内为 0**，框外取到框边的距离。
 *
 * @remarks
 * 这不是对「按距离而不是包围盒」的破例。那条规则的理由是「一条对角线的包围盒里绝大部分是
 * 空的」——而文字**占满**自己的盒子，盒子就是用户看见的那块墨。AutoCAD 同样是点在文字框内
 * 即选中。
 *
 * 把点变换到文字的局部坐标（逆旋转）后按轴对齐矩形算，因此旋转自动被照顾到。
 *
 * @internal
 */
export function pointToTextDistanceSquared(text: CadTextShape, point: CadInputPoint) {
  const radians = (text.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - text.position.x
  const dy = point.y - text.position.y
  // 逆旋转即转置：绕 -θ 转。
  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos

  const left = leftOffset(text)
  const right = left + cadTextWidth(text)
  const top = -text.height * CAD_TEXT_ASCENT_RATIO
  const bottom = text.height * CAD_TEXT_DESCENT_RATIO

  const clampedX = Math.max(left, Math.min(right, localX))
  const clampedY = Math.max(top, Math.min(bottom, localY))
  return squaredDistance({ x: clampedX, y: clampedY }, { x: localX, y: localY })
}
