import { validateComposeDocument } from '../document'
import type { ComposeDocument, JsonObject, JsonValue } from '../document-types'
import { isComposeComponentKey } from '../entity'
import {
  COMPOSE_COMPONENT_FILE_SUFFIX,
  COMPOSE_COMPONENT_MEDIA_TYPE,
  COMPOSE_COMPONENT_SCHEMA_VERSION,
  type ComposeComponentAssetIssue,
  type ComposeComponentAssetParseResult,
  type ComposeComponentAssetV1,
  type ComposeComponentLineageEntry,
  type ComposeComponentOverrideOperation,
  type ComposeComponentReference,
  type ComposeResolvedComponentSnapshot,
} from './component-types'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function issue(
  issues: ComposeComponentAssetIssue[],
  code: ComposeComponentAssetIssue['code'],
  path: readonly (string | number)[],
  message: string,
  operationId?: string,
) {
  issues.push({ code, path, message, ...(operationId ? { operationId } : {}) })
}

function rejectUnknown(
  value: UnknownRecord,
  allowed: readonly string[],
  path: readonly (string | number)[],
  issues: ComposeComponentAssetIssue[],
  code: ComposeComponentAssetIssue['code'] = 'component-asset.invalid-shape',
) {
  const known = new Set(allowed)
  Object.keys(value).forEach((key) => {
    if (!known.has(key)) issue(issues, code, [...path, key], `包含未知字段 ${key}`)
  })
}

function validateReference(
  value: unknown,
  path: readonly (string | number)[],
  issues: ComposeComponentAssetIssue[],
): value is ComposeComponentReference {
  if (!isRecord(value)) {
    issue(issues, 'component-asset.invalid-reference', path, '组件引用必须是对象')
    return false
  }
  rejectUnknown(value, ['kind', 'providerId', 'assetKey', 'scope'], path, issues,
    'component-asset.invalid-reference')
  if (value.kind !== 'component') {
    issue(issues, 'component-asset.invalid-reference', [...path, 'kind'], 'kind 必须为 component')
  }
  for (const key of ['providerId', 'assetKey'] as const) {
    if (!nonEmpty(value[key])) {
      issue(issues, 'component-asset.invalid-reference', [...path, key], `${key} 必须是非空字符串`)
    }
  }
  if (value.scope !== 'persistent' && value.scope !== 'session') {
    issue(issues, 'component-asset.invalid-reference', [...path, 'scope'], 'scope 无效')
  }
  return nonEmpty(value.providerId)
    && nonEmpty(value.assetKey)
    && value.kind === 'component'
    && (value.scope === 'persistent' || value.scope === 'session')
}

function validateComponentDocument(
  value: unknown,
  path: readonly (string | number)[],
  issues: ComposeComponentAssetIssue[],
): value is ComposeDocument {
  const result = validateComposeDocument(value)
  if (!result.valid) {
    result.issues.forEach((candidate) => {
      issue(issues, candidate.code, [...path, ...candidate.path], candidate.message)
    })
    return false
  }
  // 单根是硬约束：diff 与操作应用都依赖父子两份文档共享同一根 ID，多根会让锚点失去参照。
  // 根的类型不作限制，容器或任意 Entity 都可以作为组件根。
  if (result.document.rootIds.length !== 1 || !result.document.rootIds[0]) {
    issue(issues, 'component-asset.invalid-root', [...path, 'rootIds'], '组件文档必须只有一个根')
    return false
  }
  return true
}

function validateLineage(
  value: unknown,
  path: readonly (string | number)[],
  issues: ComposeComponentAssetIssue[],
): value is readonly ComposeComponentLineageEntry[] {
  if (!Array.isArray(value)) {
    issue(issues, 'component-asset.invalid-lineage', path, 'appliedLineage 必须是数组')
    return false
  }
  const ids = new Set<string>()
  value.forEach((candidate, index) => {
    const itemPath = [...path, index]
    if (!isRecord(candidate)) {
      issue(issues, 'component-asset.invalid-lineage', itemPath, 'lineage 项必须是对象')
      return
    }
    rejectUnknown(candidate, ['reference', 'componentId', 'kind', 'revision'], itemPath, issues,
      'component-asset.invalid-lineage')
    validateReference(candidate.reference, [...itemPath, 'reference'], issues)
    if (!nonEmpty(candidate.componentId) || ids.has(String(candidate.componentId))) {
      issue(issues, 'component-asset.invalid-lineage', [...itemPath, 'componentId'], 'componentId 为空或重复')
    }
    else ids.add(candidate.componentId)
    if (candidate.kind !== 'base' && candidate.kind !== 'variant') {
      issue(issues, 'component-asset.invalid-lineage', [...itemPath, 'kind'], 'lineage kind 无效')
    }
    if (!nonEmpty(candidate.revision)) {
      issue(issues, 'component-asset.invalid-lineage', [...itemPath, 'revision'], 'revision 不能为空')
    }
  })
  return issues.every((candidate) => candidate.code !== 'component-asset.invalid-lineage')
}

const OPERATION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'set-field': ['id', 'kind', 'entityId', 'componentKey', 'fieldPath', 'value'],
  'remove-field': ['id', 'kind', 'entityId', 'componentKey', 'fieldPath'],
  'add-component': ['id', 'kind', 'entityId', 'componentKey', 'value'],
  'remove-component': ['id', 'kind', 'entityId', 'componentKey'],
  'add-entity': ['id', 'kind', 'rootEntityId', 'entities', 'parentId', 'beforeEntityId'],
  'remove-entity': ['id', 'kind', 'entityId'],
  'move-entity': ['id', 'kind', 'entityId', 'parentId', 'beforeEntityId'],
}

function validateOperations(
  value: unknown,
  path: readonly (string | number)[],
  issues: ComposeComponentAssetIssue[],
): value is readonly ComposeComponentOverrideOperation[] {
  if (!Array.isArray(value)) {
    issue(issues, 'component-asset.invalid-operation', path, 'overrides 必须是数组')
    return false
  }
  const ids = new Set<string>()
  value.forEach((candidate, index) => {
    const itemPath = [...path, index]
    if (!isRecord(candidate) || !(String(candidate.kind) in OPERATION_FIELDS)) {
      issue(issues, 'component-asset.invalid-operation', itemPath, '操作 kind 无效')
      return
    }
    const operationId = nonEmpty(candidate.id) ? candidate.id : undefined
    rejectUnknown(candidate, OPERATION_FIELDS[String(candidate.kind)]!, itemPath, issues,
      'component-asset.invalid-operation')
    if (!operationId || ids.has(operationId)) {
      issue(issues, 'component-asset.invalid-operation', [...itemPath, 'id'], '操作 ID 为空或重复', operationId)
    }
    else ids.add(operationId)
    const kind = candidate.kind
    if (kind === 'set-field' || kind === 'remove-field') {
      if (
        !nonEmpty(candidate.entityId)
        || !nonEmpty(candidate.componentKey)
        || !isComposeComponentKey(String(candidate.componentKey))
        || !Array.isArray(candidate.fieldPath)
        || candidate.fieldPath.length === 0
        || candidate.fieldPath.some((field) => !nonEmpty(field))
      ) issue(issues, 'component-asset.invalid-operation', itemPath, '字段操作目标无效', operationId)
    }
    else if (kind === 'add-component' || kind === 'remove-component') {
      if (!nonEmpty(candidate.entityId) || !nonEmpty(candidate.componentKey)) {
        issue(issues, 'component-asset.invalid-operation', itemPath, 'Component 操作目标无效', operationId)
      }
      if (kind === 'add-component' && !isRecord(candidate.value)) {
        issue(issues, 'component-asset.invalid-operation', [...itemPath, 'value'], 'Component value 必须是对象', operationId)
      }
    }
    else if (kind === 'add-entity') {
      if (!nonEmpty(candidate.rootEntityId) || !isRecord(candidate.entities)) {
        issue(issues, 'component-asset.invalid-operation', itemPath, '新增 Entity 子树无效', operationId)
      }
    }
    else if (!nonEmpty(candidate.entityId)) {
      issue(issues, 'component-asset.invalid-operation', itemPath, 'Entity 操作目标无效', operationId)
    }
    if (
      'parentId' in candidate && candidate.parentId !== null && !nonEmpty(candidate.parentId)
    ) issue(issues, 'component-asset.invalid-operation', [...itemPath, 'parentId'], 'parentId 无效', operationId)
    if (
      'beforeEntityId' in candidate
      && candidate.beforeEntityId !== null
      && !nonEmpty(candidate.beforeEntityId)
    ) issue(issues, 'component-asset.invalid-operation', [...itemPath, 'beforeEntityId'], 'beforeEntityId 无效', operationId)
  })
  return issues.every((candidate) => candidate.code !== 'component-asset.invalid-operation')
}

function validateSnapshot(
  value: unknown,
  path: readonly (string | number)[],
  issues: ComposeComponentAssetIssue[],
): value is ComposeResolvedComponentSnapshot {
  if (!isRecord(value)) {
    issue(issues, 'component-asset.invalid-snapshot', path, 'resolvedSnapshot 必须是对象')
    return false
  }
  rejectUnknown(value, ['componentId', 'kind', 'revision', 'document', 'appliedLineage'], path,
    issues, 'component-asset.invalid-snapshot')
  if (!nonEmpty(value.componentId) || !nonEmpty(value.revision)
    || (value.kind !== 'base' && value.kind !== 'variant')) {
    issue(issues, 'component-asset.invalid-snapshot', path, 'snapshot 标识无效')
  }
  const validDocument = validateComponentDocument(value.document, [...path, 'document'], issues)
  validateLineage(value.appliedLineage, [...path, 'appliedLineage'], issues)
  return validDocument
}

function validateAsset(value: unknown): ComposeComponentAssetParseResult {
  const issues: ComposeComponentAssetIssue[] = []
  if (!isRecord(value)) {
    return { ok: false, issues: [{ code: 'component-asset.invalid-shape', path: [], message: '组件文件必须是对象' }] }
  }
  if (value.schemaVersion === COMPOSE_COMPONENT_SCHEMA_VERSION && value.kind === undefined) {
    return { ok: false, issues: [{ code: 'component-asset.legacy', path: ['kind'], message: '旧草案缺少 kind，请显式迁移' }] }
  }
  if (value.schemaVersion !== COMPOSE_COMPONENT_SCHEMA_VERSION) {
    issue(issues, 'component-asset.unsupported-version', ['schemaVersion'], `不支持组件版本 ${String(value.schemaVersion)}`)
  }
  if (!nonEmpty(value.componentId)) issue(issues, 'component-asset.invalid-shape', ['componentId'], 'componentId 不能为空')
  if (!nonEmpty(value.name)) issue(issues, 'component-asset.invalid-shape', ['name'], 'name 不能为空')
  if (value.kind === 'base') {
    // properties 是已删除的暴露属性，必须走显式迁移而不是被当作未知字段拒绝，
    // 因此在这里单独判为 legacy 以便调用方区分。
    if (value.properties !== undefined) {
      return {
        ok: false,
        issues: [{
          code: 'component-asset.legacy',
          path: ['properties'],
          message: 'Base 含已删除的暴露属性，请显式迁移',
        }],
      }
    }
    rejectUnknown(value, ['schemaVersion', 'kind', 'componentId', 'name', 'document'], [], issues)
    validateComponentDocument(value.document, ['document'], issues)
  }
  else if (value.kind === 'variant') {
    rejectUnknown(value, [
      'schemaVersion', 'kind', 'componentId', 'name', 'parentRef', 'appliedLineage', 'overrides',
      'resolvedSnapshot',
    ], [], issues)
    validateReference(value.parentRef, ['parentRef'], issues)
    validateLineage(value.appliedLineage, ['appliedLineage'], issues)
    validateOperations(value.overrides, ['overrides'], issues)
    validateSnapshot(value.resolvedSnapshot, ['resolvedSnapshot'], issues)
  }
  else issue(issues, 'component-asset.invalid-shape', ['kind'], 'kind 必须为 base 或 variant')
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, asset: value as unknown as ComposeComponentAssetV1 }
}

/** 判断媒体类型是否为 Component Asset。 @public */
export function isComposeComponentMediaType(mediaType: string | undefined): boolean {
  return mediaType?.toLowerCase() === COMPOSE_COMPONENT_MEDIA_TYPE
}

/** 判断名称是否符合组件文件命名约定；资源身份仍应使用媒体类型。 @public */
export function isComposeComponentFileName(name: string): boolean {
  return name.length > COMPOSE_COMPONENT_FILE_SUFFIX.length && name.endsWith(COMPOSE_COMPONENT_FILE_SUFFIX)
}

/** 把显示名称规范化为组件文件名。 @public */
export function composeComponentFileName(displayName: string): string {
  const value = displayName.trim()
  return isComposeComponentFileName(value) ? value : `${value}${COMPOSE_COMPONENT_FILE_SUFFIX}`
}

/** 解析严格 Component Asset v1 文本。 @public */
export function parseComposeComponentAsset(text: string): ComposeComponentAssetParseResult {
  try {
    return validateAsset(JSON.parse(text) as unknown)
  }
  catch (error) {
    return {
      ok: false,
      issues: [{
        code: 'component-asset.invalid-json',
        path: [],
        message: `组件文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      }],
    }
  }
}

/** 序列化 Component Asset，并保持可读 diff。 @public */
export function serializeComposeComponentAsset(asset: ComposeComponentAssetV1): string {
  return `${JSON.stringify(asset, null, 2)}\n`
}

/** 显式把缺少 `kind` 的历史 v1 草案迁移为 Base。 @public */
export function migrateLegacyComposeComponentAsset(value: unknown): ComposeComponentAssetParseResult {
  if (!isRecord(value) || value.schemaVersion !== COMPOSE_COMPONENT_SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [{ code: 'component-asset.invalid-shape', path: [], message: '输入不是可迁移的历史组件草案' }],
    }
  }
  // 两类历史形状：缺少 kind 的旧草案，以及含已删除暴露属性的 Base。
  const migratable = value.kind === undefined || value.properties !== undefined
  if (!migratable) {
    return {
      ok: false,
      issues: [{ code: 'component-asset.invalid-shape', path: [], message: '输入不是可迁移的历史组件草案' }],
    }
  }
  const rest = { ...value }
  // 暴露属性已删除：迁移即丢弃该字段，文档内容不变。
  delete rest.properties
  return validateAsset({ ...rest, kind: value.kind ?? 'base' })
}

/** 在已解析对象边界重新执行严格校验。 @internal */
export function validateComposeComponentAssetValue(value: unknown): ComposeComponentAssetParseResult {
  return validateAsset(value)
}

/** 把 JSON 对象字段路径写入可变克隆。 @internal */
export function setComponentField(target: JsonObject, path: readonly string[], value: JsonValue): boolean {
  let current = target as unknown as Record<string, JsonValue>
  for (let index = 0; index < path.length - 1; index += 1) {
    const field = path[index]!
    const next = current[field]
    if (!isRecord(next)) return false
    current = next as unknown as Record<string, JsonValue>
  }
  current[path[path.length - 1]!] = structuredClone(value)
  return true
}

/** 从 JSON 对象移除字段路径。 @internal */
export function removeComponentField(target: JsonObject, path: readonly string[]): boolean {
  let current = target as unknown as Record<string, JsonValue>
  for (let index = 0; index < path.length - 1; index += 1) {
    const next = current[path[index]!]
    if (!isRecord(next)) return false
    current = next as unknown as Record<string, JsonValue>
  }
  const field = path[path.length - 1]!
  if (!(field in current)) return false
  delete current[field]
  return true
}
