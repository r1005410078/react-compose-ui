import { composePointToFields, formatComposeNumber } from '@compose-ui/core'
import { worldToScreen, type StagePoint, type StageViewport } from '@compose-ui/stage-engine'
import { resolveStageDynamicInput, type StageDynamicInputAnnotation } from './dynamic-input-geometry'

/** 缩放会话上报的尺寸参考：两点都是世界坐标。 */
export interface StageResizeReadoutInput {
  readonly origin: StagePoint
  readonly point: StagePoint
}

/**
 * 缩放手柄的尺寸读数。
 *
 * @remarks
 * 复用取点动态输入的**同一个**呈现求解，参数化恒为 `cartesian`——两点之差就是新包围盒的
 * 宽和高（原点是与手柄对角的那个角，见 `resizeReadoutPoints`）。各画一套的症状是同一个数
 * 在两处呈现里对不齐。
 *
 * 两个字段的框尾标记恒为 `idle`：**光标条是「这里能打字」的那个记号**，而读数不可键入，
 * 挂上它就是在撒谎。这条复用既有的标记派生而不新造视觉——两个东西长得一样而行为不同，
 * 与同一件事在屏幕上有两种说法，是同一类缺陷的两面。
 *
 * 不可键入这一档是有意的：动态输入唯一的输入端是命令行，而缩放是**按住拖动**的手势，
 * 那一刻焦点不在命令行上。AutoCAD 能在夹点上打字，是因为它的夹点编辑根本不按着按钮
 * （点一下变热、松开、移动、再点一下）。补可键入的正确路径是给手柄加与夹点同构的「点亮」
 * 态，不是想办法在按住的时候接键盘。
 *
 * @param readout - 缩放会话上报的原点与落点，世界坐标。
 * @param viewport - 当前视口。
 * @public
 */
export function stageResizeReadout(
  readout: StageResizeReadoutInput,
  viewport: StageViewport,
): StageDynamicInputAnnotation {
  const values = composePointToFields('cartesian', readout.point, readout.origin)
  const field = (value: number) => ({
    text: formatComposeNumber(value),
    state: 'idle' as const,
  })
  return resolveStageDynamicInput({
    kind: 'cartesian',
    origin: worldToScreen(readout.origin, viewport),
    point: worldToScreen(readout.point, viewport),
    first: field(values.first),
    second: field(values.second),
  })
}
