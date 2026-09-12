import {
  getComposeCurve,
  getComposeLock,
  resolveComposeGeometryConstraints,
  type ComposeEntity,
} from '@compose-ui/core'

/**
 * 这个 Entity 能不能进几何编辑会话。
 *
 * @remarks
 * 三条缺一不可：有 `Curve`（没有几何就没有夹点）、没锁定（锁保护的正是「别动我」）、
 * 尺寸没有被锁死。
 *
 * 最后一条读的是**文档上的 `GeometryConstraints`** 而不是 `Composition.presetId`：
 * Stage 与引擎都不必多认识一种 Preset，而任何将来声明 `resize: 'none'` 的物料自动跟上。
 * 它与 `entity.curve.set` 的那条拒绝是一对——**这一条是「不邀请」**（屏幕上不出现一个按下去
 * 会被拒绝的入口），**那一条是「绕不过去」**（键盘入口、宿主自己的命令、将来某条新路径）。
 * 只做前者会留一条暗门，只做后者会让用户点进去再被拒。
 *
 * @internal
 */
export function isComposeEntityGeometryEditable(entity: ComposeEntity | undefined): boolean {
  if (!entity || !getComposeCurve(entity)) return false
  if (getComposeLock(entity).locked) return false
  return resolveComposeGeometryConstraints(entity).resize !== 'none'
}
