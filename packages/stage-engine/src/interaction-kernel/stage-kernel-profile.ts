import type { StageSceneIndex } from '../hit-testing'
import type {
  StageInteractionContext,
  StageInteractionEffect,
  StageInteractionEvent,
  StageInteractionSnapshot,
} from '../interaction-controller'
import type { InteractionClaimResult, InteractionKernelProfile, InteractionPlugin, InteractionPluginContext, InteractionSession } from './kernel-types'
import { createInteractionPluginRegistry, type InteractionPluginRegistry } from './plugin-registry'
import {
  createInteractionSessionArbiter,
  type InteractionArbiterBeginResult,
  type InteractionSessionArbiter,
} from './session-arbiter'

/**
 * 指针按下事件；Stage 的插件 claim 只在这个事件上被询问。
 *
 * @public
 */
export type StagePointerDownEvent = Extract<StageInteractionEvent, { type: 'pointer.down' }>

/**
 * 把泛型交互内核绑定到 Stage 的文档协议。
 *
 * @remarks
 * 这个文件是 Stage 与内核之间唯一的接线处：`kernel-types.ts`、`session-arbiter.ts` 与
 * `plugin-registry.ts` 因此不 import 任何 Stage 专有类型，该约束由
 * `dependency-boundary.test.ts` 守住。把绑定写回那三个文件会让守卫无从谈起——
 * 边界要从声明变成结构才守得住。
 *
 * @public
 */
export interface StageKernelProfile extends InteractionKernelProfile {
  readonly context: StageInteractionContext
  readonly index: StageSceneIndex
  readonly event: StageInteractionEvent
  readonly claimEvent: StagePointerDownEvent
  readonly effect: StageInteractionEffect
  readonly snapshot: StageInteractionSnapshot
}

/** 内核提供给 Stage 插件的运行时上下文。 @public */
export type StagePluginContext = InteractionPluginContext<StageKernelProfile>

/** 一次被接管的 Stage 交互会话。 @public */
export type StageSession = InteractionSession<StageKernelProfile>

/** Stage `claim` 的三态结果。 @public */
export type StageClaimResult = InteractionClaimResult<StageKernelProfile>

/** 可替换的 Stage 交互单元。 @public */
export type StageInteractionPlugin = InteractionPlugin<StageKernelProfile>

/** 按优先级排序的 Stage 插件集合。 @public */
export type StagePluginRegistry = InteractionPluginRegistry<StageKernelProfile>

/** 同一时刻至多一个 Stage 交互会话的仲裁器。 @public */
export type StageSessionArbiter = InteractionSessionArbiter<StageKernelProfile>

/** Stage `begin` 的结果，供 Controller 决定是否继续走兜底路径。 @public */
export type StageArbiterBeginResult = InteractionArbiterBeginResult

/**
 * 建立 Stage 插件注册表。
 *
 * @remarks
 * 显式标注类型而不是直接转导泛型函数：注册空数组时类型参数无从推断，会退化到约束上，
 * 使 `StagePluginRegistry` 与调用点的类型对不上。
 *
 * @public
 */
export const createStagePluginRegistry: (
  plugins: readonly StageInteractionPlugin[],
) => StagePluginRegistry = createInteractionPluginRegistry

/** 建立 Stage 会话仲裁器。 @public */
export const createStageSessionArbiter: (
  registry: StagePluginRegistry,
) => StageSessionArbiter = createInteractionSessionArbiter
