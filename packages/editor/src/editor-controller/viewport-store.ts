import type { Dispatch, SetStateAction } from 'react'
import type { StageViewport } from '@compose-ui/stage-engine'

/**
 * 视口会话状态源。
 *
 * @remarks
 * 视口不进入 ComposeDocument、History 或 Operation Log，因此它的归属可以脱离 controller 的
 * 渲染态。做成外部状态源之后，平移帧只唤醒订阅了视口的组件，而不是整棵工作区树。
 *
 * @internal
 */
export interface ViewportStore {
  /** 读取当前视口快照。 */
  getSnapshot: () => StageViewport
  /** 订阅视口变化，返回取消订阅函数。 */
  subscribe: (listener: () => void) => () => void
  /**
   * 替换视口；与当前快照相同的对象不会触发通知。
   *
   * @remarks
   * 同时接受 updater，保持与 React state setter 相同的调用方式：工具栏的相对缩放需要读取
   * 当前视口，不应为此额外订阅一次。
   */
  setViewport: Dispatch<SetStateAction<StageViewport>>
  /**
   * 渲染期安全地重置视口：立即写快照，但把通知推迟到当前渲染之后。
   *
   * @remarks
   * 换 runtime 时 controller 需要在渲染期就把视口复位，否则会先用上一页的视口渲染一帧。
   * 但渲染期同步通知订阅者，等于在渲染一个组件的过程中更新另一个组件，React 会报
   * "Cannot update a component while rendering a different component"。
   *
   * 快照立即生效即可满足绝大多数订阅者：它们都在这一轮重新渲染，而 `useSyncExternalStore`
   * 每次渲染都会重读 `getSnapshot`。推迟的通知只为覆盖被 memo 挡住、本轮不重渲的订阅者，
   * 因此不能省略，也不能提前。
   *
   * 只用于渲染期复位；事件回调里的平移与缩放必须走 `setViewport`，那里需要同步通知。
   */
  resetViewportDuringRender: (viewport: StageViewport) => void
}

/**
 * 创建一个视口会话状态源。
 *
 * @param initial - 初始视口。
 * @returns 可供 `useSyncExternalStore` 消费的状态源。
 * @internal
 */
export function createViewportStore(initial: StageViewport): ViewportStore {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setViewport(viewport) {
      const next = typeof viewport === 'function' ? viewport(snapshot) : viewport
      if (Object.is(next, snapshot)) return
      snapshot = next
      listeners.forEach((listener) => listener())
    },
    resetViewportDuringRender(viewport) {
      if (Object.is(viewport, snapshot)) return
      snapshot = viewport
      // 通知延后一个微任务：此刻仍在渲染中，同步通知会触发跨组件的渲染期更新。
      queueMicrotask(() => {
        // 期间可能已被真实交互改写；那次写入自己通知过，这里不再重复唤醒订阅者。
        if (!Object.is(viewport, snapshot)) return
        listeners.forEach((listener) => listener())
      })
    },
  }
}
