/**
 * 一次指针交互的完整生命周期：按下归一化、Pointer capture、window 路由、逐帧推进与取消。
 *
 * @remarks
 * 会话以单调递增的 generation 判等，过期消息一律丢弃；坐标归一化是纯函数，独立于会话。
 */
export { useStagePointerSession } from './use-stage-pointer-session'
export type {
  StagePointerSession,
  StagePointerSessionParams,
} from './use-stage-pointer-session'
export { useStageRootHandlers } from './use-stage-root-handlers'
export type { StageRootHandlers, StageRootHandlersParams } from './use-stage-root-handlers'
export {
  frozenSurfaceRect,
  modifiers,
  pressedButtons,
  resolveClientPoint,
  screenPoint,
  screenPointFromRect,
} from './stage-pointer-geometry'
export type { FrozenSurfaceRect, StageModifiers } from './stage-pointer-geometry'
