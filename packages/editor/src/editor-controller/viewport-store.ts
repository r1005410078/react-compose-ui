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
  }
}
