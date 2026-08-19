/**
 * 提供 Container、Rectangle、Text、Image、SVG 与绘图 Shape 的 ECS Entity Presets。
 *
 * @packageDocumentation
 */

import './styles.css'

export {
  COMPOSE_UI_MATERIALS_PACKAGE,
  DEFAULT_COMPOSE_BASIC_PRESETS,
  DEFAULT_COMPOSE_BASIC_RENDERERS,
  createComposeBasicMaterials,
} from './create-basic-materials'
export {
  ComposeArrowMaterialIcon,
  ComposeCircleMaterialIcon,
  ComposeContainerMaterialIcon,
  ComposeEchartsMaterialIcon,
  ComposeGroupMaterialIcon,
  ComposeImageMaterialIcon,
  ComposeLineMaterialIcon,
  ComposePageSlotMaterialIcon,
  ComposeRectangleMaterialIcon,
  ComposeSvgMaterialIcon,
  ComposeTextMaterialIcon,
  ComposeWidgetSwitcherMaterialIcon,
} from './material-icons'
export {
  createComposeBuiltinComponentDefinitions,
  DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS,
  DEFAULT_COMPOSE_COMPONENT_DEFINITIONS,
} from './builtin-components'
export { composeNodePropertySchema } from './material-inspector-kit/node'
export { DEFAULT_COMPOSE_CONTAINER_PRESET } from './container'
export { DEFAULT_COMPOSE_FRAME_PRESET } from './frame'
export { DEFAULT_COMPOSE_GROUP_PRESET } from './group'
export { DEFAULT_COMPOSE_WIDGET_SWITCHER_PRESET } from './widget-switcher'
export {
  DEFAULT_COMPOSE_RECTANGLE_PRESET,
  DEFAULT_COMPOSE_RECTANGLE_RENDERER,
} from './rectangle'
export {
  DEFAULT_COMPOSE_TEXT_PRESET,
  DEFAULT_COMPOSE_TEXT_RENDERER,
} from './text'
export {
  DEFAULT_COMPOSE_IMAGE_PRESET,
  DEFAULT_COMPOSE_IMAGE_RENDERER,
} from './image'
export {
  DEFAULT_COMPOSE_SVG_PRESET,
  DEFAULT_COMPOSE_SVG_RENDERER,
} from './svg'
export {
  DEFAULT_COMPOSE_ARROW_PRESET,
  DEFAULT_COMPOSE_CIRCLE_PRESET,
  DEFAULT_COMPOSE_LINE_PRESET,
  DEFAULT_COMPOSE_SHAPE_RENDERER,
} from './shape'
export {
  DEFAULT_COMPOSE_PAGE_SLOT_PRESET,
  DEFAULT_COMPOSE_PAGE_SLOT_RENDERER,
} from './page-slot'
export {
  DEFAULT_COMPOSE_COMPONENT_INSTANCE_PRESET,
  DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER,
} from './component-instance'
export type {
  ComposeBasicContainerOptions,
  ComposeBasicMaterialOptions,
  ComposeBasicMaterials,
  ComposeCreateBasicMaterialsOptions,
  ComposeShapeMaterialOptions,
} from './types'
