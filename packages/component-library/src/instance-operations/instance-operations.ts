import {
  applyComposeComponentOverrides,
  migrateLegacyComposeInstanceOverrides,
  parseComposeInstanceOverrides,
  type ComposeComponentInstanceOverrides,
  type ComposeComponentOverrideOperation,
  type ComposeComponentReference,
  type ComposeEntity,
  type ComposeResolvedComponentSnapshot,
  type ComposeVariantComponentAsset,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '../component-store'
import { createComposeVariantAsset } from '../variant-operations'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 一个合法 component-instance Renderer 中的稳定资源、快照与当前层覆盖。 @public */
export interface ComposeComponentInstanceFacts {
  readonly reference: ComposeComponentReference
  readonly snapshot: ComposeResolvedComponentSnapshot
  readonly overrides: ComposeComponentInstanceOverrides
  /**
   * 该实体仍是旧 `propertyOverrides` 形状，本次读取经过显式迁移。
   *
   * @remarks
   * 宿主可据此在下一次写入时把实体落盘为分区形状；读取本身不改写文档。
   */
  readonly migratedFromLegacy: boolean
}

/**
 * 读取关联组件实例事实；非实例或损坏数据返回 null。
 *
 * @remarks
 * 优先按分区形状解析 `instanceOverrides`。仅当实体完全没有该字段时，才对旧
 * `propertyOverrides` 调用显式迁移并置位 {@link ComposeComponentInstanceFacts.migratedFromLegacy}；
 * 形状损坏的 `instanceOverrides` 一律判为无效，不回退到旧字段。
 *
 * @public
 */
export function readComposeComponentInstance(entity: ComposeEntity): ComposeComponentInstanceFacts | null {
  const renderer = entity.components.Renderer
  if (!renderer || renderer.type !== 'component-instance' || !isRecord(renderer.props)) return null
  const reference = renderer.props.reference
  const snapshot = renderer.props.resolvedSnapshot
  if (
    !isRecord(reference)
    || reference.kind !== 'component'
    || typeof reference.providerId !== 'string'
    || typeof reference.assetKey !== 'string'
    || (reference.scope !== 'persistent' && reference.scope !== 'session')
    || !isRecord(snapshot)
    || !isRecord(snapshot.document)
    || !Array.isArray(snapshot.properties)
    || !Array.isArray(snapshot.appliedLineage)
  ) return null
  const raw = renderer.props.instanceOverrides
  let overrides: ComposeComponentInstanceOverrides
  let migratedFromLegacy = false
  if (raw === undefined) {
    const legacy = renderer.props.propertyOverrides
    if (!isRecord(legacy)) return null
    overrides = migrateLegacyComposeInstanceOverrides(legacy as Readonly<Record<string, JsonValue>>)
    migratedFromLegacy = true
  }
  else {
    const parsed = parseComposeInstanceOverrides(raw)
    if (!parsed.ok) return null
    overrides = parsed.overrides
  }
  return {
    reference: reference as ComposeComponentReference,
    snapshot: snapshot as unknown as ComposeResolvedComponentSnapshot,
    overrides,
    migratedFromLegacy,
  }
}

function propertyOperations(
  snapshot: ComposeResolvedComponentSnapshot,
  overrides: Readonly<Record<string, JsonValue>>,
  propertyIds?: readonly string[],
): readonly ComposeComponentOverrideOperation[] {
  const selected = propertyIds ? new Set(propertyIds) : null
  const definitions = new Map(snapshot.properties.map((definition) => [definition.id, definition]))
  return Object.entries(overrides).flatMap(([propertyId, value]) => {
    if (selected && !selected.has(propertyId)) return []
    const definition = definitions.get(propertyId)
    if (!definition) throw new Error(`实例覆盖 ${propertyId} 不是来源公开属性`)
    return [{
      id: `instance-apply:${propertyId}`,
      kind: 'set-field',
      entityId: definition.target.entityId,
      componentKey: definition.target.componentKey,
      fieldPath: definition.target.fieldPath,
      value: structuredClone(value),
    } satisfies ComposeComponentOverrideOperation]
  })
}

/** 从实例公开属性覆盖创建直接引用其来源的 Variant Asset v1。 @public */
export function createComposeVariantAssetFromInstance(input: {
  readonly entity: ComposeEntity
  readonly componentId: string
  readonly name: string
}): ComposeVariantComponentAsset {
  const facts = readComposeComponentInstance(input.entity)
  if (!facts) throw new Error('选择不是有效的关联组件实例')
  const overrides = propertyOperations(facts.snapshot, facts.overrides.properties)
  const applied = applyComposeComponentOverrides(facts.snapshot.document, overrides)
  if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
  const asset = createComposeVariantAsset({
    componentId: input.componentId,
    name: input.name,
    parentRef: facts.reference,
    parentSnapshot: facts.snapshot,
  })
  return {
    ...asset,
    overrides,
    resolvedSnapshot: {
      ...asset.resolvedSnapshot,
      document: applied.document,
    },
  }
}

/** 组件实例显式更新的预览或可提交结果。 @public */
export type ComposeComponentInstanceUpdateResult =
  | {
      readonly status: 'updated'
      readonly snapshot: ComposeResolvedComponentSnapshot
      /** 更新后仍然兼容、应写回实例的完整覆盖。 */
      readonly overrides: ComposeComponentInstanceOverrides
      readonly discardedPropertyIds: readonly string[]
      readonly discardedOperationIds: readonly string[]
    }
  | {
      readonly status: 'conflict'
      readonly propertyIds: readonly string[]
      /** 锚点在最新父链中失效的结构操作。 */
      readonly operationIds: readonly string[]
      readonly messages: readonly string[]
    }

/**
 * 读取实例直接来源的最新快照并预览属性覆盖冲突；不修改场景。
 *
 * @public
 */
export async function updateComposeComponentInstanceFromSource(input: {
  readonly store: ComposeComponentStore
  readonly entity: ComposeEntity
  readonly discardConflicts?: boolean
  readonly signal?: AbortSignal
}): Promise<ComposeComponentInstanceUpdateResult> {
  const facts = readComposeComponentInstance(input.entity)
  if (!facts) throw new Error('选择不是有效的关联组件实例')
  const resolved = await input.store.resolveComponent(facts.reference, input.signal)
  if (resolved.status === 'invalid') {
    throw new Error(resolved.issues.map(({ message }) => message).join('；'))
  }

  // 结构操作先逐条在最新来源文档上试应用，锚点失效的直接列为冲突；不这样做的话失效操作
  // 会留到渲染期才以「实例覆盖无效」的形式整体失败，用户无从知道是哪一条。
  const compatibleOperations: ComposeComponentOverrideOperation[] = []
  const conflictOperationIds: string[] = []
  let structuralDocument = resolved.snapshot.document
  for (const operation of facts.overrides.operations) {
    const attempt = applyComposeComponentOverrides(structuralDocument, [operation])
    if (attempt.ok) {
      structuralDocument = attempt.document
      compatibleOperations.push(operation)
    }
    else conflictOperationIds.push(operation.id)
  }

  const definitions = new Map(resolved.snapshot.properties.map((definition) => [definition.id, definition]))
  const conflicts = Object.keys(facts.overrides.properties).filter((id) => !definitions.has(id))
  const operations: ComposeComponentOverrideOperation[] = []
  for (const [id, value] of Object.entries(facts.overrides.properties)) {
    const definition = definitions.get(id)
    if (!definition) continue
    operations.push({
      id: `instance-update:${id}`,
      kind: 'set-field',
      entityId: definition.target.entityId,
      componentKey: definition.target.componentKey,
      fieldPath: definition.target.fieldPath,
      value: structuredClone(value),
    })
  }
  // 属性覆盖作用在结构操作之后的文档上，与解析顺序一致。
  const applied = applyComposeComponentOverrides(structuralDocument, operations)
  const operationConflicts = applied.ok
    ? []
    : applied.issues.flatMap(({ operationId }) => operationId
      ? [operationId.slice('instance-update:'.length)]
      : [])
  const conflictIds = [...new Set([...conflicts, ...operationConflicts])]
  if ((conflictIds.length > 0 || conflictOperationIds.length > 0) && !input.discardConflicts) {
    return {
      status: 'conflict',
      propertyIds: conflictIds,
      operationIds: conflictOperationIds,
      messages: [
        ...conflictIds.map((id) => `公开属性 ${id} 已被来源删除或目标已变化`),
        ...conflictOperationIds.map((id) => `结构操作 ${id} 的目标在最新来源中已不存在`),
      ],
    }
  }
  const discarded = new Set(conflictIds)
  return {
    status: 'updated',
    snapshot: resolved.snapshot,
    overrides: {
      properties: Object.fromEntries(
        Object.entries(facts.overrides.properties).filter(([id]) => !discarded.has(id)),
      ),
      operations: compatibleOperations,
    },
    discardedPropertyIds: conflictIds,
    discardedOperationIds: conflictOperationIds,
  }
}

/** 实例覆盖 Apply 后由 Editor 在一个场景事务中写回的事实。 @public */
export interface ComposeInstanceApplyResult {
  readonly source: ComposeComponentSnapshot
  readonly snapshot: ComposeResolvedComponentSnapshot
  /** 未被本次 Apply 消费、仍留在实例层的覆盖。 */
  readonly remainingOverrides: ComposeComponentInstanceOverrides
}

/**
 * 把实例的属性覆盖与结构操作写入直接来源。
 *
 * @remarks
 * 结构操作与属性覆盖共用同一套操作代数，因此 Apply 到 Variant 父源时可以原样并入其操作
 * 列表，不需要有损转换；父源是 Base 时由同一 Applier 落到 Base 文档。结构操作排在属性
 * 覆盖之前，与解析顺序一致。
 *
 * 资源写入先发生。调用方随后应以单个场景事务写回新快照并消费返回的覆盖；场景事务失败时
 * 不回滚已写资源，与 Variant Apply 的 partial-success 顺序一致。
 *
 * @param input.propertyIds - 限定本次消费的属性 ID；省略表示全部
 * @param input.operationIds - 限定本次消费的结构操作 ID；省略表示全部
 *
 * @public
 */
export async function applyComposeInstanceOverrides(input: {
  readonly store: ComposeComponentStore
  readonly entity: ComposeEntity
  readonly propertyIds?: readonly string[]
  readonly operationIds?: readonly string[]
  readonly signal?: AbortSignal
}): Promise<ComposeInstanceApplyResult> {
  const facts = readComposeComponentInstance(input.entity)
  if (!facts) throw new Error('选择不是有效的关联组件实例')
  if (facts.reference.providerId !== input.store.providerId) {
    throw new Error('实例来源与 Component Store Provider 不一致')
  }
  const selectedOperationIds = input.operationIds ? new Set(input.operationIds) : null
  const structural = facts.overrides.operations.filter(
    ({ id }) => !selectedOperationIds || selectedOperationIds.has(id),
  )
  const properties = propertyOperations(
    facts.snapshot,
    facts.overrides.properties,
    input.propertyIds,
  )
  // 结构先于属性，与 resolveComposeInstanceOverrides 的解析顺序保持一致。
  const operations = [...structural, ...properties]
  if (operations.length === 0) {
    return {
      source: await input.store.readComponent(facts.reference.assetKey, input.signal),
      snapshot: facts.snapshot,
      remainingOverrides: facts.overrides,
    }
  }
  const source = await input.store.readComponent(facts.reference.assetKey, input.signal)
  let next: typeof source.asset
  if (source.asset.kind === 'base') {
    const applied = applyComposeComponentOverrides(source.asset.document, operations)
    if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
    next = { ...source.asset, document: applied.document }
  }
  else {
    const resolved = await input.store.resolveComponent(facts.reference, input.signal)
    if (resolved.status === 'invalid') {
      throw new Error(resolved.issues.map(({ message }) => message).join('；'))
    }
    const applied = applyComposeComponentOverrides(resolved.snapshot.document, operations)
    if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
    const existingIds = new Set(source.asset.overrides.map(({ id }) => id))
    const uniqueOperations = operations.map((operation) => {
      const baseId = operation.id
      let id = baseId
      let suffix = 2
      while (existingIds.has(id)) {
        id = `${baseId}:${suffix}`
        suffix += 1
      }
      existingIds.add(id)
      return { ...operation, id }
    })
    next = {
      ...source.asset,
      overrides: [...source.asset.overrides, ...uniqueOperations],
      resolvedSnapshot: { ...resolved.snapshot, document: applied.document },
    }
  }
  const written = await input.store.saveComponent(
    source.assetKey,
    next,
    source.revision,
    false,
    input.signal,
  )
  const resolved = await input.store.resolveComponent(facts.reference, input.signal)
  if (resolved.status === 'invalid') {
    throw new Error(resolved.issues.map(({ message }) => message).join('；'))
  }
  const consumedProperties = new Set(
    properties.map(({ id }) => id.slice('instance-apply:'.length)),
  )
  const consumedOperations = new Set(structural.map(({ id }) => id))
  return {
    source: written,
    snapshot: resolved.snapshot,
    remainingOverrides: {
      properties: Object.fromEntries(
        Object.entries(facts.overrides.properties).filter(([id]) => !consumedProperties.has(id)),
      ),
      operations: facts.overrides.operations.filter(({ id }) => !consumedOperations.has(id)),
    },
  }
}
