import type { ComposeComponentDefinition } from '@compose-ui/component-registry'
import { cloneProps, cloneStyle } from '../material-inspector-kit/default-values'
import {
  createDefaultInspectorId,
  type InspectorIdFactory,
} from '../material-inspector-kit/inspector/dispatch-update'
import type { ComposeBasicMaterialComponentOptions } from '../types'
import { DEFAULT_RECTANGLE_SIZE, DEFAULT_RECTANGLE_STYLE } from './defaults'
import { createRectangleInspector } from './inspector'
import { RectangleRenderer } from './renderer'

/** 根据实例配置创建 Rectangle definition。 @internal */
export function createRectangleDefinition(
  options: ComposeBasicMaterialComponentOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): ComposeComponentDefinition {
  const name = options.name ?? 'Rectangle'
  const defaultSize = options.defaultSize ?? DEFAULT_RECTANGLE_SIZE
  const defaultProps = cloneProps({}, options.defaultProps)
  const defaultStyle = cloneStyle(DEFAULT_RECTANGLE_STYLE, options.defaultStyle)
  return {
    type: 'rectangle',
    label: options.label ?? 'Rectangle',
    defaultName: name,
    icon: <span aria-hidden="true">▭</span>,
    defaultSize: { ...defaultSize },
    createDefaultProps: () => cloneProps(defaultProps),
    createDefaultStyle: () => cloneStyle(defaultStyle),
    renderer: RectangleRenderer,
    inspector: createRectangleInspector({
      name,
      size: defaultSize,
      style: defaultStyle,
    }, idFactory),
  }
}

/** 默认 Rectangle definition；不会创建模块级 registry。 @public */
export const DEFAULT_COMPOSE_RECTANGLE_DEFINITION = createRectangleDefinition()
