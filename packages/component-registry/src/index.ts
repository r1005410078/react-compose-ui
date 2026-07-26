/**
 * 提供实例级宿主 React 组件注册协议。
 *
 * @packageDocumentation
 */

export { createComposeComponentRegistry } from './registry'
export {
  ComposeRegistryComponent,
  ComposeRegistryInspector,
} from './registry-renderers'
export {
  ComposeComponentRegistryError,
  type ComposeComponentDefaultSize,
  type ComposeComponentAssetDropDefinition,
  type ComposeComponentAssetDropInput,
  type ComposeComponentDefinition,
  type ComposeComponentInspectorProps,
  type ComposeNodeInspectorProps,
  type ComposeComponentRegistry,
  type ComposeComponentRendererProps,
  type ComposeComponentSeed,
  type ComposeComponentSeedError,
  type ComposeComponentSeedResult,
} from './registry'

/** `@compose-ui/component-registry` 的稳定包标识。 @public */
export const COMPOSE_UI_COMPONENT_REGISTRY_PACKAGE = '@compose-ui/component-registry' as const
