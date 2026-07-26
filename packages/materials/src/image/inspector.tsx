import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import { PropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import type { ImageValue } from '../shared/inspector/schemas'
import { useMaterialInspectorI18n } from '../shared/inspector/use-material-inspector-i18n'
import { createContainerValue } from '../shared/inspector/values'

/** 创建 Image Inspector。 @internal */
export function createImageInspector(idFactory: InspectorIdFactory) {
  return function ImageInspector({ node, dispatch }: ComponentInspectorProps) {
    const i18n = useMaterialInspectorI18n()
    const value: ImageValue = {
      ...createContainerValue(node),
      alt: typeof node.props.alt === 'string' ? node.props.alt : node.name,
      fit: (
        typeof node.props.fit === 'string' ? node.props.fit : 'contain'
      ) as ImageValue['fit'],
    }
    return (
      <PropertyPanel
        aria-label={i18n.propertiesLabel(node.name)}
        defaultValue={{ ...value, alt: node.name, fit: 'contain' }}
        readOnly={node.locked}
        schema={i18n.schemas.image}
        value={value}
        onValueChange={(next) =>
          dispatchInspectorUpdate(node, value, next, dispatch, idFactory)}
      />
    )
  }
}
