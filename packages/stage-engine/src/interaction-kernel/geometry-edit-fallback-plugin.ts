import { applyMatrix, invertMatrix, screenToWorld } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { resolveStageEntityHit } from './group-hit'
import { shouldConvergeToMarquee } from './marquee-plugin'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent } from './stage-kernel-profile'

/** 空心图形内部双击进入几何编辑的注册 id。 @public */
export const STAGE_GEOMETRY_EDIT_FALLBACK_PLUGIN_ID = 'geometry-edit-fallback'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 在空心图形的盒内部双击，选中它并进入几何编辑。
 *
 * @remarks
 * 空心曲线**不以包围盒拦截指针**——一个矩形外框套在符号外面时，盒里绝大部分是空的，让它可点
 * 会抢走里面每一个符号的点击。这条规则不动，本插件也不改变**任何一次单击**的含义：框选、
 * 取消选择、选中框内的符号全都照旧。
 *
 * 它补的是这样一处落差：矩形选中之后画的是普通包围盒与八个手柄，看起来就是一个面积对象，
 * 而在它中间双击却什么都不会发生——用户唯一能进顶点模式的地方是那一圈只有几像素宽的描边，
 * 而屏幕上没有任何东西说这件事。
 *
 * **只认双击**，而双击是一次明确的手势：落在这块面积里的双击不可能指别的东西——那里要么是
 * 空白，要么是更上层的 Entity，而后者会在更高优先级的分支上被自己接管。
 *
 * **不要求它已经被选中**：一次双击里的第一下会落到框选兜底、松手时清空选区，等第二下到达
 * 时选区已经空了。因此这里自己完成「选中它 + 进入几何编辑」两步——几何编辑会话的存续条件
 * 是选中集恰好只有目标，缺了前一步它进去就会立刻退出。
 *
 * 它接管的是**那些本来会变成框选的**双击：命中空白，或者命中一块会收敛成框选的顶层容器体
 * ——外框通常就画在场景里，落在它里面的点首先命中的是场景本身。因此优先级必须排在容器体
 * 收敛之上；而命中一个具体 Entity 的双击 MUST NOT 被它接管，那一下属于那个 Entity 自己
 * （文字进原地编辑、曲线进它自己的几何编辑）。
 *
 * @public
 */
export function createStageGeometryEditFallbackPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_GEOMETRY_EDIT_FALLBACK_PLUGIN_ID,
    priority: priorityOf(STAGE_GEOMETRY_EDIT_FALLBACK_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      const { context } = ctx
      // 必须恰好等于 2：计数继续增长时用户已经在几何编辑里了，那一下应当落给夹点。
      if (event.clickCount !== 2 || context.tool !== 'select') return null
      if (!context.isGeometryEditable) return null
      // 只接管本来会变成框选的那一下；命中一个具体 Entity 的双击属于那个 Entity 自己。
      // 实体命中先过 Group 门槛，与收敛插件读同一个解算结果。
      const resolved = resolveStageEntityHit(event, ctx)
      const convergent = event.hit.kind === 'entity' && resolved !== null
        && shouldConvergeToMarquee(
          context.tool,
          context.document,
          { ...event.hit, entityId: resolved.entityId },
          event.modifiers,
        )
      if (event.hit.kind !== 'surface' && !convergent) return null

      const world = screenToWorld(event.point, context.viewport)
      // 从最上层往下找：两个空心矩形叠着时，双击进的应当是画在上面的那一个。
      for (let i = ctx.index.order.length - 1; i >= 0; i -= 1) {
        const entityId = ctx.index.order[i]!
        if (!context.isGeometryEditable(entityId)) continue
        const box = ctx.index.layoutSnapshot.boxes[entityId]
        const matrix = ctx.index.getWorldMatrix(entityId)
        if (!box || !matrix) continue
        // 换算进 Entity 局部坐标再比，旋转过的对象因此自动正确。
        const local = applyMatrix(invertMatrix(matrix), world)
        if (local.x < 0 || local.y < 0 || local.x > box.width || local.y > box.height) continue

        ctx.apply([
          // 选区变更 MUST 先于进入会话：会话的存续条件是选中集恰好只有目标。
          { type: 'selection.change', selectedIds: [entityId] },
          { type: 'geometry-editing.enter', entityId, worldPoint: world },
        ])
        return 'consumed'
      }
      return null
    },
  }
}
