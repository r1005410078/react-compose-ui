import type { StageSceneIndex } from '../scene-index'
import type {
  StageInteractionContext,
  StageInteractionEffect,
  StageInteractionEvent,
  StageInteractionSnapshot,
} from '../interaction-controller'

/**
 * 指针按下事件；插件的 claim 只在这个事件上被询问。
 *
 * @public
 */
export type StagePointerDownEvent = Extract<StageInteractionEvent, { type: 'pointer.down' }>

/**
 * 内核提供给插件的运行时上下文。
 *
 * @remarks
 * 插件 MUST NOT 自行组装或发布 snapshot 之外的状态，也 MUST NOT 直接持有 surface：
 * 快照的派生字段由内核在 {@link StagePluginContext.publish} 中统一补齐，绕过它会让
 * 派生字段缺失。
 *
 * @public
 */
export interface StagePluginContext {
  /** 最新受控 context；与 `index` 属于同一求解周期。 */
  readonly context: StageInteractionContext
  /** 与 `context.document` 对应的场景索引。 */
  readonly index: StageSceneIndex
  /** 向 surface 发出效果；空数组是合法的 no-op。 */
  apply(effects: readonly StageInteractionEffect[]): void
  /** 发布快照，内核负责补齐派生字段并通知订阅者。 */
  publish(snapshot: StageInteractionSnapshot): void
}

/**
 * 一次被接管的交互会话。
 *
 * @remarks
 * 生命周期是 `update`（零次或多次）→ `commit` 或 `cancel`，二者互斥且各至多一次。
 *
 * `update` MUST NOT 写文档，只更新预览与快照；`commit` MUST 至多规划一个命令或 batch；
 * `cancel` MUST 丢弃全部预览，用于 Escape、并发文档变化与会话释放。
 *
 * 仲裁器保证 `commit` 之前已用 pointerup 的点与修饰键调用过一次 `update`，因此 `commit`
 * 不接收终点参数——见 {@link StageSessionArbiter.commit}。
 *
 * @public
 */
export interface StageSession {
  /**
   * 会话绑定的指针。
   *
   * @remarks
   * 仲裁器据此丢弃其他指针的事件；多点触控下第二根手指不会打断进行中的手势。
   */
  readonly pointerId: number
  /**
   * 推进会话。
   *
   * @remarks
   * 收到的不只是 `pointer.move`：`temporary-pan.start` / `temporary-pan.end` 等非指针事件
   * 同样转发给活动会话（move 手势用它表达「锁定原父级」）。会话对不关心的事件 MUST 无副作用地忽略。
   */
  update(event: StageInteractionEvent, ctx: StagePluginContext): void
  commit(ctx: StagePluginContext): void
  cancel(): void
}

/**
 * `claim` 的三态结果。
 *
 * @remarks
 * `'consumed'` 表示这次按下已经被处理掉，但不产生拖拽会话，且仲裁器 MUST 停止询问其余插件。
 * 现有实现里文字编辑守卫（在编辑目标或变换手柄上按下）与 `tool === 'rotate'` 的兜底就是
 * 这种语义：用 `null` 会让仲裁器继续问下一个插件而改变行为，用空会话则会凭空产生一次
 * `commit`。
 *
 * @public
 */
export type StageClaimResult = StageSession | 'consumed' | null

/**
 * 可替换的交互单元。
 *
 * @remarks
 * 插件是纯状态机：不碰 React、不碰 DOM，输入是归一化事件与 {@link StagePluginContext}，
 * 输出是预览、快照与效果。
 *
 * @public
 */
export interface StageInteractionPlugin {
  /** 注册表内唯一；重复注册会被拒绝。 */
  readonly id: string
  /**
   * 询问顺序，数值大的先被询问。
   *
   * @remarks
   * 这个数值取代了原实现中「`begin()` 里 if 分支的先后」这一隐式优先级。顺序错位会静默改变
   * 「同一次按下由谁接管」，因此新增插件时必须对照 {@link STAGE_GESTURE_PRIORITY}。
   */
  readonly priority: number
  /** 纯判定是否接管本次按下；MUST NOT 产生副作用之外的文档写入。 */
  claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult
}
