/**
 * 提供 Frame、Rectangle 与 Text 基础物料及其通用 Inspector。
 *
 * @packageDocumentation
 */

import './styles.css'

export {
  COMPOSE_UI_MATERIALS_PACKAGE,
  DEFAULT_BASIC_COMPONENT_DEFINITIONS,
  DEFAULT_BASIC_FRAME_PRESETS,
  createBasicMaterials,
} from './create-basic-materials'
export {
  DEFAULT_FRAME_PRESET,
} from './frame'
export {
  DEFAULT_RECTANGLE_DEFINITION,
} from './rectangle'
export {
  DEFAULT_TEXT_DEFINITION,
} from './text'
export type {
  BasicMaterialComponentOptions,
  BasicMaterialFrameOptions,
  BasicMaterials,
  CreateBasicMaterialsOptions,
} from './types'
