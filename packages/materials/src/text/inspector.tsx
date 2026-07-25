import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import type { JsonObject, NodeStyle } from '@compose-ui/core'
import { PropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import { textSchema, type TextValue } from '../shared/inspector/schemas'
import { createContainerValue } from '../shared/inspector/values'

interface TextInspectorDefaults {
  readonly name: string
  readonly size: {
    readonly width: number
    readonly height: number
  }
  readonly props: JsonObject
  readonly style: NodeStyle
}

/** 创建绑定当前 Text defaults 的 Inspector。 @internal */
export function createTextInspector(
  defaults: TextInspectorDefaults,
  idFactory: InspectorIdFactory,
) {
  return function TextInspector({ node, dispatch }: ComponentInspectorProps) {
    const props = {
      text: typeof node.props.text === 'string'
        ? node.props.text
        : String(defaults.props.text),
      color: typeof node.props.color === 'string'
        ? node.props.color
        : String(defaults.props.color),
      fontSize: typeof node.props.fontSize === 'number'
        ? node.props.fontSize
        : Number(defaults.props.fontSize),
    }
    const value: TextValue = { ...createContainerValue(node), ...props }
    const defaultValue: TextValue = {
      ...createContainerValue({
        ...node,
        name: defaults.name,
        transform: { x: 0, y: 0, ...defaults.size, rotation: 0 },
        style: defaults.style,
      }),
      text: String(defaults.props.text),
      color: String(defaults.props.color),
      fontSize: Number(defaults.props.fontSize),
    }
    return (
      <PropertyPanel
        aria-label={`${node.name} properties`}
        defaultValue={defaultValue}
        readOnly={node.locked}
        schema={textSchema}
        value={value}
        onValueChange={(next) =>
          dispatchInspectorUpdate(node, value, next, dispatch, idFactory)}
      />
    )
  }
}
