import { useRef, useState } from 'react'
import { snapComposeScreenSize } from '@compose-ui/core'
import type { ComposeScreenSizeSnapCandidate, ComposeSize } from '@compose-ui/core'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 拖动改屏幕尺寸的会话状态。 @internal */
export interface ComposeScreenResizeSession {
  /** 指针手势是否正在进行。 */
  readonly dragging: boolean
  /** 当前命中的吸附候选；未命中为 `null`，呈现层据此决定要不要画命中态。 */
  readonly snapped: ComposeScreenSizeSnapCandidate | null
}

/** {@link useComposeScreenResize} 的选项。 @internal */
export interface ComposeScreenResizeOptions {
  /** 当前屏幕尺寸。 */
  readonly screenSize: ComposeSize
  /** 预览目标自身的尺寸；吸附时它的优先级最高。 */
  readonly targetSize: ComposeSize
  /** 当前视图缩放；指针位移要除以它才是屏幕尺寸的变化量。 */
  readonly zoom: number
  /** 提交新的屏幕尺寸。 */
  readonly onChange: (size: ComposeSize) => void
}

/**
 * 拖画板的角改屏幕尺寸。
 *
 * @remarks
 * **对角锚定**：拖右下角时左上角不动，与画布上的 resize 手柄逐字相同的语义——用户已经
 * 会了。因此本 Hook 只改尺寸，取景偏移由调用方保持不变；拖动期间 **MUST NOT 重新取景**，
 * 否则画板在屏幕上纹丝不动，拖了等于没有反馈。
 *
 * 指针位移是**屏幕像素**，除以 `zoom` 才是被预览那块屏的像素——这一步漏掉的症状是
 * 「缩小之后拖一点点尺寸就狂飙」。
 *
 * @internal
 */
export function useComposeScreenResize(options: ComposeScreenResizeOptions): {
  readonly session: ComposeScreenResizeSession
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
} {
  const [session, setSession] = useState<ComposeScreenResizeSession>({
    dragging: false,
    snapped: null,
  })
  // 手势起点放 ref：它每帧都要读，但它的变化不需要触发渲染。
  const origin = useRef<{
    readonly pointerX: number
    readonly pointerY: number
    readonly size: ComposeSize
    readonly zoom: number
  } | null>(null)

  const resolve = (event: ReactPointerEvent<HTMLElement>) => {
    const start = origin.current
    if (!start) return null
    const scale = start.zoom > 0 ? start.zoom : 1
    return snapComposeScreenSize(
      {
        width: start.size.width + (event.clientX - start.pointerX) / scale,
        height: start.size.height + (event.clientY - start.pointerY) / scale,
      },
      { targetSize: options.targetSize, zoom: scale },
    )
  }

  return {
    session,
    onPointerDown: (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      origin.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        size: options.screenSize,
        zoom: options.zoom,
      }
      setSession({ dragging: true, snapped: null })
    },
    onPointerMove: (event) => {
      if (!origin.current) return
      const result = resolve(event)
      if (!result) return
      setSession({ dragging: true, snapped: result.snapped })
      options.onChange(result.size)
    },
    onPointerUp: (event) => {
      if (!origin.current) return
      const result = resolve(event)
      if (result) options.onChange(result.size)
      origin.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setSession({ dragging: false, snapped: null })
    },
  }
}
