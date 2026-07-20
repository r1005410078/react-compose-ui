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
import { FilterIcon, SearchIcon, SettingsIcon } from './icons'
import {
  getValueAtPath,
  setValueAtPath,
} from './schema-model'
import { PropertyTree } from './property-tree'
import type { PropertyPanelFilter, TreeCommitOptions } from './property-tree'
import './styles.css'

/** 属性在受控值中的稳定路径。 */
export type PropertyPath = readonly (string | number)[]

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
}

/** 实例级自定义属性 renderer 定义。 */
export interface PropertyPanelRenderer {
  /** renderer 的实例内稳定标识。 */
  id: string
  /** 未显式指定 editor ID 时，用基础 Schema 和 metadata 判断是否匹配。 */
  matches?: (schema: v.GenericSchema, metadata: PropertyPanelMetadata) => boolean
  /** 渲染自定义字段 UI 的 React 组件。 */
  component: ComponentType<PropertyPanelRendererProps>
  /** 为 optional、nullable 等缺失字段生成可校验的初值。 */
  createDefault?: (schema: v.GenericSchema) => unknown
}

/** `PropertyPanel` 的受控属性。 */
export interface PropertyPanelProps<TSchema extends v.GenericSchema>
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
export function PropertyPanel<TSchema extends v.GenericSchema>({
  schema,
  value,
  defaultValue,
  header,
  renderers,
  readOnly = false,
  onValueChange,
  className,
  style,
  ...htmlProps
}: PropertyPanelProps<TSchema>) {
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
    typeof style?.width === 'number' ? style.width : 480,
  )
  const rootClassName = ['property-panel', className].filter(Boolean).join(' ')
  const asyncSchema = (schema as unknown as { async?: boolean }).async === true
  const validation = asyncSchema ? null : v.safeParse(schema, value)
  const issues = validation && !validation.success ? validation.issues : []
  const hasValidDefault = defaultValue !== undefined
    && !asyncSchema
    && v.safeParse(schema, defaultValue).success
  const panelStyle = {
    ...style,
    '--pp-label-width': `${labelWidth}px`,
    '--pp-action-width': `${actionWidth}px`,
  } as CSSProperties

  const resizeLabel = (candidate: number) => {
    setLabelWidth(clamp(candidate, 88, Math.max(88, availableWidth - actionWidth - 120)))
  }
  const resizeAction = (candidate: number) => {
    setActionWidth(clamp(candidate, 32, Math.max(32, availableWidth - labelWidth - 120)))
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
      const nextAction = clamp(actionWidth, 32, Math.max(32, width - 88 - 120))
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
    return true
  }

  return (
    <div
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? '组件属性'}
      className={rootClassName}
      data-compose-ui="property-panel"
      ref={rootRef}
      role="region"
      style={panelStyle}
    >
      {header ? (
        <header className="property-panel__header">
          {header.icon}
          <div>
            <strong>{header.title}</strong>
            {header.subtitle ? <span>{header.subtitle}</span> : null}
          </div>
        </header>
      ) : null}
      <div className="property-panel__toolbar">
        <label className="property-panel__search">
          <SearchIcon />
          <input
            aria-label="搜索属性"
            placeholder="Search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="property-panel__menu-anchor">
          <button
            aria-expanded={filterOpen}
            aria-label="筛选属性"
            type="button"
            onClick={() => {
              setFilterOpen((current) => !current)
              setSettingsOpen(false)
            }}
          ><FilterIcon /></button>
          {filterOpen ? (
            <div aria-label="属性筛选" className="property-panel__menu" role="menu">
              {([
                ['all', '全部'],
                ['modified', '已修改'],
                ['errors', '有错误'],
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
            aria-label="属性面板设置"
            type="button"
            onClick={() => {
              setSettingsOpen((current) => !current)
              setFilterOpen(false)
            }}
          ><SettingsIcon /></button>
          {settingsOpen ? (
            <div aria-label="属性面板设置" className="property-panel__menu" role="menu">
              <button
                aria-checked={showAdvanced}
                role="menuitemcheckbox"
                type="button"
                onClick={() => {
                  setShowAdvanced((current) => !current)
                  setSettingsOpen(false)
                }}
              >显示高级属性</button>
              <button
                aria-checked={showDescriptions}
                role="menuitemcheckbox"
                type="button"
                onClick={() => {
                  setShowDescriptions((current) => !current)
                  setSettingsOpen(false)
                }}
              >显示字段说明</button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setLabelWidth(160)
                  setActionWidth(36)
                  setSettingsOpen(false)
                }}
              >恢复默认列宽</button>
            </div>
          ) : null}
        </div>
      </div>
      {asyncSchema ? (
        <p role="alert">当前版本暂不支持异步 Valibot Schema</p>
      ) : (
        <PropertyTree
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
        aria-label="调整属性名列宽"
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
        aria-label="调整操作列宽"
        aria-orientation="vertical"
        aria-valuemax={Math.max(32, availableWidth - labelWidth - 120)}
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
