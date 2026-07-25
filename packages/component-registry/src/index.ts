/**
 * 提供实例级宿主 React 组件注册协议。
 *
 * @packageDocumentation
 */

export { createComponentRegistry } from './registry'
export { RegistryComponent, RegistryInspector } from './renderers'
export {
  ComponentRegistryError,
  type ComponentDefaultSize,
  type ComponentDefinition,
  type ComponentInspectorProps,
  type NodeInspectorProps,
  type ComponentRegistry,
  type ComponentRendererProps,
  type ComponentSeed,
  type ComponentSeedError,
  type ComponentSeedResult,
} from './types'

/** `@compose-ui/component-registry` 的稳定包标识。 @public */
export const COMPOSE_UI_COMPONENT_REGISTRY_PACKAGE = '@compose-ui/component-registry' as const
