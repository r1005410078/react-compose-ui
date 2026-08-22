import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import {
  composeCanvasZoomAt,
  type ComposeCanvasViewport,
  type ComposeZoomRange,
} from '@compose-ui/core'

/** 滚轮缩放的灵敏度；指数换算保证放大与缩小对称。 */
const WHEEL_ZOOM_SENSITIVITY = 0.002

/** 滚轮导航能力的依赖清单。 @public */
export interface ComposeCanvasWheelNavigationParams {
  readonly viewport: ComposeCanvasViewport
  readonly onViewportChange: (viewport: ComposeCanvasViewport) => void
  /** 缩放的合法区间；由调用方给出，本包不写死。 */
  readonly zoomRange: ComposeZoomRange
  /** 装监听的容器；通常是画布的根元素。 */
  readonly containerRef: RefObject<HTMLElement | null>
  /** 求锚点坐标用的图面元素；同时用于判定事件是否落在画布内。 */
  readonly surfaceRef: RefObject<Element | null>
}

/**
 * 「用滚轮平移与缩放画布」这条能力。
 *
 * @remarks
 * 监听器手动装在容器上而不是走 React 的 `onWheel`：React 把 wheel 作为 **passive** listener
 * 委托，在其 SyntheticEvent 上调用 `preventDefault` 只会产生浏览器警告，拦不住页面滚动。
 * 画布需要独占滚轮，因此必须显式安装非 passive 的原生监听。
 *
 * 监听只装一次（依赖只有两个 ref），最新的视口与回调从内部 ref 读——把它们放进依赖数组会让
 * 监听在滚动过程中反复重装并丢帧。
 *
 * 缩放用指数换算：`exp(-Δ·k)` 使同样的滚动距离放大与缩小互为逆运算，线性倍率做不到这一点。
 *
 * @public
 */
export function useCanvasWheelNavigation(params: ComposeCanvasWheelNavigationParams): void {
  const { containerRef, surfaceRef } = params
  const latestRef = useRef(params)
  useLayoutEffect(() => {
    latestRef.current = params
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleWheel = (event: WheelEvent) => {
      const surface = surfaceRef.current
      if (
        !surface
        || (!surface.contains(event.target as Node) && event.target !== container)
      ) return
      const current = latestRef.current
      const rect = surface.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)
        current.onViewportChange(composeCanvasZoomAt(
          current.viewport,
          point,
          current.viewport.zoom * factor,
          current.zoomRange,
        ))
      }
      else {
        current.onViewportChange({
          ...current.viewport,
          offset: {
            x: current.viewport.offset.x - event.deltaX,
            y: current.viewport.offset.y - event.deltaY,
          },
        })
      }
      event.preventDefault()
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [containerRef, surfaceRef])
}
