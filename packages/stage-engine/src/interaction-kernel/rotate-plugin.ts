import { getComposeLock, getComposeTransform } from '@compose-ui/core'
import {
  pointOnRotationRay,
  rotationFromPointer,
  rotationMatrixAround,
  screenToWorld,
  type StagePoint,
  type StageRect,
  type StageViewport,
} from '../geometry'
import { resolveTransformTargets } from '../gesture-planning'
import { planTransformCommit } from '../gesture-planning'
import { transformedSelection } from '../gesture-planning'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** 旋转工具的注册 id。 @public */
export const STAGE_ROTATE_PLUGIN_ID = 'rotate-tool'

const ROTATE_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_ROTATE_PLUGIN_ID)!.priority

/**
 * 旋转工具不接管、留给后续插件的命中类型。
 *
 * @remarks
 * 标尺、辅助线、Paint 柄与路径柄在旋转工具下保留各自原本的语义——它们不是「要旋转的对象」，
 * 而是画布 chrome。命中它们时本插件返回 `null`，让级联继续。
 */
const PASS_THROUGH_HITS = new Set(['ruler', 'ruler-corner', 'guide', 'paint-handle', 'path-handle'])

function createRotateSession(options: {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly ids: readonly string[]
  readonly startWorld: StagePoint
  readonly bounds: StageRect
  readonly center: StagePoint
  readonly baseRotation: number
  readonly baselineHolds: StageSpatialBaselineCheck
}): StageSession {
  const { pointerId, viewport, ids, startWorld, center, baseRotation, baselineHolds } = options
  let transforms: Readonly<Record<string, ReturnType<typeof transformedSelection>[string]>> = {}

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 变换会话使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变
      // 同一次 Pointer 手势的坐标基线。
      const world = screenToWorld(event.point, viewport)
      const angle = rotationFromPointer(center, startWorld, world, {
        shift: event.modifiers.shift,
        baseRotation,
      })
      // Shift 吸附时拉线终点也投影到吸附射线，避免线跟着鼠标、物体却已跳角。
      const pointer = event.modifiers.shift
        ? pointOnRotationRay(center, startWorld, world, angle)
        : world
      transforms = transformedSelection(ctx.index, ids, rotationMatrixAround(center, angle))
      ctx.publish({
        ...ctx.snapshot,
        phase: 'rotate',
        previewTransforms: transforms,
        rotationPreview: {
          center,
          pointer,
          angleDegrees: angle,
          snapped: event.modifiers.shift,
        },
        snapGuides: [],
      })
    },
    commit(ctx) {
      const planned = planTransformCommit({
        document: ctx.context.document,
        layoutSnapshot: ctx.context.layoutSnapshot,
        index: ctx.index,
        finished: { type: 'rotate', ids, transforms },
        idFactory: ctx.context.idFactory,
      })
      // 正式命令必须在 preview 清理和 capture 释放前同步交给宿主，否则 React 会短暂重新
      // 渲染旧 document，造成高速松手时可见的「回弹」。
      if (planned) ctx.apply([planned])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 丢弃预览变换并还原快照；捕获也由本会话释放。
      transforms = {}
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next, nextIndex) {
      // 旋转引用具体 Entity 的冻结几何（center / bounds / baseRotation 都是按下当刻算好的）：
      // 文档或布局一变、工具一换就必须中止，否则提交的是绕着过期中心算出来的角度。
      if (!baselineHolds(next)) return false
      // 选区不再是同一批目标同样不成立——那已经是另一次旋转的对象。
      const sameTargets = nextIndex.topLevelSelection(next.selectedIds)
      return ids.length === sameTargets.length
        && ids.every((id, i) => sameTargets[i] === id)
    },
  }
}

/**
 * 旋转工具插件。
 *
 * @remarks
 * Godot 风格的独立旋转工具，与 select / marquee 互斥，因此优先级高于绘制、框选与实体选择：
 * 那些分支在 `tool !== select` 时会提前退出，若排在旋转之前，空白按下会落到框选。
 *
 * @public
 */
export function createStageRotatePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_ROTATE_PLUGIN_ID,
    priority: ROTATE_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      const { context, index } = ctx
      if (context.tool !== 'rotate') return null

      const start = (ids: readonly string[]): StageSession | null => {
        const targets = resolveTransformTargets({
          document: context.document,
          index,
          type: 'rotate',
          ids,
        })
        if (!targets) return null
        const { editableIds, bounds } = targets
        const center = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        }
        const startWorld = screenToWorld(event.point, context.viewport)
        const baseRotation = getComposeTransform(
          context.document.entities[editableIds[0]!]!,
        ).rotation
        // Godot 风格：按下即出现中心到指针的拉线，线随指针移动。
        ctx.publish({
          ...ctx.idleSnapshot(),
          phase: 'rotate',
          rotationPreview: { center, pointer: startWorld, angleDegrees: 0, snapped: false },
        })
        return createRotateSession({
          pointerId: event.pointerId,
          viewport: context.viewport,
          ids: editableIds,
          startWorld,
          bounds,
          center,
          baseRotation,
          baselineHolds: captureStageSpatialBaseline(context),
        })
      }

      if (event.hit.kind === 'entity') {
        const entity = context.document.entities[event.hit.entityId]
        // 命中一个不存在的 Entity：这次按下已被旋转工具吃掉，不该再落到框选。
        if (!entity) return 'consumed'
        const selected = context.selectedIds.filter((id) => context.document.entities[id])
        const nextSelection = event.modifiers.shift
          ? selected.includes(entity.id)
            ? selected.filter((id) => id !== entity.id)
            : [...selected, entity.id]
          : selected.includes(entity.id) ? selected : [entity.id]
        ctx.apply([{ type: 'selection.change', selectedIds: nextSelection }])
        const session = getComposeLock(entity).locked ? null : start(nextSelection)
        if (!session) return 'consumed'
        ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
        return session
      }

      if (PASS_THROUGH_HITS.has(event.hit.kind)) return null

      const session = context.selectedIds.length > 0 ? start(context.selectedIds) : null
      if (!session) return 'consumed'
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return session
    },
  }
}
