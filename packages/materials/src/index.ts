/**
 * 提供 Frame、Rectangle、Text、Image 与 SVG 基础物料及其 Inspector。
 *
 * @packageDocumentation
 */

import './styles.css'

export {
  COMPOSE_UI_MATERIALS_PACKAGE,
  DEFAULT_COMPOSE_BASIC_COMPONENT_DEFINITIONS,
  DEFAULT_COMPOSE_BASIC_FRAME_PRESETS,
  createComposeBasicMaterials,
} from './create-basic-materials'
export {
  DEFAULT_COMPOSE_FRAME_PRESET,
} from './frame'
export {
  DEFAULT_COMPOSE_RECTANGLE_DEFINITION,
} from './rectangle'
export {
  DEFAULT_COMPOSE_TEXT_DEFINITION,
} from './text'
export {
  DEFAULT_COMPOSE_IMAGE_DEFINITION,
} from './image'
export {
  DEFAULT_COMPOSE_SVG_DEFINITION,
} from './svg'
export type {
  ComposeBasicMaterialComponentOptions,
  ComposeBasicMaterialFrameOptions,
  ComposeBasicMaterials,
  ComposeCreateBasicMaterialsOptions,
} from './types'
