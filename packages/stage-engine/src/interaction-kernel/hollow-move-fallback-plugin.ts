import { getComposeCurve, getComposeCurveFill, isComposeClosedCurve } from '@compose-ui/core'
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
 * `candidate` 是不是 `entityId` 的祖先。
 *
 * @remarks
 * 沿 index 的父链上溯，与框选提交排除起框容器祖先走的是同一条链——各写一份的话，下一个改
 * 层级语义的人只会改到其中一处。
 */
function isAncestorOf(
  index: StagePluginContext['index'],
  candidate: string,
  entityId: string,
): boolean {
  let ancestor = index.getParentId(entityId)
  while (ancestor) {
    if (ancestor === candidate) return true
    ancestor = index.getParentId(ancestor)
  }
  return false
}

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
 * **只接管拖，不接管点。**一步没动时不产生任何文档变更，也不动选区，因此双击进几何编辑那条
 * 路一个字不用改。判据是**指针有没有离开过按下点**而不是「收没收到 `pointer.move`」——浏览器
 * 在 `pointerup` 之前会补发一次原地的 move，原地单击同样收得到，与夹点「点亮」用的是同一条
 * 判据。
 *
 * **接管的条件是三个独立理由之一**：命中空白、命中一块会收敛成框选的顶层容器体、或者命中的是
 * 它自己的**祖先**（外框画在普通容器里时就是这一档）。命中一个排在它前面的具体 Entity 的按下
 * 属于那个 Entity 自己，那一支在更高优先级上。
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
      const curve = getComposeCurve(entity)
      if (!curve || getComposeCurveFill(entity)) return null
      /*
       * 「一步没动保持选中」只在**画了盒**的那一档成立，因此这里读与 Stage 决定画盒还是画
       * 几何轮廓**同一个**谓词。开放几何（对角线、一段弧、未闭合折线）选中之后画的是沿几何的
       * 轮廓、没有盒，它的包围盒里绝大部分是空的——落在空角上的那一下什么都没点到，仍然该
       * 清空选区。两处各判一次的症状是「画着轮廓的对象，点它的空角却不取消选中」。
       */
      const drawsBox = isComposeClosedCurve(curve)

      /*
       * 接管的条件是三个**独立**的理由之一：什么都没点到、点到一块会收敛成框选的顶层容器体、
       * 或者点到的是它自己的祖先。
       *
       * 第三条不能少：前两条都只覆盖「外框画在场景里」——收敛要求命中目标是 `rootIds` 的直接
       * 成员，而普通容器不是。外框画在一个普通容器里时按下命中的是那个容器，两条都不满足，
       * 这次按下就落给实体命中，**选中并拖走了那个容器**。而这个产品里的空心矩形是设备外框、
       * 柜体轮廓与分区框，它们几乎总是画在某个容器里。
       *
       * 判据取「祖先」而不是「绘制次序排在它之前」：后者同样解释得通（指针之所以落到别人身上，
       * 正是因为空心图形放行了它），但它会把画在下面的**兄弟**一并收走——点在一块看得见的墨上
       * 得到「选中那块墨」是解释得通的结果，不是这条能力要挡的那个症状。祖先没有这个问题：
       * 它在几何上**包含**这个已选中的子级，而按下点落在子级被承诺的那块面积里。
       *
       * 前两条**不因为「祖先涵盖了顶层容器体」被简化掉**：收敛那一支还覆盖锁定容器与 Group
       * （锁定的 Hierarchy 直接收敛，不看是不是顶层），删掉它会让「命中一个锁定的非祖先容器」
       * 从接管变成不接管，而那与本条要解决的问题无关。
       */
      const convergent = event.hit.kind === 'entity'
        && shouldConvergeToMarquee(context.tool, context.document, event.hit, event.modifiers)
      const ancestor = event.hit.kind === 'entity'
        && isAncestorOf(index, event.hit.entityId, entityId)
      if (event.hit.kind !== 'surface' && !convergent && !ancestor) return null

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
           * 一步没动：这是一次**单击**，先取消会话（丢掉预览并释放捕获）。
           *
           * 画了盒的那一档**不发任何选区效果**：这个对象已经是当前选区——守卫的前置条件就是
           * 如此，再选一次只会凭空多出一次可观察的选区写入。曾经这里一律还原成「框选兜底的
           * 含义」，也就是清空选区，**那在这一档不成立**：框选兜底之所以清空选区，是因为那
           * 一下什么都没点到；而这一下点在一个已经被选中的对象自己的盒里，「点一下自己的盒」
           * 等于「取消选中自己」没有任何解释得通的读法。
           *
           * 没画盒的那一档照旧清空选区：开放几何的包围盒里绝大部分是空的，那一下确实什么都
           * 没点到，而屏幕上也没有任何盒在宣称那块面积归它。
           *
           * 「只接管拖，不接管点」因此收成它真正的意思——这一下不产生任何文档变更。
           */
          session.cancel(sessionCtx)
          if (!drawsBox) sessionCtx.apply([{ type: 'selection.change', selectedIds: [] }])
        },
      }
    },
  }
}
