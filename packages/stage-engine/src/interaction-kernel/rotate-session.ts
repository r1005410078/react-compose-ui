import {
  pointOnRotationRay,
  rotationFromPointer,
  rotationMatrixAround,
  screenToWorld,
  type StagePoint,
  type StageRect,
  type StageViewport,
} from '../geometry'
import { planTransformCommit } from '../gesture-planning'
import { transformedSelection } from '../gesture-planning'
import type { StageSpatialBaselineCheck } from './spatial-baseline'
import type { StageSession } from './stage-kernel-profile'

/**
 * 旋转取点会话。
 *
 * @remarks
 * 与「谁启动它」解耦：变换指示器的圆环与（历史上的）旋转工具都用它。**不另写一份旋转数学**
 * ——另写的那份必然在 Shift 角度吸附、`baseRotation` 与并发中止三处里漏掉一两处。
 *
 * `center` 由调用方给出（见 `resolveTransformGizmoTarget`）：单选是该 Entity 的旋转基点，
 * 多选是选区包围盒中心。
 *
 * @public
 */
export function createRotateSession(options: {
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
