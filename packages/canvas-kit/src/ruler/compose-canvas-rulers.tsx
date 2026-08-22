import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ComposeCanvasRect, ComposeRulerTick } from '@compose-ui/core'
import {
  paintRuler,
  type ComposeRulerPaintInput,
  type ComposeRulerPalette,
} from './ruler-painter'

function formatDimension(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

const PALETTE_PROPERTIES: Readonly<Record<keyof ComposeRulerPalette, string>> = {
  tick: '--compose-canvas-ruler-tick',
  tickMajor: '--compose-canvas-ruler-tick-major',
  label: '--compose-canvas-ruler-label',
  selection: '--compose-canvas-ruler-selection',
  selectionLabel: '--compose-canvas-ruler-selection-label',
  selectionShadow: '--compose-canvas-ruler-selection-shadow',
  cursor: '--compose-canvas-ruler-cursor',
}

/*
 * Canvas 无法套用 CSS class，颜色改从容器的自定义属性读取，主题切换与浅色覆盖仍然只在
 * styles.css 里定义。读取会触发样式计算，因此只在主题变化时取一次并缓存。
 */
function readPalette(element: HTMLElement): ComposeRulerPalette {
  const computed = getComputedStyle(element)
  const entries = Object.entries(PALETTE_PROPERTIES).map(([key, property]) => [
    key,
    computed.getPropertyValue(property).trim(),
  ])
  return Object.fromEntries(entries) as unknown as ComposeRulerPalette
}

/** 单条标尺画布；沿轴的指针位置由命令式接口更新，避免 pointermove 触发 React 重渲染。 */
interface RulerCanvasHandle {
  setCursor: (position: number | null) => void
}

interface RulerCanvasProps {
  readonly axis: 'x' | 'y'
  readonly ticks: readonly ComposeRulerTick[]
  readonly selection: ComposeRulerPaintInput['selection']
  readonly themeKey: string | undefined
}

const RulerCanvas = forwardRef<RulerCanvasHandle, RulerCanvasProps>(function RulerCanvas(
  { axis, ticks, selection, themeKey },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<number | null>(null)
  const paletteRef = useRef<ComposeRulerPalette | null>(null)
  const frameRef = useRef<number | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const draw = useCallback(() => {
    frameRef.current = null
    const canvas = canvasRef.current
    if (!canvas || size.width <= 0 || size.height <= 0) return
    const context = canvas.getContext('2d')
    if (!context) return
    const dpr = globalThis.devicePixelRatio || 1
    const backingWidth = Math.round(size.width * dpr)
    const backingHeight = Math.round(size.height * dpr)
    if (canvas.width !== backingWidth) canvas.width = backingWidth
    if (canvas.height !== backingHeight) canvas.height = backingHeight
    paletteRef.current ??= readPalette(canvas)
    paintRuler(context, {
      axis,
      ticks,
      size,
      devicePixelRatio: dpr,
      palette: paletteRef.current,
      selection,
      cursor: cursorRef.current,
    })
  }, [axis, selection, size, ticks])

  // 平移与缩放会在同一帧内多次触发绘制请求，合并到一次 rAF 才不会比原来的 SVG 更差。
  const schedule = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(draw)
  }, [draw])

  useImperativeHandle(ref, () => ({
    setCursor: (position) => {
      if (cursorRef.current === position) return
      cursorRef.current = position
      schedule()
    },
  }), [schedule])

  useEffect(() => {
    paletteRef.current = null
    schedule()
  }, [schedule, themeKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    // 先按当前布局取一次尺寸：没有 ResizeObserver 的环境（jsdom）也能得到确定的绘制输入。
    setSize((current) => (
      current.width === parent.clientWidth && current.height === parent.clientHeight
        ? current
        : { width: parent.clientWidth, height: parent.clientHeight }
    ))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect
      if (!rect) return
      setSize((current) => (
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height }
      ))
    })
    observer.observe(parent)
    return () => { observer.disconnect() }
  }, [])

  useEffect(() => {
    schedule()
    return () => {
      if (frameRef.current === null) return
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [schedule])

  return <canvas aria-hidden="true" className="compose-canvas__ruler-canvas" ref={canvasRef} />
})

/** 命令式更新指针游标的句柄。 */
export interface ComposeCanvasRulersHandle {
  /** 传入 surface 坐标系中的指针位置；离开画布时传 `null`。 */
  setCursor: (point: { readonly x: number; readonly y: number } | null) => void
}

export interface ComposeCanvasRulersProps {
  readonly bounds: ComposeCanvasRect | null
  readonly screenBounds: ComposeCanvasRect | null
  readonly horizontalTicks: readonly ComposeRulerTick[]
  readonly verticalTicks: readonly ComposeRulerTick[]
  readonly themeKey: string | undefined
  readonly labels: {
    readonly origin: string
    readonly horizontal: string
    readonly vertical: string
  }
  /**
   * `data-testid` 的前缀，各画布自取。
   *
   * @remarks
   * 由调用方给出而不是本包写死：测试 id 属于消费它的那块画布，写死会让共享组件带上某一个
   * 画布的命名。
   */
  readonly testIdPrefix: string
  readonly onCornerPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onHorizontalPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onVerticalPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * 固定于视口边缘的标尺。
 *
 * @remarks
 * 完全受控：刻度、选择区间与交互回调全部由调用方给出。本组件不求解刻度，也不因标尺上的按下
 * 产生辅助线、选择或任何文档变更——那些属于消费它的那块画布。
 *
 * 摆放位置由调用方的样式表决定，本包只提供画布元素自身的样式。
 *
 * @public
 */
export const ComposeCanvasRulers = forwardRef<ComposeCanvasRulersHandle, ComposeCanvasRulersProps>(function ComposeCanvasRulers({
  bounds,
  screenBounds,
  horizontalTicks,
  verticalTicks,
  themeKey,
  labels,
  testIdPrefix,
  onCornerPointerDown,
  onHorizontalPointerDown,
  onVerticalPointerDown,
}, ref) {
  const horizontalRef = useRef<RulerCanvasHandle>(null)
  const verticalRef = useRef<RulerCanvasHandle>(null)

  useImperativeHandle(ref, () => ({
    setCursor: (point) => {
      horizontalRef.current?.setCursor(point ? point.x : null)
      verticalRef.current?.setCursor(point ? point.y : null)
    },
  }), [])

  const horizontalSelection = screenBounds && bounds
    ? {
      start: screenBounds.x,
      end: screenBounds.x + screenBounds.width,
      label: formatDimension(bounds.width),
    }
    : null
  const verticalSelection = screenBounds && bounds
    ? {
      start: screenBounds.y,
      end: screenBounds.y + screenBounds.height,
      label: formatDimension(bounds.height),
    }
    : null

  return (
    <>
      <div
        aria-label={labels.origin}
        className="compose-canvas__ruler-corner"
        data-testid={`${testIdPrefix}-corner`}
        role="img"
        onPointerDown={onCornerPointerDown}
      >
        <span aria-hidden="true">＋</span>
      </div>
      <div
        aria-label={labels.horizontal}
        className="compose-canvas__ruler is-horizontal"
        data-testid={`${testIdPrefix}-x`}
        role="group"
        onPointerDown={onHorizontalPointerDown}
      >
        <RulerCanvas
          axis="x"
          ref={horizontalRef}
          selection={horizontalSelection}
          themeKey={themeKey}
          ticks={horizontalTicks}
        />
      </div>
      <div
        aria-label={labels.vertical}
        className="compose-canvas__ruler is-vertical"
        data-testid={`${testIdPrefix}-y`}
        role="group"
        onPointerDown={onVerticalPointerDown}
      >
        <RulerCanvas
          axis="y"
          ref={verticalRef}
          selection={verticalSelection}
          themeKey={themeKey}
          ticks={verticalTicks}
        />
      </div>
    </>
  )
})
