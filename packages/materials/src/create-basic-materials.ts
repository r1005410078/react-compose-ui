import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createComposeBuiltinComponentDefinitions,
  DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS,
} from './builtin-components'
import { createContainerPreset, DEFAULT_COMPOSE_CONTAINER_PRESET } from './container'
import { createFramePreset, DEFAULT_COMPOSE_FRAME_PRESET } from './frame'
import { createGroupPreset, DEFAULT_COMPOSE_GROUP_PRESET } from './group'
import {
  createWidgetSwitcherPreset,
  DEFAULT_COMPOSE_WIDGET_SWITCHER_PRESET,
} from './widget-switcher'
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
import { createPageSlotMaterial } from './page-slot'
import {
  createComponentInstanceMaterial,
  DEFAULT_COMPOSE_COMPONENT_INSTANCE_PRESET,
  DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER,
} from './component-instance'
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
import {
  createShapeMaterial,
  DEFAULT_COMPOSE_ARROW_PRESET,
  DEFAULT_COMPOSE_CIRCLE_PRESET,
  DEFAULT_COMPOSE_LINE_PRESET,
  DEFAULT_COMPOSE_SHAPE_RENDERER,
} from './shape'
import type { ComposeBasicMaterials, ComposeCreateBasicMaterialsOptions } from './types'

/** `@compose-ui/materials` 的稳定包标识。 @public */
export const COMPOSE_UI_MATERIALS_PACKAGE = '@compose-ui/materials' as const

/** 默认 Renderer 定义。 @public */
export const DEFAULT_COMPOSE_BASIC_RENDERERS = Object.freeze([
  DEFAULT_COMPOSE_RECTANGLE_RENDERER,
  DEFAULT_COMPOSE_TEXT_RENDERER,
  DEFAULT_COMPOSE_IMAGE_RENDERER,
  DEFAULT_COMPOSE_SVG_RENDERER,
  DEFAULT_COMPOSE_SHAPE_RENDERER,
  DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER,
])

/** 默认 Entity Presets。 @public */
export const DEFAULT_COMPOSE_BASIC_PRESETS = Object.freeze([
  DEFAULT_COMPOSE_GROUP_PRESET,
  DEFAULT_COMPOSE_FRAME_PRESET,
  DEFAULT_COMPOSE_CONTAINER_PRESET,
  DEFAULT_COMPOSE_WIDGET_SWITCHER_PRESET,
  DEFAULT_COMPOSE_RECTANGLE_PRESET,
  DEFAULT_COMPOSE_TEXT_PRESET,
  DEFAULT_COMPOSE_IMAGE_PRESET,
  DEFAULT_COMPOSE_SVG_PRESET,
  DEFAULT_COMPOSE_COMPONENT_INSTANCE_PRESET,
  DEFAULT_COMPOSE_LINE_PRESET,
  DEFAULT_COMPOSE_ARROW_PRESET,
  DEFAULT_COMPOSE_CIRCLE_PRESET,
])

/** 为一个编辑器实例创建基础 ECS 物料和 Entity Registry。 @public */
export function createComposeBasicMaterials(
  options: ComposeCreateBasicMaterialsOptions = {},
): ComposeBasicMaterials {
  const idFactory = options.idFactory ?? createDefaultInspectorId
  const group = createGroupPreset()
  // 场景与容器共用同一组默认值：场景就是放在顶层的容器。
  const frame = createFramePreset(options.container)
  const container = createContainerPreset(options.container)
  const widgetSwitcher = createWidgetSwitcherPreset(options.widgetSwitcher)
  const rectangle = createRectangleMaterial(options.rectangle)
  const text = createTextMaterial(options.text, idFactory)
  const image = createImageMaterial(options.image, idFactory)
  const svg = createSvgMaterial(options.svg, idFactory)
  const shape = createShapeMaterial(options.shape, idFactory)
  const pageSlot = createPageSlotMaterial(options.pageSlot, idFactory)
  const componentInstance = createComponentInstanceMaterial()
  const rendererDefinitions = Object.freeze([
    rectangle.renderer,
    text.renderer,
    image.renderer,
    svg.renderer,
    shape.renderer,
    pageSlot.renderer,
    componentInstance.renderer,
    ...(options.extensions?.renderers ?? []),
  ])
  const componentDefinitions = Object.freeze([
    ...createComposeBuiltinComponentDefinitions(idFactory),
    ...(options.extensions?.components ?? []),
  ])
  const presets = Object.freeze([
    group,
    frame,
    container,
    widgetSwitcher,
    rectangle.preset,
    text.preset,
    image.preset,
    svg.preset,
    pageSlot.preset,
    componentInstance.preset,
    ...shape.presets,
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
