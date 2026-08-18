import {
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  createComposeFrame,
  createComposeGroupEntitySeed,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeLock,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import {
  decomposeMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  multiplyMatrices,
  toComposeTransform,
  translationMatrix,
  unionRects,
} from './geometry'

/** 组件抽取失败的稳定原因。 @public */
export type ComposeComponentExtractionUnavailableReason =
  | 'selection-empty'
  | 'selection-invalid'
  | 'different-parents'
  | 'flow-selection'
  | 'locked-selection'
  | 'layout-pending'
  | 'group-id-conflict'

/** 场景选区抽取为组件文档后的纯规划结果。 @public */
export interface ComposeComponentExtractionPlan {
  readonly status: 'ready'
  readonly sourceEntityIds: readonly string[]
  readonly parentId: string | null
  readonly siblingIndex: number
  readonly componentDocument: ComposeDocument
  readonly instanceTransform: ComposeSpatialTransform
}

/** 组件抽取规划的判别结果。 @public */
export type ComposeComponentExtractionResult = ComposeComponentExtractionPlan | {
  readonly status: 'unavailable'
  readonly reason: ComposeComponentExtractionUnavailableReason
}

function childrenOf(document: ComposeDocument, parentId: string | null): readonly string[] {
  return parentId === null
    ? document.rootIds
    : getComposeHierarchy(document.entities[parentId]!)?.childIds ?? []
}

function hasSelectedAncestor(
  document: ComposeDocument,
  entityId: string,
  selected: ReadonlySet<string>,
) {
  let parentId = getEntityParentId(document, entityId)
  while (parentId !== null) {
    if (selected.has(parentId)) return true
    parentId = getEntityParentId(document, parentId)
  }
  return false
}

function normalizeSelection(
  document: ComposeDocument,
  selectedIds: readonly string[],
): readonly string[] | null {
  const unique = [...new Set(selectedIds)]
  if (unique.length === 0 || unique.some((id) => document.entities[id] === undefined)) return null
  const selected = new Set(unique)
  const roots = unique.filter((id) => !hasSelectedAncestor(document, id, selected))
  const parentId = getEntityParentId(document, roots[0]!)
  if (roots.some((id) => getEntityParentId(document, id) !== parentId)) return roots
  const order = childrenOf(document, parentId)
  return [...roots].sort((left, right) => order.indexOf(left) - order.indexOf(right))
}

function collectSubtree(
  document: ComposeDocument,
  entityId: string,
  entities: Record<string, ComposeEntity>,
) {
  const entity = document.entities[entityId]
  if (!entity || entities[entityId]) return
  entities[entityId] = structuredClone(entity)
  getComposeHierarchy(entity)?.childIds.forEach((childId) => {
    collectSubtree(document, childId, entities)
  })
}

function withTransform(
  entity: ComposeEntity,
  transform: ComposeSpatialTransform,
): ComposeEntity {
  const item = getComposeLayoutItem(entity)
  return {
    ...entity,
    components: {
      ...entity.components,
      Transform: { rotation: transform.rotation },
      LayoutItem: {
        ...item,
        positioning: 'absolute',
        offset: transform.position,
        width: { ...item.width, value: transform.size.width },
        height: { ...item.height, value: transform.size.height },
      },
    },
  }
}

function transformRelativeTo(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
  targetWorld: ReturnType<typeof translationMatrix>,
): ComposeSpatialTransform | null {
  const box = snapshot.boxes[entityId]
  if (!box) return null
  return toComposeTransform(decomposeMatrix(
    multiplyMatrices(
      invertMatrix(targetWorld),
      getEntityWorldMatrix(document, snapshot, entityId),
    ),
    box.width,
    box.height,
  ))
}

function transformUnderParent(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  world: ReturnType<typeof translationMatrix>,
  parentId: string | null,
  width: number,
  height: number,
): ComposeSpatialTransform {
  const parentWorld = parentId === null
    ? null
    : getEntityWorldMatrix(document, snapshot, parentId)
  const local = parentWorld ? multiplyMatrices(invertMatrix(parentWorld), world) : world
  return toComposeTransform(decomposeMatrix(local, width, height))
}

/**
 * 把同父级 Absolute 顶层选区克隆为透明、单根 Group 的独立 v6 组件文档。
 *
 * @remarks
 * 规划器不修改正式文档。选区中的后代会被祖先覆盖，结果沿原 sibling 顺序排列；只有资源
 * 写入成功后，调用方才应使用 `createReplaceSelectionWithEntityCommand` 提交场景替换。
 *
 * @public
 */
export function createComponentExtractionPlan(input: {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly selectedIds: readonly string[]
  readonly groupId: string
  readonly name: string
}): ComposeComponentExtractionResult {
  const roots = normalizeSelection(input.document, input.selectedIds)
  if (!roots) return { status: 'unavailable', reason: 'selection-empty' }
  const parentId = getEntityParentId(input.document, roots[0]!)
  if (roots.some((id) => getEntityParentId(input.document, id) !== parentId)) {
    return { status: 'unavailable', reason: 'different-parents' }
  }
  if (roots.some((id) => getComposeLayoutItem(input.document.entities[id]!).positioning !== 'absolute')) {
    return { status: 'unavailable', reason: 'flow-selection' }
  }
  if (
    roots.some((id) => getComposeLock(input.document.entities[id]!).locked)
    || (parentId !== null && getComposeLock(input.document.entities[parentId]!).locked)
  ) return { status: 'unavailable', reason: 'locked-selection' }
  if (roots.some((id) => !input.layoutSnapshot.boxes[id])) {
    return { status: 'unavailable', reason: 'layout-pending' }
  }

  const bounds = unionRects(roots.map((id) => (
    getEntityWorldBounds(input.document, input.layoutSnapshot, id)
  )))
  if (!bounds) return { status: 'unavailable', reason: 'selection-invalid' }
  const safeBounds = {
    ...bounds,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
  }
  const outputWorld = translationMatrix(safeBounds.x, safeBounds.y)
  // 单选时直接复用被选中的节点作为组件根：追加包装层会在场景树里多出一级同名节点，
  // 且组件根不再要求是 Group，任意 Entity 都可以承担。只有多选才需要 Group 归拢。
  const reuseRoot = roots.length === 1
  if (!reuseRoot && input.document.entities[input.groupId]) {
    return { status: 'unavailable', reason: 'group-id-conflict' }
  }

  const entities: Record<string, ComposeEntity> = {}
  roots.forEach((rootId) => collectSubtree(input.document, rootId, entities))
  for (const rootId of roots) {
    const transform = transformRelativeTo(
      input.document,
      input.layoutSnapshot,
      rootId,
      outputWorld,
    )
    if (!transform) return { status: 'unavailable', reason: 'layout-pending' }
    entities[rootId] = withTransform(entities[rootId]!, transform)
  }

  const componentRootId = reuseRoot ? roots[0]! : input.groupId
  if (reuseRoot) {
    entities[componentRootId] = { ...entities[componentRootId]!, name: input.name }
  }
  else {
    entities[componentRootId] = createComposeGroupEntitySeed({
      id: componentRootId,
      name: input.name,
      childIds: roots,
      size: safeBounds,
    })
  }
  // 组件根必须是 Frame（Component Asset v2）。这里是「创建组件」这一用户动作的隐含升格：
  // 只往既有根上加一个 Frame Component，Entity ID、子级与动画轨道全部原地保留。
  const rootEntity = entities[componentRootId]!
  const rootComposition = rootEntity.components.Composition as
    { readonly baseComponentKeys?: readonly string[] } | undefined
  const baseComponentKeys = rootComposition?.baseComponentKeys ?? []
  entities[componentRootId] = {
    ...rootEntity,
    components: {
      ...rootEntity.components,
      ...(rootComposition
        ? {
            Composition: {
              ...rootComposition,
              baseComponentKeys: baseComponentKeys.includes('Frame')
                ? baseComponentKeys
                : [...baseComponentKeys, 'Frame'],
            } as JsonObject,
          }
        : {}),
      Frame: createComposeFrame({ width: safeBounds.width, height: safeBounds.height }),
    },
  }
  const siblings = childrenOf(input.document, parentId)
  const siblingIndex = Math.min(...roots.map((id) => siblings.indexOf(id)))
  const componentDocument: ComposeDocument = {
    schemaVersion: 7,
    canvas: structuredClone(input.document.canvas),
    rootIds: [componentRootId],
    entities,
  }
  return {
    status: 'ready',
    sourceEntityIds: roots,
    parentId,
    siblingIndex,
    componentDocument,
    instanceTransform: transformUnderParent(
      input.document,
      input.layoutSnapshot,
      outputWorld,
      parentId,
      safeBounds.width,
      safeBounds.height,
    ),
  }
}

/**
 * 创建“删除源子树并在最小 sibling index 插入实例”的原子可逆命令。
 *
 * @public
 */
export function createReplaceSelectionWithEntityCommand(input: {
  readonly document: ComposeDocument
  readonly plan: ComposeComponentExtractionPlan
  readonly entity: ComposeEntity
  readonly commandId: string
  readonly deleteCommandId: string
  readonly createCommandId: string
}): EditorCommand {
  const entity = withTransform(input.entity, input.plan.instanceTransform)
  const deleteCommand: EditorCommand = {
    id: input.deleteCommandId,
    type: BUILTIN_COMMAND_TYPES.deleteEntity,
    payload: { entityIds: input.plan.sourceEntityIds },
    meta: { label: 'Remove component source', source: 'component-library' },
  }
  const createCommand: EditorCommand = {
    id: input.createCommandId,
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId: input.plan.parentId,
      index: input.plan.siblingIndex,
    },
    meta: { label: `Create ${entity.name} instance`, source: 'component-library' },
  }
  return createComposeBatchCommand({
    id: input.commandId,
    commands: [deleteCommand, createCommand],
    meta: {
      label: `Create Component · ${entity.name}`,
      source: 'component-library',
      targetIds: [...input.plan.sourceEntityIds, entity.id],
    },
  })
}
