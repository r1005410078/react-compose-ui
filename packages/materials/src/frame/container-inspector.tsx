import type { NodeInspectorProps } from '@compose-ui/component-registry'
import type { NodeStyle } from '@compose-ui/core'
import { PropertyPanel } from '@compose-ui/property-panel'
import type { ComponentType } from 'react'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import { containerSchema } from '../shared/inspector/schemas'
import { createContainerValue } from '../shared/inspector/values'
import type { ContainerNode } from '../types'

interface ContainerInspectorDefaults {
  readonly name: string
  readonly size: {
    readonly width: number
    readonly height: number
  }
  readonly style: NodeStyle
}

/** 创建绑定当前 Frame defaults 的 Frame/Group Inspector。 @internal */
export function createContainerInspector(
  frameDefaults: ContainerInspectorDefaults,
  idFactory: InspectorIdFactory,
): ComponentType<NodeInspectorProps<ContainerNode>> {
  return function ContainerInspector({ node, dispatch }) {
    const value = createContainerValue(node)
    const defaultValue = node.kind === 'frame'
      ? createContainerValue({
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
      : createContainerValue({
          ...node,
          name: 'Group',
          transform: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
          style: undefined,
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
