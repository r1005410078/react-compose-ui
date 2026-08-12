import { applyComposeComponentOverrides } from './component-overrides'
import {
  COMPOSE_COMPONENT_NEST_DEPTH_LIMIT,
  type ComposeComponentAssetIssue,
  type ComposeComponentAssetV1,
  type ComposeComponentLineageEntry,
  type ComposeComponentReference,
  type ComposeComponentResolveResult,
  type ComposeLoadedComponentAsset,
  type ComposeResolvedComponentSnapshot,
  type ResolveComposeComponentAssetInput,
} from './component-types'

function referenceKey(reference: ComposeComponentReference): string {
  return `${reference.providerId}:${reference.scope}:${reference.assetKey}`
}

function sameReference(a: ComposeComponentReference, b: ComposeComponentReference): boolean {
  return a.providerId === b.providerId && a.assetKey === b.assetKey && a.scope === b.scope
}

function sameLineage(
  actual: readonly ComposeComponentLineageEntry[],
  expected: readonly ComposeComponentLineageEntry[],
): boolean {
  return actual.length === expected.length && actual.every((entry, index) => {
    const candidate = expected[index]
    return candidate
      && entry.componentId === candidate.componentId
      && entry.kind === candidate.kind
      && entry.revision === candidate.revision
      && sameReference(entry.reference, candidate.reference)
  })
}

function issue(
  code: ComposeComponentAssetIssue['code'],
  message: string,
  path: readonly (string | number)[] = [],
): ComposeComponentAssetIssue {
  return { code, path, message }
}

function snapshotForBase(
  asset: Extract<ComposeComponentAssetV1, { kind: 'base' }>,
  reference: ComposeComponentReference,
  revision: string,
): ComposeResolvedComponentSnapshot {
  const entry: ComposeComponentLineageEntry = {
    reference,
    componentId: asset.componentId,
    kind: 'base',
    revision,
  }
  return {
    componentId: asset.componentId,
    kind: 'base',
    revision,
    document: structuredClone(asset.document),
    properties: structuredClone(asset.properties),
    appliedLineage: [entry],
  }
}

/**
 * 把一个已读取的 Component Asset 固化为可写入实例的当前离线快照。
 *
 * @remarks
 * Base 从自身文档构造；Variant 使用文件内保存的有效快照，并把当前资源引用与 Provider
 * revision 写入 lineage。该函数不解析父源，完整在线解析仍使用 `resolveComposeComponentAsset`。
 *
 * @public
 */
export function createComposeResolvedComponentSnapshot(
  asset: ComposeComponentAssetV1,
  reference: ComposeComponentReference,
  revision: string,
): ComposeResolvedComponentSnapshot {
  if (asset.kind === 'base') return snapshotForBase(asset, reference, revision)
  const entry: ComposeComponentLineageEntry = {
    reference,
    componentId: asset.componentId,
    kind: 'variant',
    revision,
  }
  const previous = asset.resolvedSnapshot.appliedLineage
  const appliedLineage = previous[previous.length - 1]?.componentId === asset.componentId
    ? [...previous.slice(0, -1), entry]
    : [...previous, entry]
  return {
    ...structuredClone(asset.resolvedSnapshot),
    componentId: asset.componentId,
    kind: 'variant',
    revision,
    appliedLineage,
  }
}

async function resolveLoaded(
  loaded: ComposeLoadedComponentAsset,
  reference: ComposeComponentReference,
  input: ResolveComposeComponentAssetInput,
  visited: ReadonlySet<string>,
  depth: number,
): Promise<ComposeComponentResolveResult> {
  if (depth > COMPOSE_COMPONENT_NEST_DEPTH_LIMIT) {
    return {
      status: 'invalid',
      issues: [issue('component-asset.depth-exceeded', '组件继承超过八层')],
    }
  }
  const key = referenceKey(reference)
  if (visited.has(key)) {
    return { status: 'invalid', issues: [issue('component-asset.cycle', '组件继承形成循环')] }
  }
  const nextVisited = new Set(visited)
  nextVisited.add(key)
  if (loaded.asset.kind === 'base') {
    return {
      status: 'resolved',
      snapshot: createComposeResolvedComponentSnapshot(loaded.asset, reference, loaded.revision),
    }
  }
  const asset = loaded.asset
  if (
    asset.parentRef.providerId !== reference.providerId
    || asset.parentRef.scope !== reference.scope
  ) {
    return {
      status: 'invalid',
      issues: [issue('component-asset.invalid-reference', 'Variant 父源必须位于同 Provider 和 scope', ['parentRef'])],
    }
  }
  let parent: ComposeLoadedComponentAsset
  try {
    if (input.signal?.aborted) throw input.signal.reason ?? new Error('aborted')
    parent = await input.load(asset.parentRef, input.signal)
  }
  catch (error) {
    return {
      status: 'orphaned',
      snapshot: structuredClone(asset.resolvedSnapshot),
      issues: [issue(
        'component-asset.parent-missing',
        `无法读取父组件：${error instanceof Error ? error.message : String(error)}`,
        ['parentRef'],
      )],
    }
  }
  const parentResult = await resolveLoaded(parent, asset.parentRef, input, nextVisited, depth + 1)
  if (parentResult.status === 'invalid') return parentResult
  if (parentResult.status === 'orphaned') {
    return {
      status: 'orphaned',
      snapshot: structuredClone(asset.resolvedSnapshot),
      issues: parentResult.issues,
    }
  }
  const parentSnapshot = parentResult.snapshot
  const lineageChanged = !sameLineage(parentSnapshot.appliedLineage, asset.appliedLineage)
  const applied = applyComposeComponentOverrides(parentSnapshot.document, asset.overrides)
  const currentEntry: ComposeComponentLineageEntry = {
    reference,
    componentId: asset.componentId,
    kind: 'variant',
    revision: loaded.revision,
  }
  if (!applied.ok) {
    if (lineageChanged || parentResult.status === 'pending-update') {
      return {
        status: 'pending-update',
        snapshot: structuredClone(asset.resolvedSnapshot),
        issues: [issue('component-asset.pending-update', '父源已变化且覆盖存在冲突')],
        conflicts: applied.issues,
      }
    }
    return { status: 'invalid', issues: applied.issues }
  }
  const snapshot: ComposeResolvedComponentSnapshot = {
    componentId: asset.componentId,
    kind: 'variant',
    revision: loaded.revision,
    document: applied.document,
    properties: structuredClone(parentSnapshot.properties),
    appliedLineage: [...parentSnapshot.appliedLineage, currentEntry],
  }
  if (lineageChanged || parentResult.status === 'pending-update') {
    return {
      status: 'pending-update',
      snapshot,
      issues: [issue('component-asset.pending-update', '父组件 revision 已变化')],
      conflicts: parentResult.status === 'pending-update' ? parentResult.conflicts : [],
    }
  }
  return { status: 'resolved', snapshot }
}

/**
 * 解析 Base/Variant 继承链并返回可离线保存的有效快照。
 *
 * @remarks
 * Loader 由 Store/宿主注入，Core 不依赖 assets。解析永不自动写回文件或丢弃冲突。
 *
 * @public
 */
export function resolveComposeComponentAsset(
  input: ResolveComposeComponentAssetInput,
): Promise<ComposeComponentResolveResult> {
  return resolveLoaded(
    { asset: input.asset, revision: input.revision },
    input.reference,
    input,
    new Set(),
    1,
  )
}
