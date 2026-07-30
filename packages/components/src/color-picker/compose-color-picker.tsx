import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent,
  ReactNode,
} from 'react'
import { normalizeComposeColor, type ComposeColor } from '@compose-ui/core'
import { cn } from '#lib/utils'
import {
  clampComposeColor,
  COMPOSE_COMMON_COLORS,
  composeColorFromHsv,
  composeColorWithAlpha,
  parseComposeEditableColor,
  type ComposeEditableColor,
  type ComposeHsvColor,
} from './color-model'
import { useComposeColorHistory } from './use-compose-color-history'

type EyeDropperResult = { readonly sRGBHex: string }
type EyeDropperInstance = { open(input?: { readonly signal?: AbortSignal }): Promise<EyeDropperResult> }
type EyeDropperConstructor = new () => EyeDropperInstance

function useColorPickerMessages() {
  const i18n = useComposeI18nContext()
  const chinese = i18n ? i18n.locale !== 'en-US' : true
  const text = (id: string, zh: string, en: string, variables?: Readonly<Record<string, string | number>>) => {
    const fallback = chinese ? zh : en
    if (i18n) return i18n.formatMessage(id, fallback, variables)
    return variables
      ? fallback.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key: string) => String(variables[key] ?? match))
      : fallback
  }
  const localizedChinese = (label: string) => i18n ? chinese : /[\u3400-\u9fff]/.test(label)
  const suffix = (label: string) => localizedChinese(label)
    ? label.endsWith('颜色') ? label : `${label}颜色`
    : /color$/i.test(label) ? label : `${label} color`
  return {
    alpha: (label: string) => text('components.colorPicker.alpha', '{label}不透明度', '{label} opacity', { label }),
    common: text('components.colorPicker.common', '常用', 'Common'),
    dialog: (label: string) => suffix(label),
    eyedropper: text('components.colorPicker.eyedropper', '吸管', 'Eyedropper'),
    exact: text('components.colorPicker.exact', '精确', 'Exact'),
    hex: text('components.colorPicker.hex', 'HEX', 'HEX'),
    hue: (label: string) => text('components.colorPicker.hue', '{label}色相', '{label} hue', { label }),
    plane: (label: string) => text('components.colorPicker.plane', '{label}色盘', '{label} color plane', { label }),
    recent: text('components.colorPicker.recent', '最近使用', 'Recent'),
    select: (label: string) => text('components.colorPicker.select', '选择{label}', 'Select {label}', { label: suffix(label) }),
    transparent: text('components.colorPicker.transparent', '透明', 'Transparent'),
  }
}

/** Shadcn Popover 生成源码在 Color Picker 内部的 Compose 主题适配。 */
function ColorPickerPopoverContent({
  children,
  label,
}: {
  readonly children: ReactNode
  readonly label: string
}) {
  const theme = useComposeThemeContext()
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align="end" className="cu:isolate cu:z-[20000]" collisionPadding={8} side="bottom" sideOffset={4}>
        <PopoverPrimitive.Popup
          aria-label={label}
          className={cn(
            'cu:w-[min(384px,calc(100vw-24px))] cu:origin-(--transform-origin) cu:rounded-lg cu:border cu:border-border cu:bg-popover cu:p-3 cu:text-popover-foreground cu:shadow-xl cu:outline-none',
            'cu:duration-100 cu:data-[side=bottom]:slide-in-from-top-2 cu:data-[side=top]:slide-in-from-bottom-2 cu:data-open:animate-in cu:data-open:fade-in-0 cu:data-open:zoom-in-95',
          )}
          data-compose-theme={theme?.resolvedTheme}
          data-compose-ui="color-picker"
          role="dialog"
          style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

/** ComposeColorPicker 的受控属性。 @public */
export interface ComposeColorPickerProps {
  /** 当前颜色。非法旧 CSS 值只显示为安全回退，用户修改后会改写为规范 ComposeColor。 */
  readonly value: string
  /** 颜色实时变化时的受控回调。 */
  readonly onValueChange?: (value: ComposeColor) => void
  /** 色块触发器及色盘控件的可访问名称基础。 */
  readonly label: string
  /** 禁用整个 Picker。 */
  readonly disabled?: boolean
  /** 以不可编辑状态展示当前颜色。 */
  readonly readOnly?: boolean
  /** 是否提供完全透明选项；默认开启。 */
  readonly allowTransparent?: boolean
  /** 原生吸管不可用或失败时进入宿主图层取色的入口。 */
  readonly onEyedropperFallback?: () => void
  /** Popover 可见性变化；Paint 编辑端口可据此锁定/释放画布手柄。 */
  readonly onOpenChange?: (open: boolean) => void
  /** @internal 供同包 Paint Picker 在其 Popover 内嵌入色彩编辑控件。 */
  readonly embedded?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable)
}

/**
 * 基于 Shadcn Popover 组合的 Figma 风格纯色选择器。
 *
 * @remarks
 * 指针拖动时色盘/滑杆只用本地 `dragPreviewColor` 即时回显，不向父级派发 `onValueChange`。
 * Editor 中每次颜色变更都会走完整文档事务、Stage 与属性树重绘；拖动中每帧提交会直接造成
 * 色盘拖选卡顿。松手时同步 flush 最终采样点，保证受控值、舞台与历史一致。颜色 MRU 只在
 * Popover 关闭时记录。原生 EyeDropper 始终由用户手势启动，浏览器拒绝或不支持时交给宿主
 * 图层取色。
 *
 * @public
 */
export function ComposeColorPicker({
  allowTransparent = true,
  disabled = false,
  embedded = false,
  label,
  onEyedropperFallback,
  onOpenChange,
  onValueChange,
  readOnly = false,
  value,
}: ComposeColorPickerProps) {
  const messages = useColorPickerMessages()
  const { colors: recentColors, record } = useComposeColorHistory()
  const [open, setOpen] = useState(false)
  const [dragPreviewColor, setDragPreviewColor] = useState<ComposeColor | null>(null)
  const emittedColor = useRef<ComposeColor | null>(null)
  const pendingColor = useRef<ComposeColor | null>(null)
  const pointerDrag = useRef(false)
  const dragSample = useRef<ComposeEditableColor | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const parsed = parseComposeEditableColor(dragPreviewColor ?? value)
  const locked = disabled || readOnly
  const fallback = normalizeComposeColor(value) === null
  const transparent = parsed.color === 'transparent'
  const flushPointerColor = useCallback(() => {
    const next = pendingColor.current
    pendingColor.current = null
    if (next) onValueChange?.(next)
  }, [onValueChange])
  const emitColor = useCallback((next: ComposeColor, sample?: ComposeEditableColor) => {
    if (locked) return
    emittedColor.current = next
    if (!pointerDrag.current) {
      onValueChange?.(next)
      return
    }
    // 同步写入采样 ref，使连续 pointermove 在 React 重绘前仍能读到最新 HSV。
    if (sample) dragSample.current = sample
    else dragSample.current = parseComposeEditableColor(next)
    // 拖动中只更新本地草稿与 pending；文档事务延后到松手，避免 Editor 全树每帧提交。
    setDragPreviewColor((current) => (current === next ? current : next))
    pendingColor.current = next
  }, [locked, onValueChange])
  const emit = useCallback((next: ComposeHsvColor, alpha: number) => {
    if (locked) return
    const color = composeColorFromHsv(next, alpha)
    emitColor(color, { color, hsv: next, alpha })
  }, [emitColor, locked])
  const emitAlpha = useCallback((alpha: number) => {
    if (locked) return
    const sample = dragSample.current ?? parsed
    const color = composeColorWithAlpha(sample.color, alpha)
    emitColor(color, {
      color,
      hsv: sample.hsv,
      alpha: Math.min(1, Math.max(0, alpha)),
    })
  }, [emitColor, locked, parsed])
  const startPointerDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (locked) return
    pointerDrag.current = true
    dragSample.current = parseComposeEditableColor(dragPreviewColor ?? value)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [dragPreviewColor, locked, value])
  const finishPointerDrag = useCallback(() => {
    if (!pointerDrag.current) return
    pointerDrag.current = false
    dragSample.current = null
    flushPointerColor()
  }, [flushPointerColor])
  const updatePlane = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (locked) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    const sample = dragSample.current ?? parsed
    emit({
      ...sample.hsv,
      saturation: Math.round(clampComposeColor(((event.clientX - bounds.left) / bounds.width) * 100)),
      value: Math.round(100 - clampComposeColor(((event.clientY - bounds.top) / bounds.height) * 100)),
    }, sample.alpha === 0 ? 1 : sample.alpha)
  }, [emit, locked, parsed])
  const updatePlaneByKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1
    const next = event.key === 'ArrowRight' ? { ...parsed.hsv, saturation: clampComposeColor(parsed.hsv.saturation + step) }
      : event.key === 'ArrowLeft' ? { ...parsed.hsv, saturation: clampComposeColor(parsed.hsv.saturation - step) }
        : event.key === 'ArrowUp' ? { ...parsed.hsv, value: clampComposeColor(parsed.hsv.value + step) }
          : event.key === 'ArrowDown' ? { ...parsed.hsv, value: clampComposeColor(parsed.hsv.value - step) }
            : undefined
    if (!next) return
    event.preventDefault()
    // 从“透明”开始在色盘上选色，用户意图是得到可见颜色，而不是保持不可见 RGB 数据。
    emit(next, parsed.alpha === 0 ? 1 : parsed.alpha)
  }
  const startEyedropper = useCallback(async () => {
    if (locked) return
    const EyeDropper = (globalThis as unknown as { readonly EyeDropper?: EyeDropperConstructor }).EyeDropper
    if (!EyeDropper || !globalThis.isSecureContext) {
      onEyedropperFallback?.()
      return
    }
    try {
      const result = await new EyeDropper().open()
      const sampled = normalizeComposeColor(result.sRGBHex)
      if (sampled) emitColor(sampled)
      else onEyedropperFallback?.()
    }
    catch {
      onEyedropperFallback?.()
    }
  }, [emitColor, locked, onEyedropperFallback])
  useEffect(() => {
    if (!embedded && !open) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'i' || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return
      event.preventDefault()
      void startEyedropper()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [embedded, open, startEyedropper])
  useEffect(() => () => {
    // 嵌入 Paint Picker 时没有自身的 Popover 关闭事件；随父面板卸载再记录本次会话颜色。
    if (embedded && emittedColor.current) record(emittedColor.current)
  }, [embedded, record])
  useEffect(() => {
    // 受控值确认本地最终采样后再清草稿，避免拖动中的 thumb 被慢一拍的文档回传拉回。
    if (!pointerDrag.current && dragPreviewColor !== null && normalizeComposeColor(value) === dragPreviewColor) {
      setDragPreviewColor(null)
    }
  }, [dragPreviewColor, value])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) finishPointerDrag()
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
    if (!nextOpen && emittedColor.current) {
      record(emittedColor.current)
      emittedColor.current = null
      triggerRef.current?.focus()
    }
  }
  const triggerStyle = transparent ? undefined : { backgroundColor: parsed.color }
  const planeStyle = { '--compose-color-picker-hue': String(parsed.hsv.hue) } as CSSProperties
  const displayHex = parsed.color === 'transparent' ? '#000000' : parsed.color.slice(0, 7)
  const rgbaChannels = [1, 3, 5].map((start) => Number.parseInt(displayHex.slice(start, start + 2), 16))
  const rgbaText = `${rgbaChannels.join(', ')}, ${Math.round(parsed.alpha * 100)}%`

  const content = (
    <div className={`compose-color-picker__content${embedded ? ' compose-color-picker__content--embedded' : ''}`}>
      <div className="compose-color-picker__controls">
        <div
          aria-label={messages.plane(label)}
          className="compose-color-picker__plane"
          role="group"
          style={planeStyle}
          tabIndex={0}
          onKeyDown={updatePlaneByKey}
          onPointerDown={(event) => {
            startPointerDrag(event)
            updatePlane(event)
          }}
          onPointerMove={(event) => { if (event.buttons !== 0) updatePlane(event) }}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onLostPointerCapture={finishPointerDrag}
        >
          <span aria-hidden="true" className="compose-color-picker__plane-thumb" style={{ left: `${parsed.hsv.saturation}%`, top: `${100 - parsed.hsv.value}%` }} />
        </div>
        <div className="compose-color-picker__sliders">
          <input aria-label={messages.hue(label)} className="compose-color-picker__hue" max="359" min="0" type="range" value={parsed.hsv.hue} onChange={(event) => emit({ ...parsed.hsv, hue: Number(event.target.value) }, parsed.alpha)} onLostPointerCapture={finishPointerDrag} onPointerCancel={finishPointerDrag} onPointerDown={startPointerDrag} onPointerUp={finishPointerDrag} />
          {embedded ? <label className="compose-color-picker__alpha-row"><span>{messages.alpha(label).replace(label, '')}</span><span><input aria-label={messages.alpha(label)} className="compose-color-picker__alpha" max="100" min="0" type="range" value={Math.round(parsed.alpha * 100)} onChange={(event) => emitAlpha(Number(event.target.value) / 100)} onLostPointerCapture={finishPointerDrag} onPointerCancel={finishPointerDrag} onPointerDown={startPointerDrag} onPointerUp={finishPointerDrag} /><output>{Math.round(parsed.alpha * 100)}%</output></span></label>
            : <input aria-label={messages.alpha(label)} className="compose-color-picker__alpha" max="100" min="0" type="range" value={Math.round(parsed.alpha * 100)} onChange={(event) => emitAlpha(Number(event.target.value) / 100)} onLostPointerCapture={finishPointerDrag} onPointerCancel={finishPointerDrag} onPointerDown={startPointerDrag} onPointerUp={finishPointerDrag} />}
        </div>
      </div>
      {embedded ? <div className="compose-color-picker__embedded-values">
        <span aria-hidden="true" className="compose-color-picker__value-swatch" style={triggerStyle} />
        <label>{messages.hex}<input aria-label={messages.hex} key={displayHex} defaultValue={displayHex.toUpperCase()} onBlur={(event) => {
          const normalized = normalizeComposeColor(event.target.value)
          if (normalized) emitColor(parsed.alpha < 1 ? composeColorFromHsv(parseComposeEditableColor(normalized).hsv, parsed.alpha) : normalized)
        }} /></label>
        <label>RGBA<input aria-label="RGBA" readOnly value={rgbaText} /></label>
        <button aria-label={messages.eyedropper} className="compose-color-picker__eyedropper" type="button" onClick={() => { void startEyedropper() }}>⌖</button>
      </div> : <div className="compose-color-picker__actions">
          <button aria-label={messages.eyedropper} className="compose-color-picker__eyedropper" type="button" onClick={() => { void startEyedropper() }}>⌖</button>
          {allowTransparent ? <button aria-pressed={transparent} className="compose-color-picker__transparent" type="button" onClick={() => emitColor('transparent')}><span aria-hidden="true" className="compose-color-picker__transparent-swatch" />{messages.transparent}</button> : null}
        </div>}
      <ColorRow colors={recentColors} label={messages.recent} onSelect={emitColor} />
      <ColorRow colors={COMPOSE_COMMON_COLORS} label={messages.common} onSelect={emitColor} />
      <details className="compose-color-picker__exact">
        <summary>{messages.exact}</summary>
        <label>
          {messages.hex}
          <input aria-label={messages.hex} defaultValue={parsed.color === 'transparent' ? '#000000' : parsed.color.slice(0, 7)} onBlur={(event) => {
            const normalized = normalizeComposeColor(event.target.value)
            if (normalized) emitColor(parsed.alpha < 1 ? composeColorFromHsv(parseComposeEditableColor(normalized).hsv, parsed.alpha) : normalized)
          }} />
        </label>
        <label>
          {messages.alpha(label)}
          <input aria-label={`${messages.alpha(label)} 精确输入`} max="100" min="0" type="number" value={Math.round(parsed.alpha * 100)} onChange={(event) => emitAlpha(Number(event.target.value) / 100)} />
        </label>
      </details>
    </div>
  )

  if (embedded) return content

  return (
    <PopoverPrimitive.Root modal={false} open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        ref={triggerRef}
        aria-label={messages.select(label)}
        aria-readonly={readOnly ? 'true' : undefined}
        className="compose-color-picker__trigger"
        data-color-fallback={fallback ? 'true' : 'false'}
        disabled={locked}
        type="button"
      >
        <span aria-hidden="true" className="compose-color-picker__swatch" style={triggerStyle} />
      </PopoverPrimitive.Trigger>
      {!locked ? (
        <ColorPickerPopoverContent label={messages.dialog(label)}>
          {content}
        </ColorPickerPopoverContent>
      ) : null}
    </PopoverPrimitive.Root>
  )
}

function ColorRow({ colors, label, onSelect }: { readonly colors: readonly ComposeColor[]; readonly label: string; readonly onSelect: (color: ComposeColor) => void }) {
  if (colors.length === 0) return null
  return (
    <section aria-label={label} className="compose-color-picker__row">
      <span>{label}</span>
      <div>
        {colors.map((color) => (
          <button aria-label={color} className="compose-color-picker__color-chip" data-transparent={color === 'transparent' || undefined} key={color} style={color === 'transparent' ? undefined : { background: color }} type="button" onClick={() => onSelect(color)} />
        ))}
      </div>
    </section>
  )
}
