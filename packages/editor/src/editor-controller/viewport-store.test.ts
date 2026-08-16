import { describe, expect, it, vi } from 'vitest'
import { createViewportStore } from './viewport-store'
import type { StageViewport } from '@compose-ui/stage-engine'

const viewport = (x: number): StageViewport => ({ x, y: 0, zoom: 1 })

describe('ViewportStore', () => {
  it('setViewport 同步通知订阅者', () => {
    const store = createViewportStore(viewport(0))
    const listener = vi.fn()
    store.subscribe(listener)

    store.setViewport(viewport(10))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toEqual(viewport(10))
  })

  it('resetViewportDuringRender 立即改快照但不在当下通知', async () => {
    // 渲染期同步通知等于在渲染一个组件时更新另一个组件，React 会报
    // "Cannot update a component while rendering a different component"。
    const store = createViewportStore(viewport(0))
    const listener = vi.fn()
    store.subscribe(listener)

    store.resetViewportDuringRender(viewport(20))

    // 快照必须立刻可读：本轮重新渲染的订阅者靠 getSnapshot 取到新值，不依赖通知。
    expect(store.getSnapshot()).toEqual(viewport(20))
    expect(listener).not.toHaveBeenCalled()

    // 通知只是推迟，不能省略：被 memo 挡住、本轮不重渲的订阅者要靠它。
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('推迟的通知被后续真实写入取代时不重复唤醒', async () => {
    const store = createViewportStore(viewport(0))
    const listener = vi.fn()
    store.subscribe(listener)

    store.resetViewportDuringRender(viewport(20))
    // 微任务跑之前用户已经平移过：那次写入自己通知过一次。
    store.setViewport(viewport(30))
    expect(listener).toHaveBeenCalledTimes(1)

    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toEqual(viewport(30))
  })

  it('重置为相同快照不产生通知', async () => {
    const initial = viewport(5)
    const store = createViewportStore(initial)
    const listener = vi.fn()
    store.subscribe(listener)

    store.resetViewportDuringRender(initial)

    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()
  })
})
