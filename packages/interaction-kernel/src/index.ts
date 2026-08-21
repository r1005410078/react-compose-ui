/**
 * 零运行时依赖、无 React、无 DOM 的交互内核。
 *
 * @remarks
 * 只有三样东西：插件契约、按优先级排序的注册表、同时至多一个会话的仲裁器。内核逻辑本身
 * 完全不认识文档，只有类型签名通过 {@link InteractionKernelProfile} 认识——新文档类型声明
 * 自己的 profile 即可复用同一套仲裁规则，内核一行不改。
 *
 * 「内核不认识文档」由**包依赖**承载而不是命名约定：本包 `dependencies` 为空，想引用文档
 * 类型必须先加依赖，而那条依赖会被本包的边界用例挡下。
 *
 * @packageDocumentation
 */

export type {
  InteractionClaimResult,
  InteractionKernelProfile,
  InteractionPlugin,
  InteractionPluginContext,
  InteractionSession,
} from './kernel-types'
export {
  createInteractionPluginRegistry,
  type InteractionPluginRegistry,
} from './plugin-registry'
export {
  createInteractionSessionArbiter,
  type InteractionArbiterBeginResult,
  type InteractionSessionArbiter,
} from './session-arbiter'

/** `@compose-ui/interaction-kernel` 的稳定包标识。 @public */
export const COMPOSE_UI_INTERACTION_KERNEL_PACKAGE = '@compose-ui/interaction-kernel' as const
