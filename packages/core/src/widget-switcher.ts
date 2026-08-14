import { getComposeHierarchy, getComposeWidgetSwitcher } from './entity'
import type { ComposeDocument, ComposeWidgetSwitcher } from './document-types'

/** 供命令与 Registry 校验单个 WidgetSwitcher 候选。 @public */
export function isValidComposeWidgetSwitcher(
  value: unknown,
): value is ComposeWidgetSwitcher {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Number.isInteger((value as ComposeWidgetSwitcher).activeIndex)
}

/** 派生隐藏集合时的编辑期预览覆盖。 @public */
export interface ComposeWidgetSwitcherPreview {
  /**
   * switcher Entity ID 到被预览直接子项 ID 的映射。
   *
   * @remarks
   * 编辑器用它表达「选中某个后代就临时显示该分支」；命中的 switcher 忽略自身 `activeIndex`。
   * 值不是该 switcher 的直接子项时按未指定处理。
   */
  readonly previewChildIdByEntityId: Readonly<Record<string, string>>
}

/**
 * 解析 WidgetSwitcher 当前应显示的直接子项。
 *
 * @remarks
 * `activeIndex` 允许越界（子项删除后不回写文档），因此钳制发生在读取侧且是幂等的。
 *
 * @param document - 目标文档。
 * @param entityId - 被解析的 Entity ID。
 * @param previewChildId - 编辑期预览覆盖；命中该 switcher 的直接子项时优先返回它。
 * @returns 活动子项 ID；Entity 不是 switcher、没有 Hierarchy 或没有子项时返回 `null`。
 * @public
 */
export function resolveComposeActiveChildId(
  document: ComposeDocument,
  entityId: string,
  previewChildId?: string,
): string | null {
  const entity = document.entities[entityId]
  if (!entity) return null
  const switcher = getComposeWidgetSwitcher(entity)
  if (!switcher) return null
  const childIds = getComposeHierarchy(entity)?.childIds ?? []
  if (childIds.length === 0) return null
  if (previewChildId && childIds.includes(previewChildId)) return previewChildId
  const index = Number.isFinite(switcher.activeIndex)
    ? Math.min(Math.max(Math.trunc(switcher.activeIndex), 0), childIds.length - 1)
    : 0
  return childIds[index] ?? null
}

/**
 * 解析一个 Entity 本次应渲染的直接子项。
 *
 * @remarks
 * 递归渲染入口（Preview 与嵌套文档 Runtime）用它替代直接读取 `Hierarchy.childIds`：
 * 非 switcher 原样返回，switcher 只返回活动子项。与
 * {@link collectComposeSwitcherHiddenIds} 共用 {@link resolveComposeActiveChildId}，
 * 因此两条路径不会对「哪个分支是活动的」给出不同答案。
 *
 * @param document - 目标文档。
 * @param entityId - 父 Entity ID。
 * @returns 应渲染的子项 ID 顺序数组；无 Hierarchy 时为空数组。
 * @public
 */
export function resolveComposeRenderedChildIds(
  document: ComposeDocument,
  entityId: string,
): readonly string[] {
  const entity = document.entities[entityId]
  if (!entity) return []
  const childIds = getComposeHierarchy(entity)?.childIds ?? []
  if (!getComposeWidgetSwitcher(entity)) return childIds
  const activeId = resolveComposeActiveChildId(document, entityId)
  return activeId ? [activeId] : []
}

/**
 * 由选择集派生编辑期的 WidgetSwitcher 预览覆盖。
 *
 * @remarks
 * 对标 UE5 设计器：在层级树里选中 switcher 的某个后代，画布就临时切到它所在的分支。这里只
 * 计算覆盖关系，调用方负责把结果喂给渲染与命中——它不产生任何文档变更，因此不进 Undo。
 * 多个选中项落在同一个 switcher 的不同分支时，按选择顺序取第一个，避免同时显示两个互斥分支。
 *
 * @param document - 目标文档。
 * @param selectedIds - 当前选择；不存在于文档中的 ID 会被忽略。
 * @returns 可直接传给 {@link collectComposeSwitcherHiddenIds} 的覆盖描述。
 * @public
 */
export function resolveComposeSwitcherPreview(
  document: ComposeDocument,
  selectedIds: readonly string[],
): ComposeWidgetSwitcherPreview {
  const previewChildIdByEntityId: Record<string, string> = {}
  if (selectedIds.length === 0) return { previewChildIdByEntityId }
  const parentIdByChildId = new Map<string, string>()
  for (const entity of Object.values(document.entities)) {
    for (const childId of getComposeHierarchy(entity)?.childIds ?? []) {
      parentIdByChildId.set(childId, entity.id)
    }
  }
  for (const selectedId of selectedIds) {
    if (!document.entities[selectedId]) continue
    let childId = selectedId
    let parentId = parentIdByChildId.get(childId)
    while (parentId) {
      const parent = document.entities[parentId]
      if (parent && getComposeWidgetSwitcher(parent)
        && previewChildIdByEntityId[parentId] === undefined) {
        previewChildIdByEntityId[parentId] = childId
      }
      childId = parentId
      parentId = parentIdByChildId.get(childId)
    }
  }
  return { previewChildIdByEntityId }
}

/**
 * 派生本次渲染应跳过的 Entity ID 集合。
 *
 * @remarks
 * 这是 Stage、Preview、嵌套文档 Runtime 与 SceneIndex 判断「非活动分支」的唯一事实来源。
 * 只收集每个 switcher 的非活动**直接**子项——它们的后代由各入口本来就有的递归自然剪掉，
 * 因此不需要在这里展开整棵子树。隐藏不写入 `Visibility`：那是用户显式意图的字段，
 * 由索引派生的结果不得污染它。
 *
 * @param document - 目标文档。
 * @param preview - 编辑期预览覆盖；省略时全部按 `activeIndex` 解析。
 * @returns 应跳过渲染与命中的 Entity ID 集合；文档中没有 switcher 时为空集合。
 * @public
 */
export function collectComposeSwitcherHiddenIds(
  document: ComposeDocument,
  preview?: ComposeWidgetSwitcherPreview,
): ReadonlySet<string> {
  const hidden = new Set<string>()
  for (const entity of Object.values(document.entities)) {
    if (!getComposeWidgetSwitcher(entity)) continue
    const childIds = getComposeHierarchy(entity)?.childIds ?? []
    if (childIds.length === 0) continue
    const activeId = resolveComposeActiveChildId(
      document,
      entity.id,
      preview?.previewChildIdByEntityId[entity.id],
    )
    for (const childId of childIds) {
      if (childId !== activeId) hidden.add(childId)
    }
  }
  return hidden
}
