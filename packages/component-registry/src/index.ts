/**
 * 提供实例级 Entity Renderer、Component、Preset 与 Capability 注册协议。
 *
 * @packageDocumentation
 */

export { createComposeEntityRegistry } from './registry'
export {
  resolveComposeRendererRuntimeProps,
} from './registry'
export {
  ComposeRegistryComponentInspector,
  ComposeRegistryComponentInspectorHeaderActions,
  ComposeRegistryMissingComponentInspector,
  ComposeRegistryMissingComponentInspectorHeaderActions,
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposePaintLayer,
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
  composeEntityAppearanceStyle,
  composeEntitySceneStyle,
  composeEntityVisualStyle,
} from './registry-renderers'
export type {
  ComposeEntityBorderLayerProps,
  ComposePaintLayerProps,
} from './registry-renderers'
export {
  useComposePageScriptScope,
  type UseComposePageScriptScopeOptions,
} from './page-script-scope'
export {
  createComposeRendererMeasurementAdapter,
  type ComposeRendererMeasurementAdapter,
  type ComposeRendererMeasurementAdapterOptions,
} from './renderer-measurement'
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
  type ComposeMissingComponentInspectorDefinition,
  type ComposeMissingComponentInspectorProps,
  type ComposeEntityPreset,
  type ComposeNodeEditPort,
  type ComposePaintEditPort,
  type ComposeEntityRegistry,
  type ComposeEntityRegistryOptions,
  type ComposeEntitySeed,
  type ComposeEntitySeedError,
  type ComposeEntitySeedResult,
  type ComposeRendererDefinition,
  type ComposeRendererBindingDiagnostic,
  type ComposeRendererPropCategory,
  type ComposeRendererPropContract,
  type ComposeRendererRuntimePropsResult,
  type ComposeRendererMeasurementDefinition,
  type ComposeRendererMeasurementSubscriptionInput,
  type ComposeRendererMeasureInput,
  type ComposeRendererPrepareInput,
  type ComposeRendererInspectorProps,
  type ComposeRendererInspectorBindingPort,
  type ComposeRendererInspectorBindingState,
  type ComposeRendererInspectorBindingVariable,
  type ComposeRendererProps,
  type ComposeRuntimeProps,
} from './registry'

/** `@compose-ui/component-registry` 的稳定包标识。 @public */
export const COMPOSE_UI_COMPONENT_REGISTRY_PACKAGE = '@compose-ui/component-registry' as const
