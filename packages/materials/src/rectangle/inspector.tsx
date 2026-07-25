import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import type { NodeStyle } from '@compose-ui/core'
import { PropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import { createContainerValue } from '../shared/inspector/values'
import { useMaterialInspectorI18n } from '../shared/inspector/use-material-inspector-i18n'
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
    const i18n = useMaterialInspectorI18n()
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
        aria-label={i18n.propertiesLabel(node.name)}
        defaultValue={defaultValue}
        readOnly={node.locked}
        schema={i18n.schemas.container}
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
