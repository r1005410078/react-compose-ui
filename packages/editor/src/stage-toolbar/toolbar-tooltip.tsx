import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, PointerEvent } from 'react'

/** 提示与按钮下沿的间距（屏幕 px）。 */
const TOOLTIP_GAP = 6
/** 提示与视口边缘的最小留白（屏幕 px）。 */
const VIEWPORT_MARGIN = 6

interface ToolbarTooltipState {
  readonly key: string
  readonly label: string
  readonly hint: string | undefined
  /** 按钮水平中心的视口坐标。 */
  readonly left: number
  /** 按钮下沿加间距之后的视口坐标。 */
  readonly top: number
}

/** 挂在按钮上的提示接线。 @internal */
export interface ComposeToolbarTooltipTrigger {
  readonly 'aria-describedby': string | undefined
  readonly 'aria-label': string
  readonly onBlur: () => void
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void
  readonly onPointerDown: () => void
  readonly onPointerEnter: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerLeave: () => void
}

/** {@link useComposeToolbarTooltip} 的返回值。 @internal */
export interface ComposeToolbarTooltip {
  /** 渲染在工具栏里的提示元素；没有提示时是 null。 */
  readonly element: React.ReactNode
  /**
   * 把一个按钮接进提示。
   *
   * @param key - 按钮在工具栏里的稳定标识；决定 `aria-describedby` 挂在谁身上。
   * @param label - 按钮名称，同时作为可访问名。
   * @param hint - 快捷键或命令名；缺席时提示只显示名称。
   */
  readonly trigger: (key: string, label: string, hint?: string) => ComposeToolbarTooltipTrigger
}

/**
 * 工具栏的悬停提示。
 *
 * @remarks
 * 取代原生 `title`：后者要等约一秒才出现、样式不可控，而且**键盘聚焦时根本不出现**。在一个
 * 靠命令名驱动的工具里，提示正是用户发现 `LINE` 这类词的地方，等一秒等于没有。
 *
 * 整个工具栏**共用一个**提示元素而不是每个按钮各挂一个：同一时刻至多一个按钮被悬停或聚焦，
 * 每按钮一个只会让 DOM 里多出十几个常驻的空节点。因此 `aria-describedby` 由 `key` 决定挂在
 * 谁身上。
 *
 * 定位用 `position: fixed` 加视口坐标，而不是把按钮包进一个相对定位的容器：工具栏的样式表
 * 通篇是 `.compose-editor__toolbar-group > button` 这样的直接子代选择器，包一层会把它们全部
 * 打断；fixed 同时躲开了祖先 `overflow` 的裁剪。
 *
 * @internal
 */
export function useComposeToolbarTooltip(): ComposeToolbarTooltip {
  const id = useId()
  const [state, setState] = useState<ToolbarTooltipState | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  // 指针按下之后紧跟着的那次 focus 不该弹提示：用户已经点了，提示只会盖住刚点的东西。
  // 键盘 Tab 过来的 focus 仍然要弹——那正是原生 title 做不到的一半。
  const pressedRef = useRef(false)

  const hide = useCallback(() => setState(null), [])

  const show = useCallback((element: HTMLElement, key: string, label: string, hint?: string) => {
    const rect = element.getBoundingClientRect()
    setState({
      hint,
      key,
      label,
      left: rect.left + rect.width / 2,
      top: rect.bottom + TOOLTIP_GAP,
    })
  }, [])

  // Escape 关闭是 tooltip pattern 的一部分：提示可能盖住用户下一步要点的东西，而此刻焦点
  // 在按钮上，没有别的办法把它收走。
  useEffect(() => {
    if (!state) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hide, state])

  // 居中之后再按实测宽度往回推：工具栏最左边那个按钮的提示比按钮宽得多，居中会把它推到
  // 视口外面。直接改 style 而不是回写 state——那会多一次渲染，还要自己防住来回震荡。
  useLayoutEffect(() => {
    const node = tooltipRef.current
    if (!node) return
    node.style.transform = 'translateX(-50%)'
    const rect = node.getBoundingClientRect()
    const overflowLeft = VIEWPORT_MARGIN - rect.left
    const overflowRight = rect.right - (window.innerWidth - VIEWPORT_MARGIN)
    const shift = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0
    if (shift !== 0) node.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`
  }, [state])

  const trigger = useCallback((key: string, label: string, hint?: string) => ({
    'aria-describedby': state?.key === key ? id : undefined,
    'aria-label': label,
    onBlur: () => {
      pressedRef.current = false
      hide()
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (pressedRef.current) {
        pressedRef.current = false
        return
      }
      show(event.currentTarget, key, label, hint)
    },
    onPointerDown: () => {
      pressedRef.current = true
      hide()
    },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => show(event.currentTarget, key, label, hint),
    onPointerLeave: () => {
      pressedRef.current = false
      hide()
    },
  }), [hide, id, show, state?.key])

  return {
    element: state
      ? (
        <div
          className="compose-editor__toolbar-tooltip"
          id={id}
          ref={tooltipRef}
          role="tooltip"
          style={{ left: state.left, top: state.top }}
        >
          <span className="compose-editor__toolbar-tooltip-label">{state.label}</span>
          {state.hint ? (
            <span className="compose-editor__toolbar-tooltip-hint">{state.hint}</span>
          ) : null}
        </div>
      )
      : null,
    trigger,
  }
}
