import type { ComponentType, ReactNode } from 'react'
import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import type {
  ComposeComponentNode,
  ComposeNode,
  EditorCommand,
  JsonObject,
  NodeStyle,
} from '@compose-ui/core'

/**
 * 注册组件创建时使用的默认尺寸。
 *
 * @public
 */
export interface ComposeComponentDefaultSize {
  /** 默认宽度，必须为有限正数。 */
  readonly width: number
  /** 默认高度，必须为有限正数。 */
  readonly height: number
}

/**
 * 宿主 renderer 获得的只读文档上下文。
 *
 * @public
 */
export interface ComposeComponentRendererProps {
  /** 当前文档 Component 节点。 */
  readonly node: ComposeComponentNode
  /** 与 node.props 相同的严格 JSON 属性。 */
  readonly props: JsonObject
  /** 编辑 Stage 与只读 Preview 的渲染语义。 */
  readonly mode: 'editor' | 'preview'
  /** 资源型 definition 读取节点引用时使用的可选运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
}

/** Asset Browser drop 交给 definition 的已解析资源。 @public */
export interface ComposeComponentAssetDropInput {
  readonly reference: ComposeAssetReference
  readonly resolved: ComposeResolvedAsset
  readonly name: string
}

/** 资源型 definition 创建 seed 的可选协议。 @public */
export interface ComposeComponentAssetDropDefinition {
  /** 仅使用稳定元数据判断是否接受资源。 */
  accepts(input: { readonly name: string; readonly mediaType: string }): boolean
  /** 从已解析内容创建组件 seed；componentType 由 Registry 补充。 */
  createSeed(
    input: ComposeComponentAssetDropInput,
  ): Promise<Omit<ComposeComponentSeed, 'componentType'>> | Omit<ComposeComponentSeed, 'componentType'>
}

/**
 * 宿主 Inspector renderer 获得的命令派发上下文。
 *
 * @public
 */
export interface ComposeNodeInspectorProps<TNode extends ComposeNode = ComposeNode> {
  /** 当前只读文档节点。 */
  readonly node: TNode
  /** 向同一个 TransactionRuntime 派发结构化命令。 */
  readonly dispatch: (command: EditorCommand) => unknown
}

/**
 * Component definition Inspector renderer 获得的命令上下文。
 *
 * @public
 */
export type ComposeComponentInspectorProps = ComposeNodeInspectorProps<ComposeComponentNode>

/**
 * 一个可由 Stage 与 Preview 共同解析的宿主组件定义。
 *
 * @public
 */
export interface ComposeComponentDefinition {
  /** 文档 componentType 使用的唯一非空标识。 */
  readonly type: string
  /** Palette 与错误信息中的用户可读名称。 */
  readonly label: string
  /** 新建文档 Component 节点使用的名称；省略时回退到 label。 */
  readonly defaultName?: string
  /** Palette 可选图标；不会写入 ComposeDocument。 */
  readonly icon?: ReactNode
  /** 隐藏 ComposeComponentPalette 项，但仍保留 registry 渲染与资源创建能力。 */
  readonly paletteHidden?: boolean
  /** 创建节点时使用的合法默认尺寸。 */
  readonly defaultSize: ComposeComponentDefaultSize
  /** 每次调用必须返回一份严格 JSON 对象。 */
  readonly createDefaultProps: () => JsonObject
  /** 可选通用节点 style factory；每次调用必须返回合法独立 JSON。 */
  readonly createDefaultStyle?: () => NodeStyle
  /** Stage 与 Preview 共享的宿主 React renderer。 */
  readonly renderer: ComponentType<ComposeComponentRendererProps>
  /** 可选宿主 Inspector；可以在其内部组合 ComposePropertyPanel。 */
  readonly inspector?: ComponentType<ComposeComponentInspectorProps>
  /** 可选资源 drop 匹配与 seed factory。 */
  readonly assetDrop?: ComposeComponentAssetDropDefinition
}

/**
 * 成功创建 Component 节点所需的可序列化种子。
 *
 * @public
 */
export interface ComposeComponentSeed {
  /** definition 的稳定组件类型。 */
  readonly componentType: string
  /** 新建文档节点使用的名称。 */
  readonly name: string
  /** 每次 seed 独立的 JSON props。 */
  readonly props: JsonObject
  /** 每次 seed 独立的可选通用节点样式。 */
  readonly style?: NodeStyle
  /** 默认节点宽度。 */
  readonly width: number
  /** 默认节点高度。 */
  readonly height: number
}

/**
 * definition factory 创建失败的稳定描述。
 *
 * @public
 */
export interface ComposeComponentSeedError {
  readonly code:
    | 'definition.unknown-type'
    | 'definition.invalid-props'
    | 'definition.invalid-style'
    | 'definition.asset-unsupported'
    | 'definition.asset-factory-failed'
  readonly message: string
}

/**
 * Component seed 的判别结果。
 *
 * @public
 */
export type ComposeComponentSeedResult =
  | { readonly ok: true; readonly seed: ComposeComponentSeed }
  | { readonly ok: false; readonly error: ComposeComponentSeedError }

/**
 * 不拥有文档或全局状态的实例级只读注册表。
 *
 * @public
 */
export interface ComposeComponentRegistry {
  /** 按稳定 type 解析 definition。 */
  get(type: string): ComposeComponentDefinition | undefined
  /** 按创建注册表时的顺序列出 definitions。 */
  list(): readonly ComposeComponentDefinition[]
  /** 调用 definition factory 并创建独立 JSON 节点种子。 */
  createSeed(type: string): ComposeComponentSeedResult
  /** 按 definition 顺序从已解析资源创建组件 seed。 */
  createAssetSeed(input: ComposeComponentAssetDropInput): Promise<ComposeComponentSeedResult>
}

/**
 * 注册表创建失败。
 *
 * @public
 */
export class ComposeComponentRegistryError extends Error {
  /** 稳定错误码。 */
  readonly code: 'definition.invalid'
  /** definitions 数组中的定位索引。 */
  readonly definitionIndex: number

  constructor(definitionIndex: number, message: string) {
    super(message)
    this.name = 'ComposeComponentRegistryError'
    this.code = 'definition.invalid'
    this.definitionIndex = definitionIndex
  }
}
