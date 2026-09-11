import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/** 宿主盒子的布局尺寸，单位是 CSS 像素。 @internal */
export interface ComposeHostBoxSize {
  readonly width: number
  readonly height: number
}

/**
 * 量出 `fit` 需要的宿主盒子尺寸。
 *
 * @remarks
 * **用 `offsetWidth` / `offsetHeight` 而不是 `getBoundingClientRect`**：后者返回的是被
 * 祖先 `transform` 缩放之后的视觉尺寸，而预览对话框的视图缩放正是挂在祖先上的一个
 * `transform`。读 rect 会让 `fit` 把视图缩放再算一遍，症状是缩小对话框时内容缩了两次。
 *
 * 首次测量走 `useLayoutEffect`：它在绘制**之前**跑完，因此不会先画一帧未缩放的内容再跳。
 * `enabled` 为 false（`fit === 'none'`，也是默认值）时一个 observer 都不装。
 *
 * ref 由**调用方持有**并自己挂到元素上，与 `canvas-kit` 的 `useCanvasSurfaceSize` 同形：
 * 从 Hook 里返回 ref 会让它在渲染期被读到。
 *
 * @internal
 */
export function useComposeHostBoxSize(
  hostRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): ComposeHostBoxSize | null {
  const [size, setSize] = useState<ComposeHostBoxSize | null>(null)

  useLayoutEffect(() => {
    if (!enabled) return undefined
    const element = hostRef.current
    if (!element) return undefined
    const measure = () => {
      const width = element.offsetWidth
      const height = element.offsetHeight
      // 零尺寸直接返回：挂在隐藏容器里时量到 0×0，写进 state 会让下游按零除算出 Infinity，
      // 而容器再显示时未必会触发新的观测。
      if (width <= 0 || height <= 0) return
      // 同值短路：ResizeObserver 会因祖先重排而触发，尺寸往往没变；不短路就是每次重排
      // 都让整棵预览子树重渲染一次。
      setSize((previous) => (previous && previous.width === width && previous.height === height
        ? previous
        : { width, height }))
    }
    measure()
    // jsdom 与老浏览器没有 ResizeObserver；此时只保留挂载时的一次测量，不做降级轮询。
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [enabled, hostRef])

  // `enabled` 为 false 时**不清空**已量到的尺寸：下游按 `fit` 判定是否使用它
  // （`composeFitScale` 对 `none` 直接返回 null），而在 effect 里清空会引起一次级联渲染。
  return enabled ? size : null
}

/**
 * 把宿主盒子与 Frame 尺寸归约成两轴缩放比例。
 *
 * @remarks
 * `contain` 取两轴比例的较小者、`cover` 取较大者、`fill` 两轴各自缩放、`none` 不缩放。
 * 任何一边量不出来或为零时返回 `null`——宁可先不缩放，也不要除零算出 `Infinity`。
 *
 * @internal
 */
export function composeFitScale(
  fit: 'contain' | 'cover' | 'fill' | 'none',
  frameSize: ComposeHostBoxSize,
  hostSize: ComposeHostBoxSize | null,
): { readonly x: number; readonly y: number } | null {
  if (fit === 'none' || !hostSize) return null
  if (frameSize.width <= 0 || frameSize.height <= 0) return null
  if (hostSize.width <= 0 || hostSize.height <= 0) return null
  const x = hostSize.width / frameSize.width
  const y = hostSize.height / frameSize.height
  if (fit === 'fill') return { x, y }
  const uniform = fit === 'contain' ? Math.min(x, y) : Math.max(x, y)
  return { x: uniform, y: uniform }
}
