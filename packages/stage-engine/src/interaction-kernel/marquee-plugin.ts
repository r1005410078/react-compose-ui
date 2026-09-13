import {
  getComposeHierarchy,
  getComposeLock,
  isComposeGroupEntity,
  type ComposeDocument,
} from '@compose-ui/core'
import { rectFromPoints, screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import {
  resolveStageMarqueeCombine,
  marqueeDirection,
  resolveMarqueeCommit,
  resolveMarqueeHitTest,
} from '../hit-testing'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { resolveStageEntityHit } from './group-hit'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type {
  StageInteractionHit,
  StageInteractionModifiers,
  StageInteractionTool,
} from '../interaction-controller'
import type { StageInteractionPlugin, StagePluginContext, StagePointerDownEvent, StageSession } from './stage-kernel-profile'

/** 框选工具入口的注册 id。 @public */

/** 容器体收敛入口的注册 id。 @public */
export const STAGE_MARQUEE_CONVERGE_PLUGIN_ID = 'marquee-converge'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 一次框选会话的接管参数。
 *
 * @remarks
 * 三个框选入口（工具、容器体收敛、默认兜底）只在**何时接管**上不同，接管之后的推进与提交
 * 完全一致，因此共用本工厂。差异全部落在 `originEntityId` 上：只有从容器体上收敛而来的框选
 * 需要排除起框容器。
 *
 * @public
 */
export interface StageMarqueeSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  /** 按下当刻的世界坐标，全程冻结。 */
  readonly startWorld: StagePoint
  /** 起框所在的容器 Entity；从空白起框时省略。 */
  readonly originEntityId?: string
  /** 框选开始前的选区；Shift 加选与 Alt 减选以它为基准，不受拖拽过程影响。 */
  readonly baseSelection: readonly string[]
  readonly baselineHolds: StageSpatialBaselineCheck
}

/**
 * 建立一次框选会话。
 *
 * @remarks
 * 由三个框选入口插件共用；调用方负责在接管时发布首帧快照并捕获指针。
 *
 * @public
 */
export function createStageMarqueeSession(options: StageMarqueeSessionOptions): StageSession {
  const { pointerId, viewport, startWorld, originEntityId, baseSelection, baselineHolds } = options
  let currentWorld = startWorld
  // 组合意图以**释放时**按住的修饰键为准，用户可以在拖拽途中改主意；commit 不接收事件，
  // 因此由仲裁器在提交前驱动的那次 update 把它记下来。
  let modifiers: StageInteractionModifiers = { shift: false, alt: false, command: false }

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 框选使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变同一次
      // Pointer 手势的坐标基线。
      currentWorld = screenToWorld(event.point, viewport)
      modifiers = event.modifiers
      ctx.publish({
        ...ctx.snapshot,
        phase: 'marquee',
        marquee: rectFromPoints(startWorld, currentWorld),
        marqueeHitTest: resolveMarqueeHitTest(marqueeDirection(startWorld, currentWorld)),
      })
    },
    commit(ctx) {
      const selectedIds = resolveMarqueeCommit({
        area: rectFromPoints(startWorld, currentWorld),
        base: baseSelection,
        combine: resolveStageMarqueeCombine(modifiers, ctx.context.selectionMode),
        direction: marqueeDirection(startWorld, currentWorld),
        document: ctx.context.document,
        index: ctx.index,
        originEntityId,
      })
      ctx.apply([{ type: 'selection.change', selectedIds }])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 框只活在快照里，回到空闲即丢弃；选区保持按下前的样子。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next) {
      // 框本身只由世界坐标定义，但 baseSelection 是一串按下当刻冻结的 Entity ID：文档一变
      // 它们可能已经被删除或替换，用它做 add/subtract 的基准就会把幽灵写回选区。
      return baselineHolds(next)
    },
  }
}

/**
 * 接管一次框选：发布首帧快照、捕获指针并建立会话。
 *
 * @remarks
 * 三个入口插件共用的接管收尾动作，保证首帧快照与指针捕获的顺序在各入口之间不漂移。
 *
 * @public
 */
export function claimStageMarquee(
  event: StagePointerDownEvent,
  ctx: StagePluginContext,
  originEntityId?: string,
): StageSession {
  const { context } = ctx
  const startWorld = screenToWorld(event.point, context.viewport)
  ctx.publish({
    ...ctx.idleSnapshot(),
    phase: 'marquee',
    // 起点即终点，方向尚未确定；按下的一瞬间先按 ltr 归约，移动时会立即刷新。
    marqueeHitTest: resolveMarqueeHitTest('ltr'),
  })
  ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
  return createStageMarqueeSession({
    pointerId: event.pointerId,
    viewport: context.viewport,
    startWorld,
    originEntityId,
    baseSelection: context.selectedIds,
    baselineHolds: captureStageSpatialBaseline(context),
  })
}


/**
 * 判断一次 entity 命中是否应当收敛为框选而不是选中该 Entity。
 *
 * @remarks
 * 顶层容器的空白区域在用户眼里是「容器内的画布」而不是容器本身——沿用 Sketch Artboard 与
 * Figma Frame 的约定，容器体不抢占选中，选中入口收敛到标题标签。
 *
 * 收敛只发生在**顶层**容器上：标题标签只画给顶层容器（v7 下即 `rootIds` 里的场景），
 * 嵌套容器没有标签，一旦收敛就没有任何选中入口了。
 *
 * **容器为空、以及容器已在选区里，都不再是例外。** 两者曾各自留出一条搬走整块场景的路径：
 * 空场景整块都是拖动把手，而用户几乎总是先选中场景（看属性、改尺寸）再去框选它的内容，
 * 此时保护恰好失效——而子级是相对坐标，场景被搬走时画面内部没有任何变化，用户很久之后才
 * 发现。两者都有标题标签这个不受影响的入口，因此没有「收敛之后就选不中了」的补偿问题。
 *
 * `command` 是标签之外的第二个入口（抄 Sketch 的 ⌘ 点击）。已知耦合：`command` 在移动手势
 * 里同时表示「临时关闭吸附」，因此按住它拖场景的第一帧吸附是关的；修饰键逐帧读取，松开即
 * 恢复，而场景在工作区里的位置不影响产出，不值得为此另造一个键。
 *
 * @public
 */
export function shouldConvergeToMarquee(
  tool: StageInteractionTool,
  document: ComposeDocument,
  hit: Extract<StageInteractionHit, { kind: 'entity' }>,
  modifiers: StageInteractionModifiers,
): boolean {
  if (tool !== 'select') return false
  const entity = document.entities[hit.entityId]
  if (!entity) return false
  const hierarchy = getComposeHierarchy(entity)
  // 锁定的容器与 Group 完全退出画布选中：它们本来就是用来「挡住不要动的东西」的，
  // 还能被点中只会让用户反复误选。标签与 command 同样不是入口，改从场景树选中。
  if (hierarchy && getComposeLock(entity).locked) return true
  if (hit.source === 'label') return false
  if (modifiers.command) return false
  // 顶层 = `rootIds` 的直接成员，v7 下即各块场景。判定必须与标题标签的渲染范围保持一致：
  // 收敛只能作用于带标签的容器，否则被收敛的容器在画布上没有任何选中入口。
  if (!document.rootIds.includes(hit.entityId)) return false
  // Group 不是「容器」：它没有画布标签，收敛之后就再也选不中了。
  if (isComposeGroupEntity(entity)) return false
  return hierarchy !== null
}

/**
 * 容器体收敛入口插件。
 *
 * @remarks
 * 在顶层容器体上按下时起框而不是选中该容器，起框容器与它的祖先随后被排除在结果之外。
 *
 * 它在优先级表中位于 800，与 1100 的工具入口之间隔着 draw(1000) 与 move-axis(900)——因此两者
 * **不能**作为一个插件一次抽完，只能各自在自己的位次上复用 {@link createStageMarqueeSession}。
 *
 * @public
 */
export function createStageMarqueeConvergePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_MARQUEE_CONVERGE_PLUGIN_ID,
    priority: priorityOf(STAGE_MARQUEE_CONVERGE_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext) {
      if (event.hit.kind !== 'entity') return null
      // 先过 Group 门槛再判收敛：命中一个锁定 Group 的子级，看到的必须是那个锁定的 Group。
      const resolved = resolveStageEntityHit(event, ctx)
      if (!resolved) return null
      const hit = { ...event.hit, entityId: resolved.entityId }
      const { context } = ctx
      if (!shouldConvergeToMarquee(context.tool, context.document, hit, event.modifiers)) {
        return null
      }
      return claimStageMarquee(event, ctx, hit.entityId)
    },
  }
}
