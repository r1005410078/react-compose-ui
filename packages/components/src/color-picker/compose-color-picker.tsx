import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useCallback } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { cn } from '#lib/utils'

type HsvColor = {
  readonly hue: number
  readonly saturation: number
  readonly value: number
}

const FALLBACK_COLOR = '#000000'

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeHex(value: string): string | undefined {
  const compact = /^#([\da-f]{3})$/i.exec(value.trim())
  if (compact) return `#${compact[1].split('').map((part) => part.repeat(2)).join('')}`.toLowerCase()
  const full = /^#([\da-f]{6})$/i.exec(value.trim())
  return full ? `#${full[1].toLowerCase()}` : undefined
}

function hexToHsv(hex: string): HsvColor {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const difference = maximum - minimum
  let hue = 0
  if (difference !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / difference) % 6)
    else if (maximum === green) hue = 60 * ((blue - red) / difference + 2)
    else hue = 60 * ((red - green) / difference + 4)
  }
  return {
    hue: Math.round((hue + 360) % 360),
    saturation: maximum === 0 ? 0 : Math.round((difference / maximum) * 100),
    value: Math.round(maximum * 100),
  }
}

function hsvToHex({ hue, saturation, value }: HsvColor): string {
  const normalizedHue = ((hue % 360) + 360) % 360
  const chroma = (value / 100) * (saturation / 100)
  const secondary = chroma * (1 - Math.abs((normalizedHue / 60) % 2 - 1))
  const match = value / 100 - chroma
  const [red, green, blue] = normalizedHue < 60
    ? [chroma, secondary, 0]
    : normalizedHue < 120
      ? [secondary, chroma, 0]
      : normalizedHue < 180
        ? [0, chroma, secondary]
        : normalizedHue < 240
          ? [0, secondary, chroma]
          : normalizedHue < 300
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  const channel = (color: number) => Math.round((color + match) * 255).toString(16).padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

function useColorPickerMessages() {
  const i18n = useComposeI18nContext()
  const chinese = i18n ? i18n.locale !== 'en-US' : true
  const text = (id: string, zh: string, en: string, variables?: Readonly<Record<string, string>>) => {
    const fallback = chinese ? zh : en
    if (i18n) return i18n.formatMessage(id, fallback, variables)
    return variables
      ? fallback.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key: string) => variables[key] ?? match)
      : fallback
  }
  const localizedChinese = (label: string) => i18n ? chinese : /[\u3400-\u9fff]/.test(label)
  const suffix = (label: string) => localizedChinese(label)
    ? label.endsWith('颜色') ? label : `${label}颜色`
    : /color$/i.test(label) ? label : `${label} color`
  return {
    dialog: (label: string) => suffix(label),
    hue: (label: string) => text(
      'components.colorPicker.hue',
      '{label}色相',
      '{label} hue',
      { label },
    ),
    plane: (label: string) => text(
      'components.colorPicker.plane',
      '{label}色盘',
      '{label} color plane',
      { label },
    ),
    select: (label: string) => text(
      'components.colorPicker.select',
      '选择{label}',
      'Select {label}',
      { label: suffix(label) },
    ),
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
      <PopoverPrimitive.Positioner
        align="end"
        className="cu:isolate cu:z-[20000]"
        collisionPadding={8}
        side="bottom"
        sideOffset={4}
      >
        <PopoverPrimitive.Popup
          aria-label={label}
          className={cn(
            'cu:w-56 cu:origin-(--transform-origin) cu:rounded-md cu:border cu:border-border cu:bg-popover cu:p-3 cu:text-popover-foreground cu:shadow-lg cu:outline-none',
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

/** 共享 Color Picker 的受控属性。 */
export interface ComposeColorPickerProps {
  /** 当前 CSS 色值；Picker 会保留无法精确编辑的已有值，并在用户选择后归一化。 */
  readonly value: string
  /** 选择颜色或完全透明时提交的受控值。 */
  readonly onValueChange?: (value: string) => void
  /** 色块触发器及色盘控件的可访问名称基础。 */
  readonly label: string
  /** 禁用整个 Picker。 */
  readonly disabled?: boolean
  /** 以不可编辑状态展示当前颜色。 */
  readonly readOnly?: boolean
  /** 是否提供完全透明选项；默认开启。 */
  readonly allowTransparent?: boolean
}

/**
 * 基于 Shadcn Popover 源码组合的受控颜色选择器。
 *
 * @remarks
 * Trigger 与弹层均不显示 HEX、RGB、HSL 等颜色字符串。Picker 只输出不透明小写 HEX 或
 * `transparent`；不支持精确编辑的既有 CSS 色仅在用户主动选择后才会被替换。
 *
 * @public
 */
export function ComposeColorPicker({
  allowTransparent = true,
  disabled = false,
  label,
  onValueChange,
  readOnly = false,
  value,
}: ComposeColorPickerProps) {
  const messages = useColorPickerMessages()
  const parsedValue = normalizeHex(value)
  const transparent = value.trim().toLowerCase() === 'transparent'
  const fallback = !parsedValue
  const hsv = hexToHsv(parsedValue ?? FALLBACK_COLOR)
  const locked = disabled || readOnly
  const emit = useCallback((next: HsvColor) => {
    if (!locked) onValueChange?.(hsvToHex(next))
  }, [locked, onValueChange])
  const updatePlane = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (locked) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    emit({
      ...hsv,
      saturation: Math.round(clamp(((event.clientX - bounds.left) / bounds.width) * 100)),
      value: Math.round(100 - clamp(((event.clientY - bounds.top) / bounds.height) * 100)),
    })
  }, [emit, hsv, locked])
  const updatePlaneByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1
    const next = event.key === 'ArrowRight' ? { ...hsv, saturation: clamp(hsv.saturation + step) }
      : event.key === 'ArrowLeft' ? { ...hsv, saturation: clamp(hsv.saturation - step) }
        : event.key === 'ArrowUp' ? { ...hsv, value: clamp(hsv.value + step) }
          : event.key === 'ArrowDown' ? { ...hsv, value: clamp(hsv.value - step) }
            : undefined
    if (!next) return
    event.preventDefault()
    emit(next)
  }
  const triggerStyle = transparent ? undefined : { backgroundColor: value }
  const planeStyle = {
    '--compose-color-picker-hue': String(hsv.hue),
  } as CSSProperties

  return (
    <PopoverPrimitive.Root modal="trap-focus">
      <PopoverPrimitive.Trigger
        aria-label={messages.select(label)}
        aria-readonly={readOnly ? 'true' : undefined}
        className="compose-color-picker__trigger"
        data-color-fallback={fallback ? 'true' : 'false'}
        disabled={locked}
        type="button"
      >
        <span
          aria-hidden="true"
          className="compose-color-picker__swatch"
          style={triggerStyle}
        />
      </PopoverPrimitive.Trigger>
      {!locked ? (
        <ColorPickerPopoverContent label={messages.dialog(label)}>
          <div className="compose-color-picker__content">
            <div
              aria-label={messages.plane(label)}
              className="compose-color-picker__plane"
              role="group"
              style={planeStyle}
              tabIndex={0}
              onKeyDown={updatePlaneByKey}
              onPointerDown={updatePlane}
              onPointerMove={(event) => {
                if (event.buttons !== 0) updatePlane(event)
              }}
            >
              <span
                aria-hidden="true"
                className="compose-color-picker__plane-thumb"
                style={{
                  left: `${hsv.saturation}%`,
                  top: `${100 - hsv.value}%`,
                }}
              />
            </div>
            <input
              aria-label={messages.hue(label)}
              className="compose-color-picker__hue"
              max="359"
              min="0"
              type="range"
              value={hsv.hue}
              onChange={(event) => emit({ ...hsv, hue: Number(event.target.value) })}
            />
            {allowTransparent ? (
              <button
                aria-pressed={transparent}
                className="compose-color-picker__transparent"
                type="button"
                onClick={() => onValueChange?.('transparent')}
              >
                <span aria-hidden="true" className="compose-color-picker__transparent-swatch" />
                {messages.transparent}
              </button>
            ) : null}
          </div>
        </ColorPickerPopoverContent>
      ) : null}
    </PopoverPrimitive.Root>
  )
}
