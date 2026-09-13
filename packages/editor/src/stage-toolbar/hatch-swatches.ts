/**
 * 填充色板：这一页已经用过的那些颜色。
 *
 * @remarks
 * 色板从**文档算出来**而不是内置一张表，也**不引入任何文档字段**。内置一份色表是替宿主做了
 * 一个多半要改的决定，与「不内置电压等级色表」同一条；而一张接线图上真正会用到的那几档，
 * 用户自己已经在图上用过了。
 */

import {
  COMPOSE_DEFAULT_HATCH_COLOR,
  getComposeCurve,
  getComposeCurveFill,
  normalizeComposeColor,
  type ComposeDocument,
} from '@compose-ui/core'

/**
 * 色板最多列几档。
 *
 * @remarks
 * 弹出层是一行，多到要换行就不再是「挑一个最近用过的」而是一张色表了——那是 Inspector 里
 * 取色器的活儿，这里给的是快捷入口。
 */
const MAX_SWATCHES = 8

/**
 * 这一页已经用过的填充色，默认色恒在第一位。
 *
 * @remarks
 * 只看**带 `Curve`** 的 Entity：容器与矩形盒的背景是另一回事（那是一块底板的颜色），混进来
 * 会让色板列出一堆与填充无关的档。读取走 `getComposeCurveFill`——渲染与命中读的是同一个入口，
 * 因此「色板上列出来的」与「图上看得见的」不可能分家；全透明按那个入口的定义等于没填充。
 *
 * 默认色**恒在第一位而不是按用过的次序排**：它是这条能力的起点，一张空白页上也要有东西可点；
 * 而位置固定之后用户的第二次点击不需要重新找。
 *
 * @public
 */
export function composeHatchSwatches(document: ComposeDocument): readonly string[] {
  const seen = new Set<string>([COMPOSE_DEFAULT_HATCH_COLOR])
  const swatches: string[] = [COMPOSE_DEFAULT_HATCH_COLOR]
  for (const entity of Object.values(document.entities)) {
    if (swatches.length >= MAX_SWATCHES) break
    if (!getComposeCurve(entity)) continue
    const fill = getComposeCurveFill(entity)
    // 规范化之后再去重：`#3F5068` 与 `#3f5068` 是同一档，列两遍读起来像两个很接近的颜色。
    const color = fill ? normalizeComposeColor(fill) : null
    if (!color || color === 'transparent' || seen.has(color)) continue
    seen.add(color)
    swatches.push(color)
  }
  return swatches
}
