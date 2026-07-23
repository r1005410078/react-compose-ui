import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import * as v from 'valibot'
import {
  ArrowIcon,
  ChevronIcon,
  CloseIcon,
  PlusIcon,
  ResetIcon,
} from './icons'
import type {
  PropertyPanelChangeReason,
  PropertyPath,
  PropertyPanelRenderer,
} from './index'
import {
  createInitialValue,
  getObjectEntries,
  getValueAtPath,
  inspectSchema,
} from './schema-model'

type RuntimeSchema = v.GenericSchema & {
  entries?: Readonly<Record<string, v.GenericSchema>>
  item?: v.GenericSchema
  items?: readonly v.GenericSchema[]
  key?: v.GenericSchema
  literal?: unknown
  options?: readonly unknown[]
  rest?: v.GenericSchema
  value?: v.GenericSchema
}

export interface TreeCommitOptions {
  eventPath?: PropertyPath
  previousValue?: unknown
}

interface TreeSharedProps {
  schema: v.GenericSchema
  value: unknown
  readOnly: boolean
  renderers?: readonly PropertyPanelRenderer[]
  commit: (
    path: PropertyPath,
    value: unknown,
    reason: PropertyPanelChangeReason,
    options?: TreeCommitOptions,
  ) => boolean
}

interface PropertyTreeProps extends TreeSharedProps {
  defaultValue?: unknown
  hasDefaultValue: boolean
  filter: PropertyPanelFilter
  issues: readonly v.BaseIssue<unknown>[]
  query: string
  showAdvanced: boolean
  showDescriptions: boolean
}

interface PropertyNodeProps extends TreeSharedProps {
  label: string
  path: PropertyPath
  schema: v.GenericSchema
  nodeActions?: ReactNode
}

export type PropertyPanelFilter = 'all' | 'modified' | 'errors'

interface PropertyTreeView {
  defaultValue?: unknown
  hasDefaultValue: boolean
  filter: PropertyPanelFilter
  issues: readonly v.BaseIssue<unknown>[]
  query: string
  showAdvanced: boolean
  showDescriptions: boolean
}

const OBJECT_TYPES = new Set(['object', 'loose_object', 'strict_object', 'object_with_rest'])
const TUPLE_TYPES = new Set(['tuple', 'loose_tuple', 'strict_tuple', 'tuple_with_rest'])
const RendererContext = createContext<readonly PropertyPanelRenderer[]>([])
const ViewContext = createContext<PropertyTreeView>({
  hasDefaultValue: false,
  filter: 'all',
  issues: [],
  query: '',
  showAdvanced: false,
  showDescriptions: false,
})

export function PropertyTree({
  schema,
  value,
  defaultValue,
  hasDefaultValue,
  filter,
  issues,
  query,
  showAdvanced,
  showDescriptions,
  readOnly,
  renderers = [],
  commit,
}: PropertyTreeProps) {
  return (
    <RendererContext.Provider value={renderers}>
      <ViewContext.Provider value={{
        defaultValue,
        hasDefaultValue,
        filter,
        issues,
        query,
        showAdvanced,
        showDescriptions,
      }}>
        <div className="property-panel__fields">
          <ObjectChildren
            commit={commit}
            path={[]}
            readOnly={readOnly}
            renderers={renderers}
            schema={schema}
            value={value}
          />
        </div>
      </ViewContext.Provider>
    </RendererContext.Provider>
  )
}

function PropertyNode({
  schema,
  value,
  label,
  path,
  readOnly,
  commit,
  nodeActions,
}: PropertyNodeProps) {
  const info = inspectSchema(schema)
  const renderers = useContext(RendererContext)
  const view = useContext(ViewContext)
  const baseline = view.hasDefaultValue ? getValueAtPath(view.defaultValue, path) : undefined
  if (
    info.metadata.hidden
    || (info.metadata.advanced && !view.showAdvanced)
    || !matchesNode(schema, value, baseline, path, label, view)
  ) return null

  const renderer = info.metadata.editor
    ? renderers.find((candidate) => candidate.id === info.metadata.editor)
    : renderers.find((candidate) => candidate.matches?.(info.base, info.metadata))
  const missing = value === undefined || value === null
  const supportsPresence = info.optional || info.nullable
  const presenceControl = supportsPresence ? (
    <input
      aria-label={`${label} 存在`}
      checked={!missing}
      disabled={readOnly}
      type="checkbox"
      onChange={(event) => {
        const nextValue = event.target.checked
          ? renderer?.createDefault?.(info.base) ?? createInitialValue(info.base)
          : info.nullable ? null : undefined
        commit(path, nextValue, 'set-presence')
      }}
    />
  ) : null
  const resetControl = view.hasDefaultValue
    && v.safeParse(schema, baseline).success
    && !deepEqual(value, baseline) ? (
    <button
      aria-label={`重置 ${label}`}
      disabled={readOnly}
      title={`重置 ${label}`}
      type="button"
      onClick={() => commit(path, cloneValue(baseline), 'reset')}
    ><ResetIcon /></button>
  ) : null
  const actions = <>{presenceControl}{resetControl}{nodeActions}</>

  if (supportsPresence && missing) {
    return (
      <PropertyRow label={label} path={path}>
        <span className="property-panel__empty">未设置</span>
        <div className="property-panel__actions">{actions}</div>
      </PropertyRow>
    )
  }

  if (renderer) {
    const Renderer = renderer.component
    return (
      <div className="property-panel__field" data-property-path={path.join('.')}>
        <span className="property-panel__label">{label}</span>
        <div className="property-panel__editor">
          <Renderer
            commit={(candidate, reason = 'commit') => commit(path, candidate, reason)}
            issues={issuesAtPath(view.issues, path)}
            metadata={info.metadata}
            path={path}
            readOnly={readOnly}
            schema={schema}
            value={value}
          />
        </div>
        <div className="property-panel__actions">{actions}</div>
      </div>
    )
  }

  if (OBJECT_TYPES.has(info.type)) {
    return (
      <ObjectGroup
        commit={commit}
        label={label}
        nodeActions={actions}
        path={path}
        readOnly={readOnly}
        schema={info.base}
        initiallyExpanded={info.metadata.collapsed !== true}
        value={value}
      />
    )
  }

  if (info.type === 'array') {
    return (
      <ArrayGroup
        commit={commit}
        label={label}
        nodeActions={actions}
        path={path}
        readOnly={readOnly}
        schema={info.base}
        initiallyExpanded={info.metadata.collapsed !== true}
        value={value}
      />
    )
  }

  if (TUPLE_TYPES.has(info.type)) {
    return (
      <TupleGroup
        commit={commit}
        label={label}
        nodeActions={actions}
        path={path}
        readOnly={readOnly}
        schema={info.base}
        initiallyExpanded={info.metadata.collapsed !== true}
        value={value}
      />
    )
  }

  if (info.type === 'record') {
    return (
      <RecordGroup
        commit={commit}
        label={label}
        nodeActions={actions}
        path={path}
        readOnly={readOnly}
        schema={info.base}
        initiallyExpanded={info.metadata.collapsed !== true}
        value={value}
      />
    )
  }

  if (info.type === 'union' || info.type === 'variant') {
    return (
      <UnionGroup
        commit={commit}
        label={label}
        nodeActions={actions}
        path={path}
        readOnly={readOnly}
        schema={info.base}
        initiallyExpanded={info.metadata.collapsed !== true}
        value={value}
      />
    )
  }

  return (
    <PrimitiveField
      commit={commit}
      label={label}
      nodeActions={actions}
      path={path}
      readOnly={readOnly}
      schema={schema}
      value={value}
    />
  )
}

interface GroupProps extends PropertyNodeProps {
  nodeActions: ReactNode
  initiallyExpanded?: boolean
}

function GroupShell({
  children,
  label,
  nodeActions,
  initiallyExpanded = true,
}: {
  children: ReactNode
  label: string
  nodeActions: ReactNode
  initiallyExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const { query } = useContext(ViewContext)
  const visibleExpanded = query.trim() ? true : expanded
  return (
    <section className="property-panel__group">
      <div className="property-panel__group-header">
        <button
          aria-expanded={visibleExpanded}
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronIcon expanded={visibleExpanded} />
          {label}
        </button>
        <div className="property-panel__actions">{nodeActions}</div>
      </div>
      {visibleExpanded ? <div className="property-panel__group-content">{children}</div> : null}
    </section>
  )
}

function ObjectChildren({
  schema,
  value,
  path,
  readOnly,
  commit,
}: TreeSharedProps & { path: PropertyPath }) {
  const view = useContext(ViewContext)
  const entries = getObjectEntries(schema, path).filter((entry) => {
    const label = entry.info.title ?? humanizeKey(entry.key)
    return matchesNode(
      entry.info.schema,
      getValueAtPath(value, [entry.key]),
      view.hasDefaultValue ? getValueAtPath(view.defaultValue, entry.path) : undefined,
      entry.path,
      label,
      view,
    )
  })
  const groups: Array<{
    section?: string
    entries: typeof entries
  }> = []
  for (const entry of entries) {
    const section = entry.info.metadata.section
    if (!section) {
      groups.push({ entries: [entry] })
      continue
    }
    const existing = groups.find((group) => group.section === section)
    if (existing) existing.entries.push(entry)
    else groups.push({ section, entries: [entry] })
  }
  const renderEntry = (entry: typeof entries[number]) => (
    <PropertyNode
      key={entry.key}
      commit={commit}
      label={entry.info.title ?? humanizeKey(entry.key)}
      path={entry.path}
      readOnly={readOnly || entry.info.metadata.readOnly === true}
      schema={entry.info.schema}
      value={getValueAtPath(value, [entry.key])}
    />
  )
  return groups.map((group, index) => (
    group.section ? (
      <GroupShell key={`section-${group.section}`} label={group.section} nodeActions={null}>
        {group.entries.map(renderEntry)}
      </GroupShell>
    ) : <div className="property-panel__ungrouped" key={`field-${index}`}>{group.entries.map(renderEntry)}</div>
  ))
}

function ObjectGroup({
  schema,
  value,
  label,
  path,
  readOnly,
  commit,
  nodeActions,
  initiallyExpanded,
}: GroupProps) {
  return (
    <GroupShell
      initiallyExpanded={initiallyExpanded}
      label={label}
      nodeActions={nodeActions}
    >
      <ObjectChildren
        commit={commit}
        path={path}
        readOnly={readOnly}
        schema={schema}
        value={value}
      />
    </GroupShell>
  )
}

function ArrayGroup({
  schema,
  value,
  label,
  path,
  readOnly,
  commit,
  nodeActions,
  initiallyExpanded,
}: GroupProps) {
  const runtime = schema as RuntimeSchema
  const items = Array.isArray(value) ? value : []
  const itemSchema = runtime.item
  const canAdd = Boolean(itemSchema && v.safeParse(itemSchema, createInitialValue(itemSchema)).success)
  const add = () => {
    if (!itemSchema) return
    commit(path, [...items, createInitialValue(itemSchema)], 'array-add')
  }
  return (
    <GroupShell
      initiallyExpanded={initiallyExpanded}
      label={label}
      nodeActions={<>
        <button aria-label={`添加 ${label}`} disabled={readOnly || !canAdd} type="button" onClick={add}>
          <PlusIcon />
        </button>
        {nodeActions}
      </>}
    >
      {itemSchema ? items.map((item, index) => {
        const itemLabel = `${label} ${index + 1}`
        return (
          <PropertyNode
            key={`${path.join('.')}-${index}`}
            commit={commit}
            label={itemLabel}
            nodeActions={<>
              <button
                aria-label={`上移 ${itemLabel}`}
                disabled={readOnly || index === 0}
                type="button"
                onClick={() => {
                  const next = [...items]
                  ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                  commit(path, next, 'array-move')
                }}
              ><ArrowIcon direction="up" /></button>
              <button
                aria-label={`下移 ${itemLabel}`}
                disabled={readOnly || index === items.length - 1}
                type="button"
                onClick={() => {
                  const next = [...items]
                  ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                  commit(path, next, 'array-move')
                }}
              ><ArrowIcon direction="down" /></button>
              <button
                aria-label={`删除 ${itemLabel}`}
                disabled={readOnly}
                type="button"
                onClick={() => commit(path, items.filter((_, itemIndex) => itemIndex !== index), 'array-remove')}
              ><CloseIcon /></button>
            </>}
            path={[...path, index]}
            readOnly={readOnly}
            schema={itemSchema}
            value={item}
          />
        )
      }) : null}
    </GroupShell>
  )
}

function TupleGroup({
  schema,
  value,
  label,
  path,
  readOnly,
  commit,
  nodeActions,
  initiallyExpanded,
}: GroupProps) {
  const runtime = schema as RuntimeSchema
  const items = Array.isArray(value) ? value : []
  const fixedSchemas = runtime.items ?? []
  const restSchema = runtime.rest
  const schemas = items.map((_, index) => fixedSchemas[index] ?? restSchema).filter(Boolean) as v.GenericSchema[]
  const canAdd = Boolean(restSchema && v.safeParse(restSchema, createInitialValue(restSchema)).success)
  return (
    <GroupShell
      initiallyExpanded={initiallyExpanded}
      label={label}
      nodeActions={<>
        {restSchema ? (
          <button
            aria-label={`添加 ${label}`}
            disabled={readOnly || !canAdd}
            type="button"
            onClick={() => commit(path, [...items, createInitialValue(restSchema)], 'array-add')}
          ><PlusIcon /></button>
        ) : null}
        {nodeActions}
      </>}
    >
      {schemas.map((itemSchema, index) => {
        const itemLabel = `${label} ${index + 1}`
        const restItem = index >= fixedSchemas.length
        return (
          <PropertyNode
            key={`${path.join('.')}-${index}`}
            commit={commit}
            label={itemLabel}
            nodeActions={restItem ? (
              <button
                aria-label={`删除 ${itemLabel}`}
                disabled={readOnly}
                type="button"
                onClick={() => commit(path, items.filter((_, itemIndex) => itemIndex !== index), 'array-remove')}
              ><CloseIcon /></button>
            ) : null}
            path={[...path, index]}
            readOnly={readOnly}
            schema={itemSchema}
            value={items[index]}
          />
        )
      })}
    </GroupShell>
  )
}

function RecordGroup({
  schema,
  value,
  label,
  path,
  readOnly,
  commit,
  nodeActions,
  initiallyExpanded,
}: GroupProps) {
  const runtime = schema as RuntimeSchema
  const entries = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>)
    : []
  const keySchema = runtime.key
  const valueSchema = runtime.value
  const nextKey = createUniqueKey(new Set(entries.map(([key]) => key)))
  const nextValue = valueSchema ? createInitialValue(valueSchema) : undefined
  const canAdd = Boolean(
    keySchema
    && valueSchema
    && v.safeParse(keySchema, nextKey).success
    && v.safeParse(valueSchema, nextValue).success,
  )
  return (
    <GroupShell
      initiallyExpanded={initiallyExpanded}
      label={label}
      nodeActions={<>
        <button
          aria-label={`添加 ${label}`}
          disabled={readOnly || !canAdd}
          type="button"
          onClick={() => commit(path, { ...Object.fromEntries(entries), [nextKey]: nextValue }, 'record-add')}
        ><PlusIcon /></button>
        {nodeActions}
      </>}
    >
      {valueSchema ? entries.map(([key, entryValue], index) => (
        <div className="property-panel__record" key={key}>
          <input
            aria-label={`${label} 键 ${index + 1}`}
            disabled={readOnly}
            value={key}
            onChange={(event) => {
              const replacement = event.target.value
              if (
                !keySchema
                || replacement === key
                || entries.some(([existingKey]) => existingKey === replacement)
                || !v.safeParse(keySchema, replacement).success
              ) return
              const renamed = Object.fromEntries(entries.map(([entryKey, item]) => [
                entryKey === key ? replacement : entryKey,
                item,
              ]))
              commit(path, renamed, 'record-rename', {
                eventPath: [...path, 'key'],
                previousValue: key,
              })
            }}
          />
          <PropertyNode
            commit={commit}
            label={`${label} 值 ${key}`}
            nodeActions={(
              <button
                aria-label={`删除 ${label} ${key}`}
                disabled={readOnly}
                type="button"
                onClick={() => commit(
                  path,
                  Object.fromEntries(entries.filter(([entryKey]) => entryKey !== key)),
                  'record-remove',
                )}
              ><CloseIcon /></button>
            )}
            path={[...path, key]}
            readOnly={readOnly}
            schema={valueSchema}
            value={entryValue}
          />
        </div>
      )) : null}
    </GroupShell>
  )
}

function UnionGroup({
  schema,
  value,
  label,
  path,
  readOnly,
  commit,
  nodeActions,
  initiallyExpanded,
}: GroupProps) {
  const runtime = schema as RuntimeSchema
  const options = (runtime.options ?? []).filter((option): option is v.GenericSchema => (
    Boolean(option && typeof option === 'object' && 'kind' in option)
  ))
  const candidates = options.map((option) => createInitialValue(option))
  const activeIndex = Math.max(0, options.findIndex((option) => v.safeParse(option, value).success))
  const activeSchema = options[activeIndex]
  return (
    <GroupShell initiallyExpanded={initiallyExpanded} label={label} nodeActions={nodeActions}>
      <PropertyRow label={`${label} 分支`} path={[...path, '$branch']}>
        <select
          aria-label={`${label} 分支`}
          disabled={readOnly}
          value={String(activeIndex)}
          onChange={(event) => {
            const index = Number(event.target.value)
            commit(path, candidates[index], 'union-switch')
          }}
        >
          {options.map((option, index) => (
            <option
              disabled={!v.safeParse(option, candidates[index]).success}
              key={index}
              value={String(index)}
            >
              {inspectSchema(option).title ?? `分支 ${index + 1}`}
            </option>
          ))}
        </select>
        <div className="property-panel__actions" />
      </PropertyRow>
      {activeSchema && OBJECT_TYPES.has(inspectSchema(activeSchema).type)
        ? getObjectEntries(activeSchema, path).map((entry) => (
            <PropertyNode
              key={entry.key}
              commit={commit}
              label={entry.info.title ?? humanizeKey(entry.key)}
              path={entry.path}
              readOnly={readOnly}
              schema={entry.info.schema}
              value={getValueAtPath(value, [entry.key])}
            />
          ))
        : activeSchema ? (
            <PropertyNode
              commit={commit}
              label={label}
              path={path}
              readOnly={readOnly}
              schema={activeSchema}
              value={value}
            />
          ) : null}
    </GroupShell>
  )
}

function PropertyRow({
  children,
  label,
  path,
}: {
  children: ReactNode
  label: string
  path: PropertyPath
}) {
  return (
    <div className="property-panel__field" data-property-path={path.join('.')}>
      <span className="property-panel__label">{label}</span>
      <div className="property-panel__editor">{children}</div>
    </div>
  )
}

function PrimitiveField({ schema, value, label, path, readOnly, commit, nodeActions }: GroupProps) {
  const info = inspectSchema(schema)
  const { showDescriptions } = useContext(ViewContext)
  const id = `property-${path.map(String).join('-')}`
  const runtime = info.base as RuntimeSchema
  const [draft, setDraft] = useState<{ source: unknown; text: string; error?: string }>({
    source: value,
    text: value === undefined ? '' : String(value),
  })
  const draftActive = Object.is(draft.source, value)
  const textValue = draftActive ? draft.text : value === undefined ? '' : String(value)
  const activeError = draftActive ? draft.error : undefined
  let editor: ReactNode

  if (info.type === 'string') {
    editor = (
      <input
        aria-label={label}
        disabled={readOnly}
        id={id}
        placeholder={info.metadata.placeholder}
        type="text"
        aria-invalid={activeError ? 'true' : undefined}
        value={textValue}
        onChange={(event) => {
          const text = event.target.value
          const fieldResult = v.safeParse(schema, text)
          const success = fieldResult.success && commit(path, text, 'input')
          setDraft({
            // 提交成功后以新值标记草稿归属，历史跳转回旧值时才不会误复用新草稿。
            source: success ? text : value,
            text,
            error: success ? undefined : fieldResult.success
              ? '完整属性值不符合 Schema'
              : fieldResult.issues[0]?.message,
          })
        }}
      />
    )
  } else if (info.type === 'number' || info.type === 'bigint') {
    const submitNumber = () => {
      if (textValue === '') return
      let nextValue: number | bigint
      try {
        nextValue = info.type === 'bigint' ? BigInt(textValue) : Number(textValue)
      } catch {
        setDraft({ source: value, text: textValue, error: '请输入有效数字' })
        return
      }
      const fieldResult = v.safeParse(schema, nextValue)
      const success = fieldResult.success && commit(path, nextValue, 'commit')
      setDraft({
        source: success ? nextValue : value,
        text: textValue,
        error: success ? undefined : fieldResult.success
          ? '完整属性值不符合 Schema'
          : fieldResult.issues[0]?.message,
      })
    }
    editor = (
      <input
        aria-label={label}
        aria-invalid={activeError ? 'true' : undefined}
        disabled={readOnly}
        id={id}
        max={info.constraints.max?.toString()}
        min={info.constraints.min?.toString()}
        step={info.constraints.step?.toString()}
        type="number"
        value={textValue}
        onBlur={submitNumber}
        onChange={(event) => setDraft({ source: value, text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submitNumber()
          if (event.key === 'Escape') setDraft({ source: value, text: String(value ?? '') })
        }}
      />
    )
  } else if (info.type === 'boolean') {
    editor = (
      <input
        aria-label={label}
        checked={Boolean(value)}
        disabled={readOnly}
        id={id}
        type="checkbox"
        onChange={(event) => commit(path, event.target.checked, 'input')}
      />
    )
  } else if (info.type === 'date') {
    const dateValue = value instanceof Date && !Number.isNaN(value.valueOf())
      ? value.toISOString().slice(0, 10)
      : ''
    editor = (
      <input
        aria-label={label}
        disabled={readOnly}
        id={id}
        type="date"
        value={dateValue}
        onChange={(event) => commit(path, new Date(`${event.target.value}T00:00:00.000Z`), 'commit')}
      />
    )
  } else if (info.type === 'picklist' || info.type === 'enum') {
    editor = (
      <select
        aria-label={label}
        disabled={readOnly}
        id={id}
        value={String(value)}
        onChange={(event) => {
          const option = runtime.options?.find((candidate) => String(candidate) === event.target.value)
          commit(path, option, 'input')
        }}
      >
        {runtime.options?.map((option) => (
          <option key={String(option)} value={String(option)}>
            {info.metadata.optionLabels?.[String(option)] ?? String(option)}
          </option>
        ))}
      </select>
    )
  } else if (info.type === 'literal') {
    editor = <output aria-label={label}>{String(runtime.literal)}</output>
  } else {
    editor = <span role="status">{label}（{info.type}）暂不支持</span>
  }

  return (
    <div className="property-panel__field" data-property-path={path.join('.')}>
      <label htmlFor={id}>
        <span>{label}</span>
        {showDescriptions && info.description
          ? <small className="property-panel__description">{info.description}</small>
          : null}
      </label>
      <div className="property-panel__editor">
        {editor}
        {info.metadata.unit ? <span>{info.metadata.unit}</span> : null}
        {activeError ? <span role="alert">{activeError}</span> : null}
      </div>
      <div className="property-panel__actions">{nodeActions}</div>
    </div>
  )
}

function createUniqueKey(keys: ReadonlySet<string>): string {
  if (!keys.has('key')) return 'key'
  let index = 2
  while (keys.has(`key${index}`)) index += 1
  return `key${index}`
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .replace(/^./u, (character) => character.toUpperCase())
}

function matchesNode(
  schema: v.GenericSchema,
  value: unknown,
  baseline: unknown,
  path: PropertyPath,
  label: string,
  view: PropertyTreeView,
): boolean {
  const info = inspectSchema(schema)
  if (info.metadata.hidden || (info.metadata.advanced && !view.showAdvanced)) return false

  const normalizedQuery = view.query.trim().toLocaleLowerCase()
  const ownSearchText = [label, path.join('.'), info.title, info.description]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
  const children = childNodes(info.base, value, baseline, path, label)
  const descendantMatchesQuery = normalizedQuery
    ? children.some((child) => matchesNode(
        child.schema,
        child.value,
        child.baseline,
        child.path,
        child.label,
        { ...view, filter: 'all' },
      ))
    : true
  const queryMatches = !normalizedQuery
    || ownSearchText.includes(normalizedQuery)
    || descendantMatchesQuery

  let filterMatches = true
  if (view.filter === 'modified') {
    filterMatches = view.hasDefaultValue && !deepEqual(value, baseline)
  } else if (view.filter === 'errors') {
    filterMatches = issuesAtPath(view.issues, path, true).length > 0
  }
  return queryMatches && filterMatches
}

interface ChildNode {
  schema: v.GenericSchema
  value: unknown
  baseline: unknown
  path: PropertyPath
  label: string
}

function childNodes(
  schema: v.GenericSchema,
  value: unknown,
  baseline: unknown,
  path: PropertyPath,
  parentLabel: string,
): readonly ChildNode[] {
  const info = inspectSchema(schema)
  const runtime = info.base as RuntimeSchema
  if (OBJECT_TYPES.has(info.type)) {
    return getObjectEntries(info.base, path).map((entry) => ({
      schema: entry.info.schema,
      value: getValueAtPath(value, [entry.key]),
      baseline: getValueAtPath(baseline, [entry.key]),
      path: entry.path,
      label: entry.info.title ?? humanizeKey(entry.key),
    }))
  }
  if (info.type === 'array' && runtime.item) {
    const values = Array.isArray(value) ? value : []
    const baselines = Array.isArray(baseline) ? baseline : []
    const length = Math.max(values.length, baselines.length)
    return Array.from({ length }, (_, index) => ({
      schema: runtime.item as v.GenericSchema,
      value: values[index],
      baseline: baselines[index],
      path: [...path, index],
      label: `${parentLabel} ${index + 1}`,
    }))
  }
  if (TUPLE_TYPES.has(info.type)) {
    const values = Array.isArray(value) ? value : []
    const baselines = Array.isArray(baseline) ? baseline : []
    const length = Math.max(values.length, baselines.length, runtime.items?.length ?? 0)
    const children: ChildNode[] = []
    Array.from({ length }, (_, index) => {
      const itemSchema = runtime.items?.[index] ?? runtime.rest
      if (itemSchema) children.push({
        schema: itemSchema,
        value: values[index],
        baseline: baselines[index],
        path: [...path, index],
        label: `${parentLabel} ${index + 1}`,
      })
    })
    return children
  }
  if (info.type === 'record' && runtime.value) {
    const values = isRecord(value) ? value : {}
    const baselines = isRecord(baseline) ? baseline : {}
    const keys = new Set([...Object.keys(values), ...Object.keys(baselines)])
    return [...keys].map((key) => ({
      schema: runtime.value as v.GenericSchema,
      value: values[key],
      baseline: baselines[key],
      path: [...path, key],
      label: `${parentLabel} 值 ${key}`,
    }))
  }
  if (info.type === 'union' || info.type === 'variant') {
    const active = (runtime.options ?? []).find((option): option is v.GenericSchema => (
      Boolean(option && typeof option === 'object' && 'kind' in option)
      && v.safeParse(option as v.GenericSchema, value).success
    ))
    return active ? childNodes(active, value, baseline, path, parentLabel) : []
  }
  return []
}

function issuesAtPath(
  issues: readonly v.BaseIssue<unknown>[],
  path: PropertyPath,
  includeDescendants = false,
): readonly v.BaseIssue<unknown>[] {
  return issues.filter((issue) => {
    const issuePath = (issue.path ?? []).map((item) => item.key)
    if (includeDescendants) {
      return path.every((segment, index) => Object.is(issuePath[index], segment))
    }
    return issuePath.length === path.length
      && path.every((segment, index) => Object.is(issuePath[index], segment))
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.valueOf() === right.valueOf()
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => deepEqual(item, right[index]))
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => (
        Object.prototype.hasOwnProperty.call(right, key)
        && deepEqual(left[key], right[key])
      ))
  }
  return false
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  if (value instanceof Date) return new Date(value.valueOf()) as T
  if (Array.isArray(value)) return value.map(cloneValue) as T
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)])) as T
  }
  return value
}
