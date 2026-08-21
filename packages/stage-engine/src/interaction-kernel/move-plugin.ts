import { getComposeLock } from '@compose-ui/core'
import {
  screenToWorld,
  type StagePoint,
  type StageRect,
  type StageTransform,
  type StageViewport,
} from '../geometry'
import { planMoveCommit, planMovePreview } from '../gesture-planning'
import { resolveTransformTargets } from '../gesture-planning'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type { StageDropTarget } from '../hit-testing'
import type { StageInteractionModifiers } from '../interaction-controller'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent, StageSession } from './stage-kernel-profile'

/** 轴向移动手柄入口的注册 id。 @public */
export const STAGE_MOVE_AXIS_PLUGIN_ID = 'move-axis'

/** 实体选中并拖动入口的注册 id。 @public */
export const STAGE_ENTITY_SELECT_MOVE_PLUGIN_ID = 'entity-select-move'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 一次移动会话的接管参数。
 *
 * @remarks
 * 移动有多个接管入口（轴向手柄、实体拖动），它们只在**何时接管**与是否带轴向约束上不同，
 * 接管之后的推进与提交完全一致，因此共用本工厂。
 *
 * @public
 */
export interface StageMoveSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  /** 已按顶层收敛、且滤掉不可移动目标的 Entity。 */
  readonly ids: readonly string[]
  /** 接管当刻的选区世界包围盒。 */
  readonly bounds: StageRect
  /** 接管当刻的世界坐标。 */
  readonly startWorld: StagePoint
  /** 轴向约束；来自 move-axis 手柄，自由拖动时省略。 */
  readonly axis?: 'x' | 'y'
  /** 接管当刻的屏幕坐标，Space 切换时用于原地重算。 */
  readonly startPoint: StagePoint
  readonly startModifiers: StageInteractionModifiers
  readonly baselineHolds: StageSpatialBaselineCheck
}

/**
 * 建立一次移动会话。
 *
 * @remarks
 * 由各移动入口插件共用；调用方负责在接管时发布首帧快照并捕获指针。
 *
 * @public
 */
export function createStageMoveSession(options: StageMoveSessionOptions): StageSession {
  const { pointerId, viewport, ids, bounds, startWorld, axis, baselineHolds } = options
  let transforms: Readonly<Record<string, StageTransform>> = {}
  let dropTarget: StageDropTarget | null = null
  let parentLocked = false
  // 最近一次指针位置是**屏幕**坐标：Space 切换时要用同一个入口重算，而世界坐标依赖手势冻结的
  // viewport，存屏幕点才能原样复算。
  let lastPoint = options.startPoint
  let lastModifiers = options.startModifiers

  const recompute = (ctx: StagePluginContext) => {
    const preview = planMovePreview({
      context: ctx.context,
      index: ctx.index,
      ids,
      bounds,
      startWorld,
      world: screenToWorld(lastPoint, viewport),
      axis,
      zoom: viewport.zoom,
      modifiers: lastModifiers,
      parentLocked,
    })
    transforms = preview.transforms
    dropTarget = preview.dropTarget
    ctx.publish({
      ...ctx.snapshot,
      phase: 'move',
      previewTransforms: preview.transforms,
      snapGuides: preview.snapGuides,
      dropTarget: preview.dropTarget,
    })
  }

  return {
    pointerId,
    // Space 在移动手势中表达「锁定原父级」，不是临时平移。
    consumesTemporaryPan: true,
    update(event, ctx) {
      if (event.type === 'pointer.move' || event.type === 'pointer.up') {
        lastPoint = event.point
        lastModifiers = event.modifiers
        recompute(ctx)
        return
      }
      // 原地重算而不是等下一次移动：锁定状态要立刻反映在落点高亮上。
      if (event.type === 'temporary-pan.start') {
        parentLocked = true
        recompute(ctx)
        return
      }
      if (event.type === 'temporary-pan.end') {
        parentLocked = false
        recompute(ctx)
      }
    },
    commit(ctx) {
      const planned = planMoveCommit({
        document: ctx.context.document,
        layoutSnapshot: ctx.context.layoutSnapshot,
        index: ctx.index,
        ids,
        transforms,
        dropTarget,
        idFactory: ctx.context.idFactory,
      })
      // 正式命令必须在 preview 清理和 capture 释放前同步交给宿主，否则 React 会短暂重新
      // 渲染旧 document，造成高速松手时可见的「回弹」。
      if (planned) ctx.apply([planned])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 丢弃预览变换与落点；捕获也由本会话释放。
      transforms = {}
      dropTarget = null
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next, nextIndex) {
      // 移动引用按下当刻冻结的选区包围盒与起点，文档或布局一变就可能与真实几何脱节。
      if (!baselineHolds(next)) return false
      const sameTargets = nextIndex.topLevelSelection(next.selectedIds)
      return ids.length === sameTargets.length
        && ids.every((id, i) => sameTargets[i] === id)
    },
  }
}

/**
 * 接管一次移动：解析目标、发布首帧快照、捕获指针并建立会话。
 *
 * @remarks
 * 各移动入口共用的接管收尾动作。目标解析失败（全部锁定、不可移动或不存在）时返回 `null`，
 * 由调用方决定这次按下是消费掉还是交给后续插件。
 *
 * @public
 */
export function claimStageMove(
  event: StagePointerDownEvent,
  ctx: StagePluginContext,
  ids: readonly string[],
  axis?: 'x' | 'y',
): StageSession | null {
  const { context, index } = ctx
  const targets = resolveTransformTargets({
    document: context.document,
    index,
    type: 'move',
    ids,
  })
  if (!targets) return null
  ctx.publish({ ...ctx.idleSnapshot(), phase: 'move' })
  ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
  return createStageMoveSession({
    pointerId: event.pointerId,
    viewport: context.viewport,
    ids: targets.editableIds,
    bounds: targets.bounds,
    startWorld: screenToWorld(event.point, context.viewport),
    axis,
    startPoint: event.point,
    startModifiers: event.modifiers,
    baselineHolds: captureStageSpatialBaseline(context),
  })
}

/**
 * 轴向移动手柄插件。
 *
 * @remarks
 * Godot 风格的 move 工具在选区上画出 X/Y 两根轴，拖动其中一根把位移约束到该轴。命中手柄但
 * 工具已经不是 move、或选区没有可移动目标时消费这次按下——手柄画在选区之上，放行会让它退化
 * 成一次自由拖动。
 *
 * @public
 */
export function createStageMoveAxisPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_MOVE_AXIS_PLUGIN_ID,
    priority: priorityOf(STAGE_MOVE_AXIS_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'move-axis') return null
      if (ctx.context.tool !== 'move') return 'consumed'
      return claimStageMove(event, ctx, ctx.context.selectedIds, event.hit.axis) ?? 'consumed'
    },
  }
}

/**
 * 实体选中并拖动插件。
 *
 * @remarks
 * 画布上最常走的一条路径：在实体上按下先改选区，随后按工具决定这次按下变成什么——
 * select 工具下的双击进入原地文字编辑（**不**开始移动），select/move 工具下未锁定的目标开始
 * 拖动，其余情形只改选区。
 *
 * 无论是否开始移动，这次按下都被消费：选区已经改过了，再交给后续插件会让同一次按下既改选区
 * 又起框。
 *
 * 选区变更 MUST 先于指针捕获发出——宿主据此更新选中态，顺序颠倒会让捕获落在旧选区上。
 *
 * @public
 */
export function createStageEntitySelectMovePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_ENTITY_SELECT_MOVE_PLUGIN_ID,
    priority: priorityOf(STAGE_ENTITY_SELECT_MOVE_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'entity') return null
      const { context } = ctx
      const entity = context.document.entities[event.hit.entityId]
      // 命中一个不存在的 Entity：命中判定与文档已经脱节，这次按下就此打住，不落到框选。
      if (!entity) return 'consumed'

      // 基准选区要滤掉已从文档中消失的 ID，否则 Shift 加选会把幽灵一路带下去。
      const selected = context.selectedIds.filter((id) => context.document.entities[id])
      const nextSelection = event.modifiers.shift
        ? selected.includes(entity.id)
          ? selected.filter((id) => id !== entity.id)
          : [...selected, entity.id]
        : selected.includes(entity.id) ? selected : [entity.id]
      ctx.apply([{ type: 'selection.change', selectedIds: nextSelection }])

      const locked = getComposeLock(entity).locked
      // 双击可编辑 Entity 进入原地编辑，且不开始移动手势——否则一次双击会同时打开编辑器并
      // 拖动目标。这里用 >=2 而不是 ==2：连击计数继续增长仍应停留在编辑态。
      if (
        context.tool === 'select'
        && (event.clickCount ?? 1) >= 2
        && !locked
        && context.isTextEditable?.(entity.id) === true
      ) {
        ctx.apply([{ type: 'text-editing.enter', entityId: entity.id }])
        return 'consumed'
      }

      if (locked || (context.tool !== 'select' && context.tool !== 'move')) return 'consumed'
      return claimStageMove(event, ctx, nextSelection) ?? 'consumed'
    },
  }
}
