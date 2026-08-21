import type { StageInteractionPlugin, StagePluginContext } from './stage-kernel-profile'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'

/** 文字编辑守卫的注册 id。 @public */
export const STAGE_TEXT_EDIT_GUARD_PLUGIN_ID = 'text-edit-guard'

const GUARD_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_TEXT_EDIT_GUARD_PLUGIN_ID)!.priority

/**
 * 文字编辑守卫。
 *
 * @remarks
 * 它不是手势，而是整条 claim 级联的**最高优先级前置判定**，因此必须排在所有手势插件之前：
 * 编辑态下在目标自身上拖拽的语义是选择文本而不是操作实体，编辑态下按下别处则要先结束编辑
 * 再按普通交互处理。任何手势插件排到它前面，都会让「编辑中按下」绕过这两条规则——例如
 * 编辑中按中键会直接开始平移，且编辑会话永远退不出去。
 *
 * 三种结果各自对应契约的一态：命中编辑目标或变换手柄返回 `consumed`（整条手势打住）；
 * 编辑态下按在别处发出退出效果后返回 `null`（本次按下继续交给后续插件）；非编辑态返回
 * `null`。
 *
 * @public
 */
export function createStageTextEditGuardPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_TEXT_EDIT_GUARD_PLUGIN_ID,
    priority: GUARD_PRIORITY,
    claim(event, ctx: StagePluginContext) {
      const editing = ctx.context.textEditing
      if (!editing) return null
      // 编辑态下在目标自身上拖拽的语义是选择文本，不是移动实体；整条手势就此打住，
      // 否则用户在文字上拖选会把实体拖走。
      const onEditingTarget = event.hit.kind === 'entity'
        && event.hit.entityId === editing.entityId
      // 变换手柄始终作用于当前选区，而编辑态的选区就是编辑目标，因此一并屏蔽——
      // Stage 在编辑态本就不渲染这些手柄，这里是协议层的兜底。
      const onEditingHandle = event.hit.kind === 'resize'
        || event.hit.kind === 'rotate'
        || event.hit.kind === 'move-axis'
        || (event.hit.kind === 'segment-endpoint' && event.hit.entityId === editing.entityId)
      if (onEditingTarget || onEditingHandle) return 'consumed'
      ctx.apply([{ type: 'text-editing.exit' }])
      // 退出后本次按下继续按普通交互处理：点空白即取消选择，点别的实体即选中它。
      return null
    },
  }
}
