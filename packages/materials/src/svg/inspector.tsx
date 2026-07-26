import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import { PropertyPanel } from '@compose-ui/property-panel'
import { dispatchInspectorUpdate } from '../shared/inspector/dispatch-update'
import type { InspectorIdFactory } from '../shared/inspector/dispatch-update'
import type { SvgValue } from '../shared/inspector/schemas'
import { useMaterialInspectorI18n } from '../shared/inspector/use-material-inspector-i18n'
import { createContainerValue } from '../shared/inspector/values'

/** 创建 SVG Inspector。 @internal */
export function createSvgInspector(idFactory: InspectorIdFactory) {
  return function SvgInspector({ node, dispatch }: ComponentInspectorProps) {
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
      <PropertyPanel
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
