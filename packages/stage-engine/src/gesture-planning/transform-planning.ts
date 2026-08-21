import {
  BUILTIN_COMMAND_TYPES,
  getComposeLayoutItem,
  getComposeLock,
  getComposeRenderer,
  resolveComposeAppearance,
  resolveComposeGeometryConstraints,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { toComposeTransform, unionRects, type ResizeHandle, type StageRect, type StageTransform } from '../geometry'
import { describeTransform } from '../commands'
import type { StageSceneIndex } from '../hit-testing'
import type { StageInteractionEffect } from '../interaction-controller'

/** 变换手势的三种语义；决定约束查询与提交规划的分支。 @public */
export type StageTransformKind = 'move' | 'resize' | 'rotate'

/** {@link resolveTransformTargets} 的结果；没有可变换目标时调用方拿到 `null`。 @public */
export interface StageTransformTargets {
  /** 按约束过滤后的顶层目标，顺序与 `topLevelSelection` 一致。 */
  readonly editableIds: readonly string[]
  /** 上述目标的世界包围盒并集。 */
  readonly bounds: StageRect
}

/**
 * 解析一次变换手势的可操作目标与选区 bounds。
 *
 * @remarks
 * 纯函数：不创建手势、不发布快照、不产生 surface effect，因此可以脱离交互会话单独测试。
 *
 * `document` 与 `index` MUST 来自同一求解周期——`index` 的世界几何以文档与布局快照为基础，
 * 传入不一致的一对会得到指向旧几何的 bounds。
 *
 * 没有可变换目标时返回 `null`（正常结果而非异常）：调用方据此不开手势。
 *
 * @public
 */
export function resolveTransformTargets(options: {
  readonly document: ComposeDocument
  readonly index: StageSceneIndex
  readonly type: StageTransformKind
  readonly ids: readonly string[]
  readonly handle?: ResizeHandle
}): StageTransformTargets | null {
  const { document, index, type, ids, handle } = options
  const editableIds = index.topLevelSelection(ids)
    .filter((id) => {
      const entity = document.entities[id]
      if (!entity || !index.isVisible(id) || getComposeLock(entity).locked) return false
      const constraints = resolveComposeGeometryConstraints(entity)
      // 页面实例最外层始终可 free 缩放（旧文档可能仍存 resize:none）。
      const isComponentInstance = getComposeRenderer(entity)?.type === 'component-instance'
      const resizeMode = isComponentInstance ? 'free' as const : constraints.resize
      if (type === 'move') return constraints.movable
      if (type === 'rotate') return constraints.rotatable
      if (resizeMode === 'none') return false
      if (!handle) return true
      if (resizeMode === 'horizontal') return handle === 'e' || handle === 'w'
      if (resizeMode === 'vertical') return handle === 'n' || handle === 's'
      if (resizeMode === 'preserve-aspect') {
        return handle === 'ne' || handle === 'se' || handle === 'sw' || handle === 'nw'
      }
      return true
    })
  const bounds = unionRects(editableIds
    .filter((id) => index.isVisible(id))
    .map((id) => index.getWorldBounds(id))
    .filter((rect): rect is StageRect => rect !== null))
  if (!bounds || editableIds.length === 0) return null
  return { editableIds, bounds }
}

/** 提交规划的输入：一次已结束的变换手势。 @public */
export type StageFinishedTransform =
  | {
      readonly type: 'move' | 'rotate'
      readonly ids: readonly string[]
      readonly transforms: Readonly<Record<string, StageTransform>>
    }
  | {
      readonly type: 'resize'
      readonly ids: readonly string[]
      readonly transforms: Readonly<Record<string, StageTransform>>
      /** 只有 resize 有手柄，用它决定哪条轴取新尺寸。 */
      readonly handle: ResizeHandle
    }

/**
 * 把一次已结束的变换手势规划成至多一条命令。
 *
 * @remarks
 * 纯函数：只返回效果，不发布也不派发。没有可提交的更新时返回 `null`。
 *
 * 三种类型的位置与尺寸算法**刻意不同**，不要合并：
 *
 * - `move` 排除 Flow 目标——它们的位置由 Auto Layout 决定，写 offset 只会留下无效值；
 *   脱流不由拖拽隐式触发，唯一入口是几何 Inspector 的显式开关。
 * - `move` 的非 Fill 轴保留持久值，避免把 Yoga clamp 后的尺寸误记成一次 Resize。
 * - `resize` 只让被拖动的轴取新尺寸。
 * - `rotate` 的位置与尺寸都取持久值——旋转不改变盒子本身。
 *
 * 绝对位置要扣掉父级 border inset：布局求解把边框计入内容盒，直接写世界坐标会让子级偏移。
 *
 * `document`、`layoutSnapshot` 与 `index` MUST 来自同一求解周期。
 *
 * @public
 */
export function planTransformCommit(options: {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex | null
  readonly finished: StageFinishedTransform
  readonly idFactory: () => string
}): StageInteractionEffect | null {
  const { document, layoutSnapshot, index, finished, idFactory } = options
  const stageUpdates = Object.entries(finished.transforms)
    .filter(([entityId]) => {
      if (finished.type !== 'move') return true
      const entity = document.entities[entityId]
      return !entity || getComposeLayoutItem(entity).positioning !== 'flow'
    })
    .map(([entityId, transform]) => ({ entityId, transform }))
  if (stageUpdates.length === 0) return null

  const updates = stageUpdates.map(({ entityId, transform }) => {
    const next = toComposeTransform(transform)
    const entity = document.entities[entityId]
    const item = entity ? getComposeLayoutItem(entity) : null
    const persistedAbsolutePosition = () => {
      const initialBox = layoutSnapshot.boxes[entityId]
      const parentId = index?.getParentId(entityId)
      const parent = parentId ? document.entities[parentId] : undefined
      const borderInset = parent ? resolveComposeAppearance(parent).borderWidth : 0
      const inset = item?.positioning === 'absolute' && initialBox
        ? {
            x: initialBox.x - item.offset.x,
            y: initialBox.y - item.offset.y,
          }
        : { x: borderInset, y: borderInset }
      return {
        x: next.position.x - inset.x,
        y: next.position.y - inset.y,
      }
    }
    // move 的几何来自冻结 Snapshot；非 Fill 轴仍保留持久 fallback，避免把
    // Yoga clamp 后的尺寸误记成一次 Resize。Fill 转 Absolute 时才烘焙求解尺寸。
    if (!item) return { entityId, transform: next }
    if (finished.type === 'move') {
      return {
        entityId,
        transform: {
          ...next,
          position: persistedAbsolutePosition(),
          size: {
            width: item.width.mode === 'fill' ? next.size.width : item.width.value,
            height: item.height.mode === 'fill' ? next.size.height : item.height.value,
          },
        },
      }
    }
    if (finished.type === 'resize') {
      const changesWidth = finished.handle.includes('e') || finished.handle.includes('w')
      const changesHeight = finished.handle.includes('n') || finished.handle.includes('s')
      return {
        entityId,
        transform: {
          ...next,
          position: item.positioning === 'flow'
            ? item.offset
            : persistedAbsolutePosition(),
          size: {
            width: changesWidth ? next.size.width : item.width.value,
            height: changesHeight ? next.size.height : item.height.value,
          },
        },
      }
    }
    return {
      entityId,
      transform: {
        ...next,
        position: item.positioning === 'flow'
          ? item.offset
          : persistedAbsolutePosition(),
        size: { width: item.width.value, height: item.height.value },
      },
    }
  })

  return {
    type: 'command.dispatch',
    command: {
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setTransform,
      payload: { operation: finished.type, updates },
      meta: {
        label: describeTransform(document, stageUpdates, finished.type),
        source: 'stage',
        targetIds: finished.ids,
      },
    },
  }
}
