import { ComposeButton, ComposeInput } from '@compose-ui/components'
import type { ComposeEntity, JsonValue } from '@compose-ui/core'
import { readComposeComponentInstance } from '../instance-operations'
import type { ComposeComponentInstanceUpdateResult } from '../instance-operations'
import { useState } from 'react'
import './styles.css'

/** {@link ComposeComponentInstanceOverridesPanel} 属性。 @public */
export interface ComposeComponentInstanceOverridesPanelProps {
  readonly entity: ComposeEntity
  readonly onChange: (overrides: Readonly<Record<string, JsonValue>>) => void
  readonly onApply: (propertyIds?: readonly string[]) => void
  readonly onCreateVariant: () => void
  readonly onUpdate: (discardConflicts?: boolean) => Promise<ComposeComponentInstanceUpdateResult>
}

function atPath(value: unknown, path: readonly string[]): JsonValue | undefined {
  let current = value
  for (const field of path) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Readonly<Record<string, unknown>>)[field]
  }
  return current as JsonValue | undefined
}

/** 关联实例当前层暴露属性覆盖、Apply/Revert 与创建 Variant 的控制面板。 @public */
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
  const change = (id: string, value: JsonValue) => {
    onChange({ ...facts.overrides.properties, [id]: value })
  }
  const revert = (id: string) => {
    const next = { ...facts.overrides.properties }
    delete next[id]
    onChange(next)
  }
  const overrideIds = Object.keys(facts.overrides.properties)
  const update = async (discardConflicts = false) => {
    setUpdating(true)
    try {
      const result = await onUpdate(discardConflicts)
      if (result.status === 'conflict') {
        setUpdateConflict(result.propertyIds)
        setMessage(result.messages.join('；'))
      }
      else {
        setUpdateConflict(null)
        setMessage(result.discardedPropertyIds.length > 0
          ? `已更新，并丢弃 ${result.discardedPropertyIds.length} 项冲突覆盖`
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
      <header>
        <strong>{facts.snapshot.kind === 'variant' ? '变体实例' : '组件实例'}</strong>
        <div>
          <ComposeButton disabled={updating} size="sm" variant="ghost" onClick={() => void update()}>
            检查更新
          </ComposeButton>
          <ComposeButton size="sm" variant="outline" onClick={onCreateVariant}>创建变体…</ComposeButton>
        </div>
      </header>
      {facts.snapshot.properties.length === 0 ? <p>来源没有暴露属性</p> : (
        <ul>
          {facts.snapshot.properties.map((definition) => {
            const component = facts.snapshot.document.entities[definition.target.entityId]
              ?.components[definition.target.componentKey]
            const inherited = atPath(component, definition.target.fieldPath)
            const overridden = Object.prototype.hasOwnProperty.call(
              facts.overrides.properties,
              definition.id,
            )
            const value = overridden ? facts.overrides.properties[definition.id] : inherited
            return (
              <li key={definition.id}>
                <label>{definition.name}
                  {definition.valueType === 'boolean' ? (
                    <input
                      checked={Boolean(value)}
                      type="checkbox"
                      onChange={(event) => change(definition.id, event.currentTarget.checked)}
                    />
                  ) : (
                    <ComposeInput
                      value={definition.valueType === 'json'
                        ? JSON.stringify(value ?? null)
                        : String(value ?? '')}
                      onChange={(event) => {
                        const raw = event.currentTarget.value
                        try {
                          const numeric = Number(raw)
                          if (definition.valueType === 'number' && !Number.isFinite(numeric)) return
                          change(definition.id, definition.valueType === 'number'
                            ? numeric
                            : definition.valueType === 'json'
                              ? JSON.parse(raw) as JsonValue
                              : raw)
                        }
                        catch {
                          // JSON 输入未完成时保留最近一次有效值；不会写入非法中间态。
                        }
                      }}
                    />
                  )}
                </label>
                <span>{overridden ? '已覆盖' : '继承'}</span>
                <ComposeButton
                  disabled={!overridden}
                  size="xs"
                  variant="ghost"
                  onClick={() => revert(definition.id)}
                >Revert</ComposeButton>
                <ComposeButton
                  disabled={!overridden}
                  size="xs"
                  variant="ghost"
                  onClick={() => onApply([definition.id])}
                >Apply</ComposeButton>
              </li>
            )
          })}
        </ul>
      )}
      <ComposeButton disabled={overrideIds.length === 0} size="sm" onClick={() => onApply()}>
        Apply 全部实例覆盖
      </ComposeButton>
      <ComposeButton
        disabled={overrideIds.length === 0}
        size="sm"
        variant="outline"
        onClick={() => onChange({})}
      >Revert 全部实例覆盖</ComposeButton>
      {updateConflict ? (
        <ComposeButton disabled={updating} variant="destructive" onClick={() => void update(true)}>
          {`丢弃 ${updateConflict.length} 项冲突并更新`}
        </ComposeButton>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  )
}
