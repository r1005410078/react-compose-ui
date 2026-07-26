import type {
  ComposeComponentDefinition,
  ComposeComponentRegistry,
  ComposeNodeInspectorProps,
} from '@compose-ui/component-registry'
import type {
  ComposeFrameNode,
  JsonObject,
  NodeStyle,
} from '@compose-ui/core'
import type { ComposeStageFramePreset } from '@compose-ui/stage'
import type { ComponentType } from 'react'

/** Container Inspector 支持的 Frame 节点类型。 @internal */
export type ContainerNode = ComposeFrameNode

/**
 * 单个基础 Component 物料的 factory 覆盖项。
 *
 * @public
 */
export interface ComposeBasicMaterialComponentOptions {
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
export interface ComposeBasicMaterialFrameOptions {
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
 * `createComposeBasicMaterials` 配置。
 *
 * @public
 */
export interface ComposeCreateBasicMaterialsOptions {
  /** Frame preset 的可选覆盖。 */
  readonly frame?: ComposeBasicMaterialFrameOptions
  /** Rectangle definition 的可选覆盖。 */
  readonly rectangle?: ComposeBasicMaterialComponentOptions
  /** Text definition 的可选覆盖。 */
  readonly text?: ComposeBasicMaterialComponentOptions
  /** Image definition 的默认节点覆盖。 */
  readonly image?: ComposeBasicMaterialComponentOptions
  /** SVG definition 的默认节点覆盖。 */
  readonly svg?: ComposeBasicMaterialComponentOptions
  /** 按给定顺序追加到内建 definitions 之后的宿主 definitions。 */
  readonly extensions?: readonly ComposeComponentDefinition[]
  /** Inspector 命令 ID factory；测试或宿主可注入确定性实现。 */
  readonly idFactory?: () => string
}

/**
 * 一个编辑器实例使用的基础物料组合结果。
 *
 * @public
 */
export interface ComposeBasicMaterials {
  /** Rectangle、Text、Image、SVG 与宿主扩展组成的实例级 registry。 */
  readonly registry: ComposeComponentRegistry
  /** 按 Palette 顺序排列的 Component definitions。 */
  readonly componentDefinitions: readonly ComposeComponentDefinition[]
  /** 当前实例使用的 Frame presets。 */
  readonly framePresets: readonly ComposeStageFramePreset[]
  /** 绑定当前 Frame 默认值的 Frame Inspector。 */
  readonly ContainerInspector: ComponentType<ComposeNodeInspectorProps<ContainerNode>>
}
