import {
  isComposeFrameEntity,
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLock,
  getComposeTransformPivot,
  resolveComposeAppearance,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type ComposePosition,
  type EditorCommand,
} from '@compose-ui/core'
import {
  createDuplicateCommand,
  createReparentCommand,
  transformUnderParent,
} from './structure-commands'
import {
  decomposeMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  multiplyMatrices,
  snapTranslation,
  translationMatrix,
  unionRects,
  type StagePoint,
  type StageTransform,
} from '../geometry'
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

/**
 * 粘贴锚点：用户此刻指着的那个世界坐标。
 *
 * @remarks
 * 粘贴出来的那组对象 MUST 保持彼此的相对位置，整组的世界包围盒**中心**落到这里——单个符号
 * 「我要放在这儿」指的是它的中心，一片框选下来的图纸也没有哪个角比中心更配当基点。落点再过
 * 一次**网格吸附**（只吸网格、不找参考线：粘贴不是拖动，没有辅助线可画），因此实际中心与
 * 锚点至多差半个网格步长。锚点缺席时粘贴退回既有行为——同父级错开 10、跨父级保留来源坐标。
 * @public
 */
export interface ComposeEntityPasteAnchor {
  readonly worldPoint: StagePoint
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
    // 回退目标必须是**这份文档里**的 Frame：宿主传来的 `activeFrameId` 住在页面文件上，
    // 切换页面标签时它与文档各自更新，中间会有一帧对不上——不校验就会读到 undefined 的
    // Entity 而整块画布卸载。既有的 `resolveTargetFrameId` 与 Stage 都是这么判的。
    const frameId = (fallbackFrameId && isComposeFrameEntity(document.entities[fallbackFrameId])
      ? fallbackFrameId
      : document.rootIds.find((id) => isComposeFrameEntity(document.entities[id])))
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
  if (isBlockedCutInsertion(document, entityIds, insertion)) return true

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
 * 剪切落点在结构上就不成立：父级非法、落进自己或后代、来源缺失或锁定。
 *
 * @remarks
 * 与「同父级顺序没变」那条分开：后者只对不带锚点的剪切成立——带锚点时同父级粘贴照样要
 * 挪位置，顺序没变不是拒绝的理由。
 */
function isBlockedCutInsertion(
  document: ComposeDocument,
  entityIds: readonly string[],
  insertion: ComposeEntityInsertion,
): boolean {
  if (!validParent(document, insertion.parentId)) return true
  if (insertion.parentId) {
    if (entityIds.includes(insertion.parentId)) return true
    if (entityIds.some((id) => isAncestor(document, id, insertion.parentId))) return true
  }
  return entityIds.some((id) => !document.entities[id] || getComposeLock(document.entities[id]!).locked)
}

/**
 * 把锚点换算成整组来源要平移的世界位移。
 *
 * @returns 没有快照、任一来源没有盒时返回 `null`——那时锚点无从谈起，粘贴退回既有行为。
 */
function resolvePasteShift(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot | null | undefined,
  sourceIds: readonly string[],
  anchor: ComposeEntityPasteAnchor | null | undefined,
): StagePoint | null {
  if (!anchor || !snapshot) return null
  if (sourceIds.some((id) => !snapshot.boxes[id])) return null
  const bounds = unionRects(sourceIds.map((id) => getEntityWorldBounds(document, snapshot, id)))
  if (!bounds) return null
  const delta = {
    x: anchor.worldPoint.x - (bounds.x + bounds.width / 2),
    y: anchor.worldPoint.y - (bounds.y + bounds.height / 2),
  }
  const { grid } = document.canvas
  // 只吸网格：候选参考线为空，`zoom` 因此不参与任何阈值。
  return snapTranslation(bounds, delta, [], 1, false, {
    stepX: grid.stepX,
    stepY: grid.stepY,
    offsetX: grid.offsetX,
    offsetY: grid.offsetY,
    enabled: grid.snapEnabled,
  }).delta
}

/** 来源平移 `shift` 之后的世界矩阵。 */
function shiftedWorldMatrix(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
  shift: StagePoint,
) {
  return multiplyMatrices(
    translationMatrix(shift.x, shift.y),
    getEntityWorldMatrix(document, snapshot, entityId),
  )
}

/**
 * 把会话剪贴板规划成一次文档命令。
 *
 * @param anchor - 粘贴锚点；给了且快照可用时整组副本的包围盒中心落到那里，见
 *   {@link ComposeEntityPasteAnchor}。
 * @returns 来源失效、落点非法或跨父级剪切缺少布局快照时返回 `null`。
 * @public
 */
export function createPasteFromClipboard(
  document: ComposeDocument,
  clipboard: ComposeEntityClipboard,
  insertion: ComposeEntityInsertion,
  idFactory: () => string,
  layoutSnapshot?: ComposeLayoutSnapshot | null,
  anchor?: ComposeEntityPasteAnchor | null,
): ComposeClipboardPastePlan | null {
  const sourceIds = normalizeClipboardEntityIds(document, clipboard.entityIds, clipboard.kind)
  if (sourceIds.length !== clipboard.entityIds.length || sourceIds.length === 0) return null
  if (!validParent(document, insertion.parentId)) return null
  const shift = resolvePasteShift(document, layoutSnapshot, sourceIds, anchor)

  if (clipboard.kind === 'copy') {
    const parent = insertion.parentId ? document.entities[insertion.parentId] : undefined
    // Auto Layout 容器里位置由求解决定，显式落点在那里没有意义；锚点此时只决定父级。
    const targetManagesFlow = Boolean(parent && getComposeLayout(parent))
    const targetBorder = parent ? resolveComposeAppearance(parent).borderWidth : 0
    const placementFor = (id: string): ComposePosition | undefined => {
      const entity = document.entities[id]
      const box = layoutSnapshot?.boxes[id]
      if (!shift || !layoutSnapshot || !entity || !box || targetManagesFlow) return undefined
      const transform = transformUnderParent(
        document,
        layoutSnapshot,
        shiftedWorldMatrix(document, layoutSnapshot, id, shift),
        insertion.parentId,
        box.width,
        box.height,
        getComposeTransformPivot(entity),
      )
      // 与 reparent 同一条换算：盒坐标相对父级的边框盒，`LayoutItem.offset` 相对内容盒。
      return {
        x: transform.position.x - targetBorder,
        y: transform.position.y - targetBorder,
      }
    }
    const duplicates = sourceIds
      .map((id, offset) => createDuplicateCommand(
        document,
        id,
        idFactory,
        idFactory(),
        {
          parentId: insertion.parentId,
          index: insertion.index + offset,
          ...(placementFor(id) ? { position: placementFor(id) } : {}),
        },
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

  if (shift && layoutSnapshot) {
    /*
     * 带锚点的剪切是「搬到那里」：同父级也要挪位置，因此不走「顺序没变即拒绝」那一档，
     * 只拦结构上不成立的落点。位移以来源各自父级的局部坐标交给 reparent，与拖动松手走的
     * 是同一条命令。
     */
    if (isBlockedCutInsertion(document, sourceIds, insertion)) return null
    const dragged: Record<string, StageTransform> = {}
    for (const id of sourceIds) {
      const entity = document.entities[id]!
      const box = layoutSnapshot.boxes[id]!
      const parentId = getEntityParentId(document, id)
      const world = shiftedWorldMatrix(document, layoutSnapshot, id, shift)
      const local = parentId
        ? multiplyMatrices(invertMatrix(getEntityWorldMatrix(document, layoutSnapshot, parentId)), world)
        : world
      dragged[id] = decomposeMatrix(local, box.width, box.height, getComposeTransformPivot(entity))
    }
    return {
      command: createReparentCommand(
        document,
        layoutSnapshot,
        sourceIds,
        insertion.parentId,
        insertion.index,
        idFactory(),
        dragged,
      ),
      nextSelection: sourceIds,
      clearClipboard: true,
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
