import type {
  InteractionClaimResult,
  InteractionKernelProfile,
  InteractionPlugin,
  InteractionPluginContext,
  InteractionPluginRegistry,
  InteractionSession,
  InteractionSessionArbiter,
} from '@compose-ui/interaction-kernel'
import {
  createInteractionPluginRegistry,
  createInteractionSessionArbiter,
} from '@compose-ui/interaction-kernel'
import type { ComposeCommandPrompt } from '@compose-ui/commands'
import type { CadDocument } from '../document'
import type { CadInputPoint } from '../point-input'
import type { CadSelectionBounds, CadSelectionMode } from '../selection'

/** 一次按下携带的修饰键。 @public */
export interface CadPointerModifiers {
  readonly shift: boolean
  readonly alt: boolean
  readonly command: boolean
}

/**
 * 归一化后的图面输入事件。
 *
 * @remarks
 * 点一律是**世界坐标**：屏幕换算属于宿主视口，插件不该知道缩放存在。
 *
 * @public
 */
export type CadInteractionEvent =
  | {
      readonly type: 'pointer.down'
      readonly pointerId: number
      readonly button: number
      readonly point: CadInputPoint
      readonly modifiers: CadPointerModifiers
    }
  | {
      readonly type: 'pointer.move'
      readonly pointerId: number
      readonly point: CadInputPoint
      readonly modifiers: CadPointerModifiers
    }
  | {
      readonly type: 'pointer.up'
      readonly pointerId: number
      readonly point: CadInputPoint
      readonly modifiers: CadPointerModifiers
    }

/** 询问 claim 的事件变体。 @public */
export type CadPointerDownEvent = Extract<CadInteractionEvent, { type: 'pointer.down' }>

/**
 * 插件看到的受控上下文。
 *
 * @remarks
 * `prompt` 是**活动命令当前等待的那一步**，没有活动命令时为 `null`。插件据此判断这次按下
 * 该不该让给命令——它不持有命令会话，也不知道命令有几步。
 *
 * @public
 */
export interface CadInteractionContext {
  readonly document: CadDocument
  readonly prompt: ComposeCommandPrompt | null
  readonly selection: readonly string[]
  /** 命中容差（世界单位）；宿主按屏幕像素除以缩放得出。 */
  readonly hitTolerance: number
}

/**
 * 与上下文同一求解周期的命中索引。
 *
 * @remarks
 * 做成索引而不是让插件直接调几何函数，是为了让插件完全不碰几何：将来加空间索引时插件一行
 * 不改。今天的实现就是对文档的一次线性遍历。
 *
 * @public
 */
export interface CadSceneIndex {
  /** 求指定点命中的图元；没有命中为 `null`。 */
  hitTest(point: CadInputPoint): string | null
  /** 求落在选框内的图元。 */
  hitBounds(bounds: CadSelectionBounds, mode: CadSelectionMode): readonly string[]
}

/**
 * 插件发给宿主的效果。
 *
 * @remarks
 * 插件不认识命令会话：需要把输入交给活动命令时发出 `command.point` / `command.selection`，
 * 由宿主先过一遍点求解管线（捕捉 > 正交 > 网格）再喂给会话。几何留在宿主，插件只决定
 * **指针归谁**。
 *
 * @public
 */
export type CadInteractionEffect =
  | { readonly kind: 'pointer.capture'; readonly pointerId: number }
  | { readonly kind: 'pointer.release'; readonly pointerId: number }
  /** 把这个世界坐标交给活动命令；宿主负责先过点求解管线。 */
  | { readonly kind: 'command.point'; readonly point: CadInputPoint }
  /** 把这批 Entity 交给活动命令。 */
  | { readonly kind: 'command.selection'; readonly ids: readonly string[] }

/** 对外发布的交互快照。 @public */
export interface CadInteractionSnapshot {
  readonly selection: readonly string[]
  /** 框选进行中的选框；没有框选时为 `null`。 */
  readonly marquee: { readonly bounds: CadSelectionBounds; readonly mode: CadSelectionMode } | null
}

/**
 * 把泛型交互内核绑定到 CAD 的文档协议。
 *
 * @remarks
 * 这个文件是 CAD 与内核之间**唯一**的接线处。内核住在 `@compose-ui/interaction-kernel`，
 * 那个包 `dependencies` 为空，因此它不认识 `CadDocument`——认识它的只有这里的类型签名。
 *
 * @public
 */
export interface CadKernelProfile extends InteractionKernelProfile {
  readonly context: CadInteractionContext
  readonly index: CadSceneIndex
  readonly event: CadInteractionEvent
  readonly claimEvent: CadPointerDownEvent
  readonly effect: CadInteractionEffect
  readonly snapshot: CadInteractionSnapshot
}

/** 内核提供给 CAD 插件的运行时上下文。 @public */
export type CadPluginContext = InteractionPluginContext<CadKernelProfile>

/** 一次被接管的 CAD 交互会话。 @public */
export type CadSession = InteractionSession<CadKernelProfile>

/** CAD `claim` 的三态结果。 @public */
export type CadClaimResult = InteractionClaimResult<CadKernelProfile>

/** 可替换的 CAD 交互单元。 @public */
export type CadInteractionPlugin = InteractionPlugin<CadKernelProfile>

/** 按优先级排序的 CAD 插件集合。 @public */
export type CadPluginRegistry = InteractionPluginRegistry<CadKernelProfile>

/** 同一时刻至多一个 CAD 交互会话的仲裁器。 @public */
export type CadSessionArbiter = InteractionSessionArbiter<CadKernelProfile>

/**
 * 建立 CAD 插件注册表。
 *
 * @remarks
 * 显式标注类型而不是直接转导泛型函数：注册空数组时类型参数无从推断，会退化到约束上。
 *
 * @public
 */
export const createCadPluginRegistry: (
  plugins: readonly CadInteractionPlugin[],
) => CadPluginRegistry = createInteractionPluginRegistry

/** 建立 CAD 会话仲裁器。 @public */
export const createCadSessionArbiter: (
  registry: CadPluginRegistry,
) => CadSessionArbiter = createInteractionSessionArbiter
