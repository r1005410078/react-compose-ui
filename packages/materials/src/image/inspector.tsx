import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../material-inspector-kit/inspector/dispatch-update'
import type { InspectorIdFactory } from '../material-inspector-kit/inspector/dispatch-update'
import type { ImageValue } from '../material-inspector-kit/inspector/schemas'
import { useMaterialInspectorI18n } from '../material-inspector-kit/inspector/use-material-inspector-i18n'
import { createContainerValue } from '../material-inspector-kit/inspector/values'

/** 创建 Image Inspector。 @internal */
export function createImageInspector(idFactory: InspectorIdFactory) {
  return function ImageInspector({ node, dispatch }: ComposeComponentInspectorProps) {
    const i18n = useMaterialInspectorI18n()
    const value: ImageValue = {
      ...createContainerValue(node),
      alt: typeof node.props.alt === 'string' ? node.props.alt : node.name,
      fit: (
        typeof node.props.fit === 'string' ? node.props.fit : 'contain'
      ) as ImageValue['fit'],
    }
    return (
      <ComposePropertyPanel
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
