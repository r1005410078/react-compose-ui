/**
 * 提供由 Valibot Schema 驱动、受控且可扩展的 React 组件属性面板。
 *
 * @remarks
 * 本包只生成属性编辑 UI 和变更意图，不拥有页面文档、撤销历史或持久化状态。
 *
 * @packageDocumentation
 */
import { useEffect, useRef, useState } from 'react'
import type {
  ComponentType,
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from 'react'
import * as v from 'valibot'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { FilterIcon, SearchIcon, SettingsIcon } from '../icons'
import { remapPropertyBindings } from '../property-bindings'
// eslint-disable-next-line react-refresh/only-export-components -- 公共入口必须同时导出纯绑定解析函数。
export { resolvePropertyBindings } from '../property-bindings'
export type {
  ResolvePropertyBindingsOptions,
  ResolvePropertyBindingsResult,
} from '../property-bindings'
import {
  getValueAtPath,
  setValueAtPath,
} from '../schema-model'
import { PropertyTree } from '../property-tree'
import { usePropertyPanelMessages } from '../property-panel-i18n'
import type { PropertyPanelFilter, TreeCommitOptions } from '../property-tree'
import '../styles.css'

/** 属性在受控值中的稳定路径。 */
export type PropertyPath = readonly (string | number)[]

/** 自定义 renderer 在属性树中的字段布局。 */
export type PropertyPanelRendererLayout = 'inline' | 'full-width'

/** 一个可绑定逻辑输入在属性面板中的稳定地址。 */
export interface PropertyPanelBindingAddress {
  /** 字段在完整 Valibot input 中的路径。 */
  path: PropertyPath
  /** renderer 内的逻辑目标 ID；内置字段固定为 `value`。 */
  targetId: string
}

/** 可由宿主提供给属性面板的只读变量。 */
export interface PropertyPanelVariable {
  /** 变量在宿主生命周期内的稳定 ID。 */
  id: string
  /** 变量选择器中显示的名称。 */
  label: string
  /** 变量所属的宿主作用域。 */
  scope: 'page' | 'global'
  /** 当前解析值；改变它只会更新 effective value。 */
  value: unknown
  /** 变量选择器中的可选补充说明。 */
  description?: string
  /** 变量允许匹配的可选业务语义范围。 */
  semanticScopes?: readonly string[]
}

/** 一条独立于字面属性值保存的单向变量绑定。 */
export interface PropertyPanelBinding {
  /** 被绑定的字段或 renderer 子目标。 */
  target: PropertyPanelBindingAddress
  /** 引用的宿主变量 ID。 */
  variableId: string
}

/** 绑定目标的展示与校验描述。 */
export interface PropertyPanelBindingTarget {
  /** 目标的稳定地址。 */
  address: PropertyPanelBindingAddress
  /** 选择器和状态提示使用的名称。 */
  label: string
  /** 校验变量当前值的同步 Valibot Schema。 */
  schema: v.GenericSchema
  /** 限制候选变量的可选业务语义范围。 */
  semanticScope?: string
}

/** 纯绑定解析得到的单个目标状态。 */
export interface PropertyPanelResolvedBindingTarget extends PropertyPanelBindingTarget {
  /** 当前保存的绑定。 */
  binding: PropertyPanelBinding
  /** 解析到的变量；变量缺失时为空。 */
  variable?: PropertyPanelVariable
  /** 绑定前保留的字面值。 */
  literalValue: unknown
  /** 实际用于预览或 Canvas 的值；错误时回退为字面值。 */
  effectiveValue: unknown
  /** 当前解析状态。 */
  status: 'resolved' | 'missing-variable' | 'invalid-variable' | 'invalid-root' | 'unknown-target'
  /** 面向用户的错误说明。 */
  message?: string
}

/** 绑定解析结果中的结构化问题。 */
export interface PropertyPanelBindingIssue {
  /** 出错的目标地址。 */
  target: PropertyPanelBindingAddress
  /** 可稳定判断的问题类型。 */
  code: Exclude<PropertyPanelResolvedBindingTarget['status'], 'resolved'>
  /** 面向用户的错误说明。 */
  message: string
}

/** 自定义 renderer 声明的一个稳定逻辑输入。 */
export interface PropertyPanelRendererBindingTargetDescriptor {
  /** renderer 内稳定且不可随语言变化的目标 ID。 */
  id: string
  /** 目标的显示名称。 */
  label: string
  /** 校验变量值的同步 Valibot Schema。 */
  schema: v.GenericSchema
  /** 限制变量候选的可选业务语义范围。 */
  semanticScope?: string
  /** 从 renderer 字段值读取该逻辑输入。 */
  getValue: (value: unknown) => unknown
  /** 不可变地把逻辑输入写回 renderer 字段值。 */
  setValue: (value: unknown, targetValue: unknown) => unknown
}

/** renderer 创建绑定目标描述时获得的字段上下文。 */
export interface PropertyPanelRendererBindingTargetsContext {
  /** renderer 字段路径。 */
  path: PropertyPath
  /** 字段原始 Schema。 */
  schema: v.GenericSchema
  /** 字段展示 metadata。 */
  metadata: PropertyPanelMetadata
  /** 当前字面字段值。 */
  value: unknown
}

/** 自定义 renderer 内单个目标的交互状态。 */
export interface PropertyPanelRendererBindingTargetState extends PropertyPanelBindingTarget {
  /** 当前保存的绑定；未绑定时为空。 */
  binding?: PropertyPanelBinding
  /** 当前解析到的变量。 */
  variable?: PropertyPanelVariable
  /** 绑定前保留的字面值。 */
  literalValue: unknown
  /** 当前预览和 Canvas 应使用的值。 */
  effectiveValue: unknown
  /** 当前绑定解析状态。 */
  status: PropertyPanelResolvedBindingTarget['status'] | 'literal'
  /** 绑定错误的可读说明。 */
  message?: string
  /** 面板或字段是否禁止变更绑定。 */
  readOnly: boolean
  /** 打开该目标的绑定选择器。 */
  openPicker: () => void
}

/** 自定义 renderer 用来访问其逻辑子目标的控制器。 */
export interface PropertyPanelRendererBindingController {
  /** 当前 renderer 声明的全部逻辑目标状态。 */
  targets: readonly PropertyPanelRendererBindingTargetState[]
  /** 按稳定 ID 查询目标。 */
  getTarget: (targetId: string) => PropertyPanelRendererBindingTargetState | undefined
  /**
   * 渲染与内置字段一致的完整绑定槽位。
   *
   * @remarks
   * 把返回节点放在对应逻辑控件之后，并让二者共同位于
   * `.property-panel__binding-target` 中；槽位负责常驻占位、响应式收缩和 trigger 状态显示。
   */
  renderTrigger: (targetId: string) => ReactNode
}

/** 自定义绑定入口获得的属性。 */
export interface PropertyPanelBindingTriggerRendererProps {
  /** 当前目标状态。 */
  target: PropertyPanelRendererBindingTargetState
}

/** 自定义变量选择器获得的属性。 */
export interface PropertyPanelBindingPickerRendererProps {
  /** 正在选择变量的目标。 */
  target: PropertyPanelRendererBindingTargetState
  /** 已通过 Schema、语义范围和宿主规则的候选。 */
  variables: readonly PropertyPanelVariable[]
  /** 当前搜索文本。 */
  query: string
  /** 更新搜索文本。 */
  onQueryChange: (query: string) => void
  /** 选择一个候选变量。 */
  onBind: (variable: PropertyPanelVariable) => void
  /** 删除当前绑定。 */
  onUnbind: () => void
  /** 关闭选择器并恢复入口焦点。 */
  onClose: () => void
}

/** 绑定入口的可替换 React renderer。 */
export type PropertyPanelBindingTriggerRenderer = ComponentType<PropertyPanelBindingTriggerRendererProps>

/** 绑定选择器的可替换 React renderer。 */
export type PropertyPanelBindingPickerRenderer = ComponentType<PropertyPanelBindingPickerRendererProps>

/** 宿主提供的独立受控绑定配置。 */
export interface PropertyPanelBindingConfig {
  /** 当前组件实例的绑定集合。 */
  value: readonly PropertyPanelBinding[]
  /** 页面与全局变量的只读快照。 */
  variables: readonly PropertyPanelVariable[]
  /** 绑定集合发生用户或结构变化时调用。 */
  onChange: (
    next: readonly PropertyPanelBinding[],
    change: {
      /** 绑定变化的业务原因。 */
      reason: 'bind' | 'unbind' | 'reset' | 'remap'
      /** 发起变化或结构重映射的目标。 */
      target: PropertyPanelBindingAddress
    },
  ) => void
  /** 对已通过 Schema 与语义范围的变量执行宿主级授权。 */
  canBind?: (target: PropertyPanelBindingTarget, variable: PropertyPanelVariable) => boolean
  /** 覆盖默认绑定入口。 */
  renderTrigger?: PropertyPanelBindingTriggerRenderer
  /** 覆盖默认变量选择器。 */
  renderPicker?: PropertyPanelBindingPickerRenderer
}

/** 字段 metadata 中的变量绑定配置。 */
export interface PropertyPanelMetadataBinding {
  /** 是否允许该字段绑定；内置与自定义字段均默认关闭。 */
  enabled?: boolean
  /** 限制变量候选的业务语义范围。 */
  semanticScope?: string
}

/** 属性面板发出的修改原因。 */
export type PropertyPanelChangeReason =
  | 'input'
  | 'commit'
  | 'reset'
  | 'set-presence'
  | 'array-add'
  | 'array-remove'
  | 'array-move'
  | 'record-add'
  | 'record-rename'
  | 'record-remove'
  | 'union-switch'

/** Valibot metadata 中 `propertyPanel` 命名空间支持的展示配置。 */
export interface PropertyPanelMetadata {
  /** 选择实例级 renderer 的稳定 ID。 */
  editor?: string
  /** 覆盖匹配 renderer 的默认字段布局；仅对自定义 renderer 生效。 */
  layout?: PropertyPanelRendererLayout
  /** 将同级字段收纳到指定展示分组。 */
  section?: string
  /** 同级字段的升序展示顺序，未设置的字段保持 Schema 顺序。 */
  order?: number
  /** 从属性树中完全隐藏该字段。 */
  hidden?: boolean
  /** 显示字段但禁用其修改操作。 */
  readOnly?: boolean
  /** 默认隐藏、由设置菜单控制的高级字段。 */
  advanced?: boolean
  /** 显示在内置输入控件旁的单位。 */
  unit?: string
  /** 传递给内置文本输入控件的占位内容。 */
  placeholder?: string
  /** picklist 或 enum 值到显示名称的映射。 */
  optionLabels?: Readonly<Record<string, string>>
  /** 对象或集合分组是否默认折叠。 */
  collapsed?: boolean
  /** 变量绑定的可用性和语义范围。 */
  binding?: PropertyPanelMetadataBinding
}

/** 属性面板头部内容。 */
export interface PropertyPanelHeader {
  /** 面板头部主标题。 */
  title: ReactNode
  /** 面板头部可选副标题。 */
  subtitle?: ReactNode
  /** 面板头部可选图标。 */
  icon?: ReactNode
}

/** 一次已通过完整 Schema 校验的属性修改。 */
export interface PropertyPanelChange<TOutput = unknown> {
  /** 发生修改的字段路径。 */
  path: PropertyPath
  /** 修改前的字段值。 */
  previousValue: unknown
  /** 已写入候选完整 input 的字段值。 */
  value: unknown
  /** 产生修改的交互类型。 */
  reason: PropertyPanelChangeReason
  /** 完整 Schema 解析后的输出值。 */
  output: TOutput
}

/** 自定义属性 renderer 获得的字段上下文。 */
export interface PropertyPanelRendererProps {
  /** 自定义字段在完整受控值中的路径。 */
  path: PropertyPath
  /** 字段声明的原始 Valibot Schema。 */
  schema: v.GenericSchema
  /** 字段的 `propertyPanel` metadata。 */
  metadata: PropertyPanelMetadata
  /** 当前受控字段值。 */
  value: unknown
  /** 当前字段的完整 Schema issues。 */
  issues: readonly v.BaseIssue<unknown>[]
  /** renderer 是否必须保持只读。 */
  readOnly: boolean
  /** 提交候选字段值；返回值表示完整 Schema 是否校验成功。 */
  commit: (value: unknown, reason?: PropertyPanelChangeReason) => boolean
  /** renderer 声明逻辑子目标后由面板提供的绑定控制器。 */
  binding?: PropertyPanelRendererBindingController
}

/** 实例级自定义属性 renderer 定义。 */
export interface PropertyPanelRenderer {
  /** renderer 的实例内稳定标识。 */
  id: string
  /** 未显式指定 editor ID 时，用基础 Schema 和 metadata 判断是否匹配。 */
  matches?: (schema: v.GenericSchema, metadata: PropertyPanelMetadata) => boolean
  /** 渲染自定义字段 UI 的 React 组件。 */
  component: ComponentType<PropertyPanelRendererProps>
  /** renderer 的默认字段布局，字段 metadata 可以覆盖该值。 */
  layout?: PropertyPanelRendererLayout
  /** 为 optional、nullable 等缺失字段生成可校验的初值。 */
  createDefault?: (schema: v.GenericSchema) => unknown
  /** 声明该 renderer 内可独立绑定的稳定逻辑输入；字段 metadata 还必须显式启用绑定。 */
  bindingTargets?: (
    context: PropertyPanelRendererBindingTargetsContext,
  ) => readonly PropertyPanelRendererBindingTargetDescriptor[]
}

/** `ComposePropertyPanel` 的受控属性。 */
export interface ComposePropertyPanelProps<TSchema extends v.GenericSchema>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  /** 驱动字段结构和完整候选校验的同步 Valibot Schema。 */
  schema: TSchema
  /** 由宿主持有的完整 Schema input。 */
  value: v.InferInput<TSchema>
  /** 用于已修改筛选和重置操作的有效基线值。 */
  defaultValue?: v.InferInput<TSchema>
  /** 可选的显式面板头部；不会从根 Schema 隐式生成。 */
  header?: PropertyPanelHeader
  /** 仅作用于当前面板实例的自定义 renderer registry。 */
  renderers?: readonly PropertyPanelRenderer[]
  /** 是否禁用面板内全部修改操作。 */
  readOnly?: boolean
  /** 与字面 `value` 分离、由宿主保存的可选变量绑定配置。 */
  binding?: PropertyPanelBindingConfig
  /** 完整候选 input 校验成功后调用的受控变更回调。 */
  onValueChange?: (
    value: v.InferInput<TSchema>,
    change: PropertyPanelChange<v.InferOutput<TSchema>>,
  ) => void
}

/**
 * 渲染由同步 Valibot Schema 驱动的受控属性面板。
 *
 * @param props - Schema、受控值、renderer registry 与标准 `div` 属性。
 * @returns 属性面板 React 元素。
 * @public
 */
export function ComposePropertyPanel<TSchema extends v.GenericSchema>({
  schema,
  value,
  defaultValue,
  header,
  renderers,
  binding,
  readOnly = false,
  onValueChange,
  className,
  style,
  ...htmlProps
}: ComposePropertyPanelProps<TSchema>) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const messages = usePropertyPanelMessages()
  const rootRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{
    kind: 'label' | 'action'
    startX: number
    labelWidth: number
    actionWidth: number
  } | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PropertyPanelFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDescriptions, setShowDescriptions] = useState(false)
  const [labelWidth, setLabelWidth] = useState(160)
  const [actionWidth, setActionWidth] = useState(36)
  const [availableWidth, setAvailableWidth] = useState(
    typeof style?.width === 'number' ? style.width : 365,
  )
  const rootClassName = ['property-panel', className].filter(Boolean).join(' ')
  const asyncSchema = (schema as unknown as { async?: boolean }).async === true
  const validation = asyncSchema ? null : v.safeParse(schema, value)
  const issues = validation && !validation.success ? validation.issues : []
  const hasValidDefault = defaultValue !== undefined
    && !asyncSchema
    && v.safeParse(schema, defaultValue).success
  const panelStyle = {
    ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
    ...style,
    '--pp-label-width': `${labelWidth}px`,
    '--pp-action-width': `${actionWidth}px`,
  } as CSSProperties

  const resizeLabel = (candidate: number) => {
    setLabelWidth(clamp(candidate, 88, Math.max(88, availableWidth - actionWidth - 120)))
  }
  const resizeAction = (candidate: number) => {
    setActionWidth(clamp(candidate, 32, Math.min(96, Math.max(32, availableWidth - labelWidth - 120))))
  }
  const startResize = (kind: 'label' | 'action') => (event: PointerEvent<HTMLDivElement>) => {
    setDrag({
      kind,
      startX: event.clientX,
      labelWidth,
      actionWidth,
    })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    if (drag.kind === 'label') resizeLabel(drag.labelWidth + event.clientX - drag.startX)
    else resizeAction(drag.actionWidth + drag.startX - event.clientX)
  }
  const stopResize = (event: PointerEvent<HTMLDivElement>) => {
    setDrag(null)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }
  const keyboardResize = (kind: 'label' | 'action') => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.shiftKey ? 24 : 8
    if (kind === 'label') resizeLabel(labelWidth + (event.key === 'ArrowRight' ? step : -step))
    else resizeAction(actionWidth + (event.key === 'ArrowLeft' ? step : -step))
  }

  useEffect(() => {
    const element = rootRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (!width) return
      setAvailableWidth(width)
      const nextAction = clamp(actionWidth, 32, Math.min(96, Math.max(32, width - 88 - 120)))
      setActionWidth(nextAction)
      setLabelWidth(clamp(labelWidth, 88, Math.max(88, width - nextAction - 120)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [actionWidth, labelWidth])
  const commit = (
    path: PropertyPath,
    nextFieldValue: unknown,
    reason: PropertyPanelChangeReason,
    options?: TreeCommitOptions,
  ) => {
    const previousValue = options && 'previousValue' in options
      ? options.previousValue
      : getValueAtPath(value, path)
    const nextValue = setValueAtPath(value, path, nextFieldValue) as v.InferInput<TSchema>
    const result = v.safeParse(schema, nextValue)
    if (!result.success) return false
    onValueChange?.(nextValue, {
      path: options?.eventPath ?? path,
      previousValue,
      value: nextFieldValue,
      reason,
      output: result.output,
    })
    if (binding && options?.bindingMutation) {
      const nextBindings = remapPropertyBindings(binding.value, options.bindingMutation)
      if (nextBindings !== binding.value) {
        binding.onChange(nextBindings, {
          reason: 'remap',
          target: { path: options.bindingMutation.path, targetId: 'value' },
        })
      }
    }
    return true
  }

  return (
    <div
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? messages.region}
      className={rootClassName}
      data-compose-ui="property-panel"
      data-compose-theme={theme?.resolvedTheme}
      lang={i18n?.locale ?? 'zh-CN'}
      ref={rootRef}
      role="region"
      style={panelStyle}
    >
      {header ? (
        <div className="property-panel__header">
          {header.icon}
          <div>
            <strong>{header.title}</strong>
            {header.subtitle ? <span>{header.subtitle}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="property-panel__toolbar">
        <label className="property-panel__search">
          <SearchIcon />
          <input
            aria-label={messages.search}
            placeholder={messages.searchPlaceholder}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="property-panel__menu-anchor">
          <button
            aria-expanded={filterOpen}
            aria-label={messages.filter}
            type="button"
            onClick={() => {
              setFilterOpen((current) => !current)
              setSettingsOpen(false)
            }}
          ><FilterIcon /></button>
          {filterOpen ? (
            <div aria-label={messages.filterMenu} className="property-panel__menu" role="menu">
              {([
                ['all', messages.all],
                ['modified', messages.modified],
                ['errors', messages.errors],
              ] as const).map(([id, label]) => (
                <button
                  aria-checked={filter === id}
                  key={id}
                  role="menuitemradio"
                  type="button"
                  onClick={() => {
                    setFilter(id)
                    setFilterOpen(false)
                  }}
                >{label}</button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="property-panel__menu-anchor">
          <button
            aria-expanded={settingsOpen}
            aria-label={messages.settings}
            type="button"
            onClick={() => {
              setSettingsOpen((current) => !current)
              setFilterOpen(false)
            }}
          ><SettingsIcon /></button>
          {settingsOpen ? (
            <div aria-label={messages.settings} className="property-panel__menu" role="menu">
              <button
                aria-checked={showAdvanced}
                role="menuitemcheckbox"
                type="button"
                onClick={() => {
                  setShowAdvanced((current) => !current)
                  setSettingsOpen(false)
                }}
              >{messages.showAdvanced}</button>
              <button
                aria-checked={showDescriptions}
                role="menuitemcheckbox"
                type="button"
                onClick={() => {
                  setShowDescriptions((current) => !current)
                  setSettingsOpen(false)
                }}
              >{messages.showDescriptions}</button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setLabelWidth(160)
                  setActionWidth(36)
                  setSettingsOpen(false)
                }}
              >{messages.resetColumns}</button>
            </div>
          ) : null}
        </div>
      </div>
      {asyncSchema ? (
        <p role="alert">{messages.asyncUnsupported}</p>
      ) : (
        <PropertyTree
          actionWidth={actionWidth}
          binding={binding}
          commit={commit}
          defaultValue={defaultValue}
          filter={filter}
          hasDefaultValue={hasValidDefault}
          issues={issues}
          query={query}
          readOnly={readOnly}
          renderers={renderers}
          schema={schema}
          showAdvanced={showAdvanced}
          showDescriptions={showDescriptions}
          value={value}
        />
      )}
      <div
        aria-label={messages.resizeLabel}
        aria-orientation="vertical"
        aria-valuemax={Math.max(88, availableWidth - actionWidth - 120)}
        aria-valuemin={88}
        aria-valuenow={labelWidth}
        className="property-panel__separator property-panel__separator--label"
        role="separator"
        tabIndex={0}
        onKeyDown={keyboardResize('label')}
        onPointerDown={startResize('label')}
        onPointerMove={moveResize}
        onPointerUp={stopResize}
      ><span aria-hidden="true" className="property-panel__resize-handle">＝</span></div>
      <div
        aria-label={messages.resizeAction}
        aria-orientation="vertical"
        aria-valuemax={Math.min(96, Math.max(32, availableWidth - labelWidth - 120))}
        aria-valuemin={32}
        aria-valuenow={actionWidth}
        className="property-panel__separator property-panel__separator--action"
        role="separator"
        tabIndex={0}
        onKeyDown={keyboardResize('action')}
        onPointerDown={startResize('action')}
        onPointerMove={moveResize}
        onPointerUp={stopResize}
      />
    </div>
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
