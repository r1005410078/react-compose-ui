import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS,
  DEFAULT_COMPOSE_COMPONENT_DEFINITIONS,
} from './builtin-components'
import { createContainerPreset, DEFAULT_COMPOSE_CONTAINER_PRESET } from './container'
import {
  createDefaultInspectorId,
} from './material-inspector-kit/renderer-inspectors'
import {
  createRectangleMaterial,
  DEFAULT_COMPOSE_RECTANGLE_PRESET,
  DEFAULT_COMPOSE_RECTANGLE_RENDERER,
} from './rectangle'
import {
  createTextMaterial,
  DEFAULT_COMPOSE_TEXT_PRESET,
  DEFAULT_COMPOSE_TEXT_RENDERER,
} from './text'
import {
  createImageMaterial,
  DEFAULT_COMPOSE_IMAGE_PRESET,
  DEFAULT_COMPOSE_IMAGE_RENDERER,
} from './image'
import {
  createSvgMaterial,
  DEFAULT_COMPOSE_SVG_PRESET,
  DEFAULT_COMPOSE_SVG_RENDERER,
} from './svg'
import type { ComposeBasicMaterials, ComposeCreateBasicMaterialsOptions } from './types'

/** `@compose-ui/materials` 的稳定包标识。 @public */
export const COMPOSE_UI_MATERIALS_PACKAGE = '@compose-ui/materials' as const

/** 默认 Renderer 定义。 @public */
export const DEFAULT_COMPOSE_BASIC_RENDERERS = Object.freeze([
  DEFAULT_COMPOSE_RECTANGLE_RENDERER,
  DEFAULT_COMPOSE_TEXT_RENDERER,
  DEFAULT_COMPOSE_IMAGE_RENDERER,
  DEFAULT_COMPOSE_SVG_RENDERER,
])

/** 默认 Entity Presets。 @public */
export const DEFAULT_COMPOSE_BASIC_PRESETS = Object.freeze([
  DEFAULT_COMPOSE_CONTAINER_PRESET,
  DEFAULT_COMPOSE_RECTANGLE_PRESET,
  DEFAULT_COMPOSE_TEXT_PRESET,
  DEFAULT_COMPOSE_IMAGE_PRESET,
  DEFAULT_COMPOSE_SVG_PRESET,
])

/** 为一个编辑器实例创建基础 ECS 物料和 Entity Registry。 @public */
export function createComposeBasicMaterials(
  options: ComposeCreateBasicMaterialsOptions = {},
): ComposeBasicMaterials {
  const idFactory = options.idFactory ?? createDefaultInspectorId
  const container = createContainerPreset(options.container)
  const rectangle = createRectangleMaterial(options.rectangle)
  const text = createTextMaterial(options.text, idFactory)
  const image = createImageMaterial(options.image, idFactory)
  const svg = createSvgMaterial(options.svg, idFactory)
  const rendererDefinitions = Object.freeze([
    rectangle.renderer,
    text.renderer,
    image.renderer,
    svg.renderer,
    ...(options.extensions?.renderers ?? []),
  ])
  const componentDefinitions = Object.freeze([
    ...DEFAULT_COMPOSE_COMPONENT_DEFINITIONS,
    ...(options.extensions?.components ?? []),
  ])
  const presets = Object.freeze([
    container,
    rectangle.preset,
    text.preset,
    image.preset,
    svg.preset,
    ...(options.extensions?.presets ?? []),
  ])
  const capabilities = Object.freeze([
    ...DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS,
    ...(options.extensions?.capabilities ?? []),
  ])
  return Object.freeze({
    registry: createComposeEntityRegistry({
      renderers: rendererDefinitions,
      components: componentDefinitions,
      presets,
      capabilities,
    }),
    rendererDefinitions,
    componentDefinitions,
    presets,
    capabilities,
  })
}
