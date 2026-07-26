import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import type { JsonObject, NodeStyle } from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../material-inspector-kit/inspector/dispatch-update'
import type { InspectorIdFactory } from '../material-inspector-kit/inspector/dispatch-update'
import type { TextValue } from '../material-inspector-kit/inspector/schemas'
import { createContainerValue } from '../material-inspector-kit/inspector/values'
import { useMaterialInspectorI18n } from '../material-inspector-kit/inspector/use-material-inspector-i18n'

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
  return function TextInspector({ node, dispatch }: ComposeComponentInspectorProps) {
    const i18n = useMaterialInspectorI18n()
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
      <ComposePropertyPanel
        aria-label={i18n.propertiesLabel(node.name)}
        defaultValue={defaultValue}
        readOnly={node.locked}
        schema={i18n.schemas.text}
        value={value}
        onValueChange={(next) =>
          dispatchInspectorUpdate(node, value, next, dispatch, idFactory)}
      />
    )
  }
}
