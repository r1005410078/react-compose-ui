import {
  getComposeLock,
  getComposeRenderer,
  getComposeVisibility,
  resolveComposeGeometryConstraints,
  type ComposeDocument,
} from '@compose-ui/core'
import type { ResizeHandle } from '@compose-ui/stage-engine'

/** 单个选中项的几何能力；`resize` 与 `rotatable` 决定手柄的可用集合。 */
export type StageSelectionConstraint = ReturnType<typeof resolveComposeGeometryConstraints>

/** 八个缩放手柄，按顺时针自上排列；顺序即 Overlay 的绘制顺序。 */
const ALL_RESIZE_HANDLES = [
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
  'nw',
] as const satisfies readonly ResizeHandle[]

/**
 * 解析选区各项的几何约束。
 *
 * @remarks
 * 组件实例强制按 `free` 处理：已落盘的旧实例可能仍是 `resize: 'none'`，而页面组合必须
 * 始终可四角缩放。这条覆盖只作用于选区表现层，不改文档。
 */
export function resolveStageSelectionConstraints(
  document: ComposeDocument,
  selectedIds: readonly string[],
): readonly StageSelectionConstraint[] {
  return selectedIds.flatMap((id) => {
    const entity = document.entities[id]
    if (!entity) return []
    const constraints = resolveComposeGeometryConstraints(entity)
    if (getComposeRenderer(entity)?.type === 'component-instance') {
      return [{ ...constraints, resize: 'free' as const }]
    }
    return [constraints]
  })
}

/** 缩放手柄的两个集合。 */
export interface StageResizeHandleSets {
  /** 可响应拖动的手柄；边方向即使不画方块也在其中。 */
  readonly enabled: readonly ResizeHandle[]
  /** 需要画出方块的手柄。 */
  readonly visible: readonly ResizeHandle[]
}

/**
 * 由选区约束求出缩放手柄。
 *
 * @remarks
 * 「可拖动」与「画方块」是两件事：`free` / `preserve-aspect` 下只画四角，边方向靠透明的
 * edge hit 区响应，画出中点方块会让选中框显得笨重；`horizontal` / `vertical` 没有角可用，
 * 因此必须把对应的边控点画出来。
 *
 * 约束取交集——多选时只要有一项不允许某个方向，该手柄整体不可用。
 */
export function resolveStageResizeHandles(
  constraints: readonly StageSelectionConstraint[],
): StageResizeHandleSets {
  const enabled = ALL_RESIZE_HANDLES.filter((handle) =>
    constraints.every(({ resize }) => {
      if (resize === 'none') return false
      if (resize === 'horizontal') return handle === 'e' || handle === 'w'
      if (resize === 'vertical') return handle === 'n' || handle === 's'
      if (resize === 'preserve-aspect') {
        return handle === 'ne' || handle === 'se' || handle === 'sw' || handle === 'nw'
      }
      return true
    }))
  const visible = enabled.filter((handle) => {
    if (handle === 'n' || handle === 'e' || handle === 's' || handle === 'w') {
      return constraints.every(({ resize }) =>
        resize === 'horizontal' || resize === 'vertical')
    }
    return true
  })
  return { enabled, visible }
}

/** 选区是否整体可旋转；空选区不可旋转。 */
export function isStageSelectionRotatable(
  constraints: readonly StageSelectionConstraint[],
): boolean {
  return constraints.length > 0 && constraints.every(({ rotatable }) => rotatable)
}

/**
 * 选区是否整体可编辑——存在、可见且未锁定。
 *
 * @remarks
 * 与 `unlockedStageIds` 的区别是「全体」与「部分」：这里任一项不合格即整体不可编辑，
 * 用于决定选中框是否呈现为可操作；后者做过滤，用于把命令目标收窄到实际能改的那些。
 */
export function isStageSelectionEditable(
  document: ComposeDocument,
  selectedIds: readonly string[],
): boolean {
  return selectedIds.length > 0
    && selectedIds.every((id) => {
      const entity = document.entities[id]
      return Boolean(entity)
        && getComposeVisibility(entity!).visible
        && !getComposeLock(entity!).locked
    })
}

/** 滤出选区中未锁定的部分；结构类命令一律以它为目标。 */
export function unlockedStageIds(
  document: ComposeDocument,
  selectedIds: readonly string[],
): readonly string[] {
  return selectedIds.filter((id) => {
    const entity = document.entities[id]
    return Boolean(entity) && !getComposeLock(entity!).locked
  })
}
