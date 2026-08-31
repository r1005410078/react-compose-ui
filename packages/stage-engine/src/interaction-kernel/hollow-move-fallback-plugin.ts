import { getComposeCurve, getComposeCurveFill } from '@compose-ui/core'
import { applyMatrix, invertMatrix, screenToWorld, type StagePoint } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { shouldConvergeToMarquee } from './marquee-plugin'
import { claimStageMove } from './move-plugin'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
} from './stage-kernel-profile'

/** 空心图形选中之后，盒内部起手的拖动即移动它的注册 id。 @public */
export const STAGE_HOLLOW_MOVE_FALLBACK_PLUGIN_ID = 'hollow-move-fallback'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 已选中的空心图形，从它盒内部起手的**拖动**即移动它。
 *
 * @remarks
 * 空心曲线**不以包围盒拦截指针**——外框套在符号外面时，让盒可点会抢走里面每一个符号的点击。
 * 那条规则对**没选中**的对象成立，本插件不动它。
 *
 * 它补的是另一处落差：选中之后画的是普通包围盒与八个手柄，那是一句承诺——「你正在操作的是
 * 这块面积」。而它的内部不但是死的，从那里起手拖动还会拉出一个框选、顺带把自己**取消选中**。
 * 用户读到的是「我抓着这个东西拖了一下，它跑了」，屏幕上写着一件事、做的是另一件事。
 * 原来那条理由在这一档不成立：对象已经选中了，「点的是谁」这个问题已经有答案。
 *
 * **只接管拖，不接管点。**一步没动就把这次按下还原成它本来的含义（框选兜底 = 清空选区），
 * 因此单击照旧穿过去，双击进几何编辑那条路也一个字不用改。判据是**指针有没有离开过按下点**
 * 而不是「收没收到 `pointer.move`」——浏览器在 `pointerup` 之前会补发一次原地的 move，原地
 * 单击同样收得到，与夹点「点亮」用的是同一条判据。
 *
 * **只接管本来会变成框选的那一下**：命中空白，或命中一块会收敛成框选的顶层容器体（外框通常
 * 就画在场景里）。命中一个具体 Entity 的按下属于那个 Entity 自己，那一支在更高优先级上。
 *
 * **按住 Shift 时不接管**：Shift 的含义是「加进选区」，从来不是「移动」，而从框内起手做一次
 * 加选式框选是正当用法。
 *
 * **只对自己的选区**：别人的盒不拦你，而这正是「盒是一句承诺」那条理由的作用范围——没画盒的
 * 地方没有承诺可违背。
 *
 * @public
 */
export function createStageHollowMoveFallbackPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_HOLLOW_MOVE_FALLBACK_PLUGIN_ID,
    priority: priorityOf(STAGE_HOLLOW_MOVE_FALLBACK_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      const { context, index } = ctx
      if (context.tool !== 'select' || event.modifiers.shift) return null
      // 连击交给更高优先级的双击分支；三击以上照旧落到框选，与本插件引入之前一致。
      if ((event.clickCount ?? 1) !== 1) return null

      const selected = context.selectedIds.filter((id) => context.document.entities[id])
      if (selected.length !== 1) return null
      const entityId = selected[0]!
      const entity = context.document.entities[entityId]!
      // 判据读**渲染与命中共用的那个填充入口**：全透明等于没填充，不另判一次「算不算填了色」。
      if (!getComposeCurve(entity) || getComposeCurveFill(entity)) return null

      // 只接管本来会变成框选的那一下。
      const convergent = event.hit.kind === 'entity'
        && shouldConvergeToMarquee(context.tool, context.document, event.hit, event.modifiers)
      if (event.hit.kind !== 'surface' && !convergent) return null

      const box = index.layoutSnapshot.boxes[entityId]
      const matrix = index.getWorldMatrix(entityId)
      if (!box || !matrix) return null
      // 换算进 Entity 局部坐标再比，旋转过的对象因此自动正确。
      const world = screenToWorld(event.point, context.viewport)
      const local = applyMatrix(invertMatrix(matrix), world)
      if (local.x < 0 || local.y < 0 || local.x > box.width || local.y > box.height) return null

      // 锁定或不可移动时返回 `null` 而不是 `'consumed'`：这次拖动应当照旧变成框选。
      const session = claimStageMove(event, ctx, selected)
      if (!session) return null

      const start: StagePoint = event.point
      let moved = false
      return {
        ...session,
        update(next, sessionCtx) {
          if (
            (next.type === 'pointer.move' || next.type === 'pointer.up')
            && (next.point.x !== start.x || next.point.y !== start.y)
          ) {
            moved = true
          }
          session.update(next, sessionCtx)
        },
        commit(sessionCtx) {
          if (moved) {
            session.commit(sessionCtx)
            return
          }
          /*
           * 一步没动：这是一次**单击**，还原它本来的含义。今天它落到框选兜底，一个零面积的
           * 框什么都框不到，于是清空选区——`cancel` 负责丢掉预览并释放捕获。
           */
          session.cancel(sessionCtx)
          sessionCtx.apply([{ type: 'selection.change', selectedIds: [] }])
        },
      }
    },
  }
}
