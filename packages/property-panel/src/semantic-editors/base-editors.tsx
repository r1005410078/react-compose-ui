/* eslint-disable react-refresh/only-export-components -- 内建 renderer 与仅供 registry 使用的组件必须共置，避免 registry 与组件产生循环依赖。 */
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import * as v from 'valibot'
import { ComposeColorPicker } from '@compose-ui/components'
import type {
  PropertyPanelRenderer,
  PropertyPanelRendererBindingController,
  PropertyPanelRendererBindingTargetDescriptor,
  PropertyPanelRendererProps,
} from '../property-panel/compose-property-panel'
import { createInitialValue, getObjectEntries, inspectSchema } from '../schema-model'

/** 第一方内建语义 editor 的稳定 ID。 */
export const PROPERTY_PANEL_BASE_EDITOR_IDS = [
  'vector2',
  'size',
  'angle',
  'opacity',
  'corner-radius',
  'stroke-width',
  'visibility',
  'color',
  'alignment',
  'map',
] as const

/** 第一方内建语义 editor ID。 */
export type PropertyPanelBaseEditorId = (typeof PROPERTY_PANEL_BASE_EDITOR_IDS)[number]

type ObjectValue = Record<string, unknown>

type MapBranch = {
  readonly key: string
  readonly schema: v.GenericSchema
  readonly valueSchema: v.GenericSchema
}

function isObjectValue(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getObjectValue(value: unknown): ObjectValue {
  return isObjectValue(value) ? value : {}
}

function getFieldSchema(schema: v.GenericSchema, key: string): v.GenericSchema | undefined {
  return getObjectEntries(schema).find((entry) => entry.key === key)?.info.schema
}

function getOptions(schema: v.GenericSchema | undefined): readonly unknown[] {
  if (!schema) return []
  return (inspectSchema(schema).base as v.GenericSchema & { options?: readonly unknown[] }).options ?? []
}

function getLiteralString(schema: v.GenericSchema | undefined): string | undefined {
  if (!schema) return undefined
  const base = inspectSchema(schema).base as v.GenericSchema & { literal?: unknown }
  return base.type === 'literal' && typeof base.literal === 'string' ? base.literal : undefined
}

function resolveMapBranches(schema: v.GenericSchema): readonly MapBranch[] | undefined {
  const variant = inspectSchema(schema).base as v.GenericSchema & {
    key?: unknown
    options?: readonly unknown[]
  }
  if (variant.type !== 'variant' || variant.key !== 'key') return undefined
  const branches: MapBranch[] = []
  for (const option of variant.options ?? []) {
    if (!option || typeof option !== 'object' || !('kind' in option)) return undefined
    const entries = getObjectEntries(option as v.GenericSchema)
    if (entries.length !== 2 || !entries.some((entry) => entry.key === 'key') || !entries.some((entry) => entry.key === 'value')) {
      return undefined
    }
    const key = getLiteralString(entries.find((entry) => entry.key === 'key')?.info.schema)
    const valueSchema = entries.find((entry) => entry.key === 'value')?.info.schema
    if (!key || !valueSchema || branches.some((branch) => branch.key === key)) return undefined
    branches.push({ key, schema: option as v.GenericSchema, valueSchema })
  }
  return branches.length > 0 ? branches : undefined
}

function cloneMapValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneMapValue)
  if (isObjectValue(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneMapValue(item)]))
  return value
}

function getMapBranchLabel(props: PropertyPanelRendererProps, key: string): string {
  return props.metadata.optionLabels?.[key] ?? key
}

function createMapBranchCandidate(
  props: PropertyPanelRendererProps,
  branch: MapBranch,
): Record<string, unknown> | undefined {
  const configuredDefault = props.metadata.mapValueDefaults?.[branch.key]
  const value = configuredDefault === undefined
    ? createInitialValue(branch.valueSchema)
    : cloneMapValue(configuredDefault)
  const candidate = { key: branch.key, value }
  return v.safeParse(props.schema, candidate).success ? candidate : undefined
}

function isChineseLabel(label: string): boolean {
  return /[\u3400-\u9fff]/.test(label)
}

function subLabel(label: string, chinese: string, english: string): string {
  return isChineseLabel(label) ? `${label}${chinese}` : `${label} ${english}`
}

function toOpaqueSrgbHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const shorthand = /^#([\da-f]{3})$/i.exec(value.trim())
  if (shorthand) return `#${shorthand[1].split('').map((part) => part.repeat(2)).join('')}`.toLowerCase()
  const full = /^#([\da-f]{6})$/i.exec(value.trim())
  return full ? `#${full[1].toLowerCase()}` : undefined
}

function SemanticNumberInput({
  binding,
  commit,
  fieldSchema,
  label,
  readOnly,
  targetId,
  value,
  onValueChange,
}: {
  binding: PropertyPanelRendererBindingController | undefined
  commit: PropertyPanelRendererProps['commit']
  fieldSchema?: v.GenericSchema
  label: string
  readOnly: boolean
  targetId: string
  value: unknown
  onValueChange: (nextValue: number) => unknown
}) {
  const target = binding?.getTarget(targetId)
  const bound = Boolean(target?.binding)
  const effectiveValue = target?.effectiveValue ?? value
  const [draft, setDraft] = useState({
    source: effectiveValue,
    text: String(effectiveValue ?? ''),
    error: undefined as string | undefined,
  })
  const draftActive = Object.is(draft.source, effectiveValue)
  const text = draftActive ? draft.text : String(effectiveValue ?? '')
  const error = draftActive ? draft.error : undefined
  const submit = () => {
    if (bound || text === '') return
    const nextNumber = Number(text)
    if (!Number.isFinite(nextNumber)) {
      setDraft({ source: effectiveValue, text, error: '请输入有效数字' })
      return
    }
    if (fieldSchema) {
      const result = v.safeParse(fieldSchema, nextNumber)
      if (!result.success) {
        const issue = 'issues' in result ? result.issues[0] : undefined
        setDraft({ source: effectiveValue, text, error: issue?.message ?? '输入不符合 Schema' })
        return
      }
    }
    const committed = commit(onValueChange(nextNumber), 'commit')
    setDraft({
      source: committed ? nextNumber : effectiveValue,
      text,
      error: committed ? undefined : '完整属性值不符合 Schema',
    })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') submit()
    if (event.key === 'Escape') {
      setDraft({ source: effectiveValue, text: String(effectiveValue ?? ''), error: undefined })
    }
  }
  const constraints = fieldSchema ? inspectSchema(fieldSchema).constraints : {}
  return (
    <div className="property-panel__binding-target">
      <div className="property-panel__binding-control">
        <input
          aria-invalid={error ? 'true' : undefined}
          aria-label={label}
          disabled={readOnly && !bound}
          max={constraints.max?.toString()}
          min={constraints.min?.toString()}
          readOnly={bound || readOnly}
          step={constraints.step?.toString()}
          type="number"
          value={text}
          onBlur={submit}
          onChange={(event) => {
            if (!bound) {
              setDraft({ source: effectiveValue, text: event.target.value, error: undefined })
            }
          }}
          onKeyDown={onKeyDown}
        />
        {error ? <span role="alert">{error}</span> : null}
      </div>
      {binding?.renderTrigger(targetId)}
    </div>
  )
}

function Vector2Editor(props: PropertyPanelRendererProps) {
  const value = getObjectValue(props.value)
  return (
    <div className="property-panel__semantic property-panel__semantic--pair" data-testid="semantic-editor-vector2">
      <SemanticNumberInput
        binding={props.binding}
        commit={props.commit}
        fieldSchema={getFieldSchema(props.schema, 'x')}
        label={subLabel(props.label, ' X', 'X')}
        readOnly={props.readOnly}
        targetId="x"
        value={value.x}
        onValueChange={(x) => ({ ...value, x })}
      />
      <SemanticNumberInput
        binding={props.binding}
        commit={props.commit}
        fieldSchema={getFieldSchema(props.schema, 'y')}
        label={subLabel(props.label, ' Y', 'Y')}
        readOnly={props.readOnly}
        targetId="y"
        value={value.y}
        onValueChange={(y) => ({ ...value, y })}
      />
    </div>
  )
}

function SizeEditor(props: PropertyPanelRendererProps) {
  const value = getObjectValue(props.value)
  const presetSchema = getFieldSchema(props.schema, 'preset')
  const presetOptions = getOptions(presetSchema).filter((option): option is string => typeof option === 'string')
  const presets = props.metadata.sizePresets ?? []
  const matchesPreset = (width: number, height: number) => presets.find((candidate) => (
    candidate.width === width && candidate.height === height
  ))?.value
  const updateDimension = (key: 'width' | 'height') => (nextDimension: number) => {
    const next = { ...value, [key]: nextDimension }
    if (presetOptions.includes('custom')) {
      const matching = matchesPreset(Number(next.width), Number(next.height))
      next.preset = matching ?? 'custom'
    }
    return next
  }
  return (
    <div
      className={`property-panel__semantic property-panel__semantic--size${presetSchema ? ' property-panel__semantic--size-with-preset' : ''}`}
      data-testid="semantic-editor-size"
    >
      {presetSchema ? (
        <select
          aria-label={subLabel(props.label, '预设', 'preset')}
          disabled={props.readOnly}
          value={typeof value.preset === 'string' && presetOptions.includes(value.preset) ? value.preset : 'custom'}
          onChange={(event) => {
            const preset = presets.find((candidate) => candidate.value === event.target.value)
            props.commit(
              preset ? { ...value, preset: preset.value, width: preset.width, height: preset.height } : {
                ...value,
                preset: event.target.value,
              },
              'input',
            )
          }}
        >
          {presetOptions.map((option) => (
            <option key={option} value={option}>
              {getPresetLabel(option, presetSchema)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="property-panel__semantic-pair">
        <SemanticNumberInput
          binding={props.binding}
          commit={props.commit}
          fieldSchema={getFieldSchema(props.schema, 'width')}
          label={subLabel(props.label, '宽度', 'width')}
          readOnly={props.readOnly}
          targetId="width"
          value={value.width}
          onValueChange={updateDimension('width')}
        />
        <SemanticNumberInput
          binding={props.binding}
          commit={props.commit}
          fieldSchema={getFieldSchema(props.schema, 'height')}
          label={subLabel(props.label, '高度', 'height')}
          readOnly={props.readOnly}
          targetId="height"
          value={value.height}
          onValueChange={updateDimension('height')}
        />
      </div>
    </div>
  )
}

function getPresetLabel(value: string, schema: v.GenericSchema): string {
  return inspectSchema(schema).metadata.optionLabels?.[value] ?? value
}

function SingleNumberEditor(props: PropertyPanelRendererProps) {
  return (
    <div className="property-panel__semantic" data-semantic-editor={props.metadata.editor}>
      <SemanticNumberInput
        binding={props.binding}
        commit={props.commit}
        fieldSchema={props.schema}
        label={props.label}
        readOnly={props.readOnly}
        targetId="value"
        value={props.value}
        onValueChange={(value) => value}
      />
    </div>
  )
}

function VisibilityEditor(props: PropertyPanelRendererProps) {
  const bindingTarget = props.binding?.getTarget('value')
  const bound = Boolean(bindingTarget?.binding)
  const value = Boolean(bindingTarget?.effectiveValue ?? props.value)
  return (
    <div className="property-panel__binding-target">
      <div className="property-panel__binding-control">
        <input
          aria-label={props.label}
          aria-readonly={bound ? 'true' : undefined}
          checked={value}
          disabled={props.readOnly || bound}
          type="checkbox"
          onChange={(event) => props.commit(event.target.checked, 'input')}
        />
      </div>
      {props.binding?.renderTrigger('value')}
    </div>
  )
}

function ColorEditor(props: PropertyPanelRendererProps) {
  const bindingTarget = props.binding?.getTarget('value')
  const bound = Boolean(bindingTarget?.binding)
  const effectiveValue = bindingTarget?.effectiveValue ?? props.value
  const value = typeof effectiveValue === 'string' ? effectiveValue : ''
  const [error, setError] = useState<string | undefined>()
  const fallback = toOpaqueSrgbHex(value) === undefined
  const updateColor = (nextValue: string) => {
    if (bound) return
    const result = v.safeParse(props.schema, nextValue)
    const committed = result.success && props.commit(nextValue, 'input')
    setError(committed ? undefined : result.success
      ? '完整属性值不符合 Schema'
      : result.issues[0]?.message)
  }
  return (
    <div
      className="property-panel__semantic property-panel__semantic--color"
      data-color-fallback={fallback ? 'true' : 'false'}
      data-testid="semantic-editor-color"
    >
      <div className="property-panel__binding-target">
        <div className="property-panel__binding-control">
          <ComposeColorPicker
            label={props.label}
            readOnly={props.readOnly || bound}
            value={value}
            onValueChange={updateColor}
          />
        </div>
        {props.binding?.renderTrigger('value')}
      </div>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  )
}

function AlignmentEditor(props: PropertyPanelRendererProps) {
  const options = getOptions(props.schema)
  const bindingTarget = props.binding?.getTarget('value')
  const bound = Boolean(bindingTarget?.binding)
  const value = bindingTarget?.effectiveValue ?? props.value
  return (
    <div className="property-panel__binding-target">
      <div className="property-panel__binding-control">
        <select
          aria-label={props.label}
          aria-readonly={bound ? 'true' : undefined}
          disabled={props.readOnly && !bound}
          value={String(value ?? '')}
          onChange={(event) => {
            if (!bound) props.commit(event.target.value, 'input')
          }}
        >
          {options.map((option) => {
            const key = String(option)
            return <option key={key} value={key}>{props.metadata.optionLabels?.[key] ?? key}</option>
          })}
        </select>
      </div>
      {props.binding?.renderTrigger('value')}
    </div>
  )
}

function MapLabelEditor(props: PropertyPanelRendererProps) {
  const branches = resolveMapBranches(props.schema)
  const value = getObjectValue(props.value)
  const activeKey = typeof value.key === 'string' ? value.key : ''
  if (!branches) return <span>{props.label}</span>
  return (
    <select
      aria-label={subLabel(props.label, '键', 'key')}
      className="property-panel__label-control"
      disabled={props.readOnly}
      value={activeKey}
      onChange={(event) => {
        const branch = branches.find((candidate) => candidate.key === event.target.value)
        const candidate = branch ? createMapBranchCandidate(props, branch) : undefined
        if (candidate) props.commit(candidate, 'input')
      }}
    >
      {branches.map((branch) => (
        <option
          disabled={!createMapBranchCandidate(props, branch)}
          key={branch.key}
          value={branch.key}
        >{getMapBranchLabel(props, branch.key)}</option>
      ))}
    </select>
  )
}

function MapEditor(props: PropertyPanelRendererProps) {
  const branches = resolveMapBranches(props.schema)
  const value = getObjectValue(props.value)
  const activeKey = typeof value.key === 'string' ? value.key : ''
  const branch = branches?.find((candidate) => candidate.key === activeKey)
  if (!branches || !branch) {
    return <span role="alert">{props.label} 必须是包含 string literal `key` 与 `value` 的 Valibot variant。</span>
  }
  if (!props.renderInlineValue) {
    return <span role="alert">{props.label} Map Value 无法渲染。</span>
  }
  return props.renderInlineValue({
    commit: (nextValue, reason = 'commit') => props.commit({ key: branch.key, value: nextValue }, reason),
    label: getMapBranchLabel(props, branch.key),
    schema: branch.valueSchema,
    value: value.value,
  })
}

function singleValueBindingTarget(
  label: string,
  schema: v.GenericSchema,
): readonly PropertyPanelRendererBindingTargetDescriptor[] {
  return [{
    id: 'value',
    label,
    schema,
    getValue: (value) => value,
    setValue: (_value, targetValue) => targetValue,
  }]
}

function vectorBindingTargets(
  keys: readonly ('x' | 'y' | 'width' | 'height')[],
  schema: v.GenericSchema,
): readonly PropertyPanelRendererBindingTargetDescriptor[] {
  return keys.flatMap((key) => {
    const fieldSchema = getFieldSchema(schema, key)
    if (!fieldSchema) return []
    return [{
      id: key,
      label: key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'width' ? 'W' : 'H',
      schema: fieldSchema,
      getValue: (value) => getObjectValue(value)[key],
      setValue: (value, targetValue) => ({ ...getObjectValue(value), [key]: targetValue }),
    }]
  })
}

function withSingleValueBinding(
  id: Exclude<PropertyPanelBaseEditorId, 'vector2' | 'size'>,
  component: PropertyPanelRenderer['component'],
): PropertyPanelRenderer {
  return {
    id,
    component,
    bindingTargets: ({ schema, metadata }) => singleValueBindingTarget(
      metadata.optionLabels?.value ?? '值',
      schema,
    ),
  }
}

/** 内建语义 renderer 定义；数组和成员均不可变。 */
export const PROPERTY_PANEL_BASE_RENDERERS: readonly PropertyPanelRenderer[] = [
  {
    id: 'vector2',
    component: Vector2Editor,
    bindingTargets: ({ schema }) => vectorBindingTargets(['x', 'y'], schema),
  },
  {
    id: 'size',
    component: SizeEditor,
    bindingTargets: ({ schema }) => vectorBindingTargets(['width', 'height'], schema),
  },
  withSingleValueBinding('angle', SingleNumberEditor),
  withSingleValueBinding('opacity', SingleNumberEditor),
  withSingleValueBinding('corner-radius', SingleNumberEditor),
  withSingleValueBinding('stroke-width', SingleNumberEditor),
  withSingleValueBinding('visibility', VisibilityEditor),
  withSingleValueBinding('color', ColorEditor),
  withSingleValueBinding('alignment', AlignmentEditor),
  {
    id: 'map',
    component: MapEditor,
    labelComponent: MapLabelEditor,
  },
]

/** 合并实例 registry 与默认 renderer；同 ID 的实例 renderer 始终优先。 */
export function mergePropertyPanelRenderers(
  renderers: readonly PropertyPanelRenderer[] | undefined,
): readonly PropertyPanelRenderer[] {
  const hostRenderers = renderers ?? []
  const hostIds = new Set(hostRenderers.map((renderer) => renderer.id))
  return [...hostRenderers, ...PROPERTY_PANEL_BASE_RENDERERS.filter((renderer) => !hostIds.has(renderer.id))]
}
