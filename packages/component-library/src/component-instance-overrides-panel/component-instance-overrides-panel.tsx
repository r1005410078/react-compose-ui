import { ComposeButton } from '@compose-ui/components'
import type { ComposeComponentInstanceOverrides, ComposeEntity } from '@compose-ui/core'
import { readComposeComponentInstance } from '../instance-operations'
import type { ComposeComponentInstanceUpdateResult } from '../instance-operations'
import { useState } from 'react'
import './styles.css'

/** {@link ComposeComponentInstanceOverridesPanel} 属性。 @public */
export interface ComposeComponentInstanceOverridesPanelProps {
  readonly entity: ComposeEntity
  /** 写回完整实例覆盖。 */
  readonly onChange: (overrides: ComposeComponentInstanceOverrides) => void
  /** Apply 指定结构操作到直接父源；省略参数表示全部。 */
  readonly onApply: (operationIds?: readonly string[]) => void
  readonly onCreateVariant: () => void
  readonly onUpdate: (discardConflicts?: boolean) => Promise<ComposeComponentInstanceUpdateResult>
}

/** 描述一条结构操作，用于让用户辨认要 Apply 或 Revert 的是什么。 */
function describeOperation(operation: { kind: string; entityId?: string; fieldPath?: readonly string[] }) {
  const target = operation.entityId ?? '组件根'
  if (operation.kind === 'set-field') return `设置 ${target}.${(operation.fieldPath ?? []).join('.')}`
  if (operation.kind === 'remove-field') return `移除字段 ${target}.${(operation.fieldPath ?? []).join('.')}`
  if (operation.kind === 'add-component') return `新增 Component 于 ${target}`
  if (operation.kind === 'remove-component') return `移除 Component 于 ${target}`
  if (operation.kind === 'add-entity') return `新增子树 ${target}`
  if (operation.kind === 'remove-entity') return `删除 ${target}`
  if (operation.kind === 'move-entity') return `移动 ${target}`
  return `${operation.kind} ${target}`
}

/**
 * 关联实例当前层覆盖的 Apply/Revert 与创建 Variant 控制面板。
 *
 * @remarks
 * 实例覆盖只有结构操作一个分区：内部字段可直接覆盖，因此不再有与之并行的暴露属性列表。
 *
 * @public
 */
export function ComposeComponentInstanceOverridesPanel({
  entity,
  onChange,
  onApply,
  onCreateVariant,
  onUpdate,
}: ComposeComponentInstanceOverridesPanelProps) {
  const [updating, setUpdating] = useState(false)
  const [updateConflict, setUpdateConflict] = useState<readonly string[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const facts = readComposeComponentInstance(entity)
  if (!facts) return <p role="alert">组件实例快照无效</p>

  const operations = facts.overrides.operations
  const revert = (id: string) => {
    onChange({ operations: operations.filter((operation) => operation.id !== id) })
  }
  const update = async (discardConflicts = false) => {
    setUpdating(true)
    try {
      const result = await onUpdate(discardConflicts)
      if (result.status === 'conflict') {
        setUpdateConflict(result.operationIds)
        setMessage(result.messages.join('；'))
      }
      else {
        setUpdateConflict(null)
        setMessage(result.discardedOperationIds.length > 0
          ? `已更新，并丢弃 ${result.discardedOperationIds.length} 项失效覆盖`
          : '实例已更新到来源最新 revision')
      }
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
    finally {
      setUpdating(false)
    }
  }

  return (
    <section aria-label="组件实例覆盖" className="compose-instance-overrides">
      <header className="compose-instance-overrides__header">
        <h3>组件实例</h3>
        <ComposeButton disabled={updating} size="sm" variant="outline" onClick={() => void update()}>
          检查更新
        </ComposeButton>
        <ComposeButton size="sm" variant="outline" onClick={onCreateVariant}>创建变体…</ComposeButton>
      </header>
      {message === null ? null : <p role="status">{message}</p>}
      {operations.length === 0 ? (
        <p>实例当前没有本层覆盖</p>
      ) : (
        <ul className="compose-instance-overrides__list">
          {operations.map((operation) => (
            <li key={operation.id}>
              <span>{describeOperation(operation)}</span>
              <ComposeButton size="sm" variant="outline" onClick={() => onApply([operation.id])}>
                Apply
              </ComposeButton>
              <ComposeButton size="sm" variant="outline" onClick={() => revert(operation.id)}>
                Revert
              </ComposeButton>
            </li>
          ))}
        </ul>
      )}
      <ComposeButton disabled={operations.length === 0} size="sm" onClick={() => onApply()}>
        Apply 全部实例覆盖
      </ComposeButton>
      <ComposeButton
        disabled={operations.length === 0}
        size="sm"
        variant="outline"
        onClick={() => onChange({ operations: [] })}
      >Revert 全部实例覆盖</ComposeButton>
      {updateConflict ? (
        <ComposeButton disabled={updating} variant="destructive" onClick={() => void update(true)}>
          {`丢弃 ${updateConflict.length} 项失效覆盖并更新`}
        </ComposeButton>
      ) : null}
    </section>
  )
}
