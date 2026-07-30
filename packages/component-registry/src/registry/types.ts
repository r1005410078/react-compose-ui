import type { ComponentType, ReactNode } from 'react'
import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import type {
  ComposeDocument,
  ComposeEntity,
  ComposeRenderer,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'

/** Inspector 与宿主 Stage Paint 会话之间的无 DOM 桥接。 @public */
export interface ComposePaintEditPort {
  /** 打开指定 Entity 的背景填充编辑，并显示其画布控制柄。 */
  open(input: { readonly entityId: string }): void
  /** 关闭当前 Paint 编辑并清理所有瞬时预览。 */
  close(): void
  /** 原生吸管不可用时，进入当前字段的 Stage 图层取色模式。 */
  sample(input: {
    readonly entityId: string
    readonly field: 'backgroundPaint' | 'borderColor'
  }): void
}

/** Renderer 获得的 Stage/Preview 共享上下文。 @public */
export interface ComposeRendererProps {
  /** 当前只读 Entity。 */
  readonly entity: ComposeEntity
  /** 已通过 Core 校验的 Renderer Component。 */
  readonly renderer: ComposeRenderer
  /** Renderer Component 中的严格 JSON 属性。 */
  readonly props: JsonObject
  /** 编辑 Stage 与只读 Preview 的渲染语义。 */
  readonly mode: 'editor' | 'preview'
  /** 资源型 Renderer 使用的可选运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
}

/**
 * 节点引用属性 editor 与宿主节点目录之间的桥接。
 *
 * @remarks
 * Registry 只负责透传，不解释候选值的领域含义，因此不会因此依赖 `property-panel` 或
 * `editor`。结构与 `ComposePropertyPanelNodeEditorPort` 兼容，物料可直接传给属性面板。
 * @public
 */
export interface ComposeNodeEditPort {
  /** 宿主接受的拖拽媒体类型。 */
  readonly dragMediaTypes: readonly string[]
  /** 当前可选候选。 */
  readonly candidates: readonly {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly value: unknown
  }[]
  /** 把命中的媒体类型与其文本载荷解析为候选；无法识别时返回 null。 */
  parseDrop: (data: Readonly<Record<string, string>>) => {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly value: unknown
  } | null
  /** 把已保存的值渲染为人类可读标签。 */
  resolveLabel: (value: unknown) => string
}

/** Registry Inspector 共享的命令派发上下文。 @public */
export interface ComposeEntityInspectorContext {
  /** 当前只读 Entity。 */
  readonly entity: ComposeEntity
  /** 向同一 TransactionRuntime 派发命令。 */
  readonly dispatch: (command: EditorCommand) => unknown
  /** 锁定或宿主只读状态。 */
  readonly readOnly: boolean
  /** 可选的 Editor Paint 编辑桥接；Registry 与物料包不依赖 Stage。 */
  readonly paintEditPort?: ComposePaintEditPort
  /** 可选的节点目录桥接；物料把它交给属性面板的 node editor。 */
  readonly nodeEditPort?: ComposeNodeEditPort
}

/** Renderer 内容 Inspector 的上下文。 @public */
export interface ComposeRendererInspectorProps extends ComposeEntityInspectorContext {
  /** 当前 Renderer Component。 */
  readonly renderer: ComposeRenderer
}

/** 单个 ECS Component Inspector 的上下文。 @public */
export interface ComposeComponentInspectorProps extends ComposeEntityInspectorContext {
  /** 当前 Component Key。 */
  readonly componentKey: string
  /** 当前 Component 的严格 JSON 数据。 */
  readonly value: JsonObject
}

/** 一个可由 Stage 与 Preview 共同解析的 Renderer 定义。 @public */
export interface ComposeRendererDefinition {
  /** `Renderer.type` 使用的唯一非空标识。 */
  readonly type: string
  /** Inspector 与错误状态中的用户可读名称。 */
  readonly label: string
  /** Stage 与 Preview 共享的宿主 React Renderer。 */
  readonly renderer: ComponentType<ComposeRendererProps>
  /** 可选 Renderer 内容 Inspector。 */
  readonly inspector?: ComponentType<ComposeRendererInspectorProps>
}

/** 一个可校验并展示的 ECS Component 定义。 @public */
export interface ComposeComponentDefinition {
  /** PascalCase Component Key。 */
  readonly key: string
  /** Inspector 中的用户可读名称。 */
  readonly label: string
  /** Inspector 聚合顺序；数值较小的定义优先。 */
  readonly order?: number
  /** 是否从普通 Inspector 区隐藏。 */
  readonly hidden?: boolean
  /** 创建独立默认数据；每次调用必须返回新的合法 JsonObject。 */
  readonly createDefault: () => JsonObject
  /** 可选宿主校验器；返回 false 或字符串表示无效。 */
  readonly validate?: (value: JsonObject) => boolean | string
  /** 可选 Component Inspector。 */
  readonly inspector?: ComponentType<ComposeComponentInspectorProps>
}

/** Asset Browser drop 交给 Preset 的已解析资源。 @public */
export interface ComposeEntityAssetDropInput {
  /** 可持久化的资源引用。 */
  readonly reference: ComposeAssetReference
  /** Provider 已解析的资源内容与元数据。 */
  readonly resolved: ComposeResolvedAsset
  /** 用于 Entity 默认名称的资源文件名。 */
  readonly name: string
}

/** 资源型 Preset 创建 Entity seed 的协议。 @public */
export interface ComposeEntityAssetDropDefinition {
  /** 仅使用稳定元数据判断是否接受资源。 */
  accepts(input: { readonly name: string; readonly mediaType: string }): boolean
  /** 从已解析资源创建初始 Component 组合。 */
  createSeed(
    input: ComposeEntityAssetDropInput,
  ): Promise<ComposeEntitySeed> | ComposeEntitySeed
}

/** Palette 中一个完整 Entity 初始组合。 @public */
export interface ComposeEntityPreset {
  /** Composition.presetId 使用的稳定标识。 */
  readonly id: string
  /** Palette 中的用户可读名称。 */
  readonly label: string
  /** Entity 默认名称；省略时使用 label。 */
  readonly defaultName?: string
  /** Palette 可选图标；不会写入 ComposeDocument。 */
  readonly icon?: ReactNode
  /** 隐藏 Palette 项，但保留资源创建能力。 */
  readonly paletteHidden?: boolean
  /** 创建不含 Composition 的基础 Component 组合。 */
  readonly createComponents: () => Readonly<Record<string, JsonObject>>
  /** 可选资源 drop 匹配与 seed factory。 */
  readonly assetDrop?: ComposeEntityAssetDropDefinition
}

/** 一个由用户添加和移除的命名能力包。 @public */
export interface ComposeCapabilityDefinition {
  /** Composition.capabilityIds 使用的稳定标识。 */
  readonly id: string
  /** 能力菜单中的用户可读名称。 */
  readonly label: string
  /** 能力菜单中的可选简短说明。 */
  readonly description?: string
  /** 能力拥有的 Component 默认值。 */
  readonly createComponents: () => Readonly<Record<string, JsonObject>>
  /** 添加该能力前必须存在的能力 ID。 */
  readonly requires?: readonly string[]
  /** 不能与该能力同时存在的能力 ID。 */
  readonly conflicts?: readonly string[]
}

/** 创建 Entity 所需的可序列化种子。 @public */
export interface ComposeEntitySeed {
  /** 新 Entity 的默认名称。 */
  readonly name: string
  /** 已包含 Composition 的完整初始 Component 组合。 */
  readonly components: Readonly<Record<string, JsonObject>>
}

/** Preset seed 的稳定失败描述。 @public */
export interface ComposeEntitySeedError {
  /** 调用方可稳定分支处理的失败代码。 */
  readonly code:
    | 'preset.unknown'
    | 'preset.invalid'
    | 'preset.asset-unsupported'
    | 'preset.asset-factory-failed'
  /** 面向开发者或宿主错误界面的失败说明。 */
  readonly message: string
}

/** Preset seed 的判别结果。 @public */
export type ComposeEntitySeedResult =
  | { readonly ok: true; readonly seed: ComposeEntitySeed }
  | { readonly ok: false; readonly error: ComposeEntitySeedError }

/** 能力操作不可执行的稳定原因。 @public */
export interface ComposeCapabilityIssue {
  /** 调用方可稳定分支处理的能力失败代码。 */
  readonly code:
    | 'capability.unknown'
    | 'capability.entity-missing'
    | 'capability.already-attached'
    | 'capability.not-attached'
    | 'capability.locked'
    | 'capability.conflict'
    | 'capability.component-exists'
    | 'capability.required'
    | 'capability.protected'
    | 'capability.has-children'
  /** 面向能力菜单或确认流程的失败说明。 */
  readonly message: string
  /** 导致当前操作失败的依赖或冲突能力 ID。 */
  readonly relatedCapabilityIds?: readonly string[]
}

/** 能力菜单中一个候选项的当前状态。 @public */
export interface ComposeCapabilityAvailability {
  /** 当前 Registry 中的定义；未知已附加能力没有该值。 */
  readonly definition?: ComposeCapabilityDefinition
  /** Composition 中使用的稳定能力 ID。 */
  readonly capabilityId: string
  /** Entity 当前是否已附加该能力。 */
  readonly attached: boolean
  /**
   * 当前上下文中能否执行添加或移除。
   *
   * @remarks
   * 已附加项的 disabled 表示移除会被阻止（锁定、被依赖、基础项或含子项容器），
   * 与 planRemoveCapability 使用同一套规则；未附加项表示添加会被阻止。
   */
  readonly disabled: boolean
  /** 禁用时的稳定原因。 */
  readonly issue?: ComposeCapabilityIssue
}

/** 能力添加或移除规划结果。 @public */
export type ComposeCapabilityPlanResult =
  | { readonly ok: true; readonly command: EditorCommand }
  | { readonly ok: false; readonly issue: ComposeCapabilityIssue }

/** 创建 Registry 时的四类定义。 @public */
export interface ComposeEntityRegistryOptions {
  /** Stage 与 Preview 可解析的 Renderer 定义。 */
  readonly renderers?: readonly ComposeRendererDefinition[]
  /** Core 内建项或宿主扩展的 Component 定义。 */
  readonly components?: readonly ComposeComponentDefinition[]
  /** Palette 与资源拖放可创建的 Entity Presets。 */
  readonly presets?: readonly ComposeEntityPreset[]
  /** Inspector 可添加和移除的能力定义。 */
  readonly capabilities?: readonly ComposeCapabilityDefinition[]
}

/**
 * 不拥有文档和 React 状态的实例级 Entity Registry。
 *
 * @public
 */
export interface ComposeEntityRegistry {
  /** 按 Renderer type 查找定义。 */
  getRenderer(type: string): ComposeRendererDefinition | undefined
  /** 按注册顺序列出 Renderer 定义。 */
  listRenderers(): readonly ComposeRendererDefinition[]
  /** 按 PascalCase Component Key 查找定义。 */
  getComponent(key: string): ComposeComponentDefinition | undefined
  /** 按 order 和注册顺序列出 Component 定义。 */
  listComponents(): readonly ComposeComponentDefinition[]
  /** 按 Preset ID 查找定义。 */
  getPreset(id: string): ComposeEntityPreset | undefined
  /** 按注册顺序列出 Entity Presets。 */
  listPresets(): readonly ComposeEntityPreset[]
  /** 按能力 ID 查找定义。 */
  getCapability(id: string): ComposeCapabilityDefinition | undefined
  /** 按注册顺序列出能力定义。 */
  listCapabilities(): readonly ComposeCapabilityDefinition[]
  /** 从 Preset 创建包含 Composition 的 Entity seed。 */
  createSeed(presetId: string): ComposeEntitySeedResult
  /** 从已解析资源创建包含 Composition 的 Entity seed。 */
  createAssetSeed(input: ComposeEntityAssetDropInput): Promise<ComposeEntitySeedResult>
  /** 列出 Entity 当前可添加或移除的全部能力状态。 */
  listCapabilityAvailability(entity: ComposeEntity): readonly ComposeCapabilityAvailability[]
  /** 将添加能力及其依赖规划为一个原子命令。 */
  planAddCapability(
    document: ComposeDocument,
    entityId: string,
    capabilityId: string,
    idFactory: () => string,
  ): ComposeCapabilityPlanResult
  /** 将移除能力及其拥有的 Components 规划为一个原子命令。 */
  planRemoveCapability(
    document: ComposeDocument,
    entityId: string,
    capabilityId: string,
    idFactory: () => string,
  ): ComposeCapabilityPlanResult
}

/** Registry 定义初始化失败。 @public */
export class ComposeEntityRegistryError extends Error {
  /** Registry 初始化错误的稳定代码。 */
  readonly code: 'registry.invalid'
  /** 无效定义所属的注册类别。 */
  readonly category: 'renderer' | 'component' | 'preset' | 'capability'
  /** 无效定义在输入数组中的索引。 */
  readonly definitionIndex: number

  /** 创建带稳定定位信息的 Registry 初始化错误。 */
  constructor(
    category: ComposeEntityRegistryError['category'],
    definitionIndex: number,
    message: string,
  ) {
    super(message)
    this.name = 'ComposeEntityRegistryError'
    this.code = 'registry.invalid'
    this.category = category
    this.definitionIndex = definitionIndex
  }
}
