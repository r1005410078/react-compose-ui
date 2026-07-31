/**
 * 提供实例级 Entity Renderer、Component、Preset 与 Capability 注册协议。
 *
 * @packageDocumentation
 */

export { createComposeEntityRegistry } from './registry'
export {
  ComposeRegistryComponentInspector,
  ComposeRegistryComponentInspectorHeaderActions,
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposePaintLayer,
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
  composeEntitySceneStyle,
  composeEntityVisualStyle,
} from './registry-renderers'
export type {
  ComposeEntityBorderLayerProps,
  ComposePaintLayerProps,
} from './registry-renderers'
export {
  ComposeEntityRegistryError,
  type ComposeCapabilityAvailability,
  type ComposeCapabilityDefinition,
  type ComposeCapabilityIssue,
  type ComposeCapabilityPlanResult,
  type ComposeComponentDefinition,
  type ComposeComponentInspectorProps,
  type ComposeEntityAssetDropDefinition,
  type ComposeEntityAssetDropInput,
  type ComposeEntityInspectorContext,
  type ComposeEntityPreset,
  type ComposeNodeEditPort,
  type ComposePaintEditPort,
  type ComposeEntityRegistry,
  type ComposeEntityRegistryOptions,
  type ComposeEntitySeed,
  type ComposeEntitySeedError,
  type ComposeEntitySeedResult,
  type ComposeRendererDefinition,
  type ComposeRendererInspectorProps,
  type ComposeRendererProps,
} from './registry'

/** `@compose-ui/component-registry` 的稳定包标识。 @public */
export const COMPOSE_UI_COMPONENT_REGISTRY_PACKAGE = '@compose-ui/component-registry' as const
