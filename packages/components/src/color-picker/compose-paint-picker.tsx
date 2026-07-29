import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent, ReactNode } from 'react'
import {
  evaluateComposePaintAtLocalPoint,
  type ComposeColor,
  type ComposeGradientStop,
  type ComposePaint,
} from '@compose-ui/core'
import { cn } from '#lib/utils'
import { ComposeColorPicker } from './compose-color-picker'

type GradientKind = Exclude<ComposePaint['kind'], 'solid'>

function messages(locale: string | undefined) {
  const zh = locale !== 'en-US'
  return {
    angular: zh ? '角向' : 'Angular',
    angle: zh ? '角度' : 'Angle',
    deleteStop: zh ? '删除色标' : 'Delete stop',
    dialog: zh ? '背景填充' : 'Background fill',
    exact: zh ? '精确' : 'Exact',
    linear: zh ? '线性' : 'Linear',
    position: zh ? '色标位置' : 'Stop position',
    radial: zh ? '径向' : 'Radial',
    solid: zh ? '纯色' : 'Solid',
    track: zh ? '渐变色标轨道' : 'Gradient stop track',
  }
}

function paintStyle(paint: ComposePaint): CSSProperties {
  if (paint.kind === 'solid') return { background: paint.color }
  const stops = paint.stops.map((stop) => `${stop.color} ${stop.position * 100}%`).join(', ')
  if (paint.kind === 'linear-gradient') {
    const angle = Math.atan2(paint.end.y - paint.start.y, paint.end.x - paint.start.x) * 180 / Math.PI + 90
    return { background: `linear-gradient(${angle}deg, ${stops})` }
  }
  if (paint.kind === 'radial-gradient') return { background: `radial-gradient(ellipse at ${paint.center.x * 100}% ${paint.center.y * 100}%, ${stops})` }
  return { background: `conic-gradient(from ${paint.angle}deg at ${paint.center.x * 100}% ${paint.center.y * 100}%, ${stops})` }
}

function defaultGradient(kind: GradientKind, color: ComposeColor): ComposePaint {
  const stops: readonly ComposeGradientStop[] = [
    { id: 'paint-stop-start', position: 0, color },
    { id: 'paint-stop-end', position: 1, color: 'transparent' },
  ]
  if (kind === 'linear-gradient') return { kind, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops }
  if (kind === 'radial-gradient') return { kind, center: { x: 0.5, y: 0.5 }, radiusX: 0.5, radiusY: 0.5, stops }
  return { kind, center: { x: 0.5, y: 0.5 }, angle: 0, stops }
}

function gradientWithKind(kind: GradientKind, stops: readonly ComposeGradientStop[]): ComposePaint {
  if (kind === 'linear-gradient') return { kind, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops }
  if (kind === 'radial-gradient') return { kind, center: { x: 0.5, y: 0.5 }, radiusX: 0.5, radiusY: 0.5, stops }
  return { kind, center: { x: 0.5, y: 0.5 }, angle: 0, stops }
}

function pointAtStop(paint: Exclude<ComposePaint, { readonly kind: 'solid' }>, position: number) {
  if (paint.kind === 'linear-gradient') {
    return { x: paint.start.x + (paint.end.x - paint.start.x) * position, y: paint.start.y + (paint.end.y - paint.start.y) * position }
  }
  if (paint.kind === 'radial-gradient') return { x: paint.center.x + paint.radiusX * position, y: paint.center.y }
  const radians = (paint.angle + position * 360) * Math.PI / 180
  return { x: paint.center.x + Math.cos(radians), y: paint.center.y + Math.sin(radians) }
}

function ordered(stops: readonly ComposeGradientStop[]) {
  return [...stops].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
}

/**
 * 角度控制始终围绕原有线性渐变的中点旋转，因此在 Inspector 输入角度不会意外平移渐变。
 */
function linearPaintWithAngle(
  paint: Extract<ComposePaint, { readonly kind: 'linear-gradient' }>,
  angle: number,
): ComposePaint {
  const center = {
    x: (paint.start.x + paint.end.x) / 2,
    y: (paint.start.y + paint.end.y) / 2,
  }
  const length = Math.max(0.000_001, Math.hypot(paint.end.x - paint.start.x, paint.end.y - paint.start.y))
  const radians = angle * Math.PI / 180
  const delta = { x: Math.cos(radians) * length / 2, y: Math.sin(radians) * length / 2 }
  return {
    ...paint,
    start: { x: center.x - delta.x, y: center.y - delta.y },
    end: { x: center.x + delta.x, y: center.y + delta.y },
  }
}

function composeAngle(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function PaintPopover({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  const theme = useComposeThemeContext()
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align="end" className="cu:isolate cu:z-[20000]" collisionPadding={8} side="bottom" sideOffset={4}>
        <PopoverPrimitive.Popup aria-label={label} className={cn('cu:w-[min(400px,calc(100vw-24px))] cu:rounded-lg cu:border cu:border-border cu:bg-popover cu:p-3 cu:shadow-xl cu:outline-none')} data-compose-theme={theme?.resolvedTheme} data-compose-ui="paint-picker" role="dialog" style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}>
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

/** ComposePaintPicker 的受控属性。 @public */
export interface ComposePaintPickerProps {
  /** 当前结构化背景 Paint。 */
  readonly value: ComposePaint
  /** 每一次有效编辑提交新的结构化 Paint。 */
  readonly onValueChange?: (paint: ComposePaint) => void
  /** 触发器的可访问名称。 */
  readonly label?: string
  /** 禁用交互。 */
  readonly disabled?: boolean
  /** 以不可编辑状态展示。 */
  readonly readOnly?: boolean
  /** 原生吸管不可用时把当前 stop 切到 Stage 图层采样。 */
  readonly onEyedropperFallback?: () => void
  /** Popover 可见性变化；Editor 用它控制画布 Paint edit session。 */
  readonly onOpenChange?: (open: boolean) => void
}

/**
 * 背景填充选择器：选择 Fill 类型、编辑渐变色标，并复用纯色 Picker 的 Alpha/历史/吸管能力。
 *
 * @public
 */
export function ComposePaintPicker({
  disabled = false,
  label,
  onEyedropperFallback,
  onOpenChange,
  onValueChange,
  readOnly = false,
  value,
}: ComposePaintPickerProps) {
  const text = messages(useComposeI18nContext()?.locale)
  const [open, setOpen] = useState(false)
  const [selectedStopId, setSelectedStopId] = useState<string | null>(value.kind === 'solid' ? null : value.stops[0]?.id ?? null)
  const nextStop = useRef(0)
  const locked = disabled || readOnly
  const selectedStop = value.kind === 'solid'
    ? null
    : value.stops.find((stop) => stop.id === selectedStopId) ?? value.stops[0]!
  const activeColor = value.kind === 'solid' ? value.color : selectedStop?.color ?? value.stops[0]!.color
  const emit = (paint: ComposePaint) => {
    if (!locked) onValueChange?.(paint)
  }
  const selectKind = (kind: ComposePaint['kind']) => {
    if (kind === value.kind) return
    if (kind === 'solid') {
      emit({ kind: 'solid', color: activeColor })
      setSelectedStopId(null)
      return
    }
    const next: ComposePaint = value.kind === 'solid'
      ? defaultGradient(kind, value.color)
      : gradientWithKind(kind, value.stops)
    setSelectedStopId(value.kind === 'solid' ? 'paint-stop-start' : value.stops[0]?.id ?? null)
    emit(next)
  }
  const updateCurrentStop = (color: ComposeColor) => {
    if (value.kind === 'solid') emit({ kind: 'solid', color })
    else emit({ ...value, stops: value.stops.map((stop) => stop.id === selectedStop?.id ? { ...stop, color } : stop) })
  }
  const updateStopPosition = (id: string, position: number) => {
    if (value.kind === 'solid') return
    emit({ ...value, stops: ordered(value.stops.map((stop) => stop.id === id ? { ...stop, position: Math.min(1, Math.max(0, position)) } : stop)) })
  }
  const updateAngle = (angle: number) => {
    if (!Number.isFinite(angle)) return
    if (value.kind === 'linear-gradient') emit(linearPaintWithAngle(value, composeAngle(angle)))
    if (value.kind === 'angular-gradient') emit({ ...value, angle: composeAngle(angle) })
  }
  const addStopAt = (event: PointerEvent<HTMLDivElement>) => {
    if (value.kind === 'solid' || value.stops.length >= 8) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const id = `paint-stop-${nextStop.current++}`
    const color = evaluateComposePaintAtLocalPoint(value, pointAtStop(value, position))
    setSelectedStopId(id)
    emit({ ...value, stops: ordered([...value.stops, { id, position, color }]) })
  }
  const onTrackKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (value.kind === 'solid' || !selectedStop) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (value.stops.length <= 2) return
      event.preventDefault()
      const remaining = value.stops.filter((stop) => stop.id !== selectedStop.id)
      setSelectedStopId(remaining[0]?.id ?? null)
      emit({ ...value, stops: remaining })
      return
    }
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    updateStopPosition(selectedStop.id, selectedStop.position + direction * (event.shiftKey ? 0.1 : 0.01))
  }
  const handleOpenChange = (next: boolean, details: {
    readonly reason: string
    readonly cancel: () => void
  }) => {
    // 渐变控制柄位于 Stage 的 SVG 覆盖层，不属于 Popover Portal。若把画布上的
    // pointer down 当作普通 outside press，Base UI 会在手势起点先关闭面板，随后
    // Editor 清空 Paint session，使 pointerup 没有可提交的预览。Paint 编辑器因此
    // 对 outside press 保持 pinned；Escape 和再次触发器仍是明确、可预期的关闭方式。
    if (!next && (details.reason === 'outside-press' || details.reason === 'focus-out')) {
      details.cancel()
      return
    }
    setOpen(next)
    onOpenChange?.(next)
  }
  const title = label ?? text.dialog
  const kindOptions: readonly [ComposePaint['kind'], string][] = useMemo(() => [
    ['solid', text.solid],
    ['linear-gradient', text.linear],
    ['radial-gradient', text.radial],
    ['angular-gradient', text.angular],
  ], [text.angular, text.linear, text.radial, text.solid])
  return (
    <PopoverPrimitive.Root modal="trap-focus" open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger aria-label={title} className="compose-color-picker__trigger compose-paint-picker__trigger" disabled={locked} type="button">
        <span aria-hidden="true" className="compose-color-picker__swatch" style={paintStyle(value)} />
      </PopoverPrimitive.Trigger>
      {!locked ? (
        <PaintPopover label={title}>
          <div className="compose-paint-picker">
            <div aria-label={text.dialog} className="compose-paint-picker__types" role="group">
              {kindOptions.map(([kind, name]) => <button aria-pressed={value.kind === kind} key={kind} type="button" onClick={() => selectKind(kind)}>{name}</button>)}
            </div>
            {value.kind !== 'solid' ? (
              <div aria-label={text.track} className="compose-paint-picker__track" role="group" style={paintStyle(value)} tabIndex={0} onDoubleClick={addStopAt} onKeyDown={onTrackKeyDown} onPointerDown={(event) => {
                const stop = (event.target as HTMLElement).closest('[data-stop-id]')
                if (!stop) return
                setSelectedStopId(stop.getAttribute('data-stop-id'))
              }}>
                {value.stops.map((stop) => (
                  <button aria-label={`${Math.round(stop.position * 100)}%`} className="compose-paint-picker__stop" data-stop-id={stop.id} key={stop.id} style={{ left: `${stop.position * 100}%`, background: stop.color }} type="button" onClick={() => { setSelectedStopId(stop.id) }} onPointerDown={(event) => {
                    event.stopPropagation()
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                  }} onPointerMove={(event) => {
                    if (event.buttons === 0) return
                    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
                    if (bounds) updateStopPosition(stop.id, (event.clientX - bounds.left) / bounds.width)
                  }} />
                ))}
              </div>
            ) : null}
            <ComposeColorPicker label={value.kind === 'solid' ? text.solid : `${Math.round((selectedStop?.position ?? 0) * 100)}%`} value={activeColor} onEyedropperFallback={onEyedropperFallback} onValueChange={updateCurrentStop} />
            {value.kind !== 'solid' ? (
              <details className="compose-paint-picker__exact">
                <summary>{text.exact}</summary>
                <label>
                  {text.position}
                  <input
                    aria-label={text.position}
                    max="100"
                    min="0"
                    type="number"
                    value={Math.round((selectedStop?.position ?? 0) * 100)}
                    onChange={(event) => {
                      if (selectedStop) updateStopPosition(selectedStop.id, Number(event.target.value) / 100)
                    }}
                  />
                </label>
                {value.kind === 'linear-gradient' || value.kind === 'angular-gradient' ? (
                  <label>
                    {text.angle}
                    <input
                      aria-label={text.angle}
                      max="360"
                      min="0"
                      type="number"
                      value={Math.round(value.kind === 'linear-gradient'
                        ? composeAngle(Math.atan2(value.end.y - value.start.y, value.end.x - value.start.x) * 180 / Math.PI)
                        : value.angle)}
                      onChange={(event) => updateAngle(Number(event.target.value))}
                    />
                  </label>
                ) : null}
              </details>
            ) : null}
            {value.kind !== 'solid' && value.stops.length > 2 ? <button className="compose-paint-picker__delete" type="button" onClick={() => {
              const stops = value.stops.filter((stop) => stop.id !== selectedStop?.id)
              setSelectedStopId(stops[0]?.id ?? null)
              emit({ ...value, stops })
            }}>{text.deleteStop}</button> : null}
          </div>
        </PaintPopover>
      ) : null}
    </PopoverPrimitive.Root>
  )
}
