import type { NodeInspectorProps } from '@compose-ui/component-registry'
import type { NodeStyle } from '@compose-ui/core'
import { PropertyPanel } from '@compose-ui/property-panel'
import type { ComponentType } from 'react'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import { createContainerValue } from '../shared/inspector/values'
import { useMaterialInspectorI18n } from '../shared/inspector/use-material-inspector-i18n'
import type { ContainerNode } from '../types'

interface ContainerInspectorDefaults {
  readonly name: string
  readonly size: {
    readonly width: number
    readonly height: number
  }
  readonly style: NodeStyle
}

/** 创建绑定当前 Frame defaults 的 Frame Inspector。 @internal */
export function createContainerInspector(
  frameDefaults: ContainerInspectorDefaults,
  idFactory: InspectorIdFactory,
): ComponentType<NodeInspectorProps<ContainerNode>> {
  return function ContainerInspector({ node, dispatch }) {
    const i18n = useMaterialInspectorI18n()
    const value = createContainerValue(node)
    const defaultValue = createContainerValue({
      ...node,
      name: frameDefaults.name,
      transform: {
        x: 0,
        y: 0,
        width: frameDefaults.size.width,
        height: frameDefaults.size.height,
        rotation: 0,
      },
      style: frameDefaults.style,
    })
    return (
      <PropertyPanel
        aria-label={i18n.propertiesLabel(node.name)}
        defaultValue={defaultValue}
        readOnly={node.locked}
        schema={i18n.schemas.frame}
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
