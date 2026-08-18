import { validateComposeDocument } from '../document'
import type { ComposeDocument, JsonObject, JsonValue } from '../document-types'
import { isComposeComponentKey } from '../entity'
import { isComposeFrameEntity } from '../frame'
import { migrateComposeDocumentV6ToV7 } from '../migration'
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
  // v2 起根还必须是 Frame——组件实例的尺寸事实来源就是组件根的 Frame.size，且 Frame 是
  // 实例内部的坐标、布局、裁剪、动画与脚本作用域边界。
  const rootId = result.document.rootIds[0]
  if (result.document.rootIds.length !== 1 || !rootId) {
    issue(issues, 'component-asset.invalid-root', [...path, 'rootIds'], '组件文档必须只有一个根')
    return false
  }
  // 文档层已经拒绝了非 Frame 根（`document.root-not-frame`），这里是解析边界的兜底：
  // 它保证即使未来放宽文档层约束，组件资产仍然只接受 Frame 根。
  if (!isComposeFrameEntity(result.document.entities[rootId])) {
    issue(issues, 'component-asset.invalid-root', [...path, 'rootIds', 0], '组件文档的根必须是 Frame')
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

/**
 * 把 v1 组件文档的单根提升为 Frame。
 *
 * @remarks
 * 原根已经是 Frame 时原地通过——这样"容器早就升格过"的组件不会被多包一层。否则包一层新的
 * Frame，尺寸取原根 LayoutItem 的 fixed fallback，原根成为它的唯一子级。
 */
function ensureFrameRoot(document: unknown): unknown {
  if (!isRecord(document)) return document
  const entities = document.entities
  const rootIds = document.rootIds
  if (!isRecord(entities) || !Array.isArray(rootIds) || rootIds.length !== 1) return document
  const rootId = rootIds[0]
  if (typeof rootId !== 'string') return document
  const root = entities[rootId]
  if (!isRecord(root) || !isRecord(root.components)) return document
  if (root.components.Frame !== undefined) return document

  const item = root.components.LayoutItem
  const axis = (key: 'width' | 'height', fallback: number) => {
    const value = isRecord(item) && isRecord(item[key]) ? (item[key] as Record<string, unknown>).value : undefined
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
  }
  const size = { width: axis('width', 100), height: axis('height', 100) }
  const frameId = entities['frame-root'] === undefined ? 'frame-root' : `frame-root-${rootId}`
  return {
    ...document,
    rootIds: [frameId],
    entities: {
      ...entities,
      [frameId]: {
        id: frameId,
        name: typeof root.name === 'string' ? root.name : frameId,
        components: {
          Composition: {
            presetId: 'frame',
            baseComponentKeys: [
              'Composition',
              'Transform',
              'LayoutItem',
              'Visibility',
              'Lock',
              'Hierarchy',
              'Frame',
              'Appearance',
            ],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: size.width, min: 1, max: null },
            height: { mode: 'fixed', value: size.height, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: [rootId] },
          Frame: { size, guides: [] },
          Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        },
      },
    },
  }
}

/**
 * 显式迁移历史组件文件。
 *
 * @remarks
 * 覆盖三类历史形状：`schemaVersion: 1`、缺少 `kind` 的旧草案，以及含已删除暴露属性的 Base。
 * v1→v2 还负责把文档提升到 ComposeDocument v7 并保证单根是 Frame。迁移不修改输入。
 *
 * @public
 */
export function migrateLegacyComposeComponentAsset(value: unknown): ComposeComponentAssetParseResult {
  const invalid: ComposeComponentAssetParseResult = {
    ok: false,
    issues: [{ code: 'component-asset.invalid-shape', path: [], message: '输入不是可迁移的历史组件草案' }],
  }
  if (!isRecord(value)) return invalid
  const legacyVersion = value.schemaVersion === 1
  if (!legacyVersion && value.schemaVersion !== COMPOSE_COMPONENT_SCHEMA_VERSION) return invalid
  if (!legacyVersion && value.kind !== undefined && value.properties === undefined) return invalid

  const rest = { ...structuredClone(value) } as Record<string, unknown>
  // 暴露属性已删除：迁移即丢弃该字段，文档内容不变。
  delete rest.properties
  let document = rest.document
  if (isRecord(document) && document.schemaVersion === 6) {
    const migrated = migrateComposeDocumentV6ToV7(document)
    if (!migrated.ok) {
      return {
        ok: false,
        issues: migrated.issues.map((candidate) => ({
          code: 'component-asset.invalid-document',
          path: ['document', ...candidate.path],
          message: candidate.message,
        })),
      }
    }
    document = migrated.document
  }
  return validateAsset({
    ...rest,
    schemaVersion: COMPOSE_COMPONENT_SCHEMA_VERSION,
    kind: rest.kind ?? 'base',
    document: ensureFrameRoot(document),
  })
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
