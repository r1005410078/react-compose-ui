import { resolveStageGroupHit, type StageGroupHitResolution } from '../hit-testing'
import type { StagePluginContext, StagePointerDownEvent } from './stage-kernel-profile'

/**
 * 把一次 `pointer.down` 的实体命中过一遍 Group 门槛。
 *
 * @remarks
 * 四个读实体命中的插件（收敛、空心移动兜底、几何编辑兜底、选中并拖动）MUST 读**同一个**
 * 解算结果：各自按裸命中判断的话，「命中一个锁定 Group 的子级」在收敛那里是起框、在选中那里
 * 是选中子级，同一次按下两个插件看到的是两个不同的对象。
 *
 * 命中不是实体时返回 `null`，调用方照旧走自己的非实体分支。
 *
 * @public
 */
export function resolveStageEntityHit(
  event: StagePointerDownEvent,
  ctx: StagePluginContext,
): StageGroupHitResolution | null {
  if (event.hit.kind !== 'entity') return null
  const { context, index } = ctx
  return resolveStageGroupHit({
    document: context.document,
    getParentId: (entityId) => index.getParentId(entityId),
    entityId: event.hit.entityId,
    selectedIds: context.selectedIds,
    ...(event.clickCount === undefined ? {} : { clickCount: event.clickCount }),
    deep: event.modifiers.command,
  })
}
