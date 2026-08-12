import {
  applyComposeComponentOverrides,
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

/** 一个合法 component-instance Renderer 中的稳定资源、快照与当前层属性覆盖。 @public */
export interface ComposeComponentInstanceFacts {
  readonly reference: ComposeComponentReference
  readonly snapshot: ComposeResolvedComponentSnapshot
  readonly propertyOverrides: Readonly<Record<string, JsonValue>>
}

/** 读取关联组件实例事实；非实例或损坏数据返回 null。 @public */
export function readComposeComponentInstance(entity: ComposeEntity): ComposeComponentInstanceFacts | null {
  const renderer = entity.components.Renderer
  if (!renderer || renderer.type !== 'component-instance' || !isRecord(renderer.props)) return null
  const reference = renderer.props.reference
  const snapshot = renderer.props.resolvedSnapshot
  const propertyOverrides = renderer.props.propertyOverrides
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
    || !isRecord(propertyOverrides)
  ) return null
  return {
    reference: reference as ComposeComponentReference,
    snapshot: snapshot as unknown as ComposeResolvedComponentSnapshot,
    propertyOverrides: propertyOverrides as Readonly<Record<string, JsonValue>>,
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
  const overrides = propertyOperations(facts.snapshot, facts.propertyOverrides)
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

/** 实例属性 Apply 后由 Editor 在一个场景事务中写回的事实。 @public */
export interface ComposeInstancePropertyApplyResult {
  readonly source: ComposeComponentSnapshot
  readonly snapshot: ComposeResolvedComponentSnapshot
  readonly remainingPropertyOverrides: Readonly<Record<string, JsonValue>>
}

/** 组件实例显式更新的预览或可提交结果。 @public */
export type ComposeComponentInstanceUpdateResult =
  | {
      readonly status: 'updated'
      readonly snapshot: ComposeResolvedComponentSnapshot
      readonly propertyOverrides: Readonly<Record<string, JsonValue>>
      readonly discardedPropertyIds: readonly string[]
    }
  | {
      readonly status: 'conflict'
      readonly propertyIds: readonly string[]
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
  const definitions = new Map(resolved.snapshot.properties.map((definition) => [definition.id, definition]))
  const conflicts = Object.keys(facts.propertyOverrides).filter((id) => !definitions.has(id))
  const operations: ComposeComponentOverrideOperation[] = []
  for (const [id, value] of Object.entries(facts.propertyOverrides)) {
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
  const applied = applyComposeComponentOverrides(resolved.snapshot.document, operations)
  const operationConflicts = applied.ok
    ? []
    : applied.issues.flatMap(({ operationId }) => operationId
      ? [operationId.slice('instance-update:'.length)]
      : [])
  const conflictIds = [...new Set([...conflicts, ...operationConflicts])]
  if (conflictIds.length > 0 && !input.discardConflicts) {
    return {
      status: 'conflict',
      propertyIds: conflictIds,
      messages: conflictIds.map((id) => `公开属性 ${id} 已被来源删除或目标已变化`),
    }
  }
  const discarded = new Set(conflictIds)
  return {
    status: 'updated',
    snapshot: resolved.snapshot,
    propertyOverrides: Object.fromEntries(
      Object.entries(facts.propertyOverrides).filter(([id]) => !discarded.has(id)),
    ),
    discardedPropertyIds: conflictIds,
  }
}

/**
 * 只把实例公开属性覆盖写入直接来源；不接受实例内部结构操作。
 *
 * @remarks
 * 资源写入先发生。调用方随后应以单个场景事务写回新快照并消费返回的覆盖；场景事务失败时
 * 不回滚已写资源，与 Variant Apply 的 partial-success 顺序一致。
 *
 * @public
 */
export async function applyComposeInstancePropertyOverrides(input: {
  readonly store: ComposeComponentStore
  readonly entity: ComposeEntity
  readonly propertyIds?: readonly string[]
  readonly signal?: AbortSignal
}): Promise<ComposeInstancePropertyApplyResult> {
  const facts = readComposeComponentInstance(input.entity)
  if (!facts) throw new Error('选择不是有效的关联组件实例')
  if (facts.reference.providerId !== input.store.providerId) {
    throw new Error('实例来源与 Component Store Provider 不一致')
  }
  const operations = propertyOperations(
    facts.snapshot,
    facts.propertyOverrides,
    input.propertyIds,
  )
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
  const consumed = new Set(operations.map(({ id }) => id.slice('instance-apply:'.length)))
  return {
    source: written,
    snapshot: resolved.snapshot,
    remainingPropertyOverrides: Object.fromEntries(
      Object.entries(facts.propertyOverrides).filter(([id]) => !consumed.has(id)),
    ),
  }
}
