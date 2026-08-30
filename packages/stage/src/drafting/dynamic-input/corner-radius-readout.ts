import { formatComposeNumber } from '@compose-ui/core'
import { worldToScreen, type StageCurveCorner, type StageViewport } from '@compose-ui/stage-engine'
import { resolveStageDynamicInput, type StageDynamicInputAnnotation } from './dynamic-input-geometry'

/**
 * 圆角手柄拖动时的半径读数。
 *
 * @remarks
 * 被量的那一段是**圆心到弧上**，与 CAD 的半径标注一致：它始终贴着正在变形的那条边，而不是
 * 指向形状之外的尖角顶点——圆角之后那个顶点根本不在形状上，标注从那里出发离真正在变的那条
 * 边最远。手柄画的就是圆心，因此这一段的起点白拿。
 *
 * 参数化是 `radius`——**单字段**：圆角是绕对称的，方向不影响结果，一个永远不影响结果的
 * 只读字段比没有更差。摆位与断开一律走取点动态输入的同一个求解，不为圆角另立一套。
 *
 * 弧上的落点取角平分线方向：圆心指向角顶点的那条射线就是角平分线，而它恒在两个切点之间。
 *
 * @returns 半径为零（尖角）时返回 `null`：没有弧可量。
 * @public
 */
export function stageCornerRadiusReadout(
  corner: StageCurveCorner,
  viewport: StageViewport,
): StageDynamicInputAnnotation | null {
  if (!(corner.radius > 0)) return null
  const dx = corner.vertex.x - corner.point.x
  const dy = corner.vertex.y - corner.point.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return null
  const onArc = {
    x: corner.point.x + (dx / length) * corner.radius,
    y: corner.point.y + (dy / length) * corner.radius,
  }
  return resolveStageDynamicInput({
    kind: 'radius',
    origin: worldToScreen(corner.point, viewport),
    point: worldToScreen(onArc, viewport),
    // 读数不可键入：拖动是按住的手势，那一刻焦点不在命令行上。与缩放读数同一条判断。
    first: { text: formatComposeNumber(corner.radius), state: 'idle' },
    second: { text: '', state: 'idle' },
    // 被量的那一段必须画出来：不画它，标注的两条延伸线就从空处伸出来，用户读不出这个数
    // 说的是什么。这里的预览几何是整条曲线，而半径那一段不在它里面。
    measured: true,
  })
}
