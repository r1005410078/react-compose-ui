import {
  applyComposeComponentOverrides,
  type ComposeComponentInstanceOverrides,
  type ComposeComponentOverrideOperation,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeResolvedComponentSnapshot,
} from '@compose-ui/core'
import { readComposeComponentInstance } from './instance-operations'

/** 文档是否在应用操作后有实质变化（用于丢弃已写回源后的冗余覆盖）。 */
function documentChanged(before: ComposeDocument, after: ComposeDocument): boolean {
  return JSON.stringify(before) !== JSON.stringify(after)
}

/** 可以直接提交的实例同步项。 @public */
export interface ComposeInstanceAutoSyncEntry {
  readonly entityId: string
  readonly snapshot: ComposeResolvedComponentSnapshot
  readonly overrides: ComposeComponentInstanceOverrides
}

/** 因覆盖失效而需要用户确认的实例。 @public */
export interface ComposeInstancePendingSyncEntry {
  readonly entityId: string
  readonly snapshot: ComposeResolvedComponentSnapshot
  /** 锚点在最新来源中失效的操作 ID。 */
  readonly conflictOperationIds: readonly string[]
  /** 确认丢弃冲突后应写回的覆盖。 */
  readonly compatibleOverrides: ComposeComponentInstanceOverrides
}

/** 组件源保存后的实例同步计划。 @public */
export interface ComposeInstanceAutoSyncPlan {
  readonly synced: readonly ComposeInstanceAutoSyncEntry[]
  readonly pending: readonly ComposeInstancePendingSyncEntry[]
}

function sameReference(a: ComposeComponentReference, b: ComposeComponentReference) {
  return a.providerId === b.providerId && a.assetKey === b.assetKey && a.scope === b.scope
}

/**
 * 规划组件源保存后依赖实例的同步。
 *
 * @remarks
 * 判据是「覆盖是否仍可应用」而不是变更来源，因此同一会话内的保存与外部 Provider revision 变化
 * 走同一条逻辑。全部兼容的实例直接给出可提交结果，不打断用户；存在失效覆盖的实例保留旧快照并
 * 列出失效项，等待显式确认——静默丢弃用户在实例上做的调整是不可接受的。
 *
 * 本函数不写文档：调用方负责把结果合并成一次事务，使自动与手动路径共享同一次 Undo。
 *
 * @public
 */
export function planComposeInstanceAutoSync(input: {
  readonly document: ComposeDocument
  readonly reference: ComposeComponentReference
  readonly snapshot: ComposeResolvedComponentSnapshot
}): ComposeInstanceAutoSyncPlan {
  const synced: ComposeInstanceAutoSyncEntry[] = []
  const pending: ComposeInstancePendingSyncEntry[] = []
  for (const entity of Object.values(input.document.entities)) {
    const facts = readComposeComponentInstance(entity)
    if (!facts || !sameReference(facts.reference, input.reference)) continue
    const compatible: ComposeComponentOverrideOperation[] = []
    const conflictOperationIds: string[] = []
    let document = input.snapshot.document
    for (const operation of facts.overrides.operations) {
      const attempt = applyComposeComponentOverrides(document, [operation])
      if (!attempt.ok) {
        conflictOperationIds.push(operation.id)
        continue
      }
      // 已写回主组件/变体后，同一 set-field 再应用到新源上无变化；不得继续算作「本层覆盖」。
      if (!documentChanged(document, attempt.document)) continue
      document = attempt.document
      compatible.push(operation)
    }
    if (conflictOperationIds.length === 0) {
      synced.push({
        entityId: entity.id,
        snapshot: input.snapshot,
        overrides: { operations: compatible },
      })
      continue
    }
    pending.push({
      entityId: entity.id,
      snapshot: input.snapshot,
      conflictOperationIds,
      compatibleOverrides: { operations: compatible },
    })
  }
  return { synced, pending }
}
