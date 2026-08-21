import {
  getComposeLayoutItem,
  getComposeTransform,
  resolveComposeGeometryConstraints,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
  type JsonObject,
} from '@compose-ui/core'
import {
  toComposeTransform,
  type StagePoint,
  type StageTransform,
} from '@compose-ui/stage-engine'

/**
 * 一条 `setTransform` 更新；`transform` 已换算成文档坐标（相对父级内容盒）。
 *
 * @remarks
 * 继承 `JsonObject` 不是装饰：它原样进入命令 payload，必须满足严格 JSON 约束。
 */
export interface StageNudgeUpdate extends JsonObject {
  readonly entityId: string
  readonly transform: ComposeSpatialTransform
}

/** 微调规划结果；`stageUpdates` 保留世界矩形，供事务标签描述位移用。 */
export interface StageNudgePlan {
  /** 实际参与微调的 Entity，已滤掉不可移动与 Flow 子级。 */
  readonly movableIds: readonly string[]
  /** 世界坐标下的目标矩形，仅用于生成事务标签。 */
  readonly stageUpdates: readonly {
    readonly entityId: string
    readonly transform: StageTransform
  }[]
  /** 写入命令 payload 的更新。 */
  readonly updates: readonly StageNudgeUpdate[]
}

/**
 * 把方向键位移规划成 `setTransform` 更新。
 *
 * @remarks
 * Flow 子级的位置由 Auto Layout 决定，方向键平移对它没有可见效果；先滤掉以免提交只写
 * offset 的空事务。脱流是显式操作，不再由 move 类命令隐式触发。
 *
 * 世界矩形换算回文档坐标时要减去父级内容盒原点，它按自身已有 offset 反推——求解位置与
 * authored offset 之差就是原点。这里不需要按父级边框宽度另算一套：`positioning` 只有
 * `flow` 与 `absolute` 两种，而 `flow` 已在上一步滤掉，能走到这里的一定是 `absolute`。
 *
 * `fill` 尺寸不写求解出来的像素值，否则一次微调就把「填满父级」固化成了固定尺寸。
 *
 * @param distance - 屏幕无关的世界位移步长（按住 Shift 时为 10，否则 1）。
 * @returns `movableIds` 为空表示这次按键不该产生任何事务。
 */
export function planStageNudge(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  entityIds: readonly string[],
  direction: StagePoint,
  distance: number,
): StageNudgePlan {
  const movableIds = entityIds.filter((id) =>
    resolveComposeGeometryConstraints(document.entities[id]!).movable
    && getComposeLayoutItem(document.entities[id]!).positioning !== 'flow')
  if (movableIds.length === 0) {
    return { movableIds, stageUpdates: [], updates: [] }
  }
  const stageUpdates = movableIds.map((entityId) => {
    const entity = document.entities[entityId]!
    const box = layoutSnapshot.boxes[entityId]!
    const transform: StageTransform = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: getComposeTransform(entity).rotation,
    }
    return {
      entityId,
      transform: {
        ...transform,
        x: transform.x + direction.x * distance,
        y: transform.y + direction.y * distance,
      },
    }
  })
  const updates = stageUpdates.map(({ entityId, transform }) => {
    const entity = document.entities[entityId]!
    const item = getComposeLayoutItem(entity)
    const box = layoutSnapshot.boxes[entityId]!
    const inset = { x: box.x - item.offset.x, y: box.y - item.offset.y }
    const next = toComposeTransform(transform)
    return {
      entityId,
      transform: {
        ...next,
        position: {
          x: next.position.x - inset.x,
          y: next.position.y - inset.y,
        },
        size: {
          width: item.width.mode === 'fill' ? next.size.width : item.width.value,
          height: item.height.mode === 'fill' ? next.size.height : item.height.value,
        },
      },
    }
  })
  return { movableIds, stageUpdates, updates }
}
