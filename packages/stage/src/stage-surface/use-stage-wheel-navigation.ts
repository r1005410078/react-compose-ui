import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { zoomViewportAt, type StageViewport } from '@compose-ui/stage-engine'
import { screenPoint } from './pointer-session'

/** 滚轮缩放的灵敏度；指数换算保证放大与缩小对称。 */
const WHEEL_ZOOM_SENSITIVITY = 0.002

/** 滚轮导航能力的依赖清单。 */
export interface StageWheelNavigationParams {
  readonly viewport: StageViewport
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly rootRef: RefObject<HTMLDivElement | null>
  readonly surfaceRef: RefObject<HTMLDivElement | null>
}

/**
 * 「用滚轮平移与缩放画布」这条能力。
 *
 * @remarks
 * 监听器手动装在根元素上而不是走 React 的 `onWheel`：React 把 wheel 作为 passive listener
 * 委托，在其 SyntheticEvent 上调用 `preventDefault` 只会产生浏览器警告，拦不住页面滚动。
 * Stage 需要独占画布平移，因此必须显式安装非 passive 的原生监听。
 *
 * 监听只装一次（依赖为空），最新的视口从内部 ref 读——重装监听会在滚动过程中丢帧。
 */
export function useStageWheelNavigation(params: StageWheelNavigationParams): void {
  const { rootRef, surfaceRef } = params
  const latestRef = useRef(params)
  useLayoutEffect(() => {
    latestRef.current = params
  })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const handleWheel = (event: WheelEvent) => {
      const surface = surfaceRef.current
      if (
        !surface
        || (!surface.contains(event.target as Node) && event.target !== root)
      ) return
      const current = latestRef.current
      const point = screenPoint(event, surface)
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)
        current.onViewportChange(zoomViewportAt(
          current.viewport,
          point,
          current.viewport.zoom * factor,
        ))
      }
      else {
        current.onViewportChange({
          ...current.viewport,
          x: current.viewport.x - event.deltaX,
          y: current.viewport.y - event.deltaY,
        })
      }
      event.preventDefault()
    }
    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => root.removeEventListener('wheel', handleWheel)
  }, [rootRef, surfaceRef])
}
