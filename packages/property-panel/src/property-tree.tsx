import { createContext, Fragment, useContext, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import * as v from 'valibot'
import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  useComposeContextMenu,
} from '@compose-ui/components'
import {
  ArrowIcon,
  ChevronIcon,
  CloseIcon,
  PlusIcon,
  ResetIcon,
} from './icons'
import type {
  PropertyPanelBindingConfig,
  PropertyPanelBindingIssue,
  PropertyPanelBindingTarget,
  PropertyPanelChangeReason,
  PropertyPanelInlineValueProps,
  PropertyPath,
  PropertyPanelRenderer,
  PropertyPanelRendererBindingController,
  PropertyPanelRendererBindingTargetDescriptor,
  PropertyPanelRendererBindingTargetState,
  PropertyPanelResolvedBindingTarget,
} from './property-panel/compose-property-panel'
import {
  canBindPropertyVariable,
  createBindingAddressKey,
  resolvePropertyBindings,
} from './property-bindings'
import type { PropertyBindingMutation } from './property-bindings'
import {
  createInitialValue,
  getObjectEntries,
  getValueAtPath,
  inspectSchema,
} from './schema-model'
import { usePropertyPanelMessages } from './property-panel-i18n'

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
  bindingMutation?: PropertyBindingMutation
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
  actionWidth: number
  binding?: PropertyPanelBindingConfig
  defaultValue?: unknown
  hasDefaultValue: boolean
  filter: PropertyPanelFilter
  issues: readonly v.BaseIssue<unknown>[]
  query: string
  showAdvanced: boolean
  showDescriptions: boolean
  section?: {
    title: string
    onVisibilityChange: (visible: boolean | undefined) => void
  }
}

interface PropertyNodeProps extends TreeSharedProps {
  label: string
  path: PropertyPath
  schema: v.GenericSchema
  nodeActions?: readonly RowAction[]
}

interface RowAction {
  id: string
  label: string
  priority: number
  disabled?: boolean
  control?: ReactNode
  icon?: ReactNode
  onSelect: () => void
}

export type PropertyPanelFilter = 'all' | 'modified' | 'errors'

interface PropertyTreeView {
  defaultValue?: unknown
  hasDefaultValue: boolean
  filter: PropertyPanelFilter
  issues: readonly v.BaseIssue<unknown>[]
  bindingIssues: readonly PropertyPanelBindingIssue[]
  boundTargets: readonly PropertyPanelResolvedBindingTarget[]
  query: string
  showAdvanced: boolean
  showDescriptions: boolean
  recordValue: (label: string, key: string) => string
}

const OBJECT_TYPES = new Set(['object', 'loose_object', 'strict_object', 'object_with_rest'])
const TUPLE_TYPES = new Set(['tuple', 'loose_tuple', 'strict_tuple', 'tuple_with_rest'])
const RendererContext = createContext<readonly PropertyPanelRenderer[]>([])
const TreeDepthContext = createContext(0)
const ActionWidthContext = createContext(36)
interface PropertyBindingView {
  config?: PropertyPanelBindingConfig
  resolvedTargets: ReadonlyMap<string, PropertyPanelResolvedBindingTarget>
  activeTarget?: PropertyPanelRendererBindingTargetState
  activeAnchor?: HTMLElement
  openTarget: (target: PropertyPanelRendererBindingTargetState, anchor?: HTMLElement) => void
  closePicker: () => void
}
const BindingContext = createContext<PropertyBindingView>({
  resolvedTargets: new Map(),
  openTarget: () => undefined,
  closePicker: () => undefined,
})
const ViewContext = createContext<PropertyTreeView>({
  hasDefaultValue: false,
  filter: 'all',
  issues: [],
  bindingIssues: [],
  boundTargets: [],
  query: '',
  showAdvanced: false,
  showDescriptions: false,
  recordValue: (label, key) => `${label} 值 ${key}`,
})

export function PropertyTree({
  actionWidth,
  binding,
  schema,
  value,
  defaultValue,
  hasDefaultValue,
  filter,
  issues,
  query,
  showAdvanced,
  showDescriptions,
  section,
  readOnly,
  renderers = [],
  commit,
}: PropertyTreeProps) {
  const messages = usePropertyPanelMessages()
  const [activeBinding, setActiveBinding] = useState<{
    target: PropertyPanelRendererBindingTargetState
    anchor?: HTMLElement
  }>()
  const bindingResult = binding ? resolvePropertyBindings({
    schema,
    value,
    bindings: binding.value,
    variables: binding.variables,
    renderers,
    canBind: binding.canBind,
  }) : { targets: [], issues: [] }
  const resolvedTargets = new Map(bindingResult.targets.map((target) => [
    createBindingAddressKey(target.address),
    target,
  ]))
  const closePicker = () => {
    const anchor = activeBinding?.anchor
    setActiveBinding(undefined)
    queueMicrotask(() => anchor?.focus())
  }
  const view: PropertyTreeView = {
    defaultValue,
    hasDefaultValue,
    filter,
    issues,
    bindingIssues: bindingResult.issues,
    boundTargets: bindingResult.targets,
    query,
    showAdvanced,
    showDescriptions,
    recordValue: messages.recordValue,
  }
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const sectionTitleMatches = Boolean(
    section
    && normalizedQuery
    && section.title.toLocaleLowerCase().includes(normalizedQuery),
  )
  const sectionView = sectionTitleMatches ? { ...view, query: '' } : view
  const sectionVisible = !section || matchesNode(
    schema,
    value,
    hasDefaultValue ? defaultValue : undefined,
    [],
    section.title,
    view,
  )
  useEffect(() => {
    if (!section) return
    section.onVisibilityChange(sectionVisible)
  }, [section, sectionVisible])
  return (
    <RendererContext.Provider value={renderers}>
      <ActionWidthContext.Provider value={actionWidth}>
        <BindingContext.Provider value={{
          config: binding,
          resolvedTargets,
          activeTarget: activeBinding?.target,
          activeAnchor: activeBinding?.anchor,
          openTarget: (target, anchor) => setActiveBinding({ target, anchor }),
          closePicker,
        }}>
          <ViewContext.Provider value={sectionView}>
            {section ? (
              <TreeDepthContext.Provider value={1}>
                {sectionVisible ? (
                  <ObjectChildren
                    commit={commit}
                    path={[]}
                    readOnly={readOnly}
                    renderers={renderers}
                    schema={schema}
                    value={value}
                  />
                ) : null}
              </TreeDepthContext.Provider>
            ) : (
              <div className="property-panel__fields">
                {sectionVisible ? (
                    <ObjectChildren
                      commit={commit}
                      path={[]}
                      readOnly={readOnly}
                      renderers={renderers}
                      schema={schema}
                      value={value}
                    />
                ) : null}
              </div>
            )}
            <BindingPicker />
          </ViewContext.Provider>
        </BindingContext.Provider>
      </ActionWidthContext.Provider>
    </RendererContext.Provider>
  )
}

function RowActionRail({ actions, label }: { actions: readonly RowAction[]; label: string }) {
  const messages = usePropertyPanelMessages()
  const actionWidth = useContext(ActionWidthContext)
  const rootRef = useRef<HTMLDivElement>(null)
  const overflowButtonRef = useRef<HTMLButtonElement>(null)
  const [menuMode, setMenuMode] = useState<'overflow' | null>(null)
  const contextMenu = useComposeContextMenu<readonly RowAction[]>()
  const ordered = [...actions].sort((left, right) => (
    left.priority - right.priority
    || Number(Boolean(left.disabled)) - Number(Boolean(right.disabled))
  ))
  const slots = Math.max(1, Math.min(3, Math.floor((actionWidth - 6) / 27)))
  const hasOverflow = ordered.length > slots
  const direct = hasOverflow ? ordered.slice(0, Math.max(0, slots - 1)) : ordered
  const hidden = hasOverflow ? ordered.slice(Math.max(0, slots - 1)) : []
  const menuActions = hidden

  useEffect(() => {
    const row = rootRef.current?.closest('.property-panel__field, .property-panel__group-header')
    if (!row || ordered.length === 0) return
    const openContextMenu = (event: Event) => {
      if (!(event instanceof MouseEvent)) return
      contextMenu.openAt(event, ordered)
    }
    row.addEventListener('contextmenu', openContextMenu)
    return () => row.removeEventListener('contextmenu', openContextMenu)
  }, [contextMenu, ordered])

  const selectAction = (action: RowAction) => {
    if (action.disabled) return
    action.onSelect()
    setMenuMode(null)
    overflowButtonRef.current?.focus()
  }

  return (
    <>
    <div className="property-panel__actions" ref={rootRef}>
      {direct.map((action) => (
        <Fragment key={action.id}>
          {action.control ?? (
            <button
              aria-label={action.label}
              disabled={action.disabled}
              title={action.label}
              type="button"
              onClick={action.onSelect}
            >{action.icon}</button>
          )}
        </Fragment>
      ))}
      {hasOverflow ? (
        <button
          aria-expanded={menuMode === 'overflow'}
          aria-haspopup="menu"
          aria-label={messages.moreActions(label)}
          className="property-panel__overflow-trigger"
          ref={overflowButtonRef}
          type="button"
          onClick={() => setMenuMode((current) => current ? null : 'overflow')}
        ><MoreIcon /></button>
      ) : null}
      {menuMode === 'overflow' ? (
        <div
          aria-label={messages.actions(label)}
          className="property-panel__overflow-menu"
          role="menu"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            setMenuMode(null)
            overflowButtonRef.current?.focus()
          }}
        >
          {menuActions.map((action) => (
            <button
              disabled={action.disabled}
              key={action.id}
              role="menuitem"
              type="button"
              onClick={() => selectAction(action)}
            >
              {action.icon}<span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
      <ComposeContextMenu {...contextMenu.rootProps}>
        <ComposeContextMenuContent aria-label={messages.actions(label)}>
          {(contextMenu.payload ?? []).map((action) => (
            <ComposeContextMenuItem
              disabled={action.disabled}
              key={action.id}
              onClick={action.onSelect}
            >
              {action.icon}<span>{action.label}</span>
            </ComposeContextMenuItem>
          ))}
        </ComposeContextMenuContent>
      </ComposeContextMenu>
    </>
  )
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
      <circle cx="4" cy="10" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="16" cy="10" r="1.4" />
    </svg>
  )
}

function createBindingTargetState(
  target: PropertyPanelBindingTarget,
  literalValue: unknown,
  readOnly: boolean,
  view: PropertyBindingView,
): PropertyPanelRendererBindingTargetState {
  const resolved = view.resolvedTargets.get(createBindingAddressKey(target.address))
  const state: PropertyPanelRendererBindingTargetState = {
    ...target,
    binding: resolved?.binding,
    variable: resolved?.variable,
    literalValue,
    effectiveValue: resolved?.effectiveValue ?? literalValue,
    status: resolved?.status ?? 'literal',
    message: resolved?.message,
    readOnly,
    openPicker: () => view.openTarget(
      state,
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined,
    ),
  }
  return state
}

function useBuiltInBindingTarget(
  schema: v.GenericSchema,
  path: PropertyPath,
  label: string,
  literalValue: unknown,
  readOnly: boolean,
): PropertyPanelRendererBindingTargetState | undefined {
  const view = useContext(BindingContext)
  const info = inspectSchema(schema)
  if (
    !view.config
    || info.metadata.binding?.enabled !== true
    || !['string', 'number', 'bigint', 'boolean', 'date', 'picklist', 'enum'].includes(info.type)
  ) return undefined
  return createBindingTargetState({
    address: { path, targetId: 'value' },
    label,
    schema,
    semanticScope: info.metadata.binding?.semanticScope,
  }, literalValue, readOnly, view)
}

function useRendererBindingController(
  descriptors: readonly PropertyPanelRendererBindingTargetDescriptor[],
  path: PropertyPath,
  literalValue: unknown,
  readOnly: boolean,
  semanticScope?: string,
): PropertyPanelRendererBindingController | undefined {
  const view = useContext(BindingContext)
  if (!view.config || descriptors.length === 0) return undefined
  const targets = descriptors.map((descriptor) => createBindingTargetState({
    address: { path, targetId: descriptor.id },
    label: descriptor.label,
    schema: descriptor.schema,
    semanticScope: descriptor.semanticScope ?? semanticScope,
  }, descriptor.getValue(literalValue), readOnly, view))
  return {
    targets,
    getTarget: (targetId) => targets.find((target) => target.address.targetId === targetId),
    renderTrigger: (targetId) => {
      const target = targets.find((candidate) => candidate.address.targetId === targetId)
      return target ? <BindingTrigger key={targetId} target={target} /> : null
    },
  }
}

function BindingTrigger({ target }: { target: PropertyPanelRendererBindingTargetState }) {
  const messages = usePropertyPanelMessages()
  const view = useContext(BindingContext)
  if (!view.config) return null
  const Trigger = view.config.renderTrigger
  const bound = Boolean(target.binding)
  const invalid = target.status !== 'literal' && target.status !== 'resolved'
  const variableLabel = target.variable?.label ?? target.binding?.variableId
  const title = bound
    ? `${variableLabel ?? messages.unknownVariable} · ${formatBindingPreview(target.effectiveValue)}`
    : messages.bind(target.label)
  const state = invalid ? 'invalid' : bound ? 'bound' : 'literal'
  return (
    <span
      className="property-panel__binding-slot"
      data-binding-state={state}
    >
      {Trigger ? <Trigger target={target} /> : (
        <button
          aria-description={bound ? title : undefined}
          aria-label={bound
            ? messages.replaceBinding(target.label)
            : messages.bind(target.label)}
          aria-invalid={invalid ? 'true' : undefined}
          className={`property-panel__binding-trigger${bound ? ' property-panel__binding-trigger--bound' : ''}${invalid ? ' property-panel__binding-trigger--invalid' : ''}`}
          disabled={target.readOnly}
          title={target.status !== 'literal' && target.status !== 'resolved'
            ? messages.issue(target.status)
            : title}
          type="button"
          onClick={(event) => view.openTarget(target, event.currentTarget)}
        >
          <BindingIcon />
          {bound ? <span>{variableLabel}</span> : null}
        </button>
      )}
    </span>
  )
}

function BindingPicker() {
  const view = useContext(BindingContext)
  const target = view.activeTarget
  const config = view.config
  if (!target || !config) return null
  return (
    <BindingPickerContent
      config={config}
      key={createBindingAddressKey(target.address)}
      target={target}
      view={view}
    />
  )
}

function BindingPickerContent({
  config,
  target,
  view,
}: {
  config: PropertyPanelBindingConfig
  target: PropertyPanelRendererBindingTargetState
  view: PropertyBindingView
}) {
  const messages = usePropertyPanelMessages()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const candidates = config.variables.filter((variable) => (
    canBindPropertyVariable(target, variable, config.canBind)
    && (!normalizedQuery || [variable.label, variable.id, variable.description]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery))
  ))
  const bind = (variable: typeof candidates[number]) => {
    const next = config.value
      .filter((binding) => createBindingAddressKey(binding.target) !== createBindingAddressKey(target.address))
      .concat({ target: target.address, variableId: variable.id })
    config.onChange(next, { reason: 'bind', target: target.address })
    view.closePicker()
  }
  const unbind = () => {
    config.onChange(
      config.value.filter((binding) => (
        createBindingAddressKey(binding.target) !== createBindingAddressKey(target.address)
      )),
      { reason: 'unbind', target: target.address },
    )
    view.closePicker()
  }
  const Picker = config.renderPicker
  if (Picker) {
    return (
      <Picker
        onBind={bind}
        onClose={view.closePicker}
        onQueryChange={setQuery}
        onUnbind={unbind}
        query={query}
        target={target}
        variables={candidates}
      />
    )
  }
  const anchorRect = view.activeAnchor?.getBoundingClientRect()
  const pickerStyle = anchorRect ? {
    left: `${Math.max(8, anchorRect.right - 264)}px`,
    top: `${anchorRect.bottom + 4}px`,
  } : undefined
  return (
    <div
      aria-label={messages.bind(target.label)}
      className="property-panel__binding-picker"
      role="dialog"
      style={pickerStyle}
      onKeyDown={(event) => {
        if (event.key === 'Escape') view.closePicker()
      }}
    >
      <header>
        <strong>{messages.bind(target.label)}</strong>
        <button
          aria-label={messages.closeVariablePicker}
          type="button"
          onClick={view.closePicker}
        >×</button>
      </header>
      <input
        aria-label={messages.searchVariables}
        autoFocus
        placeholder={messages.searchVariables}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="property-panel__binding-options">
        {(['page', 'global'] as const).map((scope) => {
          const variables = candidates.filter((variable) => variable.scope === scope)
          if (variables.length === 0) return null
          return (
            <section key={scope}>
              <h3>{scope === 'page' ? messages.pageVariables : messages.globalVariables}</h3>
              {variables.map((variable) => (
                <button key={variable.id} type="button" onClick={() => bind(variable)}>
                  <span>{variable.label}</span>
                  <output>{formatBindingPreview(variable.value)}</output>
                </button>
              ))}
            </section>
          )
        })}
        {candidates.length === 0 ? <p>{messages.noVariables}</p> : null}
      </div>
      {target.binding ? (
        <footer>
          <button disabled={target.readOnly} type="button" onClick={unbind}>
            {messages.unbind}
          </button>
        </footer>
      ) : null}
    </div>
  )
}

function BindingIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M7.8 6.1 6.2 4.5a3 3 0 0 0-4.2 4.2l2.2 2.2a3 3 0 0 0 4.2 0l1.3-1.3M12.2 13.9l1.6 1.6a3 3 0 0 0 4.2-4.2l-2.2-2.2a3 3 0 0 0-4.2 0l-1.3 1.3M7 13l6-6" />
    </svg>
  )
}

function formatBindingPreview(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toLocaleDateString()
  if (value === undefined) return 'undefined'
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return String(value)
    return serialized.length > 48 ? `${serialized.slice(0, 45)}…` : serialized
  } catch {
    return String(value)
  }
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
  const messages = usePropertyPanelMessages()
  const info = inspectSchema(schema)
  const renderers = useContext(RendererContext)
  const bindingView = useContext(BindingContext)
  const depth = useContext(TreeDepthContext)
  const view = useContext(ViewContext)
  const rendererLabelId = useId()
  const baseline = view.hasDefaultValue ? getValueAtPath(view.defaultValue, path) : undefined
  const descendantBindings = bindingView.config?.value.filter((binding) => (
    isPathAtOrBelow(binding.target.path, path)
  )) ?? []
  const renderer = info.metadata.editor
    ? renderers.find((candidate) => candidate.id === info.metadata.editor)
    : renderers.find((candidate) => candidate.matches?.(info.base, info.metadata))
  const missing = value === undefined || value === null
  const supportsPresence = info.optional || info.nullable
  const togglePresence = (present: boolean) => {
    const nextValue = present
          ? renderer?.createDefault?.(info.base) ?? createInitialValue(info.base)
          : info.nullable ? null : undefined
    commit(path, nextValue, 'set-presence', {
      bindingMutation: present ? undefined : { type: 'clear-descendants', path },
    })
  }
  const presenceAction: RowAction | null = supportsPresence ? {
    id: 'presence',
    label: messages.presence(label),
    priority: 10,
    disabled: readOnly,
    control: (
      <input
        aria-label={messages.presence(label)}
        checked={!missing}
        disabled={readOnly}
        type="checkbox"
        onChange={(event) => togglePresence(event.target.checked)}
      />
    ),
    onSelect: () => togglePresence(missing),
  } : null
  const resetAction: RowAction | null = view.hasDefaultValue
    && v.safeParse(schema, baseline).success
    && (!deepEqual(value, baseline) || descendantBindings.length > 0) ? {
      id: 'reset',
      label: messages.reset(label),
      priority: 20,
      disabled: readOnly,
      icon: <ResetIcon />,
      onSelect: () => {
        const committed = commit(path, cloneValue(baseline), 'reset')
        if (!committed || descendantBindings.length === 0 || !bindingView.config) return
        bindingView.config.onChange(
          bindingView.config.value.filter((binding) => (
            !isPathAtOrBelow(binding.target.path, path)
          )),
          {
            reason: 'reset',
            target: descendantBindings[0]?.target ?? { path, targetId: 'value' },
          },
        )
      },
    } : null
  const actions = [presenceAction, resetAction, ...(nodeActions ?? [])]
    .filter((action): action is RowAction => action !== null)
  const rendererBindingDescriptors = renderer && info.metadata.binding?.enabled === true
    ? renderer.bindingTargets?.({
        path,
        schema,
        metadata: info.metadata,
        value,
      }) ?? []
    : []
  const rendererBinding = useRendererBindingController(
    rendererBindingDescriptors,
    path,
    value,
    readOnly,
    info.metadata.binding?.semanticScope,
  )
  if (
    info.metadata.hidden
    || (info.metadata.advanced && !view.showAdvanced)
    || !matchesNode(schema, value, baseline, path, label, view)
  ) return null

  // renderer 声明接管空值时不短路：页面引用等 editor 需要在未设置时仍能选择或接受拖入。
  if (supportsPresence && missing && renderer?.rendersEmptyState !== true) {
    return (
      <PropertyRow label={label} nodeActions={actions} path={path}>
        <span className="property-panel__empty">未设置</span>
      </PropertyRow>
    )
  }

  if (renderer) {
    const Renderer = renderer.component
    const LabelRenderer = renderer.labelComponent
    const layout = resolveRendererLayout(info.metadata.layout, renderer.layout)
    const rendererProps = {
      binding: rendererBinding,
      commit: (candidate: unknown, reason: PropertyPanelChangeReason = 'commit') => (
        commit(path, candidate, reason)
      ),
      issues: issuesAtPath(view.issues, path),
      label,
      metadata: info.metadata,
      path,
      readOnly,
      renderInlineValue: (options: PropertyPanelInlineValueProps) => (
        <InlinePropertyControl
          {...options}
          issues={issuesAtPath(view.issues, path, true)}
          path={[...path, '$value']}
          readOnly={readOnly}
          renderers={renderers}
        />
      ),
      schema,
      value,
    }
    const rendererElement = (
      <Renderer {...rendererProps} />
    )
    const labelElement = LabelRenderer ? <LabelRenderer {...rendererProps} /> : label
    if (layout === 'full-width') {
      return (
        <div
          className="property-panel__field property-panel__field--full-width"
          data-property-depth={depth}
          data-property-layout={layout}
          data-property-nested={depth > 1 ? 'true' : undefined}
          data-property-path={path.join('.')}
          style={createFieldIndentStyle(depth)}
        >
          <span
            className={`property-panel__label${LabelRenderer ? ' property-panel__label--interactive' : ''}`}
            id={rendererLabelId}
          >{labelElement}</span>
          <RowActionRail actions={actions} label={label} />
          <div
            aria-labelledby={rendererLabelId}
            className="property-panel__editor property-panel__editor--full-width"
            data-property-renderer-content=""
            role="group"
          >
            <div className="property-panel__control property-panel__control--full-width">
              {rendererElement}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div
        className="property-panel__field"
        data-property-depth={depth}
        data-property-layout={layout}
        data-property-nested={depth > 1 ? 'true' : undefined}
        data-property-path={path.join('.')}
        style={createFieldIndentStyle(depth)}
      >
        <span className={`property-panel__label${LabelRenderer ? ' property-panel__label--interactive' : ''}`}>
          {labelElement}
        </span>
        <div className="property-panel__editor">
          <div className="property-panel__control">
            {rendererElement}
          </div>
        </div>
        <RowActionRail actions={actions} label={label} />
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

/**
 * 复用实例 renderer registry 渲染嵌在复合 editor 内的 Value。
 * Map 的 Value 不能再创建一层 property row，否则会把 Key/Value 拆成两行。
 */
function InlinePropertyControl({
  commit,
  issues,
  label,
  path,
  readOnly,
  renderers,
  schema,
  value,
}: PropertyPanelInlineValueProps & {
  readonly issues: readonly v.BaseIssue<unknown>[]
  readonly path: PropertyPath
  readonly readOnly: boolean
  readonly renderers: readonly PropertyPanelRenderer[]
}) {
  const info = inspectSchema(schema)
  const renderer = info.metadata.editor
    ? renderers.find((candidate) => candidate.id === info.metadata.editor)
    : renderers.find((candidate) => candidate.matches?.(info.base, info.metadata))
  if (renderer) {
    const Renderer = renderer.component
    return (
      <Renderer
        commit={commit}
        issues={issues}
        label={label}
        metadata={info.metadata}
        path={path}
        readOnly={readOnly}
        renderInlineValue={(options) => (
          <InlinePropertyControl
            {...options}
            issues={issues}
            path={[...path, '$value']}
            readOnly={readOnly}
            renderers={renderers}
          />
        )}
        schema={schema}
        value={value}
      />
    )
  }

  const runtime = info.base as RuntimeSchema
  if (info.type === 'picklist' || info.type === 'enum') {
    return (
      <select
        aria-label={label}
        disabled={readOnly}
        value={String(value ?? '')}
        onChange={(event) => {
          const option = runtime.options?.find((candidate) => String(candidate) === event.target.value)
          commit(option, 'input')
        }}
      >
        {runtime.options?.map((option) => {
          const key = String(option)
          return <option key={key} value={key}>{info.metadata.optionLabels?.[key] ?? key}</option>
        })}
      </select>
    )
  }
  if (info.type === 'string') {
    return (
      <input
        aria-label={label}
        disabled={readOnly}
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => commit(event.target.value, 'input')}
      />
    )
  }
  if (info.type === 'number') {
    return (
      <input
        aria-label={label}
        disabled={readOnly}
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(event) => commit(Number(event.target.value), 'input')}
      />
    )
  }
  if (info.type === 'boolean') {
    return (
      <input
        aria-label={label}
        checked={Boolean(value)}
        disabled={readOnly}
        type="checkbox"
        onChange={(event) => commit(event.target.checked, 'input')}
      />
    )
  }
  return <span role="alert">{label}（{info.type}）暂不支持作为 Map Value</span>
}

interface GroupProps extends PropertyNodeProps {
  nodeActions: readonly RowAction[]
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
  nodeActions: readonly RowAction[]
  initiallyExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const depth = useContext(TreeDepthContext)
  const { query } = useContext(ViewContext)
  const visibleExpanded = query.trim() ? true : expanded
  return (
    <section
      className="property-panel__group"
      data-property-depth={depth}
      style={createGroupIndentStyle(depth)}
    >
      <div className="property-panel__group-header">
        <button
          aria-expanded={visibleExpanded}
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronIcon expanded={visibleExpanded} />
          {label}
        </button>
        <RowActionRail actions={nodeActions} label={label} />
      </div>
      {visibleExpanded ? (
        <TreeDepthContext.Provider value={depth + 1}>
          <div className="property-panel__group-content">{children}</div>
        </TreeDepthContext.Provider>
      ) : null}
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
      <GroupShell key={`section-${group.section}`} label={group.section} nodeActions={[]}>
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
  const messages = usePropertyPanelMessages()
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
      nodeActions={[{
        id: 'add',
        label: messages.add(label),
        priority: 10,
        disabled: readOnly || !canAdd,
        icon: <PlusIcon />,
        onSelect: add,
      }, ...nodeActions]}
    >
      {itemSchema ? items.map((item, index) => {
        const itemLabel = `${label} ${index + 1}`
        return (
          <PropertyNode
            key={`${path.join('.')}-${index}`}
            commit={commit}
            label={itemLabel}
            nodeActions={[
              {
                id: 'move-up',
                label: messages.moveUp(itemLabel),
                priority: 40,
                disabled: readOnly || index === 0,
                icon: <ArrowIcon direction="up" />,
                onSelect: () => {
                  const next = [...items]
                  ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                  commit(path, next, 'array-move', {
                    bindingMutation: { type: 'array-move', path, from: index, to: index - 1 },
                  })
                },
              },
              {
                id: 'move-down',
                label: messages.moveDown(itemLabel),
                priority: 40,
                disabled: readOnly || index === items.length - 1,
                icon: <ArrowIcon direction="down" />,
                onSelect: () => {
                  const next = [...items]
                  ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                  commit(path, next, 'array-move', {
                    bindingMutation: { type: 'array-move', path, from: index, to: index + 1 },
                  })
                },
              },
              {
                id: 'delete',
                label: messages.remove(itemLabel),
                priority: 30,
                disabled: readOnly,
                icon: <CloseIcon />,
                onSelect: () => commit(
                  path,
                  items.filter((_, itemIndex) => itemIndex !== index),
                  'array-remove',
                  { bindingMutation: { type: 'array-remove', path, index } },
                ),
              },
            ]}
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
  const messages = usePropertyPanelMessages()
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
      nodeActions={[
        ...(restSchema ? [{
          id: 'add',
          label: messages.add(label),
          priority: 10,
          disabled: readOnly || !canAdd,
          icon: <PlusIcon />,
          onSelect: () => commit(path, [...items, createInitialValue(restSchema)], 'array-add'),
        } satisfies RowAction] : []),
        ...nodeActions,
      ]}
    >
      {schemas.map((itemSchema, index) => {
        const itemLabel = `${label} ${index + 1}`
        const restItem = index >= fixedSchemas.length
        return (
          <PropertyNode
            key={`${path.join('.')}-${index}`}
            commit={commit}
            label={itemLabel}
            nodeActions={restItem ? [{
              id: 'delete',
              label: messages.remove(itemLabel),
              priority: 30,
              disabled: readOnly,
              icon: <CloseIcon />,
              onSelect: () => commit(
                path,
                items.filter((_, itemIndex) => itemIndex !== index),
                'array-remove',
                { bindingMutation: { type: 'array-remove', path, index } },
              ),
            }] : []}
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
  const messages = usePropertyPanelMessages()
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
      nodeActions={[{
        id: 'add',
        label: messages.add(label),
        priority: 10,
        disabled: readOnly || !canAdd,
        icon: <PlusIcon />,
        onSelect: () => commit(
          path,
          { ...Object.fromEntries(entries), [nextKey]: nextValue },
          'record-add',
        ),
      }, ...nodeActions]}
    >
      {valueSchema ? entries.map(([key, entryValue], index) => (
        <div className="property-panel__record" key={key}>
          <input
            aria-label={messages.recordKey(label, index + 1)}
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
                bindingMutation: { type: 'record-rename', path, from: key, to: replacement },
              })
            }}
          />
          <PropertyNode
            commit={commit}
            label={messages.recordValue(label, key)}
            nodeActions={[{
              id: 'delete',
              label: messages.remove(`${label} ${key}`),
              priority: 30,
              disabled: readOnly,
              icon: <CloseIcon />,
              onSelect: () => commit(
                  path,
                  Object.fromEntries(entries.filter(([entryKey]) => entryKey !== key)),
                  'record-remove',
                  { bindingMutation: { type: 'record-remove', path, key } },
                ),
            }]}
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
  const messages = usePropertyPanelMessages()
  const runtime = schema as RuntimeSchema
  const options = (runtime.options ?? []).filter((option): option is v.GenericSchema => (
    Boolean(option && typeof option === 'object' && 'kind' in option)
  ))
  const candidates = options.map((option) => createInitialValue(option))
  const activeIndex = Math.max(0, options.findIndex((option) => v.safeParse(option, value).success))
  const activeSchema = options[activeIndex]
  return (
    <GroupShell initiallyExpanded={initiallyExpanded} label={label} nodeActions={nodeActions}>
      <PropertyRow label={messages.unionBranch(label)} nodeActions={[]} path={[...path, '$branch']}>
        <select
          aria-label={messages.unionBranch(label)}
          disabled={readOnly}
          value={String(activeIndex)}
          onChange={(event) => {
            const index = Number(event.target.value)
            commit(path, candidates[index], 'union-switch', {
              bindingMutation: { type: 'clear-descendants', path },
            })
          }}
        >
          {options.map((option, index) => (
            <option
              disabled={!v.safeParse(option, candidates[index]).success}
              key={index}
              value={String(index)}
            >
              {inspectSchema(option).title ?? messages.branch(index + 1)}
            </option>
          ))}
        </select>
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
  nodeActions,
  path,
}: {
  children: ReactNode
  label: string
  nodeActions: readonly RowAction[]
  path: PropertyPath
}) {
  const depth = useContext(TreeDepthContext)
  return (
    <div
      className="property-panel__field"
      data-property-depth={depth}
      data-property-nested={depth > 1 ? 'true' : undefined}
      data-property-path={path.join('.')}
      style={createFieldIndentStyle(depth)}
    >
      <span className="property-panel__label">{label}</span>
      <div className="property-panel__editor">{children}</div>
      <RowActionRail actions={nodeActions} label={label} />
    </div>
  )
}

function PrimitiveField({ schema, value, label, path, readOnly, commit, nodeActions }: GroupProps) {
  const info = inspectSchema(schema)
  const { showDescriptions } = useContext(ViewContext)
  const depth = useContext(TreeDepthContext)
  const id = `property-${path.map(String).join('-')}`
  const runtime = info.base as RuntimeSchema
  const bindingTarget = useBuiltInBindingTarget(schema, path, label, value, readOnly)
  const bound = Boolean(bindingTarget?.binding)
  const displayValue = bindingTarget?.effectiveValue ?? value
  const [draft, setDraft] = useState<{ source: unknown; text: string; error?: string }>({
    source: displayValue,
    text: displayValue === undefined ? '' : String(displayValue),
  })
  const draftActive = Object.is(draft.source, displayValue)
  const textValue = draftActive ? draft.text : displayValue === undefined ? '' : String(displayValue)
  const activeError = draftActive ? draft.error : undefined
  let editor: ReactNode

  if (info.type === 'string') {
    editor = (
      <input
        aria-label={label}
        disabled={readOnly && !bound}
        id={id}
        placeholder={info.metadata.placeholder}
        readOnly={bound || readOnly}
        type="text"
        aria-invalid={activeError ? 'true' : undefined}
        value={textValue}
        onChange={(event) => {
          if (bound) return
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
      if (bound) return
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
        disabled={readOnly && !bound}
        id={id}
        max={info.constraints.max?.toString()}
        min={info.constraints.min?.toString()}
        step={info.constraints.step?.toString()}
        readOnly={bound || readOnly}
        type="number"
        value={textValue}
        onBlur={submitNumber}
        onChange={(event) => {
          if (!bound) setDraft({ source: value, text: event.target.value })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !bound) submitNumber()
          if (event.key === 'Escape' && !bound) setDraft({ source: value, text: String(value ?? '') })
        }}
      />
    )
  } else if (info.type === 'boolean') {
    editor = (
      <input
        aria-label={label}
        aria-readonly={bound ? 'true' : undefined}
        checked={Boolean(displayValue)}
        disabled={readOnly && !bound}
        id={id}
        type="checkbox"
        onChange={(event) => {
          if (!bound) commit(path, event.target.checked, 'input')
        }}
      />
    )
  } else if (info.type === 'date') {
    const dateValue = displayValue instanceof Date && !Number.isNaN(displayValue.valueOf())
      ? displayValue.toISOString().slice(0, 10)
      : ''
    editor = (
      <input
        aria-label={label}
        disabled={readOnly && !bound}
        id={id}
        readOnly={bound || readOnly}
        type="date"
        value={dateValue}
        onChange={(event) => {
          if (!bound) commit(path, new Date(`${event.target.value}T00:00:00.000Z`), 'commit')
        }}
      />
    )
  } else if (info.type === 'picklist' || info.type === 'enum') {
    editor = (
      <select
        aria-label={label}
        aria-readonly={bound ? 'true' : undefined}
        disabled={readOnly && !bound}
        id={id}
        value={String(displayValue)}
        onChange={(event) => {
          if (bound) return
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
    <div
      className="property-panel__field"
      data-property-depth={depth}
      data-property-nested={depth > 1 ? 'true' : undefined}
      data-property-path={path.join('.')}
      style={createFieldIndentStyle(depth)}
    >
      <label htmlFor={id}>
        <span>{label}</span>
        {showDescriptions && info.description
          ? <small className="property-panel__description">{info.description}</small>
          : null}
      </label>
      <div className="property-panel__editor">
        <div className="property-panel__control">
          {bindingTarget ? (
            <div className="property-panel__binding-target">
              <div className="property-panel__binding-control">
                {editor}
                {info.metadata.unit
                  ? <span className="property-panel__unit">{info.metadata.unit}</span>
                  : null}
              </div>
              <BindingTrigger target={bindingTarget} />
            </div>
          ) : (
            <>
              {editor}
              {info.metadata.unit
                ? <span className="property-panel__unit">{info.metadata.unit}</span>
                : null}
            </>
          )}
        </div>
        {activeError ? <span role="alert">{activeError}</span> : null}
      </div>
      <RowActionRail actions={nodeActions} label={label} />
    </div>
  )
}

type TreeIndentStyle = CSSProperties & {
  '--pp-branch-depth'?: number
  '--pp-field-depth'?: number
  '--pp-group-depth'?: number
}

// 同一层的 group guide 与下一层 field branch 必须落在同一 X 坐标；14px 是 UE4 紧凑层级步长，
// 文字比竖线再右移 14px。两者分别在 3/4 层封顶，深层仍保留可读的标签宽度。
function createGroupIndentStyle(depth: number): TreeIndentStyle {
  return {
    '--pp-group-depth': Math.min(depth, 3),
  }
}

function createFieldIndentStyle(depth: number): TreeIndentStyle {
  return {
    '--pp-field-depth': Math.min(depth, 4),
    '--pp-branch-depth': Math.min(Math.max(depth - 1, 0), 3),
  }
}

function resolveRendererLayout(
  metadataLayout: PropertyPanelRenderer['layout'],
  rendererLayout: PropertyPanelRenderer['layout'],
): NonNullable<PropertyPanelRenderer['layout']> {
  if (metadataLayout === 'inline' || metadataLayout === 'full-width') return metadataLayout
  if (rendererLayout === 'inline' || rendererLayout === 'full-width') return rendererLayout
  return 'inline'
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
  const children = childNodes(info.base, value, baseline, path, label, view.recordValue)
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
    filterMatches = (view.hasDefaultValue && !deepEqual(value, baseline))
      || view.boundTargets.some((target) => isPathAtOrBelow(target.address.path, path))
  } else if (view.filter === 'errors') {
    filterMatches = issuesAtPath(view.issues, path, true).length > 0
      || view.bindingIssues.some((issue) => isPathAtOrBelow(issue.target.path, path))
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
  recordValue: (label: string, key: string) => string,
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
      label: recordValue(parentLabel, key),
    }))
  }
  if (info.type === 'union' || info.type === 'variant') {
    const active = (runtime.options ?? []).find((option): option is v.GenericSchema => (
      Boolean(option && typeof option === 'object' && 'kind' in option)
      && v.safeParse(option as v.GenericSchema, value).success
    ))
    return active
      ? childNodes(active, value, baseline, path, parentLabel, recordValue)
      : []
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

function isPathAtOrBelow(candidate: PropertyPath, ancestor: PropertyPath): boolean {
  return ancestor.every((segment, index) => Object.is(candidate[index], segment))
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
