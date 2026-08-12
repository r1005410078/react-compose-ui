import { validateComposeDocument } from '../document'
import type { ComposeDocument, ComposeEntity, JsonObject } from '../document-types'
import { getComposeComposition } from '../entity'
import { isComposeGroupEntity } from '../group'
import type {
  ComposeComponentAssetIssue,
  ComposeComponentOverrideApplyResult,
  ComposeComponentOverrideOperation,
} from './component-types'
import { removeComponentField, setComponentField } from './component-file'

interface MutableEntity {
  id: string
  name: string
  components: Record<string, JsonObject>
}

interface MutableDocument {
  schemaVersion: 6
  canvas: ComposeDocument['canvas']
  output: ComposeDocument['output']
  rootIds: string[]
  entities: Record<string, MutableEntity>
}

function mutableDocument(document: ComposeDocument): MutableDocument {
  return structuredClone(document) as unknown as MutableDocument
}

function fail(
  operation: ComposeComponentOverrideOperation,
  message: string,
): ComposeComponentOverrideApplyResult {
  return {
    ok: false,
    issues: [{
      code: 'component-asset.invalid-operation',
      path: ['overrides'],
      message,
      operationId: operation.id,
    }],
  }
}

function parentIdOf(document: MutableDocument, entityId: string): string | null | undefined {
  if (document.rootIds.includes(entityId)) return null
  for (const entity of Object.values(document.entities)) {
    const children = (entity.components.Hierarchy as { childIds?: readonly string[] } | undefined)?.childIds
    if (children?.includes(entityId)) return entity.id
  }
  return undefined
}

function mutableChildren(document: MutableDocument, parentId: string | null): string[] | null {
  if (parentId === null) return document.rootIds
  const hierarchy = document.entities[parentId]?.components.Hierarchy as { childIds?: readonly string[] } | undefined
  if (!hierarchy) return null
  const childIds = [...(hierarchy.childIds ?? [])]
  document.entities[parentId]!.components.Hierarchy = { childIds }
  return childIds
}

function insertAtAnchor(
  children: string[],
  entityId: string,
  beforeEntityId: string | null,
): boolean {
  if (beforeEntityId === null) {
    children.push(entityId)
    return true
  }
  const index = children.indexOf(beforeEntityId)
  if (index === -1) return false
  children.splice(index, 0, entityId)
  return true
}

function collectSubtree(document: MutableDocument, entityId: string, result = new Set<string>()) {
  if (result.has(entityId)) return result
  const entity = document.entities[entityId]
  if (!entity) return result
  result.add(entityId)
  const hierarchy = entity.components.Hierarchy as { childIds?: readonly string[] } | undefined
  hierarchy?.childIds?.forEach((childId) => collectSubtree(document, childId, result))
  return result
}

function applyOperation(
  document: MutableDocument,
  operation: ComposeComponentOverrideOperation,
): string | null {
  if (operation.kind === 'set-field' || operation.kind === 'remove-field') {
    const component = document.entities[operation.entityId]?.components[operation.componentKey]
    if (!component) return `Entity ${operation.entityId} 缺少 Component ${operation.componentKey}`
    const changed = operation.kind === 'set-field'
      ? setComponentField(component, operation.fieldPath, operation.value)
      : removeComponentField(component, operation.fieldPath)
    return changed ? null : `字段路径 ${operation.fieldPath.join('.')} 不存在`
  }
  if (operation.kind === 'add-component') {
    const entity = document.entities[operation.entityId]
    if (!entity) return `Entity ${operation.entityId} 不存在`
    if (entity.components[operation.componentKey]) return `Component ${operation.componentKey} 已存在`
    entity.components[operation.componentKey] = structuredClone(operation.value)
    return null
  }
  if (operation.kind === 'remove-component') {
    const entity = document.entities[operation.entityId]
    if (!entity?.components[operation.componentKey]) return `Component ${operation.componentKey} 不存在`
    const baseKeys = getComposeComposition(entity as unknown as ComposeEntity).baseComponentKeys
    if (baseKeys.includes(operation.componentKey)) return `基础 Component ${operation.componentKey} 不可移除`
    delete entity.components[operation.componentKey]
    return null
  }
  if (operation.kind === 'add-entity') {
    if (document.entities[operation.rootEntityId]) return `Entity ${operation.rootEntityId} 已存在`
    const entries = Object.entries(operation.entities)
    if (entries.length === 0 || !operation.entities[operation.rootEntityId]) return '新增子树缺少根 Entity'
    if (entries.some(([id]) => document.entities[id])) return '新增子树包含重复 Entity ID'
    const children = mutableChildren(document, operation.parentId)
    if (!children) return `父 Entity ${String(operation.parentId)} 不是容器`
    if (!insertAtAnchor(children, operation.rootEntityId, operation.beforeEntityId)) return '新增锚点不存在'
    entries.forEach(([id, entity]) => {
      document.entities[id] = structuredClone(entity) as unknown as MutableEntity
    })
    return null
  }
  if (operation.kind === 'remove-entity') {
    if (document.rootIds[0] === operation.entityId) return '组件根不可移除'
    const parentId = parentIdOf(document, operation.entityId)
    if (parentId === undefined) return `Entity ${operation.entityId} 不存在`
    const children = mutableChildren(document, parentId)
    const index = children?.indexOf(operation.entityId) ?? -1
    if (!children || index === -1) return 'Entity 父级无效'
    children.splice(index, 1)
    collectSubtree(document, operation.entityId).forEach((id) => { delete document.entities[id] })
    return null
  }
  if (document.rootIds[0] === operation.entityId) return '组件根不可移动'
  const sourceParentId = parentIdOf(document, operation.entityId)
  if (sourceParentId === undefined) return `Entity ${operation.entityId} 不存在`
  if (operation.parentId === operation.entityId
    || collectSubtree(document, operation.entityId).has(operation.parentId ?? '')) {
    return 'Entity 不可移动到自身后代'
  }
  // 同父级 reorder 必须共享同一个可变数组；分别克隆会让第二次写入覆盖第一次删除。
  const source = mutableChildren(document, sourceParentId)
  const target = sourceParentId === operation.parentId
    ? source
    : mutableChildren(document, operation.parentId)
  if (!source || !target) return '移动父级不是有效容器'
  const sourceIndex = source.indexOf(operation.entityId)
  if (sourceIndex === -1) return '移动来源不存在'
  source.splice(sourceIndex, 1)
  if (!insertAtAnchor(target, operation.entityId, operation.beforeEntityId)) return '移动锚点不存在'
  return null
}

/**
 * 按顺序把 Variant 语义操作应用到直接父快照。
 *
 * @remarks
 * 任一操作失败或最终文档不合法时不会返回半应用文档。
 *
 * @public
 */
export function applyComposeComponentOverrides(
  source: ComposeDocument,
  operations: readonly ComposeComponentOverrideOperation[],
): ComposeComponentOverrideApplyResult {
  const document = mutableDocument(source)
  for (const operation of operations) {
    const error = applyOperation(document, operation)
    if (error) return fail(operation, error)
  }
  const validation = validateComposeDocument(document)
  if (!validation.valid) {
    const issues: ComposeComponentAssetIssue[] = validation.issues.map((candidate) => ({
      ...candidate,
      path: ['resolvedDocument', ...candidate.path],
    }))
    return { ok: false, issues }
  }
  const rootId = validation.document.rootIds[0]
  if (
    validation.document.rootIds.length !== 1
    || !rootId
    || !isComposeGroupEntity(validation.document.entities[rootId]!)
  ) {
    return {
      ok: false,
      issues: [{
        code: 'component-asset.invalid-root',
        path: ['resolvedDocument', 'rootIds'],
        message: '覆盖后的组件文档必须保持单根结构',
      }],
    }
  }
  return { ok: true, document: validation.document }
}
