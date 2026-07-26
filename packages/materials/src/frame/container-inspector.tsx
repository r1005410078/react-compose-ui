import type { ComposeNodeInspectorProps } from '@compose-ui/component-registry'
import type { NodeStyle } from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import type { ComponentType } from 'react'
import { dispatchInspectorUpdate } from '../material-inspector-kit/inspector/dispatch-update'
import type { InspectorIdFactory } from '../material-inspector-kit/inspector/dispatch-update'
import { createContainerValue } from '../material-inspector-kit/inspector/values'
import { useMaterialInspectorI18n } from '../material-inspector-kit/inspector/use-material-inspector-i18n'
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
): ComponentType<ComposeNodeInspectorProps<ContainerNode>> {
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
      <ComposePropertyPanel
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
