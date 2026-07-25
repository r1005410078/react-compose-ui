import type { ComponentDefinition } from '@compose-ui/component-registry'
import { cloneProps, cloneStyle } from '../shared/default-values'
import {
  createDefaultInspectorId,
  type InspectorIdFactory,
} from '../shared/inspector/dispatch-update'
import type { BasicMaterialComponentOptions } from '../types'
import { DEFAULT_TEXT_PROPS, DEFAULT_TEXT_SIZE, DEFAULT_TEXT_STYLE } from './defaults'
import { createTextInspector } from './inspector'
import { TextRenderer } from './renderer'

/** 根据实例配置创建 Text definition。 @internal */
export function createTextDefinition(
  options: BasicMaterialComponentOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): ComponentDefinition {
  const name = options.name ?? 'Text'
  const defaultSize = options.defaultSize ?? DEFAULT_TEXT_SIZE
  const defaultProps = cloneProps(DEFAULT_TEXT_PROPS, options.defaultProps)
  const defaultStyle = cloneStyle(DEFAULT_TEXT_STYLE, options.defaultStyle)
  return {
    type: 'text',
    label: options.label ?? 'Text',
    defaultName: name,
    icon: <span aria-hidden="true">T</span>,
    defaultSize: { ...defaultSize },
    createDefaultProps: () => cloneProps(defaultProps),
    createDefaultStyle: () => cloneStyle(defaultStyle),
    renderer: TextRenderer,
    inspector: createTextInspector({
      name,
      size: defaultSize,
      props: defaultProps,
      style: defaultStyle,
    }, idFactory),
  }
}

/** 默认 Text definition；不会创建模块级 registry。 @public */
export const DEFAULT_TEXT_DEFINITION = createTextDefinition()
