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
  /**
   * 宿主先手：返回真表示本次滚轮已被消费，本 Hook 不再平移或缩放。
   *
   * @remarks
   * 谓词由宿主注入而本包不自己判断：判据要读宿主那边的状态（哪条命令在跑、这一步接受什么），
   * 而本包不认识文档、选择集或命令。这与绘图上下文注入 `isGeometryEditable` 是同一条边界
   * ——想在这里判断就得先加一条依赖，而那条依赖会被本包的边界用例挡下。
   *
   * 被消费时**仍然 `preventDefault`**：宿主页面照样不该滚动，让路的只是视口。
   *
   * @defaultValue 缺席即从不消费，行为与引入本参数之前完全一致
   */
  readonly interceptWheel?: (event: WheelEvent) => boolean
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
 * `interceptWheel` 让宿主先手：命令进行中的修饰键滚轮要改的是命令的参数而不是视口。判据住在
 * 宿主那边，本包只提供让路这一个动作。
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
      // 宿主先手排在读取几何之前：被消费时不需要锚点，也不该改动视口。
      if (current.interceptWheel?.(event) === true) {
        event.preventDefault()
        return
      }
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
