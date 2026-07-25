import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { StageScrollAxis } from './canvas-geometry'

type StageScrollbarProps = {
  readonly axis: 'x' | 'y'
  readonly controls: string
  readonly model: StageScrollAxis
  readonly trackLength: number
  readonly onValueChange: (value: number) => void
  readonly label?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function metrics(model: StageScrollAxis, trackLength: number) {
  const safeTrack = Math.max(1, trackLength)
  const thumbLength = Math.min(
    safeTrack,
    Math.max(24, safeTrack * model.viewportSize / Math.max(model.contentSize, 1)),
  )
  const travel = Math.max(0, safeTrack - thumbLength)
  const range = Math.max(0, model.max - model.min)
  const ratio = range === 0 ? 0 : (clamp(model.value, model.min, model.max) - model.min) / range
  return { thumbLength, travel, position: travel * ratio, range }
}

/**
 * Stage 内部使用的可访问自定义滚动条。
 */
export function StageScrollbar({
  axis,
  controls,
  model,
  trackLength,
  onValueChange,
  label,
}: StageScrollbarProps) {
  const dragRef = useRef<{
    pointerId: number
    startScreen: number
    startValue: number
  } | null>(null)
  const current = metrics(model, trackLength)
  const coordinate = (event: PointerEvent<HTMLDivElement>) => axis === 'x'
    ? event.clientX
    : event.clientY

  const updateFromDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || current.travel <= 0) return
    const delta = coordinate(event) - drag.startScreen
    onValueChange(clamp(
      drag.startValue + delta / current.travel * current.range,
      model.min,
      model.max,
    ))
  }

  const onKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const small = Math.max(1, model.viewportSize / 20)
    const direction = axis === 'x'
      ? { ArrowLeft: -small, ArrowRight: small }
      : { ArrowUp: -small, ArrowDown: small }
    let next: number | null = direction[event.key as keyof typeof direction] ?? null
    if (event.key === 'PageUp') next = -model.viewportSize
    if (event.key === 'PageDown') next = model.viewportSize
    if (event.key === 'Home') onValueChange(model.min)
    else if (event.key === 'End') onValueChange(model.max)
    else if (next !== null) onValueChange(clamp(model.value + next, model.min, model.max))
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      aria-label={label ?? (axis === 'x' ? '水平画布滚动条' : '垂直画布滚动条')}
      aria-orientation={axis === 'x' ? 'horizontal' : 'vertical'}
      aria-controls={controls}
      aria-valuemax={model.max}
      aria-valuemin={model.min}
      aria-valuenow={clamp(model.value, model.min, model.max)}
      className={`compose-stage__scrollbar is-${axis}`}
      role="scrollbar"
      tabIndex={0}
      onKeyDown={onKeyboard}
      onPointerDown={(event) => {
        event.stopPropagation()
        if ((event.target as HTMLElement).dataset.thumb === 'true') return
        const rect = event.currentTarget.getBoundingClientRect()
        const local = axis === 'x' ? event.clientX - rect.left : event.clientY - rect.top
        const direction = local < current.position ? -1 : 1
        onValueChange(clamp(
          model.value + direction * model.viewportSize,
          model.min,
          model.max,
        ))
      }}
    >
      <div
        className="compose-stage__scrollbar-thumb"
        data-thumb="true"
        style={axis === 'x'
          ? { left: current.position, width: current.thumbLength }
          : { height: current.thumbLength, top: current.position }}
        onPointerDown={(event) => {
          event.stopPropagation()
          dragRef.current = {
            pointerId: event.pointerId,
            startScreen: coordinate(event),
            startValue: model.value,
          }
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerMove={(event) => {
          event.stopPropagation()
          updateFromDrag(event)
        }}
        onPointerUp={(event) => {
          event.stopPropagation()
          updateFromDrag(event)
          dragRef.current = null
          event.currentTarget.releasePointerCapture?.(event.pointerId)
        }}
        onPointerCancel={(event) => {
          event.stopPropagation()
          dragRef.current = null
        }}
      />
    </div>
  )
}
