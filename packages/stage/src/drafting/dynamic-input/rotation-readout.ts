import { composePointToFields, formatComposeNumber } from '@compose-ui/core'
import { worldToScreen, type StagePoint, type StageViewport } from '@compose-ui/stage-engine'
import { resolveStageDynamicInput, type StageDynamicInputAnnotation } from './dynamic-input-geometry'

/** 旋转会话上报的中心与拉杆终点：两点都是世界坐标。 */
export interface StageRotationReadoutInput {
  readonly center: StagePoint
  readonly pointer: StagePoint
}

/**
 * 拖动旋转圆环时的角度读数。
 *
 * @remarks
 * 与缩放的宽高读数走**同一个纯函数与同一套呈现**，只是参数化换成单字段的 `angle`——同一个数
 * 在两处呈现里对不齐，是各画一套的必然结果，而旧的 Godot 拉线正是自带了一套标签样式。
 *
 * 单字段的理由与圆的半径逐字相同：到中心的距离对旋转结果没有任何影响，一个永远不影响结果的
 * 只读字段比没有更差。
 *
 * 两个字段的框尾标记恒为 `idle`：光标条是「这里能打字」的那个记号，而读数不可键入。
 *
 * @param readout - 旋转会话上报的中心与拉杆终点，世界坐标。
 * @param viewport - 当前视口。
 * @public
 */
export function stageRotationReadout(
  readout: StageRotationReadoutInput,
  viewport: StageViewport,
): StageDynamicInputAnnotation {
  const values = composePointToFields('angle', readout.pointer, readout.center)
  const field = (text: string) => ({ text, state: 'idle' as const })
  return resolveStageDynamicInput({
    kind: 'angle',
    origin: worldToScreen(readout.center, viewport),
    point: worldToScreen(readout.pointer, viewport),
    // 角度带上单位：它是这两个字段里唯一一个不是长度的量。
    first: field(`${formatComposeNumber(values.first)}°`),
    second: field(formatComposeNumber(values.second)),
  })
}
