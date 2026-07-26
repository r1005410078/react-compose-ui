import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../material-inspector-kit/inspector/dispatch-update'
import type { InspectorIdFactory } from '../material-inspector-kit/inspector/dispatch-update'
import type { SvgValue } from '../material-inspector-kit/inspector/schemas'
import { useMaterialInspectorI18n } from '../material-inspector-kit/inspector/use-material-inspector-i18n'
import { createContainerValue } from '../material-inspector-kit/inspector/values'

/** 创建 SVG Inspector。 @internal */
export function createSvgInspector(idFactory: InspectorIdFactory) {
  return function SvgInspector({ node, dispatch }: ComposeComponentInspectorProps) {
    const i18n = useMaterialInspectorI18n()
    const value: SvgValue = {
      ...createContainerValue(node),
      alt: typeof node.props.alt === 'string' ? node.props.alt : node.name,
      fit: (
        typeof node.props.fit === 'string' ? node.props.fit : 'contain'
      ) as SvgValue['fit'],
      overrideFill: node.props.overrideFill === true,
      fillColor: typeof node.props.fillColor === 'string' ? node.props.fillColor : '#ffffff',
      overrideStroke: node.props.overrideStroke === true,
      strokeColor: typeof node.props.strokeColor === 'string' ? node.props.strokeColor : '#ffffff',
    }
    return (
      <ComposePropertyPanel
        aria-label={i18n.propertiesLabel(node.name)}
        defaultValue={{
          ...value,
          alt: node.name,
          fit: 'contain',
          overrideFill: false,
          fillColor: '#ffffff',
          overrideStroke: false,
          strokeColor: '#ffffff',
        }}
        readOnly={node.locked}
        schema={i18n.schemas.svg}
        value={value}
        onValueChange={(next) =>
          dispatchInspectorUpdate(node, value, next, dispatch, idFactory)}
      />
    )
  }
}
