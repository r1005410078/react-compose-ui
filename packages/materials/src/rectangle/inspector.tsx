import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import type { NodeStyle } from '@compose-ui/core'
import { PropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import { containerSchema } from '../shared/inspector/schemas'
import { createContainerValue } from '../shared/inspector/values'
import { resolveLegacyRectangleStyle } from './legacy-style'

interface RectangleInspectorDefaults {
  readonly name: string
  readonly size: {
    readonly width: number
    readonly height: number
  }
  readonly style: NodeStyle
}

/** 创建绑定当前 Rectangle defaults 的 Inspector。 @internal */
export function createRectangleInspector(
  defaults: RectangleInspectorDefaults,
  idFactory: InspectorIdFactory,
) {
  return function RectangleInspector({ node, dispatch }: ComponentInspectorProps) {
    const value = createContainerValue(
      node,
      resolveLegacyRectangleStyle(node, defaults.style),
    )
    const defaultValue = createContainerValue({
      ...node,
      name: defaults.name,
      transform: { x: 0, y: 0, ...defaults.size, rotation: 0 },
      style: defaults.style,
    })
    return (
      <PropertyPanel
        aria-label={`${node.name} properties`}
        defaultValue={defaultValue}
        readOnly={node.locked}
        schema={containerSchema}
        value={value}
        onValueChange={(next) =>
          dispatchInspectorUpdate(
            node,
            value,
            next,
            dispatch,
            idFactory,
            node.style === undefined,
          )}
      />
    )
  }
}
