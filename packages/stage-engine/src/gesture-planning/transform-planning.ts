import {
  BUILTIN_COMMAND_TYPES,
  composeGridColumnWidth,
  getComposeGridItem,
  getComposeLayoutItem,
  getComposeLock,
  getComposeRenderer,
  resolveComposeAppearance,
  resolveComposeGeometryConstraints,
  type ComposeDocument,
  type ComposeGridItem,
  type ComposeLayoutSnapshot,
  type JsonValue,
} from '@compose-ui/core'
import { toComposeTransform, unionRects, type ResizeHandle, type StageRect, type StageTransform } from '../geometry'
import { describeTransform } from '../commands'
import { resolveStageGridContext, solveStageGrid, type StageSceneIndex } from '../hit-testing'
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
/**
 * 规划一次格中子级的缩放提交。
 *
 * @remarks
 * 缩放写的是**格跨度**而不是像素尺寸：盒就是格矩形，把求解出来的像素写回 `LayoutItem` 会
 * 造出第二份事实，而它下一帧就会被预解算覆盖掉。
 *
 * 拖到的边吸到最近的格线（`Math.round`，与移动落点取「所在的格」不同——缩放判据是「这条边
 * 离哪条格线更近」，而移动判据是「左上角压住了哪一格」）。`minW` / `minH` 在这里钳制。
 *
 * 缩放同样推挤：拉宽挡住了谁，谁就下移，并与目标写在同一条 batch 里。
 *
 * @returns 目标不在网格里时为 `null`，由调用方退回既有的通用提交。
 */
function planGridResizeCommit(input: {
  readonly document: ComposeDocument
  readonly index: StageSceneIndex
  readonly finished: Extract<StageFinishedTransform, { type: 'resize' }>
  readonly idFactory: () => string
}): StageInteractionEffect | null {
  const { document, index, finished, idFactory } = input
  const entityIds = Object.keys(finished.transforms)
  const entityId = entityIds[0]
  // 多选缩放在网格里的语义（整块等比还是逐张）尚未定，v1 只处理单个目标，其余退回通用路径。
  if (!entityId || entityIds.length !== 1) return null
  const item = getComposeGridItem(document.entities[entityId])
  if (!item) return null
  const containerId = index.getParentId(entityId)
  const context = containerId ? resolveStageGridContext(index, containerId) : null
  if (!containerId || !context) return null

  const transform = finished.transforms[entityId]!
  const columnStep = composeGridColumnWidth(context.metrics) + context.metrics.columnGap
  const rowStep = context.metrics.rowHeight + context.metrics.rowGap
  const changesWidth = finished.handle.includes('e') || finished.handle.includes('w')
  const changesHeight = finished.handle.includes('n') || finished.handle.includes('s')
  const spanFrom = (pixels: number, step: number, min: number) => (step > 0
    ? Math.max(min, Math.round((pixels + context.metrics.columnGap) / step))
    : min)
  const w = changesWidth
    ? Math.min(
        context.layout.columns,
        spanFrom(transform.width, columnStep, Math.max(1, item.minW ?? 1)),
      )
    : item.w
  const h = changesHeight
    ? spanFrom(transform.height, rowStep, Math.max(1, item.minH ?? 1))
    : item.h
  // 拖西/北侧手柄时起点也跟着动：用变换后的左上角重新取格，否则卡片会向反方向长出去。
  const local = index.getWorldMatrix(containerId) && toGridOrigin(index, containerId, context, transform)
  const x = local ? Math.min(Math.max(0, local.x), Math.max(0, context.layout.columns - w)) : item.x
  const y = local ? Math.max(0, local.y) : item.y
  if (w === item.w && h === item.h && x === item.x && y === item.y) return null

  const solved = solveStageGrid(index, containerId, context, { id: entityId, x, y, w, h })
  const commandId = idFactory()
  const commands = solved.flatMap((cell) => {
    const before = getComposeGridItem(document.entities[cell.id])
    if (before && before.x === cell.x && before.y === cell.y
      && before.w === cell.w && before.h === cell.h) return []
    const value: ComposeGridItem = { ...(before ?? {}), x: cell.x, y: cell.y, w: cell.w, h: cell.h }
    return [{
      id: `${commandId}:${cell.id}:grid-item`,
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: { entityId: cell.id, key: 'GridItem', value },
    }]
  })
  if (commands.length === 0) return null
  return {
    type: 'command.dispatch',
    command: {
      id: commandId,
      type: BUILTIN_COMMAND_TYPES.batch,
      payload: { commands: commands as unknown as JsonValue },
      meta: {
        label: describeTransform(document, [{ entityId, transform }], 'resize'),
        source: 'stage',
        targetIds: solved.map((cell) => cell.id),
      },
    },
  }
}

/** 把缩放后的世界左上角换算成格坐标。 */
function toGridOrigin(
  index: StageSceneIndex,
  containerId: string,
  context: ReturnType<typeof resolveStageGridContext>,
  transform: StageTransform,
): { readonly x: number; readonly y: number } | null {
  if (!context) return null
  const columnStep = composeGridColumnWidth(context.metrics) + context.metrics.columnGap
  const rowStep = context.metrics.rowHeight + context.metrics.rowGap
  const box = index.layoutSnapshot.boxes[containerId]
  const containerWorld = index.getWorldBounds(containerId)
  if (!box || !containerWorld) return null
  const localX = transform.x - containerWorld.x - context.contentOrigin.x
  const localY = transform.y - containerWorld.y - context.contentOrigin.y
  return {
    x: columnStep > 0 ? Math.max(0, Math.round(localX / columnStep)) : 0,
    y: rowStep > 0 ? Math.max(0, Math.round(localY / rowStep)) : 0,
  }
}

export function planTransformCommit(options: {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex | null
  readonly finished: StageFinishedTransform
  readonly idFactory: () => string
}): StageInteractionEffect | null {
  const { document, layoutSnapshot, index, finished, idFactory } = options
  if (finished.type === 'resize' && index) {
    const grid = planGridResizeCommit({ document, index, finished, idFactory })
    if (grid) return grid
  }
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
