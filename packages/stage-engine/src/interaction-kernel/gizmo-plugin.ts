import { getComposeTransform } from '@compose-ui/core'
import { gizmoScaleHandle, screenToWorld } from '../geometry'
import { resolveTransformGizmoTarget, resolveTransformTargets } from '../gesture-planning'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { claimStageMove } from './move-plugin'
import { claimStageResize } from './resize-plugin'
import { createRotateSession } from './rotate-session'
import { captureStageSpatialBaseline } from './spatial-baseline'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
} from './stage-kernel-profile'

/** 变换指示器把手的注册 id。 @public */
export const STAGE_GIZMO_PLUGIN_ID = 'gizmo'

const GIZMO_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_GIZMO_PLUGIN_ID)!.priority

/**
 * 变换指示器把手插件。
 *
 * @remarks
 * 优先级排在 `entity-select-move` 与 `resize` **之上**：轴的方块会落在盒的边缘命中区上（它到
 * 中心的距离与盒的半宽相近时），排在其下等于方块按不动。同时排在 `path` 与 `paint` 把手
 * **之下**——那些是**别的编辑会话**的把手，指示器不该把它们偷走。
 *
 * **环与四角缩放手柄的重叠不在这里解决**：那由覆盖层的层序回答（环单独一层、排在手柄之下），
 * 因为 SVG 的绘制顺序决定了 `pointerdown` 落在哪个元素上，也就决定了本插件收到的是哪一种
 * 命中。优先级表只在两个插件都认领同一次事件时才起作用。
 *
 * 三种把手都不另写手势：箭头走 `claimStageMove` 的轴向约束，方块走 `claimStageResize`，环走
 * `createRotateSession`。各写一份的代价是吸附、落点、等比约束、Shift 角度吸附与并发中止这
 * 几样各漏一部分。
 *
 * 指示器的开与关是 **chrome 的可见性**：关掉时把手根本不渲染，因此这条命中永远不会到达——
 * 本插件不需要读任何开关，也就不会改变别处任何一次拖动的含义。
 *
 * @public
 */
export function createStageGizmoPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_GIZMO_PLUGIN_ID,
    priority: GIZMO_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'gizmo-handle') return null
      const { context, index } = ctx
      const handle = event.hit.handle
      const selected = context.selectedIds.filter((id) => context.document.entities[id])
      // 把手是画在选区上的，选区没了这次按下已经没有意义——消费掉而不是落到框选。
      if (selected.length === 0) return 'consumed'

      const targets = resolveTransformTargets({
        document: context.document,
        index,
        type: handle === 'rotate' ? 'rotate' : 'move',
        ids: selected,
      })
      if (!targets) return 'consumed'
      const { center, degrees } = resolveTransformGizmoTarget(
        index,
        targets.editableIds,
        targets.bounds,
      )
      // Y 轴恒为 X 轴加 90°：两条轴始终正交，与指示器几何读的是同一句话。
      const axisDegrees = handle.endsWith('-y') ? degrees + 90 : degrees

      if (handle === 'move-x' || handle === 'move-y') {
        return claimStageMove(event, ctx, selected, { degrees: axisDegrees }) ?? 'consumed'
      }
      if (handle === 'scale-x' || handle === 'scale-y') {
        // 缩放走既有的 resize 会话，手柄按这条轴当前指向的方向归一——对象转过 180° 时它的
        // +X 指向屏幕左，此时该拖的是 `w`，拖动方向才与画出来的箭头一致。
        return claimStageResize(
          event,
          ctx,
          selected,
          gizmoScaleHandle(axisDegrees),
          // 方块画在环外，离被拖的那条边有一段距离：不带上这段偏移，第一帧就把那条边挪到光标
          // 底下——用户只拖了一像素，对象却猛地长到环那么大。
          { offsetFromEdge: true },
        ) ?? 'consumed'
      }

      const startWorld = screenToWorld(event.point, context.viewport)
      ctx.publish({
        ...ctx.idleSnapshot(),
        phase: 'rotate',
        rotationPreview: { center, pointer: startWorld, angleDegrees: 0, snapped: false },
      })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createRotateSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        ids: targets.editableIds,
        startWorld,
        bounds: targets.bounds,
        center,
        baseRotation: getComposeTransform(
          context.document.entities[targets.editableIds[0]!]!,
        ).rotation,
        baselineHolds: captureStageSpatialBaseline(context),
      })
    },
  }
}
