import { resolveComposeGeometryConstraints } from '@compose-ui/core'
import { snapResizePoint } from '../geometry'
import { resolveTargetFrameId } from '../geometry'
import {
  rectMappingMatrix,
  resizeBounds,
  resizeReadoutPoints,
  screenToWorld,
  type ResizeHandle,
  type StagePoint,
  type StageRect,
  type StageTransform,
  type StageViewport,
} from '../geometry'
import { planTransformCommit, resolveTransformTargets } from '../gesture-planning'
import { transformedResizeSelection } from '../gesture-planning'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent, StageSession } from './stage-kernel-profile'

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
  /** 落点到被拖那条边的世界偏移；把手不画在边上时靠它把首帧的跳变消掉。 */
  readonly grabOffset: StagePoint
  readonly baselineHolds: StageSpatialBaselineCheck
}

function createResizeSession(options: ResizeSessionOptions): StageSession {
  const { pointerId, viewport, ids, handle, bounds, grabOffset, baselineHolds } = options
  let transforms: Readonly<Record<string, StageTransform>> = {}

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 变换会话使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变
      // 同一次 Pointer 手势的坐标基线。
      const pointer: StagePoint = screenToWorld(event.point, viewport)
      // 把手不画在被拖的那条边上时（指示器的缩放方块在环外），按下当刻的偏移量必须一直带着：
      // 少了它，第一帧就把那条边挪到光标下——用户只拖了一像素，对象却猛地长到把手那么大。
      // 偏移排在吸附**之前**：吸附要作用在那条边的位置上，而不是光标的位置上。
      const world: StagePoint = { x: pointer.x + grabOffset.x, y: pointer.y + grabOffset.y }
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
        // 读数取解算之后的新包围盒，因此与选区框、参考线是同一个值；读裸指针的症状是开着
        // 网格时框里的数与选区框对不上。
        resizePreview: resizeReadoutPoints(handle, nextBounds),
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
      const { context } = ctx
      if (context.tool !== 'select') return 'consumed'
      // 双击进入几何编辑，即使这一下落在手柄上。**这不是顺手加的分支**：一条水平线的包围盒
      // 高度接近零，n/s 两条边缘命中区把整条线盖住，双击永远打不到实体本身——而水平线正是
      // 最需要几何编辑的那一类。双击手柄本来也没有别的语义。
      const target = context.selectedIds.length === 1 ? context.selectedIds[0]! : null
      if (
        context.tool === 'select'
        && (event.clickCount ?? 1) >= 2
        && target !== null
        && context.isGeometryEditable?.(target) === true
      ) {
        ctx.apply([{
          type: 'geometry-editing.enter',
          entityId: target,
          worldPoint: screenToWorld(event.point, context.viewport),
        }])
        return 'consumed'
      }
      // 四条边是**透明命中带**，它不画在被拖的那条边上（空心图形的带整条让到盒外，为的是把
      // 描边留给移动），因此按位移解算：按绝对落点解算会在第一帧把那条边挪到光标下——用户只
      // 拖了一像素，对象却猛地长到命中带那么宽。四角手柄画在角上，本来就没有偏移，不置位以
      // 保持既有行为逐像素不变。
      const offsetFromEdge = event.hit.handle.length === 1
      return claimStageResize(
        event,
        ctx,
        context.selectedIds,
        event.hit.handle,
        { offsetFromEdge },
      ) ?? 'consumed'
    },
  }
}

/**
 * 用给定的手柄开一次缩放会话。
 *
 * @remarks
 * 手柄插件与**变换指示器的缩放方块**共用它：各写一份的代价是吸附、等比约束、Flow 回流与
 * 并发中止这四样各漏一部分。返回 `null` 表示选区里没有可缩放的目标，调用方自行决定是消费掉
 * 这次按下还是放行。
 *
 * @param options.offsetFromEdge - 把手不画在被拖的那条边上时置位，会话因此按位移而不是按
 * 绝对落点解算。四角手柄画在角上，本来就没有偏移，不置位以保持既有行为逐像素不变。
 * @public
 */
export function claimStageResize(
  event: StagePointerDownEvent,
  ctx: StagePluginContext,
  ids: readonly string[],
  handle: ResizeHandle,
  options: { readonly offsetFromEdge?: boolean } = {},
): StageSession | null {
  const { context, index } = ctx
  const targets = resolveTransformTargets({
    document: context.document,
    index,
    type: 'resize',
    ids,
    handle,
  })
  if (!targets) return null
  // 只记被这个手柄驱动的那一两个分量：`e` 只管 x，另一个分量留 0，否则吸附会拿一个与本次
  // 缩放无关的坐标去找参考线。
  const grab = screenToWorld(event.point, context.viewport)
  const anchor = resizeReadoutPoints(handle, targets.bounds).point
  const grabOffset: StagePoint = options.offsetFromEdge === true
    ? {
        x: handle.includes('e') || handle.includes('w') ? anchor.x - grab.x : 0,
        y: handle.includes('n') || handle.includes('s') ? anchor.y - grab.y : 0,
      }
    : { x: 0, y: 0 }
  ctx.publish({ ...ctx.idleSnapshot(), phase: 'resize' })
  ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
  return createResizeSession({
    pointerId: event.pointerId,
    viewport: context.viewport,
    ids: targets.editableIds,
    handle,
    bounds: targets.bounds,
    grabOffset,
    baselineHolds: captureStageSpatialBaseline(context),
  })
}
