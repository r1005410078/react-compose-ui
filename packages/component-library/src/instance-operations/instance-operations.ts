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
    || !Array.isArray(snapshot.appliedLineage)
  ) return null
  const raw = renderer.props.instanceOverrides
  let overrides: ComposeComponentInstanceOverrides
  let migratedFromLegacy = false
  if (raw === undefined) {
    const legacy = renderer.props.propertyOverrides
    if (!isRecord(legacy)) return null
    overrides = migrateLegacyComposeInstanceOverrides(legacy)
    migratedFromLegacy = true
  }
  else {
    const parsed = parseComposeInstanceOverrides(raw)
    if (parsed.ok) overrides = parsed.overrides
    else if (isRecord(raw) && 'properties' in raw) {
      // 旧分区形状：属性覆盖需要 Base 定义才能还原字段目标，定义已随暴露属性一起删除，
      // 因此只能保留结构分区。这是删除暴露属性的已知有损点，见 update-component-instance-contract。
      overrides = migrateLegacyComposeInstanceOverrides(raw)
      migratedFromLegacy = true
    }
    else return null
  }
  return {
    reference: reference as ComposeComponentReference,
    snapshot: snapshot as unknown as ComposeResolvedComponentSnapshot,
    overrides,
    migratedFromLegacy,
  }
}

/** 从实例当前覆盖创建直接引用其来源的 Variant Asset v1。 @public */
export function createComposeVariantAssetFromInstance(input: {
  readonly entity: ComposeEntity
  readonly componentId: string
  readonly name: string
}): ComposeVariantComponentAsset {
  const facts = readComposeComponentInstance(input.entity)
  if (!facts) throw new Error('选择不是有效的关联组件实例')
  const overrides = facts.overrides.operations
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
      readonly discardedOperationIds: readonly string[]
    }
  | {
      readonly status: 'conflict'
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

  if (conflictOperationIds.length > 0 && !input.discardConflicts) {
    return {
      status: 'conflict',
      operationIds: conflictOperationIds,
      messages: conflictOperationIds.map((id) => `结构操作 ${id} 的目标在最新来源中已不存在`),
    }
  }
  return {
    status: 'updated',
    snapshot: resolved.snapshot,
    overrides: { operations: compatibleOperations },
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
 * @param input.operationIds - 限定本次消费的结构操作 ID；省略表示全部
 *
 * @public
 */
export async function applyComposeInstanceOverrides(input: {
  readonly store: ComposeComponentStore
  readonly entity: ComposeEntity
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
  const operations = structural
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
  const consumedOperations = new Set(structural.map(({ id }) => id))
  return {
    source: written,
    snapshot: resolved.snapshot,
    remainingOverrides: {
      operations: facts.overrides.operations.filter(({ id }) => !consumedOperations.has(id)),
    },
  }
}
