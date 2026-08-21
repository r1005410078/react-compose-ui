import { resolveComposeGeometryConstraints } from '@compose-ui/core'
import { snapResizePoint } from '../canvas-geometry'
import { resolveTargetFrameId } from '../frame-space'
import {
  rectMappingMatrix,
  resizeBounds,
  screenToWorld,
  type ResizeHandle,
  type StagePoint,
  type StageRect,
  type StageTransform,
  type StageViewport,
} from '../geometry'
import { planTransformCommit, resolveTransformTargets } from '../transform-planning'
import { transformedResizeSelection } from '../transform-preview'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** 缩放手柄的注册 id。 @public */
export const STAGE_RESIZE_PLUGIN_ID = 'resize'

const RESIZE_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_RESIZE_PLUGIN_ID)!.priority

interface ResizeSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly ids: readonly string[]
  readonly handle: ResizeHandle
  readonly bounds: StageRect
  readonly baselineHolds: StageSpatialBaselineCheck
}

function createResizeSession(options: ResizeSessionOptions): StageSession {
  const { pointerId, viewport, ids, handle, bounds, baselineHolds } = options
  let transforms: Readonly<Record<string, StageTransform>> = {}

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 变换会话使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变
      // 同一次 Pointer 手势的坐标基线。
      const world: StagePoint = screenToWorld(event.point, viewport)
      const { context, index } = ctx
      const snapped = snapResizePoint({
        point: world,
        handle,
        candidates: index.snapCandidates(
          ids,
          resolveTargetFrameId(context.document, context.selectedIds, context.activeFrameId),
        ),
        canvas: context.document.canvas,
        zoom: viewport.zoom,
        disabled: event.modifiers.command,
      })
      // 选区里只要有一个目标要求保持比例，整个选区就按等比处理——否则同一次拖拽会让一部分
      // 目标变形、另一部分不变形，结果无法预测。等价于用户一直按着 Shift。
      const preserveAspect = ids.some((id) => {
        const entity = context.document.entities[id]
        return entity
          ? resolveComposeGeometryConstraints(entity).resize === 'preserve-aspect'
          : false
      })
      const nextBounds = resizeBounds(
        bounds,
        handle,
        snapped.point,
        { ...event.modifiers, shift: event.modifiers.shift || preserveAspect },
      )
      transforms = transformedResizeSelection(
        index,
        ids,
        rectMappingMatrix(bounds, nextBounds),
        {
          scaleX: nextBounds.width / bounds.width,
          scaleY: nextBounds.height / bounds.height,
        },
        context.contentReflowsWithWidth,
        handle,
      )
      ctx.publish({
        ...ctx.snapshot,
        phase: 'resize',
        previewTransforms: transforms,
        snapGuides: snapped.guides,
      })
    },
    commit(ctx) {
      const planned = planTransformCommit({
        document: ctx.context.document,
        layoutSnapshot: ctx.context.layoutSnapshot,
        index: ctx.index,
        finished: { type: 'resize', ids, transforms, handle },
        idFactory: ctx.context.idFactory,
      })
      // 正式命令必须在 preview 清理和 capture 释放前同步交给宿主，否则 React 会短暂重新
      // 渲染旧 document，造成高速松手时可见的「回弹」。
      if (planned) ctx.apply([planned])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      transforms = {}
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next, nextIndex) {
      // 缩放引用按下当刻冻结的选区包围盒，文档或布局一变就可能与真实几何脱节。
      if (!baselineHolds(next)) return false
      const sameTargets = nextIndex.topLevelSelection(next.selectedIds)
      return ids.length === sameTargets.length
        && ids.every((id, i) => sameTargets[i] === id)
    },
  }
}

/**
 * 缩放手柄插件。
 *
 * @remarks
 * 只在 select 与 scale 工具下接管；其余工具下手柄不该被渲染，这里是兜底。命中手柄但接管条件
 * 不成立时返回 `consumed`——手柄画在选区之上，放行会让这次按下退化成一次移动或框选。
 *
 * @public
 */
export function createStageResizePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_RESIZE_PLUGIN_ID,
    priority: RESIZE_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'resize') return null
      const { context, index } = ctx
      if (context.tool !== 'select' && context.tool !== 'scale') return 'consumed'
      const targets = resolveTransformTargets({
        document: context.document,
        index,
        type: 'resize',
        ids: context.selectedIds,
        handle: event.hit.handle,
      })
      if (!targets) return 'consumed'
      ctx.publish({ ...ctx.idleSnapshot(), phase: 'resize' })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createResizeSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        ids: targets.editableIds,
        handle: event.hit.handle,
        bounds: targets.bounds,
        baselineHolds: captureStageSpatialBaseline(context),
      })
    },
  }
}
