import { ComposeButton, ComposeInput } from '@compose-ui/components'
import type {
  ComposeComponentPropertyDefinition,
  ComposeDocument,
  ComposeComponentPropertyValueType,
} from '@compose-ui/core'
import { useMemo, useState } from 'react'
import './styles.css'

/** {@link ComposeBasePropertiesPanel} 属性。 @public */
export interface ComposeBasePropertiesPanelProps {
  readonly document: ComposeDocument
  readonly properties: readonly ComposeComponentPropertyDefinition[]
  readonly selectedEntityId?: string
  readonly onChange: (properties: readonly ComposeComponentPropertyDefinition[]) => void
}

function valueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const field of path) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Readonly<Record<string, unknown>>)[field]
  }
  return current
}

/** 为 Base Component 定义稳定暴露属性目标的受控面板。 @public */
export function ComposeBasePropertiesPanel({
  document,
  properties,
  selectedEntityId,
  onChange,
}: ComposeBasePropertiesPanelProps) {
  const [propertyId, setPropertyId] = useState('property')
  const [name, setName] = useState('Property')
  const [draftEntityId, setDraftEntityId] = useState('')
  const [componentKey, setComponentKey] = useState('Renderer')
  const [fieldPath, setFieldPath] = useState('props.value')
  const [valueType, setValueType] = useState<ComposeComponentPropertyValueType>('string')
  const [error, setError] = useState<string | null>(null)
  const entityId = selectedEntityId ?? draftEntityId
  const componentKeys = useMemo(
    () => Object.keys(document.entities[entityId]?.components ?? {}).sort(),
    [document.entities, entityId],
  )

  const add = () => {
    const path = fieldPath.split('.').map((field) => field.trim()).filter(Boolean)
    const component = document.entities[entityId]?.components[componentKey]
    if (!component) {
      setError('目标 Entity 或 Component 不存在')
      return
    }
    if (!propertyId.trim() || !name.trim() || path.length === 0) {
      setError('属性 ID、名称和字段路径不能为空')
      return
    }
    if (properties.some(({ id }) => id === propertyId.trim())) {
      setError(`属性 ID ${propertyId.trim()} 已存在`)
      return
    }
    const current = valueAtPath(component, path)
    if (
      current === undefined
      || (valueType !== 'json' && typeof current !== valueType)
    ) {
      setError('字段路径不存在或值类型不兼容')
      return
    }
    onChange([...properties, {
      id: propertyId.trim(),
      name: name.trim(),
      valueType,
      target: { entityId, componentKey, fieldPath: path },
    }])
    setError(null)
  }

  return (
    <section aria-label="组件暴露属性" className="compose-base-properties">
      <h3>暴露属性 ({properties.length})</h3>
      {properties.length === 0 ? <p>实例目前没有可覆盖属性</p> : (
        <ul>
          {properties.map((property) => (
            <li key={property.id}>
              <span>{property.name}</span>
              <code>{`${property.target.entityId}.${property.target.componentKey}.${property.target.fieldPath.join('.')}`}</code>
              <ComposeButton
                aria-label={`删除暴露属性 ${property.name}`}
                size="xs"
                variant="ghost"
                onClick={() => onChange(properties.filter(({ id }) => id !== property.id))}
              >删除</ComposeButton>
            </li>
          ))}
        </ul>
      )}
      <fieldset>
        <legend>新增暴露属性</legend>
        <ComposeInput aria-label="属性 ID" value={propertyId} onChange={(event) => setPropertyId(event.currentTarget.value)} />
        <ComposeInput aria-label="属性名称" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <label>Entity
          <select
            disabled={selectedEntityId !== undefined}
            value={entityId}
            onChange={(event) => setDraftEntityId(event.currentTarget.value)}
          >
            <option value="">请选择</option>
            {Object.values(document.entities).map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.name}</option>
            ))}
          </select>
        </label>
        <label>Component
          <select value={componentKey} onChange={(event) => setComponentKey(event.currentTarget.value)}>
            {componentKeys.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <ComposeInput aria-label="字段路径" value={fieldPath} onChange={(event) => setFieldPath(event.currentTarget.value)} />
        <label>值类型
          <select value={valueType} onChange={(event) => setValueType(event.currentTarget.value as ComposeComponentPropertyValueType)}>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="json">json</option>
          </select>
        </label>
        <ComposeButton size="sm" onClick={add}>添加暴露属性</ComposeButton>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
