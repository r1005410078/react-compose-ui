/**
 * 提供 Container、Rectangle、Text、Image 与 SVG 的 ECS Entity Presets。
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
  DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS,
  DEFAULT_COMPOSE_COMPONENT_DEFINITIONS,
} from './builtin-components'
export { DEFAULT_COMPOSE_CONTAINER_PRESET } from './container'
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
export type {
  ComposeBasicContainerOptions,
  ComposeBasicMaterialOptions,
  ComposeBasicMaterials,
  ComposeCreateBasicMaterialsOptions,
} from './types'
