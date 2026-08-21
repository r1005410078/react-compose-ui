import type {
  StageInteractionContext,
  StageInteractionEvent,
} from '../interaction-controller'
import type { StageSceneIndex } from '../scene-index'
import type { StagePluginRegistry } from './plugin-registry'
import type {
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** `begin` 的结果，供内核决定是否继续走自己的兜底路径。 @public */
export type StageArbiterBeginResult = 'claimed' | 'consumed' | 'declined'

/**
 * 同一时刻至多一个交互会话的仲裁器。
 *
 * @public
 */
export interface StageSessionArbiter {
  /** 当前是否有活动会话。 */
  hasSession(): boolean
  /** 活动会话绑定的指针；无会话时为 null。 */
  activePointerId(): number | null
  /**
   * 活动会话是否把临时平移键重新解释为自己的修饰键。
   *
   * @remarks
   * 见 {@link StageSession.consumesTemporaryPan}。无会话时为 `false`。
   */
  activeSessionConsumesTemporaryPan(): boolean
  /**
   * 创建了活动会话的插件 id；无会话时为 null。
   *
   * @remarks
   * 内核处理非指针事件时据此区分会话种类（例如松开临时平移键只应结束平移会话）。
   * 暴露的是**谁创建了会话**这一内核已知的事实，而不是让会话自报手势类型——后者会把手势
   * 分类重新塞回内核，正是插件化要消除的耦合。
   */
  activePluginId(): string | null
  /**
   * 按优先级询问插件。
   *
   * @remarks
   * 已有活动会话时直接返回 `declined`：一次手势进行中不接受第二次接管。
   */
  begin(event: StagePointerDownEvent, ctx: StagePluginContext): StageArbiterBeginResult
  /** 把事件转给活动会话；无会话或指针不匹配时忽略。 */
  update(event: StageInteractionEvent, ctx: StagePluginContext): void
  /**
   * 结束并提交活动会话。
   *
   * @remarks
   * MUST 先以本事件调用一次 `session.update`，再调用 `session.commit`：提交用的几何是
   * 「最终点推进之后」的状态，而不是最后一帧 move 留下的状态。这条约束放在仲裁器里而不是
   * 交给各插件自觉，否则漏掉的表现是「松手位置与落点差最后一帧」这类极难定位的偏移。
   */
  commit(event: StageInteractionEvent, ctx: StagePluginContext): void
  /**
   * 取消活动会话。
   *
   * @param pointerId - 省略表示取消任意会话；给出时只取消匹配的会话。
   */
  cancel(ctx: StagePluginContext, pointerId?: number): void
  /**
   * 让活动会话按新上下文自检；不成立时取消它。
   *
   * @remarks
   * 会话未实现 `isCompatibleWith` 时视为始终成立。无会话时是空操作。
   *
   * @returns 是否因不兼容而取消了会话。
   */
  revalidate(
    next: StageInteractionContext,
    nextIndex: StageSceneIndex,
    ctx: StagePluginContext,
  ): boolean
  /**
   * 丢弃对活动会话的引用，且**不**调用它的 `cancel`。
   *
   * @remarks
   * 用于会话已经通过其他路径自行拆除的情况——例如并发文档变化中止手势、surface 断开、
   * controller dispose。这些路径不属于指针生命周期，却必须让仲裁器与底层实现的状态保持一致，
   * 否则仲裁器会认为手势仍在进行而拒绝下一次接管。
   *
   * 幂等：无会话时是空操作。
   */
  release(): void
}

/**
 * 建立会话仲裁器。
 *
 * @public
 */
export function createStageSessionArbiter(
  registry: StagePluginRegistry,
): StageSessionArbiter {
  let session: StageSession | null = null
  let ownerId: string | null = null

  const matches = (pointerId: number | undefined) =>
    session !== null && (pointerId === undefined || session.pointerId === pointerId)

  return {
    hasSession: () => session !== null,
    activePointerId: () => session?.pointerId ?? null,
    activePluginId: () => ownerId,
    activeSessionConsumesTemporaryPan: () => session?.consumesTemporaryPan === true,
    begin(event, ctx) {
      if (session) return 'declined'
      for (const plugin of registry.ordered()) {
        const claimed = plugin.claim(event, ctx)
        if (claimed === null) continue
        // 已消费：本次按下被处理掉但不开会话，且必须阻止其余插件再判定。
        if (claimed === 'consumed') return 'consumed'
        session = claimed
        ownerId = plugin.id
        return 'claimed'
      }
      return 'declined'
    },
    update(event, ctx) {
      if (!session) return
      // 非指针事件（temporary-pan 等）没有 pointerId，一律转发给活动会话。
      const pointerId = 'pointerId' in event ? event.pointerId : undefined
      if (!matches(pointerId)) return
      session.update(event, ctx)
    },
    commit(event, ctx) {
      if (!session) return
      const pointerId = 'pointerId' in event ? event.pointerId : undefined
      if (!matches(pointerId)) return
      const finished = session
      // 先清空再回调：commit 内部若触发重入（宿主同步回灌 context），看到的是「无会话」，
      // 不会把同一个会话提交两次。
      session = null
      ownerId = null
      finished.update(event, ctx)
      finished.commit(ctx)
    },
    cancel(ctx, pointerId) {
      if (!matches(pointerId)) return
      const finished = session!
      session = null
      ownerId = null
      finished.cancel(ctx)
    },
    revalidate(next, nextIndex, ctx) {
      if (!session?.isCompatibleWith) return false
      if (session.isCompatibleWith(next, nextIndex)) return false
      const finished = session
      session = null
      ownerId = null
      finished.cancel(ctx)
      return true
    },
    release() {
      session = null
      ownerId = null
    },
  }
}
