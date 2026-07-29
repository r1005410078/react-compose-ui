import type {
  ComposeCapabilityDefinition,
  ComposeComponentDefinition,
  ComposeEntityPreset,
  ComposeEntityRegistry,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import type { ComposeAppearance, JsonObject } from '@compose-ui/core'

/** 单个基础物料 Preset 的覆盖项。 @public */
export interface ComposeBasicMaterialOptions {
  readonly label?: string
  readonly name?: string
  readonly defaultSize?: { readonly width: number; readonly height: number }
  readonly defaultProps?: JsonObject
  readonly defaultAppearance?: ComposeAppearance
}

/** Container Preset 的覆盖项。 @public */
export interface ComposeBasicContainerOptions {
  readonly label?: string
  readonly name?: string
  readonly defaultSize?: { readonly width: number; readonly height: number }
  readonly defaultAppearance?: ComposeAppearance
  /** 默认是否裁剪后代。 @defaultValue true */
  readonly defaultClip?: boolean
}

/** `createComposeBasicMaterials` 配置。 @public */
export interface ComposeCreateBasicMaterialsOptions {
  readonly container?: ComposeBasicContainerOptions
  readonly rectangle?: ComposeBasicMaterialOptions
  readonly text?: ComposeBasicMaterialOptions
  readonly image?: ComposeBasicMaterialOptions
  readonly svg?: ComposeBasicMaterialOptions
  /** 按分类追加的宿主 Registry 定义。 */
  readonly extensions?: {
    readonly renderers?: readonly ComposeRendererDefinition[]
    readonly components?: readonly ComposeComponentDefinition[]
    readonly presets?: readonly ComposeEntityPreset[]
    readonly capabilities?: readonly ComposeCapabilityDefinition[]
  }
  /** Inspector 命令 ID factory。 */
  readonly idFactory?: () => string
}

/** 一个编辑器实例使用的基础 ECS 物料组合。 @public */
export interface ComposeBasicMaterials {
  readonly registry: ComposeEntityRegistry
  readonly rendererDefinitions: readonly ComposeRendererDefinition[]
  readonly componentDefinitions: readonly ComposeComponentDefinition[]
  readonly presets: readonly ComposeEntityPreset[]
  readonly capabilities: readonly ComposeCapabilityDefinition[]
}
