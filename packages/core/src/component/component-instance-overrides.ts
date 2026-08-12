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
 * 结构操作与 Variant 共用同一套操作代数，因此 Apply 到直接父源时可以原样并入，无需有损转换。
 * 属性覆盖保持独立分区：property ID 是 Base 声明的稳定契约，与内部实体字段路径的生命周期
 * 和冲突判定规则都不同，合并成一个分区会让二者的失效判定互相污染。
 *
 * @public
 */
export interface ComposeComponentInstanceOverrides {
  /** 稳定 property ID 到 JSON 值的覆盖。 */
  readonly properties: Readonly<Record<string, JsonValue>>
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
 * 缺少 `properties`/`operations` 分区的对象一律判为未迁移的旧 `propertyOverrides`，
 * 不静默接受；调用方必须显式走 {@link migrateLegacyComposeInstanceOverrides}。
 *
 * @public
 */
export function parseComposeInstanceOverrides(value: unknown): ComposeInstanceOverridesParseResult {
  if (!isRecord(value)) {
    return { ok: false, issues: [issue('component-asset.invalid-shape', 'instanceOverrides 必须是对象')] }
  }
  if (!('properties' in value) || !('operations' in value)) {
    return {
      ok: false,
      issues: [issue(
        'component-asset.legacy',
        'instanceOverrides 缺少 properties/operations 分区，疑似未迁移的 propertyOverrides',
      )],
    }
  }
  const { properties, operations } = value
  if (!isRecord(properties)) {
    return {
      ok: false,
      issues: [issue('component-asset.invalid-shape', 'properties 必须是对象', ['instanceOverrides', 'properties'])],
    }
  }
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
  return {
    ok: true,
    overrides: {
      properties: properties as Readonly<Record<string, JsonValue>>,
      operations: operations as readonly ComposeComponentOverrideOperation[],
    },
  }
}

/**
 * 把旧 `propertyOverrides` 显式迁移为分区形式。
 *
 * @remarks
 * 纯迁移：结构分区为空，渲染输出逐字节不变。
 *
 * @public
 */
export function migrateLegacyComposeInstanceOverrides(
  legacy: Readonly<Record<string, JsonValue>>,
): ComposeComponentInstanceOverrides {
  return { properties: { ...legacy }, operations: [] }
}

/**
 * 按 结构操作 → 属性覆盖 的固定顺序解析实例覆盖。
 *
 * @remarks
 * 结构必须先成型，属性覆盖才能命中由结构操作新建的目标；顺序颠倒会让合法覆盖失败。
 * 任一阶段失败都不返回半应用文档。
 *
 * @public
 */
export function resolveComposeInstanceOverrides(input: {
  readonly document: ComposeDocument
  readonly properties: readonly ComposeComponentPropertyDefinition[]
  readonly overrides: ComposeComponentInstanceOverrides
}): ComposeInstanceOverridesResolveResult {
  const structural = applyComposeComponentOverrides(input.document, input.overrides.operations)
  if (!structural.ok) return structural
  const definitions = new Map(input.properties.map((definition) => [definition.id, definition]))
  const propertyOperations: ComposeComponentOverrideOperation[] = []
  for (const [propertyId, value] of Object.entries(input.overrides.properties)) {
    const definition = definitions.get(propertyId)
    if (!definition) {
      return {
        ok: false,
        issues: [issue(
          'component-asset.invalid-property',
          `实例覆盖 ${propertyId} 不是来源公开属性`,
          ['instanceOverrides', 'properties', propertyId],
        )],
      }
    }
    propertyOperations.push({
      id: `instance-property:${propertyId}`,
      kind: 'set-field',
      entityId: definition.target.entityId,
      componentKey: definition.target.componentKey,
      fieldPath: definition.target.fieldPath,
      value: structuredClone(value),
    })
  }
  return applyComposeComponentOverrides(structural.document, propertyOperations)
}
