import { rectFromPoints, screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import {
  marqueeCombine,
  marqueeDirection,
  resolveMarqueeCommit,
  resolveMarqueeHitTest,
} from '../marquee-selection'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type { StageInteractionModifiers } from '../interaction-controller'
import type {
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** 框选工具入口的注册 id。 @public */
export const STAGE_MARQUEE_TOOL_PLUGIN_ID = 'marquee-tool'

const MARQUEE_TOOL_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_MARQUEE_TOOL_PLUGIN_ID)!.priority

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
        marqueeHitTest: resolveMarqueeHitTest(
          ctx.context.marqueeMode,
          marqueeDirection(startWorld, currentWorld),
        ),
      })
    },
    commit(ctx) {
      const selectedIds = resolveMarqueeCommit({
        area: rectFromPoints(startWorld, currentWorld),
        base: baseSelection,
        combine: marqueeCombine(modifiers),
        direction: marqueeDirection(startWorld, currentWorld),
        document: ctx.context.document,
        index: ctx.index,
        mode: ctx.context.marqueeMode,
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
    marqueeHitTest: resolveMarqueeHitTest(context.marqueeMode, 'ltr'),
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
 * 框选工具入口插件。
 *
 * @remarks
 * marquee 工具压在节点上也起框，这是它与 select 唯一的行为差异——密集画布上用户否则无处下手。
 * 命中判定与组合规则两者完全一致。
 *
 * 这是三个框选入口中位次最高的一个；另外两个（容器体收敛、默认兜底）在优先级表中分别位于
 * 800 与 100，中间夹着 draw、move、resize、guide 等尚未抽取的分支，因此**不能**与本插件
 * 一次抽完，只能各自在自己的位次落地并复用 {@link createStageMarqueeSession}。
 *
 * @public
 */
export function createStageMarqueeToolPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_MARQUEE_TOOL_PLUGIN_ID,
    priority: MARQUEE_TOOL_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext) {
      if (ctx.context.tool !== 'marquee') return null
      if (event.hit.kind !== 'surface' && event.hit.kind !== 'entity') return null
      return claimStageMarquee(event, ctx)
    },
  }
}
