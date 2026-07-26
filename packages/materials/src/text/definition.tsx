import type { ComposeComponentDefinition } from '@compose-ui/component-registry'
import { cloneProps, cloneStyle } from '../material-inspector-kit/default-values'
import {
  createDefaultInspectorId,
  type InspectorIdFactory,
} from '../material-inspector-kit/inspector/dispatch-update'
import type { ComposeBasicMaterialComponentOptions } from '../types'
import { DEFAULT_TEXT_PROPS, DEFAULT_TEXT_SIZE, DEFAULT_TEXT_STYLE } from './defaults'
import { createTextInspector } from './inspector'
import { TextRenderer } from './renderer'

/** 根据实例配置创建 Text definition。 @internal */
export function createTextDefinition(
  options: ComposeBasicMaterialComponentOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): ComposeComponentDefinition {
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
export const DEFAULT_COMPOSE_TEXT_DEFINITION = createTextDefinition()
