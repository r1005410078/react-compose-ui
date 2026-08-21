import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { getCadLine, getCadPlacement, type CadDocument } from '@compose-ui/cad'
import {
  cadPanViewport,
  cadScreenToWorld,
  cadWorldToScreen,
  cadZoomViewport,
  type CadCanvasPoint,
  type CadViewport,
} from '../viewport'

/** 命令进行中的未提交线段。 @internal */
export interface CadPreviewSegment {
  readonly start: CadCanvasPoint
  readonly end: CadCanvasPoint
}

/** CAD SVG 图面的属性。 @internal */
export interface CadSurfaceProps {
  readonly document: CadDocument
  /** 网格步长（世界单位）；`null` 表示不画网格。 */
  readonly gridStep: number | null
  readonly viewport: CadViewport
  readonly onViewportChange: (viewport: CadViewport) => void
  /** 用户在图面上取的一个点，已换算为世界坐标。 */
  readonly onPickPoint: (point: CadCanvasPoint) => void
  readonly previewSegments: readonly CadPreviewSegment[]
  readonly label: string
}

/** 每一格滚轮的缩放倍率；与 Stage 保持同一个手感。 */
const WHEEL_ZOOM_STEP = 1.1

/** 网格线的最小屏幕间距；低于它就不画，否则缩小视图时网格糊成一片。 */
const MIN_GRID_SPACING = 8

/**
 * 求解当前视口内要画的网格线。
 *
 * @remarks
 * 按**屏幕间距**而不是缩放比例决定画不画：同一个 zoom 下，步长 1 与步长 100 的疏密差两个
 * 数量级，用 zoom 做门槛会在其中一边失效。
 */
function gridLines(
  step: number | null,
  viewport: CadViewport,
  size: { readonly width: number; readonly height: number },
) {
  if (step === null || !(step > 0)) return []
  const spacing = step * viewport.zoom
  if (spacing < MIN_GRID_SPACING) return []
  const { width, height } = size
  const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = []
  const firstX = Math.ceil((0 - viewport.offset.x) / spacing) * spacing + viewport.offset.x
  for (let x = firstX; x <= width; x += spacing) {
    lines.push({ key: `v${x}`, x1: x, y1: 0, x2: x, y2: height })
  }
  const firstY = Math.ceil((0 - viewport.offset.y) / spacing) * spacing + viewport.offset.y
  for (let y = firstY; y <= height; y += spacing) {
    lines.push({ key: `h${y}`, x1: 0, y1: y, x2: width, y2: y })
  }
  return lines
}

/**
 * 渲染 CAD 图面并把指针输入归一化为世界坐标。
 *
 * @remarks
 * 图元颜色来自**所属图层**而不是图元自身（DXF 的 ByLayer）；找不到图层的图元不渲染——它已被
 * 文档校验拦下，能出现在这里只可能是外部写入，静默跳过好过画出一条无归属的线。
 *
 * 滚轮监听手动挂在原生元素上：React 的合成 wheel 是 passive 委托，`preventDefault` 拦不住
 * 页面滚动。
 *
 * @internal
 */
export function CadSurface({
  document,
  gridStep,
  viewport,
  onViewportChange,
  onPickPoint,
  previewSegments,
  label,
}: CadSurfaceProps) {
  const surfaceRef = useRef<SVGSVGElement | null>(null)
  // 尺寸进 state 而不是渲染期读 ref：首帧还没有元素，且窗口或面板改变大小时网格必须重画。
  const [size, setSize] = useState({ width: 0, height: 0 })
  const panRef = useRef<{ pointerId: number; last: CadCanvasPoint } | null>(null)
  // 事件处理器从 ref 读取最新值：滚轮监听只注册一次，把 viewport 放进依赖会让它每帧重挂。
  const latest = useRef({ viewport, onViewportChange })
  useLayoutEffect(() => {
    latest.current = { viewport, onViewportChange }
  })

  const localPoint = useCallback((event: { clientX: number; clientY: number }): CadCanvasPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }, [])

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) setSize({ width: box.width, height: box.height })
    })
    observer.observe(surface)
    return () => { observer.disconnect() }
  }, [])

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = surface.getBoundingClientRect()
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP
      latest.current.onViewportChange(cadZoomViewport(latest.current.viewport, factor, anchor))
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => { surface.removeEventListener('wheel', onWheel) }
  }, [])

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    // 中键平移；左键取点。右键留给后续的上下文菜单，这里不接管。
    if (event.button === 1) {
      event.preventDefault()
      panRef.current = { pointerId: event.pointerId, last: localPoint(event) }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    onPickPoint(cadScreenToWorld(latest.current.viewport, localPoint(event)))
  }, [localPoint, onPickPoint])

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const point = localPoint(event)
    latest.current.onViewportChange(cadPanViewport(latest.current.viewport, {
      x: point.x - pan.last.x,
      y: point.y - pan.last.y,
    }))
    panRef.current = { pointerId: pan.pointerId, last: point }
  }, [localPoint])

  const endPan = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const layerColors = new Map(document.layers.map((layer) => [layer.id, layer]))
  const grid = gridLines(gridStep, viewport, size)

  return (
    <svg
      ref={surfaceRef}
      aria-label={label}
      className="compose-cad-canvas__surface"
      data-testid="cad-surface"
      role="img"
      onLostPointerCapture={endPan}
      onPointerCancel={endPan}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
    >
      {grid.map(({ key, x1, y1, x2, y2 }) => (
        <line
          key={key}
          className="compose-cad-canvas__grid-line"
          x1={x1}
          x2={x2}
          y1={y1}
          y2={y2}
        />
      ))}
      {document.rootIds.map((id) => {
        const entity = document.entities[id]
        const line = entity ? getCadLine(entity) : undefined
        const layer = entity ? layerColors.get(getCadPlacement(entity)?.layerId ?? '') : undefined
        if (!line || !layer || !layer.visible) return null
        const start = cadWorldToScreen(viewport, line.start)
        const end = cadWorldToScreen(viewport, line.end)
        return (
          <line
            key={id}
            data-cad-entity={id}
            stroke={layer.color}
            strokeWidth={1}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        )
      })}
      {previewSegments.map((segment, index) => {
        const start = cadWorldToScreen(viewport, segment.start)
        const end = cadWorldToScreen(viewport, segment.end)
        return (
          <line
            key={`preview-${index}`}
            data-cad-preview=""
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeWidth={1}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        )
      })}
    </svg>
  )
}
