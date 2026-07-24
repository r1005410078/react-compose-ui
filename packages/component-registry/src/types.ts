import type { ComponentType, ReactNode } from 'react'
import type {
  ComposeComponentNode,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'

/**
 * 注册组件创建时使用的默认尺寸。
 *
 * @public
 */
export interface ComponentDefaultSize {
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
export interface ComponentRendererProps {
  /** 当前文档 Component 节点。 */
  readonly node: ComposeComponentNode
  /** 与 node.props 相同的严格 JSON 属性。 */
  readonly props: JsonObject
  /** 编辑 Stage 与只读 Preview 的渲染语义。 */
  readonly mode: 'editor' | 'preview'
}

/**
 * 宿主 Inspector renderer 获得的命令派发上下文。
 *
 * @public
 */
export interface ComponentInspectorProps {
  /** 当前只读 Component 节点。 */
  readonly node: ComposeComponentNode
  /** 向同一个 TransactionRuntime 派发结构化命令。 */
  readonly dispatch: (command: EditorCommand) => unknown
}

/**
 * 一个可由 Stage 与 Preview 共同解析的宿主组件定义。
 *
 * @public
 */
export interface ComponentDefinition {
  /** 文档 componentType 使用的唯一非空标识。 */
  readonly type: string
  /** Palette 与错误信息中的用户可读名称。 */
  readonly label: string
  /** Palette 可选图标；不会写入 ComposeDocument。 */
  readonly icon?: ReactNode
  /** 创建节点时使用的合法默认尺寸。 */
  readonly defaultSize: ComponentDefaultSize
  /** 每次调用必须返回一份严格 JSON 对象。 */
  readonly createDefaultProps: () => JsonObject
  /** Stage 与 Preview 共享的宿主 React renderer。 */
  readonly renderer: ComponentType<ComponentRendererProps>
  /** 可选宿主 Inspector；可以在其内部组合 PropertyPanel。 */
  readonly inspector?: ComponentType<ComponentInspectorProps>
}

/**
 * 成功创建 Component 节点所需的可序列化种子。
 *
 * @public
 */
export interface ComponentSeed {
  readonly componentType: string
  readonly props: JsonObject
  readonly width: number
  readonly height: number
}

/**
 * definition factory 创建失败的稳定描述。
 *
 * @public
 */
export interface ComponentSeedError {
  readonly code: 'definition.unknown-type' | 'definition.invalid-props'
  readonly message: string
}

/**
 * Component seed 的判别结果。
 *
 * @public
 */
export type ComponentSeedResult =
  | { readonly ok: true; readonly seed: ComponentSeed }
  | { readonly ok: false; readonly error: ComponentSeedError }

/**
 * 不拥有文档或全局状态的实例级只读注册表。
 *
 * @public
 */
export interface ComponentRegistry {
  /** 按稳定 type 解析 definition。 */
  get(type: string): ComponentDefinition | undefined
  /** 按创建注册表时的顺序列出 definitions。 */
  list(): readonly ComponentDefinition[]
  /** 调用 definition factory 并创建独立 JSON 节点种子。 */
  createSeed(type: string): ComponentSeedResult
}

/**
 * 注册表创建失败。
 *
 * @public
 */
export class ComponentRegistryError extends Error {
  /** 稳定错误码。 */
  readonly code: 'definition.invalid'
  /** definitions 数组中的定位索引。 */
  readonly definitionIndex: number

  constructor(definitionIndex: number, message: string) {
    super(message)
    this.name = 'ComponentRegistryError'
    this.code = 'definition.invalid'
    this.definitionIndex = definitionIndex
  }
}
