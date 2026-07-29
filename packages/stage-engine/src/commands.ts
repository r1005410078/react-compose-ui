import {
  BUILTIN_COMMAND_TYPES,
  getComposeHierarchy,
  getComposeTransform,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeTransform,
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
  type StageTransform,
} from './geometry'
import { describeEntityTargets } from './transaction-labels'

function transformUnderParent(
  document: ComposeDocument,
  worldMatrix: ReturnType<typeof getEntityWorldMatrix>,
  parentId: string | null,
  width: number,
  height: number,
): ComposeTransform {
  const parentWorld = parentId ? getEntityWorldMatrix(document, parentId) : null
  const local = parentWorld
    ? multiplyMatrices(invertMatrix(parentWorld), worldMatrix)
    : worldMatrix
  return toComposeTransform(decomposeMatrix(local, width, height))
}

/** 创建保持后代世界几何不变的 entity.group 命令。 @public */
export function createGroupCommand(
  document: ComposeDocument,
  entityIds: readonly string[],
  containerId: string,
  commandId = `group:${containerId}`,
): EditorCommand {
  const bounds = unionRects(entityIds
    .filter((id) => Boolean(document.entities[id]))
    .map((id) => getEntityWorldBounds(document, id)))
  const parentId = entityIds[0] ? getEntityParentId(document, entityIds[0]) : null
  const safeBounds = bounds ?? { x: 0, y: 0, width: 1, height: 1 }
  const groupWorld = translationMatrix(safeBounds.x, safeBounds.y)
  const groupTransform = transformUnderParent(
    document,
    groupWorld,
    parentId,
    safeBounds.width,
    safeBounds.height,
  )
  const container: ComposeEntity = {
    id: containerId,
    name: 'Container',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: [
          'Transform',
          'Visibility',
          'Lock',
          'Hierarchy',
          'Clip',
          'Appearance',
        ],
        capabilityIds: [],
      },
      Transform: groupTransform,
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [...entityIds] },
      Clip: { enabled: false },
      Appearance: {
        backgroundPaint: { kind: 'solid', color: 'transparent' },
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
      },
    },
  }
  const childTransforms: Record<string, JsonValue> = {}
  for (const entityId of entityIds) {
    const entity = document.entities[entityId]
    if (!entity) continue
    const transform = getComposeTransform(entity)
    childTransforms[entityId] = toComposeTransform(decomposeMatrix(
      multiplyMatrices(
        invertMatrix(groupWorld),
        getEntityWorldMatrix(document, entityId),
      ),
      transform.size.width,
      transform.size.height,
    )) as unknown as JsonValue
  }
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.groupEntity,
    payload: {
      container: container as unknown as JsonValue,
      entityIds,
      childTransforms,
    },
    meta: {
      label: `Group ${describeEntityTargets(document, entityIds)}`,
      source: 'stage',
      targetIds: entityIds,
    },
  }
}

/** 创建保持后代世界几何不变的 entity.ungroup 命令。 @public */
export function createUngroupCommand(
  document: ComposeDocument,
  containerId: string,
  commandId = `ungroup:${containerId}`,
): EditorCommand {
  const container = document.entities[containerId]
  const hierarchy = container && getComposeHierarchy(container)
  const parentId = getEntityParentId(document, containerId)
  const childTransforms: Record<string, JsonValue> = {}
  for (const childId of hierarchy?.childIds ?? []) {
    const child = document.entities[childId]
    if (!child) continue
    const transform = getComposeTransform(child)
    childTransforms[childId] = transformUnderParent(
      document,
      getEntityWorldMatrix(document, childId),
      parentId,
      transform.size.width,
      transform.size.height,
    ) as unknown as JsonValue
  }
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.ungroupEntity,
    payload: { containerId, childTransforms },
    meta: {
      label: `Ungroup ${container?.name ?? 'Container'}`,
      source: 'stage',
      targetIds: [containerId],
    },
  }
}

/** 创建原子 reparent batch，并把每个目标的世界矩阵分解到新父级。 @public */
export function createReparentCommand(
  document: ComposeDocument,
  entityIds: readonly string[],
  parentId: string | null,
  index: number,
  commandId = `reparent:${entityIds.join(',')}`,
): EditorCommand {
  const updates = entityIds.map((entityId) => {
    const entity = document.entities[entityId]
    const transform = entity && getComposeTransform(entity)
    return {
      entityId,
      transform: transform
        ? transformUnderParent(
            document,
            getEntityWorldMatrix(document, entityId),
            parentId,
            transform.size.width,
            transform.size.height,
          )
        : {
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            rotation: 0,
          },
    }
  })
  const commands: EditorCommand[] = [
    {
      id: `${commandId}:move`,
      type: BUILTIN_COMMAND_TYPES.moveEntity,
      payload: { entityIds, parentId, index },
    },
    {
      id: `${commandId}:transform`,
      type: BUILTIN_COMMAND_TYPES.setTransform,
      payload: { operation: 'set', updates },
    },
  ]
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: commands as unknown as JsonValue },
    meta: {
      label: `Move ${describeEntityTargets(document, entityIds)}`
        + ` to ${parentId ? document.entities[parentId]?.name ?? 'Container' : 'Canvas'}`,
      source: 'stage',
      targetIds: entityIds,
    },
  }
}

function subtreeIds(document: ComposeDocument, rootId: string) {
  const result: string[] = []
  const visit = (id: string) => {
    const entity = document.entities[id]
    if (!entity) return
    result.push(id)
    getComposeHierarchy(entity)?.childIds.forEach(visit)
  }
  visit(rootId)
  return result
}

/** 为一个 Entity 子树创建 entity.duplicate 命令。 @public */
export function createDuplicateCommand(
  document: ComposeDocument,
  sourceId: string,
  idFactory: () => string,
  commandId = `duplicate:${sourceId}`,
): { readonly command: EditorCommand; readonly rootId: string } | null {
  const source = document.entities[sourceId]
  if (!source) return null
  const ids = subtreeIds(document, sourceId)
  const remap = new Map(ids.map((id) => [id, idFactory()]))
  const entities: Record<string, JsonValue> = {}
  for (const id of ids) {
    const entity = document.entities[id]
    const cloneId = remap.get(id)
    if (!entity || !cloneId) continue
    const clone = structuredClone(entity) as ComposeEntity
    const transform = getComposeTransform(clone)
    const hierarchy = getComposeHierarchy(clone)
    const nextTransform: ComposeTransform = id === sourceId
      ? {
          ...transform,
          position: {
            x: transform.position.x + 10,
            y: transform.position.y + 10,
          },
        }
      : transform
    const next: ComposeEntity = {
      ...clone,
      id: cloneId,
      name: `${clone.name} 副本`,
      components: {
        ...clone.components,
        Transform: nextTransform,
        ...(hierarchy
          ? {
              Hierarchy: {
                childIds: hierarchy.childIds.map((childId) =>
                  remap.get(childId) ?? childId),
              },
            }
          : {}),
      },
    }
    entities[cloneId] = next as unknown as JsonValue
  }
  const rootId = remap.get(sourceId)
  if (!rootId) return null
  const parentId = getEntityParentId(document, sourceId)
  const siblings = parentId
    ? getComposeHierarchy(document.entities[parentId]!)?.childIds ?? []
    : document.rootIds
  return {
    rootId,
    command: {
      id: commandId,
      type: BUILTIN_COMMAND_TYPES.duplicateEntity,
      payload: {
        entities: entities as unknown as JsonObject,
        rootIds: [rootId],
        parentId,
        index: Math.max(0, siblings.indexOf(sourceId) + 1),
      },
      meta: {
        label: `Duplicate ${source.name}`,
        source: 'stage',
        targetIds: [sourceId],
      },
    },
  }
}

/** 将 Stage 几何更新转换为 Core Transform update。 @internal */
export function composeTransformUpdate(
  entityId: string,
  transform: StageTransform,
): JsonObject {
  return { entityId, transform: toComposeTransform(transform) }
}
