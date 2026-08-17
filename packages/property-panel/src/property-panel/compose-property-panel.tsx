/**
 * 提供由 Valibot Schema 驱动、受控且可扩展的 React 组件属性面板。
 *
 * @remarks
 * 本包只生成属性编辑 UI 和变更意图，不拥有页面文档、撤销历史或持久化状态。
 *
 * @packageDocumentation
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
import { ChevronIcon, FilterIcon, SearchIcon, SettingsIcon } from '../icons'
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
import { mergePropertyPanelRenderers } from '../semantic-editors'
import {
  PropertyPanelEditorPortsContext,
  type ComposePropertyPanelColorEditorPort,
  type ComposePropertyPanelNodeEditorPort,
  type ComposePropertyPanelPaintEditorPort,
  type PropertyPanelEditorPorts,
} from './editor-ports'
import type { PropertyPanelFilter, TreeCommitOptions } from '../property-tree'
import '../styles.css'

/**
 * 默认三列布局优先保障编辑器空间；对齐 UE4 Details 面板的紧凑操作列，38px 用 16px 图标放下
 * 2 个入口，使绑定入口与重置能同时直接可见，而不必退化为单槽聚合菜单。
 */
const DEFAULT_LABEL_WIDTH = 120
const DEFAULT_ACTION_WIDTH = 38
const DEFAULT_PANEL_WIDTH = 365
const MIN_LABEL_WIDTH = 88
const MIN_ACTION_WIDTH = 32
const MAX_ACTION_WIDTH = 96
const MIN_EDITOR_WIDTH = 120

/** 属性在受控值中的稳定路径。 */
export type PropertyPath = readonly (string | number)[]

/** 自定义 renderer 在属性树中的字段布局。 */
/**
 * 自定义 renderer 的字段布局。
 *
 * @remarks
 * `inline` 是普通三列行；`full-width` 在标题行下另起一行跨越三列，内容仍按属性名列的缩进
 * 对齐；`full-bleed` 与 `full-width` 结构相同但左右不留内缩，内容盒与整行等宽。
 *
 * `full-bleed` 面向曲线、色带、直方图这类判读依赖完整宽度的可视化控件；普通表单控件与
 * 嵌套在树里的子字段应继续用 `full-width`，贴边会让它们与属性名列和分支引导线失去对齐。
 *
 * @public
 */
export type PropertyPanelRendererLayout = 'inline' | 'full-width' | 'full-bleed'

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
  /** 返回成员类别；省略时为兼容旧宿主按 value 处理。 */
  kind?: 'value' | 'method'
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

/** 宿主判断一个 Schema 字段是否额外开放完整字段绑定时获得的上下文。 */
export interface PropertyPanelBindingTargetAuthorization {
  readonly address: PropertyPanelBindingAddress
  readonly label: string
  readonly schema: v.GenericSchema
  readonly metadata: PropertyPanelMetadata
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
  /** 在 Schema metadata 之外授权完整字段目标；未提供时继续使用显式 opt-in。 */
  isTargetEnabled?: (target: PropertyPanelBindingTargetAuthorization) => boolean
  /**
   * 覆盖直接单目标的默认绑定入口。
   *
   * @remarks 仅在 target 未绑定时生效；已绑定 target 使用内建解绑入口，变量标识承担换绑。
   * 多目标或与普通动作竞争时，面板仍使用内建聚合入口保证操作列容量与键盘语义。
   */
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

/** Size 语义 editor 的一个可选预设。 */
export interface PropertyPanelSizePreset {
  /** 写入 Size schema picklist 的稳定 ID。 */
  value: string
  /** 该预设对应的宽度。 */
  width: number
  /** 该预设对应的高度。 */
  height: number
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
  /** 用户把外部载荷拖入字段。 */
  | 'drop'
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
  /** Size editor 可选的宽高预设；显示文案由 preset 字段的 optionLabels 提供。 */
  sizePresets?: readonly PropertyPanelSizePreset[]
  /**
   * Map editor 切换到指定 Key 时写入 `value` 的候选初值。
   * 未提供时，Map 从分支 Value Schema 推导初值；无法得到有效候选的 Key 会被禁用。
   */
  mapValueDefaults?: Readonly<Record<string, unknown>>
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

/**
 * 字段装饰插槽获得的上下文。
 *
 * @remarks
 * 只描述字段本身，不含任何业务语义。宿主据此决定是否渲染以及渲染什么——面板不知道
 * 返回的是按钮、徽标还是别的东西。
 */
export interface PropertyPanelFieldAdornmentContext {
  /** 字段在 Schema 中的路径，与 `PropertyPanelChange.path` 同构。 */
  path: PropertyPath
  schema: v.GenericSchema
  metadata: PropertyPanelMetadata
  /** 已本地化的字段标签。 */
  label: string
  /** 字段当前值。 */
  value: unknown
}

/**
 * 在字段标签后渲染宿主节点。
 *
 * @remarks
 * 返回 `null` 时该字段不渲染装饰容器。
 */
export type PropertyPanelFieldAdornmentRenderer = (
  context: PropertyPanelFieldAdornmentContext,
) => ReactNode

/** 自定义属性 renderer 获得的字段上下文。 */
export interface PropertyPanelRendererProps {
  /** 自定义字段在完整受控值中的路径。 */
  path: PropertyPath
  /** 字段声明的原始 Valibot Schema。 */
  schema: v.GenericSchema
  /** 字段的 `propertyPanel` metadata。 */
  metadata: PropertyPanelMetadata
  /** Schema 解析出的字段显示名，用于 renderer 的可访问名称和本地化文案。 */
  label: string
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
  /**
   * 在当前 renderer 的内容区渲染一个未包裹 property row 的子值控件。
   *
   * @remarks
   * 该能力用于 Map 这类复合 editor 让 Value 继续复用宿主或内建 renderer；子控件的提交
   * 必须通过 `commit` 回写当前 renderer 的完整候选值。它不创建独立的变量绑定目标。
   */
  renderInlineValue?: (options: PropertyPanelInlineValueProps) => ReactNode
}

/** renderer 在自身内容区嵌入子值控件时提供的上下文。 */
export interface PropertyPanelInlineValueProps {
  /** 子值的 Schema。 */
  schema: v.GenericSchema
  /** 子值显示名称，用于无障碍名称和本地化文案。 */
  label: string
  /** 当前子值。 */
  value: unknown
  /** 提交子值候选；调用方负责把它适配回 renderer 的完整候选值。 */
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
  /**
   * 可选的左列属性名称控件；未提供时继续显示 Schema 的静态 title。
   *
   * @remarks
   * 适用于 Map 等由 Key 决定右侧 Value 的字段。组件获得与 `component` 相同的受控
   * 字段上下文，必须自行提供可访问名称。
   */
  labelComponent?: ComponentType<PropertyPanelRendererProps>
  /** renderer 的默认字段布局，字段 metadata 可以覆盖该值。 */
  layout?: PropertyPanelRendererLayout
  /**
   * renderer 自行呈现空值状态。
   *
   * @remarks
   * 面板默认在可选/可空字段取空值时短路为「未设置」行，renderer 不会被调用。像节点引用这类
   * 语义 editor 需要在空值时仍然展示选择入口与拖放目标，因此可以接管这一状态。
   * @defaultValue false
   */
  rendersEmptyState?: boolean
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
  /** 可选 Paint 编辑会话桥接；未提供时仍可独立使用颜色控件。 */
  paintEditor?: ComposePropertyPanelPaintEditorPort
  /** 可选纯色图层取色桥接；未提供时原生吸管失败只保留控件状态。 */
  colorEditor?: ComposePropertyPanelColorEditorPort
  /** 可选节点目录桥接；未提供时 node 字段呈现无候选状态但仍可清空。 */
  nodeEditor?: ComposePropertyPanelNodeEditorPort
  /**
   * 在每个字段标签后渲染宿主装饰节点。
   *
   * @remarks
   * 通用插槽，面板不解释返回内容。装饰渲染在 `data-property-part="adornment"` 容器内，
   * 不占用右侧动作栏的容量。省略该属性或返回 `null` 时字段行保持原样。
   */
  renderFieldAdornment?: PropertyPanelFieldAdornmentRenderer
  /** 完整候选 input 校验成功后调用的受控变更回调。 */
  onValueChange?: (
    value: v.InferInput<TSchema>,
    change: PropertyPanelChange<v.InferOutput<TSchema>>,
  ) => void
}

interface PropertyPanelRootView {
  readonly actionWidth: number
  readonly filter: PropertyPanelFilter
  readonly query: string
  readonly showAdvanced: boolean
  readonly showDescriptions: boolean
}

interface PropertyPanelSectionView {
  readonly onVisibilityChange: (source: symbol, visible: boolean | undefined) => void
  readonly unregisterVisibility: (source: symbol) => void
  readonly title: string
  readonly renderFieldAdornment?: PropertyPanelFieldAdornmentRenderer
}

const PropertyPanelRootContext = createContext<PropertyPanelRootView | null>(null)
const PropertyPanelSectionContext = createContext<PropertyPanelSectionView | null>(null)

/** 组合多个独立属性 Section 的共享面板根属性。 */
export interface ComposePropertyPanelRootProps
  extends HTMLAttributes<HTMLDivElement> {
  /** Root 内的独立属性 Sections。 */
  children: ReactNode
  /** 可选的显式面板头部。 */
  header?: PropertyPanelHeader
  /**
   * 搜索工具带上方的状态槽（警告/成功反馈）。
   *
   * @remarks
   * 与搜索同属 chrome band，避免在 Entity 标题与搜索之间再插一整条割裂灰条。
   */
  statusSlot?: ReactNode
}

/** 一个独立 Schema 属性区的分组属性。 */
export interface ComposePropertyPanelSectionProps {
  /** 返回 ComposePropertyPanel 或 Registry Inspector 的分组内容。 */
  children?: ReactNode
  /** 显示在折叠标题右侧的可选宿主状态或操作。 */
  actions?: ReactNode
  /**
   * 只渲染不可折叠标题与 actions，不创建空正文。
   *
   * @defaultValue false
   */
  actionOnly?: boolean
  /** 分组显示名称，同时参与全局搜索。 */
  title: string
  /** 初次挂载时是否展开。 @defaultValue true */
  defaultExpanded?: boolean
  /**
   * 注入到本 Section 内全部嵌入面板的字段装饰。
   *
   * @remarks
   * Section 的内容通常由领域包（Registry Inspector）构造，宿主拿不到那些
   * `ComposePropertyPanel` 实例的 props；经 Section 下发让宿主按分组绑定装饰闭包。
   * 嵌入面板自己的 `renderFieldAdornment` 优先。
   */
  renderFieldAdornment?: PropertyPanelFieldAdornmentRenderer
}

/**
 * 为多个独立属性 Section 提供唯一工具栏与共享列宽。
 *
 * @public
 */
export function ComposePropertyPanelRoot({
  children,
  header,
  statusSlot,
  className,
  style,
  ...htmlProps
}: ComposePropertyPanelRootProps) {
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
  const [labelWidth, setLabelWidth] = useState(DEFAULT_LABEL_WIDTH)
  const [actionWidth, setActionWidth] = useState(DEFAULT_ACTION_WIDTH)
  const [availableWidth, setAvailableWidth] = useState(
    typeof style?.width === 'number' ? style.width : DEFAULT_PANEL_WIDTH,
  )
  const resizeLabel = (candidate: number) => {
    setLabelWidth(clamp(candidate, MIN_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, availableWidth - actionWidth - MIN_EDITOR_WIDTH)))
  }
  const resizeAction = (candidate: number) => {
    setActionWidth(clamp(candidate, MIN_ACTION_WIDTH, Math.min(MAX_ACTION_WIDTH, Math.max(MIN_ACTION_WIDTH, availableWidth - labelWidth - MIN_EDITOR_WIDTH))))
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
      const nextAction = clamp(actionWidth, MIN_ACTION_WIDTH, Math.min(MAX_ACTION_WIDTH, Math.max(MIN_ACTION_WIDTH, width - MIN_LABEL_WIDTH - MIN_EDITOR_WIDTH)))
      setActionWidth(nextAction)
      setLabelWidth(clamp(labelWidth, MIN_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, width - nextAction - MIN_EDITOR_WIDTH)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [actionWidth, labelWidth])

  const panelStyle = {
    ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
    ...style,
    '--pp-label-width': `${labelWidth}px`,
    '--pp-action-width': `${actionWidth}px`,
  } as CSSProperties
  const rootClassName = ['property-panel', className].filter(Boolean).join(' ')
  const view: PropertyPanelRootView = {
    actionWidth,
    filter,
    query,
    showAdvanced,
    showDescriptions,
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
      <div
        className={[
          'property-panel__chrome',
          statusSlot ? 'property-panel__chrome--with-status' : '',
        ].filter(Boolean).join(' ')}
        data-property-part="chrome"
      >
        {statusSlot ? (
          <div className="property-panel__status" data-property-part="status">
            {statusSlot}
          </div>
        ) : null}
        <div className="property-panel__toolbar" data-property-part="toolbar">
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
                    setLabelWidth(DEFAULT_LABEL_WIDTH)
                    setActionWidth(DEFAULT_ACTION_WIDTH)
                    setSettingsOpen(false)
                  }}
                >{messages.resetColumns}</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <PropertyPanelRootContext.Provider value={view}>
        {children}
      </PropertyPanelRootContext.Provider>
      <div
        aria-label={messages.resizeLabel}
        aria-orientation="vertical"
        aria-valuemax={Math.max(MIN_LABEL_WIDTH, availableWidth - actionWidth - MIN_EDITOR_WIDTH)}
        aria-valuemin={MIN_LABEL_WIDTH}
        aria-valuenow={labelWidth}
        className="property-panel__separator property-panel__separator--label"
        data-property-part="separator"
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
        aria-valuemax={Math.min(MAX_ACTION_WIDTH, Math.max(MIN_ACTION_WIDTH, availableWidth - labelWidth - MIN_EDITOR_WIDTH))}
        aria-valuemin={MIN_ACTION_WIDTH}
        aria-valuenow={actionWidth}
        className="property-panel__separator property-panel__separator--action"
        data-property-part="separator"
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

/**
 * 在共享 Property Panel Root 中声明一个可折叠属性分组。
 *
 * @public
 */
export function ComposePropertyPanelSection({
  actionOnly = false,
  actions,
  children,
  title,
  defaultExpanded = true,
  renderFieldAdornment,
}: ComposePropertyPanelSectionProps) {
  const root = useContext(PropertyPanelRootContext)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [embeddedVisibilities, setEmbeddedVisibilities] = useState<
    ReadonlyMap<symbol, boolean | undefined>
  >(() => new Map())
  const onVisibilityChange = useCallback((source: symbol, visible: boolean | undefined) => {
    setEmbeddedVisibilities((current) => {
      if (current.get(source) === visible && current.has(source)) return current
      const next = new Map(current)
      next.set(source, visible)
      return next
    })
  }, [])
  const unregisterVisibility = useCallback((source: symbol) => {
    setEmbeddedVisibilities((current) => {
      if (!current.has(source)) return current
      const next = new Map(current)
      next.delete(source)
      return next
    })
  }, [])
  const context = useMemo<PropertyPanelSectionView>(() => ({
    onVisibilityChange,
    unregisterVisibility,
    title,
    renderFieldAdornment,
  }), [onVisibilityChange, renderFieldAdornment, title, unregisterVisibility])
  if (!root) {
    return (
      <PropertyPanelSectionContext.Provider value={context}>
        {children}
      </PropertyPanelSectionContext.Provider>
    )
  }
  const query = root.query.trim().toLocaleLowerCase()
  const titleMatches = title.toLocaleLowerCase().includes(query)
  const embeddedVisibility = embeddedVisibilities.size === 0
    ? undefined
    : [...embeddedVisibilities.values()].some((item) => item === true)
  const visible = embeddedVisibility ?? (!query || titleMatches)
  const visibleExpanded = query ? true : expanded
  return (
    <section
      className="property-panel__group"
      data-property-depth="0"
      hidden={!visible}
      style={{ '--pp-group-depth': 0 } as CSSProperties}
    >
      <div
        className="property-panel__group-header"
        data-has-actions={actions ? 'true' : undefined}
      >
        {actionOnly ? (
          <span className="property-panel__group-title">{title}</span>
        ) : (
          <button
            aria-expanded={visibleExpanded}
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronIcon expanded={visibleExpanded} />
            {title}
          </button>
        )}
        {actions ? (
          <div className="property-panel__section-actions">{actions}</div>
        ) : <div className="property-panel__actions" data-property-part="actions" />}
      </div>
      {!actionOnly && visibleExpanded ? (
        <div className="property-panel__group-content">
          <PropertyPanelSectionContext.Provider value={context}>
            {children}
          </PropertyPanelSectionContext.Provider>
        </div>
      ) : null}
    </section>
  )
}

/**
 * 渲染由同步 Valibot Schema 驱动的受控属性面板。
 *
 * @param props - Schema、受控值、renderer registry 与标准 `div` 属性。
 * @returns 属性面板 React 元素。
 * @public
 */
export function ComposePropertyPanel<TSchema extends v.GenericSchema>({
  ...props
}: ComposePropertyPanelProps<TSchema>) {
  const root = useContext(PropertyPanelRootContext)
  const section = useContext(PropertyPanelSectionContext)
  const ports = useMemo<PropertyPanelEditorPorts>(() => ({
    color: props.colorEditor,
    node: props.nodeEditor,
    paint: props.paintEditor,
  }), [props.colorEditor, props.nodeEditor, props.paintEditor])
  return (
    <PropertyPanelEditorPortsContext.Provider value={ports}>
      {root && section ? (
        <EmbeddedComposePropertyPanel {...props} root={root} section={section} />
      ) : <StandaloneComposePropertyPanel {...props} />}
    </PropertyPanelEditorPortsContext.Provider>
  )
}

function EmbeddedComposePropertyPanel<TSchema extends v.GenericSchema>({
  schema,
  value,
  defaultValue,
  renderers,
  binding,
  renderFieldAdornment,
  paintEditor: _paintEditor,
  colorEditor: _colorEditor,
  nodeEditor: _nodeEditor,
  readOnly = false,
  onValueChange,
  root,
  section,
}: ComposePropertyPanelProps<TSchema> & {
  readonly root: PropertyPanelRootView
  readonly section: PropertyPanelSectionView
}) {
  void _paintEditor
  void _colorEditor
  void _nodeEditor
  const messages = usePropertyPanelMessages()
  const visibilitySource = useRef(Symbol('compose-property-panel'))
  useEffect(() => () => {
    section.unregisterVisibility(visibilitySource.current)
  }, [section])
  const effectiveRenderers = mergePropertyPanelRenderers(renderers)
  const asyncSchema = (schema as unknown as { async?: boolean }).async === true
  const validation = asyncSchema ? null : v.safeParse(schema, value)
  const issues = validation && !validation.success ? validation.issues : []
  const hasValidDefault = defaultValue !== undefined
    && !asyncSchema
    && v.safeParse(schema, defaultValue).success
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

  if (asyncSchema) return <p role="alert">{messages.asyncUnsupported}</p>
  return (
    <PropertyTree
      actionWidth={root.actionWidth}
      binding={binding}
      renderFieldAdornment={renderFieldAdornment ?? section.renderFieldAdornment}
      commit={commit}
      defaultValue={defaultValue}
      filter={root.filter}
      hasDefaultValue={hasValidDefault}
      issues={issues}
      query={root.query}
      readOnly={readOnly}
      renderers={effectiveRenderers}
      schema={schema}
      section={{
        onVisibilityChange: (visible) => {
          section.onVisibilityChange(visibilitySource.current, visible)
        },
        title: section.title,
      }}
      showAdvanced={root.showAdvanced}
      showDescriptions={root.showDescriptions}
      value={value}
    />
  )
}

function StandaloneComposePropertyPanel<TSchema extends v.GenericSchema>({
  schema,
  value,
  defaultValue,
  header,
  renderers,
  binding,
  renderFieldAdornment,
  paintEditor: _paintEditor,
  colorEditor: _colorEditor,
  nodeEditor: _nodeEditor,
  readOnly = false,
  onValueChange,
  className,
  style,
  ...htmlProps
}: ComposePropertyPanelProps<TSchema>) {
  void _paintEditor
  void _colorEditor
  void _nodeEditor
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const messages = usePropertyPanelMessages()
  const effectiveRenderers = mergePropertyPanelRenderers(renderers)
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
  const [labelWidth, setLabelWidth] = useState(DEFAULT_LABEL_WIDTH)
  const [actionWidth, setActionWidth] = useState(DEFAULT_ACTION_WIDTH)
  const [availableWidth, setAvailableWidth] = useState(
    typeof style?.width === 'number' ? style.width : DEFAULT_PANEL_WIDTH,
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
    setLabelWidth(clamp(candidate, MIN_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, availableWidth - actionWidth - MIN_EDITOR_WIDTH)))
  }
  const resizeAction = (candidate: number) => {
    setActionWidth(clamp(candidate, MIN_ACTION_WIDTH, Math.min(MAX_ACTION_WIDTH, Math.max(MIN_ACTION_WIDTH, availableWidth - labelWidth - MIN_EDITOR_WIDTH))))
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
      const nextAction = clamp(actionWidth, MIN_ACTION_WIDTH, Math.min(MAX_ACTION_WIDTH, Math.max(MIN_ACTION_WIDTH, width - MIN_LABEL_WIDTH - MIN_EDITOR_WIDTH)))
      setActionWidth(nextAction)
      setLabelWidth(clamp(labelWidth, MIN_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, width - nextAction - MIN_EDITOR_WIDTH)))
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
      <div className="property-panel__toolbar" data-property-part="toolbar">
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
                  setLabelWidth(DEFAULT_LABEL_WIDTH)
                  setActionWidth(DEFAULT_ACTION_WIDTH)
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
          renderFieldAdornment={renderFieldAdornment}
          commit={commit}
          defaultValue={defaultValue}
          filter={filter}
          hasDefaultValue={hasValidDefault}
          issues={issues}
          query={query}
          readOnly={readOnly}
          renderers={effectiveRenderers}
          schema={schema}
          showAdvanced={showAdvanced}
          showDescriptions={showDescriptions}
          value={value}
        />
      )}
      <div
        aria-label={messages.resizeLabel}
        aria-orientation="vertical"
        aria-valuemax={Math.max(MIN_LABEL_WIDTH, availableWidth - actionWidth - MIN_EDITOR_WIDTH)}
        aria-valuemin={MIN_LABEL_WIDTH}
        aria-valuenow={labelWidth}
        className="property-panel__separator property-panel__separator--label"
        data-property-part="separator"
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
        aria-valuemax={Math.min(MAX_ACTION_WIDTH, Math.max(MIN_ACTION_WIDTH, availableWidth - labelWidth - MIN_EDITOR_WIDTH))}
        aria-valuemin={MIN_ACTION_WIDTH}
        aria-valuenow={actionWidth}
        className="property-panel__separator property-panel__separator--action"
        data-property-part="separator"
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
