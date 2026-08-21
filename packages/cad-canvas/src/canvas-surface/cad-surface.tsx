import { useCallback, useLayoutEffect, useRef } from 'react'
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
  readonly viewport: CadViewport
  readonly onViewportChange: (viewport: CadViewport) => void
  /** 用户在图面上取的一个点，已换算为世界坐标。 */
  readonly onPickPoint: (point: CadCanvasPoint) => void
  readonly previewSegments: readonly CadPreviewSegment[]
  readonly label: string
}

/** 每一格滚轮的缩放倍率；与 Stage 保持同一个手感。 */
const WHEEL_ZOOM_STEP = 1.1

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
  viewport,
  onViewportChange,
  onPickPoint,
  previewSegments,
  label,
}: CadSurfaceProps) {
  const surfaceRef = useRef<SVGSVGElement | null>(null)
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
