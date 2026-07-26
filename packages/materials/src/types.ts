import type {
  ComponentDefinition,
  ComponentRegistry,
  NodeInspectorProps,
} from '@compose-ui/component-registry'
import type {
  ComposeFrameNode,
  JsonObject,
  NodeStyle,
} from '@compose-ui/core'
import type { StageFramePreset } from '@compose-ui/stage'
import type { ComponentType } from 'react'

/** Container Inspector 支持的 Frame 节点类型。 @internal */
export type ContainerNode = ComposeFrameNode

/**
 * 单个基础 Component 物料的 factory 覆盖项。
 *
 * @public
 */
export interface BasicMaterialComponentOptions {
  /** Palette 展示名称。 */
  readonly label?: string
  /** 新建文档节点名称。 */
  readonly name?: string
  /** 新建节点尺寸。 */
  readonly defaultSize?: {
    readonly width: number
    readonly height: number
  }
  /** 与内置值浅合并的默认 JSON props。 */
  readonly defaultProps?: JsonObject
  /** 与内置值浅合并的默认通用 style。 */
  readonly defaultStyle?: NodeStyle
}

/**
 * Frame preset 的 factory 覆盖项。
 *
 * @public
 */
export interface BasicMaterialFrameOptions {
  /** Palette 展示名称。 */
  readonly label?: string
  /** 新建文档节点名称。 */
  readonly name?: string
  /** 新建 Frame 尺寸。 */
  readonly defaultSize?: {
    readonly width: number
    readonly height: number
  }
  /** 与内置值浅合并的默认通用 style。 */
  readonly defaultStyle?: NodeStyle
  /** 新建 Frame 是否默认裁剪内容。 @defaultValue `true` */
  readonly defaultClipContent?: boolean
}

/**
 * `createBasicMaterials` 配置。
 *
 * @public
 */
export interface CreateBasicMaterialsOptions {
  /** Frame preset 的可选覆盖。 */
  readonly frame?: BasicMaterialFrameOptions
  /** Rectangle definition 的可选覆盖。 */
  readonly rectangle?: BasicMaterialComponentOptions
  /** Text definition 的可选覆盖。 */
  readonly text?: BasicMaterialComponentOptions
  /** 按给定顺序追加到 Rectangle、Text 之后的宿主 definitions。 */
  readonly extensions?: readonly ComponentDefinition[]
  /** Inspector 命令 ID factory；测试或宿主可注入确定性实现。 */
  readonly idFactory?: () => string
}

/**
 * 一个编辑器实例使用的基础物料组合结果。
 *
 * @public
 */
export interface BasicMaterials {
  /** Rectangle、Text 与宿主扩展组成的实例级 registry。 */
  readonly registry: ComponentRegistry
  /** 按 Palette 顺序排列的 Component definitions。 */
  readonly componentDefinitions: readonly ComponentDefinition[]
  /** 当前实例使用的 Frame presets。 */
  readonly framePresets: readonly StageFramePreset[]
  /** 绑定当前 Frame 默认值的 Frame Inspector。 */
  readonly ContainerInspector: ComponentType<NodeInspectorProps<ContainerNode>>
}
