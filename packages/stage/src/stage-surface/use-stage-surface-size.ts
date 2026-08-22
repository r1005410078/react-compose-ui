import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** Surface 尺寸；单位是 CSS 像素。 */
export interface StageSurfaceSize {
  readonly width: number
  readonly height: number
}

/**
 * 首帧回退尺寸。
 *
 * @remarks
 * surface 挂载前没有可测的矩形，但视口换算、标尺刻度与滚动范围都要在首帧就有值。取一个
 * 常见画布尺寸而不是 0：零尺寸会让缩放换算除零，也会让首帧的滚动范围退化成一个点。
 */
const FALLBACK_SURFACE_SIZE: StageSurfaceSize = { width: 900, height: 600 }

/**
 * 观测结果：尺寸，以及是否已经量到过真实尺寸。
 *
 * @remarks
 * `measured` 单独给出而不是让调用方拿 `size` 与回退值比较：回退尺寸恰好等于真实尺寸时那种
 * 比较会给出错误答案，而首次视口适配必须等到真的量过——按 900×600 算出来的缩放与可视区域
 * 无关，用户会看到画面先跳一次再定住。
 */
export interface StageSurfaceMeasurement {
  readonly size: StageSurfaceSize
  readonly measured: boolean
}

/**
 * 观测 Scene surface 的尺寸。
 *
 * @remarks
 * 两处判定不是样板，删掉都会出问题：
 *
 * - **零尺寸直接返回**——挂在隐藏容器里时 `getBoundingClientRect` 给出 0×0，写进 state 会把
 *   回退尺寸覆盖成零，之后所有除以尺寸的换算全部失效，而容器再显示时未必会触发新的观测。
 * - **同值短路**——`ResizeObserver` 会因祖先重排而触发，尺寸往往没变；不短路就是每次重排
 *   都让整棵 Scene 重渲染一次。
 *
 * @param onChange - 宿主侧的尺寸通知；**只在实测到新尺寸时调用**，与内部 state 是否更新无关。
 */
export function useStageSurfaceSize(
  surfaceRef: RefObject<HTMLDivElement | null>,
  onChange?: (size: StageSurfaceSize) => void,
): StageSurfaceMeasurement {
  const [surfaceSize, setSurfaceSize] = useState<StageSurfaceSize>(FALLBACK_SURFACE_SIZE)
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const measure = () => {
      const rect = surface.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const next = { width: rect.width, height: rect.height }
      setSurfaceSize((current) => current.width === next.width && current.height === next.height
        ? current
        : next)
      setMeasured(true)
      onChange?.(next)
    }
    measure()
    // jsdom 与老浏览器没有 ResizeObserver；此时只保留挂载时的一次测量，不做降级轮询。
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(surface)
    return () => observer.disconnect()
  }, [onChange, surfaceRef])

  return { size: surfaceSize, measured }
}
