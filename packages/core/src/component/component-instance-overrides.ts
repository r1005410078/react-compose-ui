import type { ComposeDocument, JsonValue } from '../document-types'
import { applyComposeComponentOverrides } from './component-overrides'
import type {
  ComposeComponentAssetIssue,
  ComposeComponentOverrideOperation,
  ComposeComponentPropertyDefinition,
} from './component-types'

/**
 * `component-instance` 持久化的分层覆盖。
 *
 * @remarks
 * 只有一个结构操作分区：实例内部字段可以直接覆盖，因此不再需要与之并行的暴露属性机制。
 * 操作与 Variant 共用同一套代数，Apply 到直接父源时可以原样并入，无需有损转换。
 *
 * @public
 */
export interface ComposeComponentInstanceOverrides {
  /** 与 Variant 同构的稳定结构操作，按顺序应用。 */
  readonly operations: readonly ComposeComponentOverrideOperation[]
}

/** instanceOverrides 解析结果。 @public */
export type ComposeInstanceOverridesParseResult =
  | { readonly ok: true; readonly overrides: ComposeComponentInstanceOverrides }
  | { readonly ok: false; readonly issues: readonly ComposeComponentAssetIssue[] }

/** 实例覆盖解析结果。 @public */
export type ComposeInstanceOverridesResolveResult =
  | { readonly ok: true; readonly document: ComposeDocument }
  | { readonly ok: false; readonly issues: readonly ComposeComponentAssetIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function issue(
  code: ComposeComponentAssetIssue['code'],
  message: string,
  path: readonly (string | number)[] = ['instanceOverrides'],
): ComposeComponentAssetIssue {
  return { code, path, message }
}

/**
 * 严格解析 `instanceOverrides`。
 *
 * @remarks
 * 缺少 `operations` 的对象判为未迁移的旧 `propertyOverrides`；仍带 `properties` 分区的对象判为
 * 未迁移的旧分区形状。两者都不静默接受，必须显式走
 * {@link migrateLegacyComposeInstanceOverrides}。
 *
 * @public
 */
export function parseComposeInstanceOverrides(value: unknown): ComposeInstanceOverridesParseResult {
  if (!isRecord(value)) {
    return { ok: false, issues: [issue('component-asset.invalid-shape', 'instanceOverrides 必须是对象')] }
  }
  if (!('operations' in value)) {
    return {
      ok: false,
      issues: [issue(
        'component-asset.legacy',
        'instanceOverrides 缺少 operations 分区，疑似未迁移的 propertyOverrides',
      )],
    }
  }
  if ('properties' in value) {
    return {
      ok: false,
      issues: [issue(
        'component-asset.legacy',
        'instanceOverrides 仍含已删除的 properties 分区，需要显式迁移',
        ['instanceOverrides', 'properties'],
      )],
    }
  }
  const { operations } = value
  if (!Array.isArray(operations)) {
    return {
      ok: false,
      issues: [issue('component-asset.invalid-shape', 'operations 必须是数组', ['instanceOverrides', 'operations'])],
    }
  }
  const invalid = operations.findIndex(
    (operation) => !isRecord(operation) || typeof operation.id !== 'string' || typeof operation.kind !== 'string',
  )
  if (invalid !== -1) {
    return {
      ok: false,
      issues: [issue(
        'component-asset.invalid-operation',
        '结构操作缺少稳定 id 或 kind',
        ['instanceOverrides', 'operations', invalid],
      )],
    }
  }
  return { ok: true, overrides: { operations: operations as readonly ComposeComponentOverrideOperation[] } }
}

/**
 * 把旧实例覆盖显式迁移为只含结构操作的形式。
 *
 * @remarks
 * 接受两种旧形状：扁平的 `propertyOverrides` 映射，以及含 `properties` 分区的对象。每条属性覆盖
 * 按其定义的 target 转换为等价 `set-field` 操作，因此渲染输出不变；已有结构操作排在其后，保持
 * 「结构先于属性」的原解析顺序。
 *
 * @param legacy - 旧覆盖数据
 * @param definitions - 旧 Base 声明的暴露属性定义，用于把 property ID 还原为字段目标
 *
 * @public
 */
export function migrateLegacyComposeInstanceOverrides(
  legacy: Readonly<Record<string, unknown>>,
  definitions: readonly ComposeComponentPropertyDefinition[] = [],
): ComposeComponentInstanceOverrides {
  const existing = Array.isArray(legacy.operations)
    ? legacy.operations as readonly ComposeComponentOverrideOperation[]
    : []
  const properties = isRecord(legacy.properties)
    ? legacy.properties as Readonly<Record<string, JsonValue>>
    : 'operations' in legacy || 'properties' in legacy
      ? {}
      : legacy as Readonly<Record<string, JsonValue>>
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const migrated: ComposeComponentOverrideOperation[] = []
  for (const [propertyId, value] of Object.entries(properties)) {
    const definition = byId.get(propertyId)
    // 定义缺失时无法还原字段目标，只能丢弃：保留一条无目标的覆盖会在解析期整体失败。
    if (!definition) continue
    migrated.push({
      id: `migrated-property:${propertyId}`,
      kind: 'set-field',
      entityId: definition.target.entityId,
      componentKey: definition.target.componentKey,
      fieldPath: definition.target.fieldPath,
      value: structuredClone(value),
    })
  }
  return { operations: [...migrated, ...existing] }
}

/**
 * 按实例结构操作解析组件文档。
 *
 * @remarks
 * 失败时不返回半应用文档。
 *
 * @public
 */
export function resolveComposeInstanceOverrides(input: {
  readonly document: ComposeDocument
  readonly overrides: ComposeComponentInstanceOverrides
}): ComposeInstanceOverridesResolveResult {
  return applyComposeComponentOverrides(input.document, input.overrides.operations)
}
