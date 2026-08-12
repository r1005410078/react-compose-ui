import {
  applyComposeComponentOverrides,
  planComposeComponentRevert,
  type ComposeComponentOverrideOperation,
  type ComposeComponentReference,
  type ComposeResolvedComponentSnapshot,
  type ComposeVariantComponentAsset,
} from '@compose-ui/core'
import type {
  ComposeComponentSnapshot,
  ComposeComponentStore,
} from '../component-store'

/** Apply 的顺序化结果；partial-success 表示父源已写入，当前层仍保留覆盖。 @public */
export type ComposeVariantApplyResult =
  | {
      readonly status: 'applied'
      readonly parent: ComposeComponentSnapshot
      readonly variant: ComposeComponentSnapshot
    }
  | { readonly status: 'failed'; readonly error: Error }
  | {
      readonly status: 'partial-success'
      readonly parent: ComposeComponentSnapshot
      readonly variant: ComposeComponentSnapshot
      readonly error: Error
    }

/** Revert 的结果；依赖新增子树的操作必须先确认。 @public */
export type ComposeVariantRevertResult =
  | { readonly status: 'reverted'; readonly variant: ComposeComponentSnapshot }
  | { readonly status: 'confirmation-required'; readonly dependentOperationIds: readonly string[] }
  | { readonly status: 'failed'; readonly error: Error }

/** 显式更新父快照的结果。 @public */
export type ComposeVariantUpdateResult =
  | { readonly status: 'updated'; readonly variant: ComposeComponentSnapshot; readonly discardedOperationIds: readonly string[] }
  | { readonly status: 'conflict'; readonly operationIds: readonly string[]; readonly messages: readonly string[] }
  | { readonly status: 'failed'; readonly error: Error }

function errorOf(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

function variantSnapshot(
  asset: ComposeVariantComponentAsset,
  reference: ComposeComponentReference,
  revision: string,
  parent: ComposeResolvedComponentSnapshot,
  document: ComposeResolvedComponentSnapshot['document'],
): ComposeResolvedComponentSnapshot {
  return {
    componentId: asset.componentId,
    kind: 'variant',
    revision,
    document,
    appliedLineage: [
      ...parent.appliedLineage,
      {
        reference,
        componentId: asset.componentId,
        kind: 'variant',
        revision,
      },
    ],
  }
}

async function resolveParent(
  store: ComposeComponentStore,
  reference: ComposeComponentReference,
  signal?: AbortSignal,
) {
  const result = await store.resolveComponent(reference, signal)
  if (result.status === 'invalid') {
    throw new Error(result.issues.map(({ message }) => message).join('；'))
  }
  return result.snapshot
}

function appliedIds(
  overrides: readonly ComposeComponentOverrideOperation[],
  operationIds: readonly string[] | undefined,
) {
  const selected = operationIds ? new Set(operationIds) : null
  return overrides.filter((operation) => !selected || selected.has(operation.id))
}

function withParentOperations(
  parent: ComposeComponentSnapshot,
  operations: readonly ComposeComponentOverrideOperation[],
) {
  const existingIds = new Set(
    parent.asset.kind === 'variant' ? parent.asset.overrides.map(({ id }) => id) : [],
  )
  const normalized = operations.map((operation) => {
    const baseId = `apply:${operation.id}`
    let id = baseId
    let suffix = 2
    while (existingIds.has(id)) {
      id = `${baseId}:${suffix}`
      suffix += 1
    }
    existingIds.add(id)
    return { ...structuredClone(operation), id }
  })
  if (parent.asset.kind === 'base') {
    const applied = applyComposeComponentOverrides(parent.asset.document, normalized)
    if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
    return { ...parent.asset, document: applied.document }
  }
  const applied = applyComposeComponentOverrides(parent.asset.resolvedSnapshot.document, normalized)
  if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
  return {
    ...parent.asset,
    overrides: [...parent.asset.overrides, ...normalized],
    resolvedSnapshot: {
      ...parent.asset.resolvedSnapshot,
      document: applied.document,
    },
  }
}

/**
 * 把当前 Variant 的指定覆盖先写入直接父源，再消费当前层覆盖并保存当前层。
 *
 * @remarks
 * 父源写入后绝不自动回滚。当前层解析或保存失败返回 `partial-success`，原 Variant 文件仍
 * 保留覆盖和旧快照，因此视觉不丢失，并可由 UI 标记 pending update。
 *
 * @public
 */
export async function applyComposeVariantOverrides(input: {
  readonly store: ComposeComponentStore
  readonly assetKey: string
  readonly operationIds?: readonly string[]
  readonly signal?: AbortSignal
}): Promise<ComposeVariantApplyResult> {
  let variant: ComposeComponentSnapshot
  let parent: ComposeComponentSnapshot
  try {
    variant = await input.store.readComponent(input.assetKey, input.signal)
    if (variant.asset.kind !== 'variant') throw new Error('只有 Variant 可以 Apply 到直接父源')
    parent = await input.store.readComponent(variant.asset.parentRef.assetKey, input.signal)
  }
  catch (error) {
    return { status: 'failed', error: errorOf(error) }
  }
  const selected = appliedIds(variant.asset.overrides, input.operationIds)
  const selectedIds = new Set(selected.map(({ id }) => id))
  let savedParent: ComposeComponentSnapshot
  try {
    savedParent = await input.store.saveComponent(
      parent.assetKey,
      withParentOperations(parent, selected),
      parent.revision,
      false,
      input.signal,
    )
  }
  catch (error) {
    return { status: 'failed', error: errorOf(error) }
  }

  try {
    const parentSnapshot = await resolveParent(input.store, variant.asset.parentRef, input.signal)
    const remaining = variant.asset.overrides.filter(({ id }) => !selectedIds.has(id))
    const applied = applyComposeComponentOverrides(parentSnapshot.document, remaining)
    if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
    const reference = input.store.createReference(variant.assetKey)
    const nextAsset: ComposeVariantComponentAsset = {
      ...variant.asset,
      appliedLineage: structuredClone(parentSnapshot.appliedLineage),
      overrides: remaining,
      resolvedSnapshot: variantSnapshot(
        variant.asset,
        reference,
        variant.revision,
        parentSnapshot,
        applied.document,
      ),
    }
    const savedVariant = await input.store.saveComponent(
      variant.assetKey,
      nextAsset,
      variant.revision,
      false,
      input.signal,
    )
    return { status: 'applied', parent: savedParent, variant: savedVariant }
  }
  catch (error) {
    return {
      status: 'partial-success',
      parent: savedParent,
      variant,
      error: errorOf(error),
    }
  }
}

/** 只删除当前 Variant 层的指定覆盖，并在一次 revision 写入中更新离线快照。 @public */
export async function revertComposeVariantOverrides(input: {
  readonly store: ComposeComponentStore
  readonly assetKey: string
  readonly operationIds: readonly string[]
  readonly confirmDependencies?: boolean
  readonly signal?: AbortSignal
}): Promise<ComposeVariantRevertResult> {
  try {
    const variant = await input.store.readComponent(input.assetKey, input.signal)
    if (variant.asset.kind !== 'variant') throw new Error('只有 Variant 可以 Revert 覆盖')
    const plan = planComposeComponentRevert({
      overrides: variant.asset.overrides,
      operationIds: input.operationIds,
      confirmDependencies: input.confirmDependencies,
    })
    if (plan.requiresConfirmation) {
      return {
        status: 'confirmation-required',
        dependentOperationIds: plan.dependentOperationIds,
      }
    }
    const parentSnapshot = await resolveParent(input.store, variant.asset.parentRef, input.signal)
    const applied = applyComposeComponentOverrides(parentSnapshot.document, plan.overrides)
    if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
    const reference = input.store.createReference(variant.assetKey)
    const next: ComposeVariantComponentAsset = {
      ...variant.asset,
      appliedLineage: structuredClone(parentSnapshot.appliedLineage),
      overrides: plan.overrides,
      resolvedSnapshot: variantSnapshot(
        variant.asset,
        reference,
        variant.revision,
        parentSnapshot,
        applied.document,
      ),
    }
    return {
      status: 'reverted',
      variant: await input.store.saveComponent(
        variant.assetKey,
        next,
        variant.revision,
        false,
        input.signal,
      ),
    }
  }
  catch (error) {
    return { status: 'failed', error: errorOf(error) }
  }
}

/**
 * 显式采用直接父源的最新快照；有冲突时先返回列表，确认后才丢弃冲突操作并一次保存。
 *
 * @public
 */
export async function updateComposeVariantFromParent(input: {
  readonly store: ComposeComponentStore
  readonly assetKey: string
  readonly discardConflicts?: boolean
  readonly signal?: AbortSignal
}): Promise<ComposeVariantUpdateResult> {
  try {
    const variant = await input.store.readComponent(input.assetKey, input.signal)
    if (variant.asset.kind !== 'variant') throw new Error('只有 Variant 可以更新父快照')
    const parentSnapshot = await resolveParent(input.store, variant.asset.parentRef, input.signal)
    let overrides = variant.asset.overrides
    let applied = applyComposeComponentOverrides(parentSnapshot.document, overrides)
    const conflicts = applied.ok ? [] : applied.issues
    const conflictIds = [...new Set(conflicts.flatMap(({ operationId }) => operationId ? [operationId] : []))]
    if (!applied.ok && !input.discardConflicts) {
      return {
        status: 'conflict',
        operationIds: conflictIds,
        messages: conflicts.map(({ message }) => message),
      }
    }
    if (!applied.ok) {
      const discarded = new Set(conflictIds)
      overrides = overrides.filter(({ id }) => !discarded.has(id))
      applied = applyComposeComponentOverrides(parentSnapshot.document, overrides)
      if (!applied.ok) throw new Error(applied.issues.map(({ message }) => message).join('；'))
    }
    const reference = input.store.createReference(variant.assetKey)
    const next: ComposeVariantComponentAsset = {
      ...variant.asset,
      appliedLineage: structuredClone(parentSnapshot.appliedLineage),
      overrides,
      resolvedSnapshot: variantSnapshot(
        variant.asset,
        reference,
        variant.revision,
        parentSnapshot,
        applied.document,
      ),
    }
    return {
      status: 'updated',
      discardedOperationIds: conflictIds,
      variant: await input.store.saveComponent(
        variant.assetKey,
        next,
        variant.revision,
        false,
        input.signal,
      ),
    }
  }
  catch (error) {
    return { status: 'failed', error: errorOf(error) }
  }
}

/** 从直接父快照创建无覆盖的 Variant v1 草案。 @public */
export function createComposeVariantAsset(input: {
  readonly componentId: string
  readonly name: string
  readonly parentRef: ComposeComponentReference
  readonly parentSnapshot: ComposeResolvedComponentSnapshot
}): ComposeVariantComponentAsset {
  return {
    schemaVersion: 1,
    kind: 'variant',
    componentId: input.componentId,
    name: input.name,
    parentRef: structuredClone(input.parentRef),
    appliedLineage: structuredClone(input.parentSnapshot.appliedLineage),
    overrides: [],
    resolvedSnapshot: {
      componentId: input.componentId,
      kind: 'variant',
      revision: input.parentSnapshot.revision,
      document: structuredClone(input.parentSnapshot.document),
      appliedLineage: structuredClone(input.parentSnapshot.appliedLineage),
    },
  }
}
