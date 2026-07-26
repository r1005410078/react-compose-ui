import { createComposeComponentRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentDefinition } from '@compose-ui/component-registry'
import type { ComposeStageFramePreset } from '@compose-ui/stage'
import { createContainerInspector } from './frame'
import { DEFAULT_COMPOSE_FRAME_PRESET, createFramePreset } from './frame'
import { DEFAULT_COMPOSE_RECTANGLE_DEFINITION, createRectangleDefinition } from './rectangle'
import {
  createDefaultInspectorId,
} from './material-inspector-kit/inspector/dispatch-update'
import { DEFAULT_COMPOSE_TEXT_DEFINITION, createTextDefinition } from './text'
import { DEFAULT_COMPOSE_IMAGE_DEFINITION, createImageDefinition } from './image'
import { DEFAULT_COMPOSE_SVG_DEFINITION, createSvgDefinition } from './svg'
import type { ComposeBasicMaterials, ComposeCreateBasicMaterialsOptions } from './types'

/** `@compose-ui/materials` 的稳定包标识。 @public */
export const COMPOSE_UI_MATERIALS_PACKAGE = '@compose-ui/materials' as const

/** 按 Frame palette 顺序导出的默认 presets。 @public */
export const DEFAULT_COMPOSE_BASIC_FRAME_PRESETS: readonly ComposeStageFramePreset[] = Object.freeze([
  DEFAULT_COMPOSE_FRAME_PRESET,
])

/** 按 Component Library 顺序导出的默认 definitions。 @public */
export const DEFAULT_COMPOSE_BASIC_COMPONENT_DEFINITIONS: readonly ComposeComponentDefinition[] = Object.freeze([
  DEFAULT_COMPOSE_RECTANGLE_DEFINITION,
  DEFAULT_COMPOSE_TEXT_DEFINITION,
  DEFAULT_COMPOSE_IMAGE_DEFINITION,
  DEFAULT_COMPOSE_SVG_DEFINITION,
])

/**
 * 为一个编辑器实例创建基础物料、registry 与绑定默认值的 Container Inspector。
 *
 * @param options - Frame、Rectangle、Text 覆盖项和末尾宿主扩展。
 * @returns 不共享 registry 或可变文档默认值的实例级组合。
 * @public
 */
export function createComposeBasicMaterials(
  options: ComposeCreateBasicMaterialsOptions = {},
): ComposeBasicMaterials {
  const idFactory = options.idFactory ?? createDefaultInspectorId
  const framePreset = createFramePreset(options.frame)
  const rectangle = createRectangleDefinition(options.rectangle, idFactory)
  const text = createTextDefinition(options.text, idFactory)
  const image = createImageDefinition(options.image, idFactory)
  const svg = createSvgDefinition(options.svg, idFactory)
  const componentDefinitions = Object.freeze([
    rectangle,
    text,
    image,
    svg,
    ...(options.extensions ?? []),
  ])
  const framePresets = Object.freeze([framePreset])
  return Object.freeze({
    registry: createComposeComponentRegistry(componentDefinitions),
    componentDefinitions,
    framePresets,
    ContainerInspector: createContainerInspector({
      name: framePreset.name,
      size: framePreset.defaultSize,
      style: framePreset.createDefaultStyle(),
    }, idFactory),
  })
}
