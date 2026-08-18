import { getComposeComposition, getComposeHierarchy } from '../entity'
import type { ComposeDocument, ComposeEntity, JsonObject, JsonValue } from '../document-types'
import type {
  ComposeComponentAssetIssue,
  ComposeComponentOverrideOperation,
} from './component-types'

/** 稳定 Component 文档 diff 的结果。 @public */
export type ComposeComponentDiffResult =
  | { readonly ok: true; readonly operations: readonly ComposeComponentOverrideOperation[] }
  | { readonly ok: false; readonly issues: readonly ComposeComponentAssetIssue[] }

function issue(message: string, path: readonly (string | number)[] = []): ComposeComponentDiffResult {
  return {
    ok: false,
    issues: [{ code: 'component-asset.invalid-operation', path, message }],
  }
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => equal(value, right[index]))
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  const leftEntries = Object.entries(left)
  const rightRecord = right as Readonly<Record<string, unknown>>
  return leftEntries.length === Object.keys(rightRecord).length
    && leftEntries.every(([key, value]) => key in rightRecord && equal(value, rightRecord[key]))
}

function parentMap(document: ComposeDocument) {
  const parents = new Map<string, string | null>()
  document.rootIds.forEach((id) => parents.set(id, null))
  Object.values(document.entities).forEach((entity) => {
    getComposeHierarchy(entity)?.childIds.forEach((id) => parents.set(id, entity.id))
  })
  return parents
}

function siblingAfter(document: ComposeDocument, parents: ReadonlyMap<string, string | null>, id: string) {
  const parentId = parents.get(id)
  const siblings = parentId === null
    ? document.rootIds
    : parentId === undefined
      ? []
      : getComposeHierarchy(document.entities[parentId]!)?.childIds ?? []
  const index = siblings.indexOf(id)
  return index === -1 ? null : siblings[index + 1] ?? null
}

function documentOrder(document: ComposeDocument) {
  const result: string[] = []
  const visit = (id: string) => {
    const entity = document.entities[id]
    if (!entity) return
    result.push(id)
    getComposeHierarchy(entity)?.childIds.forEach(visit)
  }
  document.rootIds.forEach(visit)
  return result
}

function cloneAddedEntity(entity: ComposeEntity, added: ReadonlySet<string>): ComposeEntity {
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return structuredClone(entity)
  return {
    ...structuredClone(entity),
    components: {
      ...structuredClone(entity.components),
      // 已存在节点稍后由稳定 move 操作接入，避免一个 ID 暂时出现在两个父级。
      Hierarchy: { childIds: hierarchy.childIds.filter((id) => added.has(id)) },
    },
  }
}

function collectAddedSubtree(
  document: ComposeDocument,
  id: string,
  added: ReadonlySet<string>,
  result: Record<string, ComposeEntity>,
) {
  if (!added.has(id) || result[id]) return
  const entity = document.entities[id]
  if (!entity) return
  result[id] = cloneAddedEntity(entity, added)
  getComposeHierarchy(entity)?.childIds.forEach((childId) => {
    collectAddedSubtree(document, childId, added, result)
  })
}

function fieldOperations(input: {
  readonly entityId: string
  readonly componentKey: string
  readonly source: JsonObject
  readonly target: JsonObject
  readonly nextId: () => string
}): ComposeComponentOverrideOperation[] {
  const operations: ComposeComponentOverrideOperation[] = []
  const visit = (
    source: Readonly<Record<string, JsonValue>>,
    target: Readonly<Record<string, JsonValue>>,
    path: readonly string[],
  ) => {
    Object.keys(source).sort().forEach((key) => {
      if (!(key in target)) {
        operations.push({
          id: input.nextId(),
          kind: 'remove-field',
          entityId: input.entityId,
          componentKey: input.componentKey,
          fieldPath: [...path, key],
        })
      }
    })
    Object.keys(target).sort().forEach((key) => {
      const nextPath = [...path, key]
      if (input.componentKey === 'Hierarchy' && nextPath.length === 1 && key === 'childIds') return
      const before = source[key]
      const after = target[key]!
      if (equal(before, after)) return
      const recurse = before !== null
        && after !== null
        && typeof before === 'object'
        && typeof after === 'object'
        && !Array.isArray(before)
        && !Array.isArray(after)
      if (recurse) {
        visit(
          before as Readonly<Record<string, JsonValue>>,
          after as Readonly<Record<string, JsonValue>>,
          nextPath,
        )
      }
      else {
        operations.push({
          id: input.nextId(),
          kind: 'set-field',
          entityId: input.entityId,
          componentKey: input.componentKey,
          fieldPath: nextPath,
          value: structuredClone(after),
        })
      }
    })
  }
  visit(input.source, input.target, [])
  return operations
}

/**
 * 以稳定 Entity ID、Component key 与 sibling 锚点比较直接父快照和 Variant 工作文档。
 *
 * @remarks
 * 数组只作为完整字段写入，绝不生成数组下标路径。Hierarchy.childIds 只由 add/remove/move
 * 结构操作表达。顶层 canvas 与 Entity name 当前不是可覆盖语义，变化会显式拒绝。
 *
 * @public
 */
export function diffComposeComponentDocuments(input: {
  readonly parent: ComposeDocument
  readonly current: ComposeDocument
  readonly idFactory?: () => string
}): ComposeComponentDiffResult {
  const parentRoot = input.parent.rootIds[0]
  const currentRoot = input.current.rootIds[0]
  if (
    input.parent.rootIds.length !== 1
    || input.current.rootIds.length !== 1
    || !parentRoot
    || parentRoot !== currentRoot
  ) return issue('Variant 必须保持与直接父源相同的唯一根 ID', ['rootIds'])
  if (!equal(input.parent.canvas, input.current.canvas)) {
    return issue('Variant 不支持覆盖 canvas', ['canvas'])
  }
  const commonIds = Object.keys(input.parent.entities)
    .filter((id) => input.current.entities[id] !== undefined)
  const renamed = commonIds.find((id) => (
    input.parent.entities[id]!.name !== input.current.entities[id]!.name
  ))
  if (renamed) return issue('Variant 暂不支持覆盖 Entity name', ['entities', renamed, 'name'])

  let operationIndex = 0
  const nextId = input.idFactory ?? (() => `override:${String(++operationIndex).padStart(4, '0')}`)
  const operations: ComposeComponentOverrideOperation[] = []
  const parentParents = parentMap(input.parent)
  const currentParents = parentMap(input.current)
  const removed = new Set(Object.keys(input.parent.entities).filter((id) => !input.current.entities[id]))
  const added = new Set(Object.keys(input.current.entities).filter((id) => !input.parent.entities[id]))

  documentOrder(input.parent).reverse().forEach((id) => {
    if (id === parentRoot || !removed.has(id)) return
    const parentId = parentParents.get(id)
    if (parentId && removed.has(parentId)) return
    operations.push({ id: nextId(), kind: 'remove-entity', entityId: id })
  })

  documentOrder(input.current).forEach((id) => {
    if (!added.has(id)) return
    const parentId = currentParents.get(id) ?? null
    if (parentId && added.has(parentId)) return
    const entities: Record<string, ComposeEntity> = {}
    collectAddedSubtree(input.current, id, added, entities)
    let beforeEntityId = siblingAfter(input.current, currentParents, id)
    while (beforeEntityId && added.has(beforeEntityId)) {
      beforeEntityId = siblingAfter(input.current, currentParents, beforeEntityId)
    }
    operations.push({
      id: nextId(),
      kind: 'add-entity',
      rootEntityId: id,
      entities,
      parentId,
      beforeEntityId,
    })
  })

  const componentAdds: ComposeComponentOverrideOperation[] = []
  const componentRemoves: ComposeComponentOverrideOperation[] = []
  const fields: ComposeComponentOverrideOperation[] = []
  commonIds.sort().forEach((entityId) => {
    const before = input.parent.entities[entityId]!
    const after = input.current.entities[entityId]!
    Object.keys(after.components).sort().forEach((componentKey) => {
      if (before.components[componentKey]) return
      const value = componentKey === 'Hierarchy'
        ? { childIds: [] }
        : after.components[componentKey]!
      componentAdds.push({
        id: nextId(),
        kind: 'add-component',
        entityId,
        componentKey,
        value: structuredClone(value),
      })
    })
    Object.keys(before.components).sort().forEach((componentKey) => {
      if (after.components[componentKey]) return
      if (getComposeComposition(before).baseComponentKeys.includes(componentKey)) return
      componentRemoves.push({
        id: nextId(),
        kind: 'remove-component',
        entityId,
        componentKey,
      })
    })
    Object.keys(after.components).sort().forEach((componentKey) => {
      const source = before.components[componentKey]
      const target = after.components[componentKey]
      if (!source || !target) return
      fields.push(...fieldOperations({ entityId, componentKey, source, target, nextId }))
    })
  })
  operations.push(...componentAdds)

  documentOrder(input.current).forEach((id) => {
    if (id === currentRoot || !input.parent.entities[id]) return
    const beforeParent = parentParents.get(id) ?? null
    const afterParent = currentParents.get(id) ?? null
    const beforeSibling = siblingAfter(input.parent, parentParents, id)
    const afterSibling = siblingAfter(input.current, currentParents, id)
    if (beforeParent === afterParent && beforeSibling === afterSibling) return
    operations.push({
      id: nextId(),
      kind: 'move-entity',
      entityId: id,
      parentId: afterParent,
      beforeEntityId: afterSibling,
    })
  })
  operations.push(...componentRemoves, ...fields)
  return { ok: true, operations }
}

/** Revert 对新增结构依赖的预览结果。 @public */
export interface ComposeComponentRevertPlan {
  readonly selectedOperationIds: readonly string[]
  readonly dependentOperationIds: readonly string[]
  readonly requiresConfirmation: boolean
  readonly overrides: readonly ComposeComponentOverrideOperation[]
}

function operationTouchesEntities(
  operation: ComposeComponentOverrideOperation,
  entityIds: ReadonlySet<string>,
) {
  if ('entityId' in operation && entityIds.has(operation.entityId)) return true
  return operation.kind === 'add-entity'
    ? operation.parentId !== null && entityIds.has(operation.parentId)
    : operation.kind === 'move-entity'
      ? (operation.parentId !== null && entityIds.has(operation.parentId))
        || (operation.beforeEntityId !== null && entityIds.has(operation.beforeEntityId))
      : false
}

/**
 * 规划只移除当前 Variant 层的指定操作；新增子树存在后续依赖时要求显式确认。
 *
 * @public
 */
export function planComposeComponentRevert(input: {
  readonly overrides: readonly ComposeComponentOverrideOperation[]
  readonly operationIds: readonly string[]
  readonly confirmDependencies?: boolean
}): ComposeComponentRevertPlan {
  const selected = new Set(input.operationIds)
  const addedEntities = new Set<string>()
  input.overrides.forEach((operation) => {
    if (selected.has(operation.id) && operation.kind === 'add-entity') {
      Object.keys(operation.entities).forEach((id) => addedEntities.add(id))
    }
  })
  const dependentOperationIds = input.overrides
    .filter((operation) => !selected.has(operation.id) && operationTouchesEntities(operation, addedEntities))
    .map(({ id }) => id)
  const removed = new Set([
    ...selected,
    ...(input.confirmDependencies ? dependentOperationIds : []),
  ])
  return {
    selectedOperationIds: [...selected],
    dependentOperationIds,
    requiresConfirmation: dependentOperationIds.length > 0 && !input.confirmDependencies,
    overrides: dependentOperationIds.length > 0 && !input.confirmDependencies
      ? input.overrides
      : input.overrides.filter(({ id }) => !removed.has(id)),
  }
}
