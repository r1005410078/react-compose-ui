import type { ComponentDefinition } from '@compose-ui/component-registry'
import { cloneProps, cloneStyle } from '../shared/default-values'
import {
  createDefaultInspectorId,
  type InspectorIdFactory,
} from '../shared/inspector/dispatch-update'
import type { BasicMaterialComponentOptions } from '../types'
import { DEFAULT_RECTANGLE_SIZE, DEFAULT_RECTANGLE_STYLE } from './defaults'
import { createRectangleInspector } from './inspector'
import { RectangleRenderer } from './renderer'

/** 根据实例配置创建 Rectangle definition。 @internal */
export function createRectangleDefinition(
  options: BasicMaterialComponentOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): ComponentDefinition {
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
export const DEFAULT_RECTANGLE_DEFINITION = createRectangleDefinition()
