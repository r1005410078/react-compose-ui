import {
  isComposeFrameEntity,
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  getComposeHierarchy,
  getComposeLock,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import { createDuplicateCommand, createReparentCommand } from './structure-commands'
import { getEntityParentId } from '../geometry'
import { describeEntityTargets } from './transaction-labels'

/**
 * 会话级 Entity 剪贴板。
 *
 * @remarks
 * 只保存规范化后的顶层来源 ID，不写入系统剪贴板或文档。
 *
 * @public
 */
export interface ComposeEntityClipboard {
  /** 复制可重复粘贴；剪切在成功移动后清空。 */
  readonly kind: 'copy' | 'cut'
  /** 已按文档遍历顺序规范化，并去掉被祖先覆盖的后代。 */
  readonly entityIds: readonly string[]
}

/** 粘贴插入点。 @public */
export interface ComposeEntityInsertion {
  readonly parentId: string | null
  readonly index: number
}

/** 剪贴板粘贴规划结果。 @public */
export interface ComposeClipboardPastePlan {
  readonly command: EditorCommand
  readonly nextSelection: readonly string[]
  readonly clearClipboard: boolean
}

/**
 * 按文档遍历顺序筛选来源，并在祖先和后代同时入选时只保留最外层祖先。
 *
 * @public
 */
export function normalizeClipboardEntityIds(
  document: ComposeDocument,
  requestedIds: readonly string[],
  kind: 'copy' | 'cut',
): readonly string[] {
  const requested = new Set(requestedIds)
  const eligible: string[] = []
  const visit = (id: string) => {
    const entity = document.entities[id]
    if (!entity) return
    if (requested.has(id) && (kind === 'copy' || !getComposeLock(entity).locked)) {
      eligible.push(id)
      return
    }
    getComposeHierarchy(entity)?.childIds.forEach(visit)
  }
  document.rootIds.forEach(visit)
  return eligible
}

/**
 * 从当前选择创建会话剪贴板。
 *
 * @returns 没有合法来源时返回 `null`。
 * @public
 */
export function createEntityClipboard(
  document: ComposeDocument,
  selectedIds: readonly string[],
  kind: 'copy' | 'cut',
): ComposeEntityClipboard | null {
  const entityIds = normalizeClipboardEntityIds(document, selectedIds, kind)
  return entityIds.length === 0 ? null : { kind, entityIds }
}

/**
 * 解析建议粘贴落点：容器追加子项，叶节点插到自身之后，空目标落到根级末尾。
 *
 * @public
 */
export function resolveSuggestedEntityInsertion(
  document: ComposeDocument,
  targetId: string | null,
  fallbackFrameId?: string | null,
): ComposeEntityInsertion | null {
  // v7 的文档根只接受 Frame：没有命中目标时落点是某块画板，而不是文档根。
  if (targetId === null) {
    const frameId = fallbackFrameId
      ?? document.rootIds.find((id) => isComposeFrameEntity(document.entities[id]))
      ?? null
    if (frameId === null) return null
    return {
      parentId: frameId,
      index: getComposeHierarchy(document.entities[frameId])?.childIds.length ?? 0,
    }
  }
  const target = document.entities[targetId]
  if (!target) return null
  const hierarchy = getComposeHierarchy(target)
  if (hierarchy && !getComposeLock(target).locked) {
    return { parentId: targetId, index: hierarchy.childIds.length }
  }
  const parentId = getEntityParentId(document, targetId)
  if (parentId !== null) {
    const parent = document.entities[parentId]
    if (!parent || getComposeLock(parent).locked) return null
    const siblings = getComposeHierarchy(parent)?.childIds ?? []
    return { parentId, index: siblings.indexOf(targetId) + 1 }
  }
  return { parentId: null, index: document.rootIds.indexOf(targetId) + 1 }
}

/**
 * 判断剪切粘贴是否会形成循环、落到无效父级，或保持原有兄弟顺序不变。
 *
 * @public
 */
export function isInvalidCutInsertion(
  document: ComposeDocument,
  entityIds: readonly string[],
  insertion: ComposeEntityInsertion,
): boolean {
  if (!validParent(document, insertion.parentId)) return true
  if (insertion.parentId) {
    if (entityIds.includes(insertion.parentId)) return true
    if (entityIds.some((id) => isAncestor(document, id, insertion.parentId))) return true
  }
  if (entityIds.some((id) => !document.entities[id] || getComposeLock(document.entities[id]!).locked)) {
    return true
  }

  if (entityIds.some((id) => getEntityParentId(document, id) !== insertion.parentId)) return false
  const siblings = insertion.parentId
    ? [...(getComposeHierarchy(document.entities[insertion.parentId]!)?.childIds ?? [])]
    : [...document.rootIds]
  const moving = new Set(entityIds)
  const removedBefore = siblings.slice(0, insertion.index).filter((id) => moving.has(id)).length
  const remaining = siblings.filter((id) => !moving.has(id))
  const at = Math.max(0, Math.min(remaining.length, insertion.index - removedBefore))
  remaining.splice(at, 0, ...entityIds)
  return remaining.every((id, position) => id === siblings[position])
}

/**
 * 把会话剪贴板规划成一次文档命令。
 *
 * @returns 来源失效、落点非法或跨父级剪切缺少布局快照时返回 `null`。
 * @public
 */
export function createPasteFromClipboard(
  document: ComposeDocument,
  clipboard: ComposeEntityClipboard,
  insertion: ComposeEntityInsertion,
  idFactory: () => string,
  layoutSnapshot?: ComposeLayoutSnapshot | null,
): ComposeClipboardPastePlan | null {
  const sourceIds = normalizeClipboardEntityIds(document, clipboard.entityIds, clipboard.kind)
  if (sourceIds.length !== clipboard.entityIds.length || sourceIds.length === 0) return null
  if (!validParent(document, insertion.parentId)) return null

  if (clipboard.kind === 'copy') {
    const duplicates = sourceIds
      .map((id, offset) => createDuplicateCommand(
        document,
        id,
        idFactory,
        idFactory(),
        { parentId: insertion.parentId, index: insertion.index + offset },
      ))
      .filter((item): item is NonNullable<typeof item> => item !== null)
    if (duplicates.length === 0) return null
    const nextSelection = duplicates.map((item) => item.rootId)
    if (duplicates.length === 1) {
      return {
        command: duplicates[0]!.command,
        nextSelection,
        clearClipboard: false,
      }
    }
    return {
      command: createComposeBatchCommand({
        id: idFactory(),
        commands: duplicates.map((item) => item.command),
        meta: {
          label: `Duplicate ${describeEntityTargets(document, sourceIds)}`,
          source: 'stage',
          targetIds: sourceIds,
        },
      }),
      nextSelection,
      clearClipboard: false,
    }
  }

  if (isInvalidCutInsertion(document, sourceIds, insertion)) return null
  const crossesParent = sourceIds.some((id) => getEntityParentId(document, id) !== insertion.parentId)
  if (crossesParent) {
    if (!layoutSnapshot) return null
    return {
      command: createReparentCommand(
        document,
        layoutSnapshot,
        sourceIds,
        insertion.parentId,
        insertion.index,
        idFactory(),
      ),
      nextSelection: sourceIds,
      clearClipboard: true,
    }
  }
  return {
    command: {
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.moveEntity,
      payload: {
        entityIds: [...sourceIds],
        parentId: insertion.parentId,
        index: insertion.index,
      },
      meta: {
        label: `Reorder ${describeEntityTargets(document, sourceIds)}`
          + ` · position ${insertion.index + 1}`,
        source: 'stage',
        targetIds: sourceIds,
      },
    },
    nextSelection: sourceIds,
    clearClipboard: true,
  }
}

function validParent(document: ComposeDocument, parentId: string | null) {
  if (parentId === null) return true
  const parent = document.entities[parentId]
  return Boolean(parent && getComposeHierarchy(parent) && !getComposeLock(parent).locked)
}

function isAncestor(document: ComposeDocument, ancestorId: string, candidateId: string | null) {
  let current = candidateId
  while (current) {
    if (current === ancestorId) return true
    current = getEntityParentId(document, current)
  }
  return false
}
