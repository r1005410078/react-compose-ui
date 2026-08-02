import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { normalizeComposeAngle } from './angle-model'

/** ComposeAnglePicker 的受控属性。 @public */
export interface ComposeAnglePickerProps {
  /** 当前角度；文本输入保留负数和超过一圈的值。 */
  readonly value: number
  /** 数值输入与快捷设置的可访问名称。 @defaultValue 角度 */
  readonly label?: string
  /** 禁用全部交互。 @defaultValue false */
  readonly disabled?: boolean
  /** 以不可编辑状态显示当前值。 @defaultValue false */
  readonly readOnly?: boolean
  /** 用户完成一次有效输入、转盘、键盘或快捷角操作后调用。 */
  readonly onValueCommit?: (value: number) => void
}

interface DialGesture {
  readonly pointerId: number
  latest: number
}

function angleAtPointer(event: PointerEvent<HTMLElement>): number {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - bounds.left - bounds.width / 2
  const y = event.clientY - bounds.top - bounds.height / 2
  return normalizeComposeAngle(Math.atan2(y, x) * 180 / Math.PI + 90)
}

function angleMessages(locale: string | undefined, label: string | undefined) {
  const zh = locale !== 'en-US'
  const resolvedLabel = label ?? (zh ? '角度' : 'Angle')
  return {
    label: resolvedLabel,
    dial: zh ? `${resolvedLabel}转盘` : `${resolvedLabel} dial`,
    dialog: zh ? `${resolvedLabel}快捷设置` : `${resolvedLabel} quick settings`,
    exact: zh ? `${resolvedLabel}精确值` : `Exact ${resolvedLabel}`,
    trigger: zh ? `快捷设置${resolvedLabel}` : `Quick set ${resolvedLabel}`,
    shortcut: (angle: number) => zh
      ? `设置${resolvedLabel}为 ${angle}°`
      : `Set ${resolvedLabel} to ${angle}°`,
  }
}

/**
 * 组合任意角度输入、归一化转盘和常用快捷角的受控选择器。
 *
 * @remarks
 * 转盘拖动只维护本地草稿并在 pointerup 提交一次；关闭或卸载不会提交未完成手势。
 *
 * @public
 */
export function ComposeAnglePicker({
  disabled = false,
  label,
  onValueCommit,
  readOnly = false,
  value,
}: ComposeAnglePickerProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const messages = angleMessages(i18n?.locale, label)
  const locked = disabled || readOnly
  const [open, setOpen] = useState(false)
  const [inlineDraft, setInlineDraft] = useState({ source: value, text: String(value) })
  const [exactDraft, setExactDraft] = useState({ source: value, text: String(value) })
  const [dialValue, setDialValue] = useState(normalizeComposeAngle(value))
  const gestureRef = useRef<DialGesture | null>(null)
  const inlineText = Object.is(inlineDraft.source, value) ? inlineDraft.text : String(value)
  const exactText = Object.is(exactDraft.source, value) ? exactDraft.text : String(value)

  const commit = (candidate: number) => {
    if (locked || !Number.isFinite(candidate)) return false
    if (!Object.is(candidate, value)) onValueCommit?.(candidate)
    return true
  }
  const resetDrafts = () => {
    setInlineDraft({ source: value, text: String(value) })
    setExactDraft({ source: value, text: String(value) })
    setDialValue(normalizeComposeAngle(value))
    gestureRef.current = null
  }
  const setPopupOpen = (nextOpen: boolean) => {
    if (nextOpen && locked) return
    resetDrafts()
    setOpen(nextOpen)
  }
  const submitInline = () => {
    if (inlineText.trim() === '') return false
    const candidate = Number(inlineText)
    if (!commit(candidate)) return false
    setInlineDraft({ source: candidate, text: String(candidate) })
    return true
  }
  const submitExact = () => {
    if (exactText.trim() === '') return false
    const candidate = Number(exactText)
    if (!commit(candidate)) return false
    setExactDraft({ source: candidate, text: String(candidate) })
    setDialValue(normalizeComposeAngle(candidate))
    return true
  }
  const commitDial = (candidate: number) => {
    const normalized = normalizeComposeAngle(candidate)
    setDialValue(normalized)
    setExactDraft({ source: normalized, text: String(normalized) })
    commit(normalized)
  }
  const handleDialKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setPopupOpen(false)
      return
    }
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    commitDial(dialValue + direction * (event.shiftKey ? 15 : 1))
  }
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (locked) return
    const next = angleAtPointer(event)
    gestureRef.current = { pointerId: event.pointerId, latest: next }
    setDialValue(next)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gesture.latest = angleAtPointer(event)
    setDialValue(gesture.latest)
  }
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gesture.latest = angleAtPointer(event)
    gestureRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    commitDial(gesture.latest)
  }
  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDialValue(normalizeComposeAngle(value))
  }

  return (
    <PopoverPrimitive.Root modal={false} open={open} onOpenChange={setPopupOpen}>
      <div
        className="compose-angle-picker"
        data-compose-theme={theme?.resolvedTheme}
        data-compose-ui="angle-picker"
        style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}
      >
        <label className="compose-angle-picker__value">
          <input
            aria-label={messages.label}
            disabled={disabled}
            readOnly={readOnly}
            step="any"
            type="number"
            value={inlineText}
            onBlur={submitInline}
            onChange={(event) => setInlineDraft({ source: value, text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitInline()
              if (event.key === 'Escape') {
                event.preventDefault()
                setInlineDraft({ source: value, text: String(value) })
              }
            }}
          />
          <span aria-hidden="true">°</span>
        </label>
        <PopoverPrimitive.Trigger
          aria-label={messages.trigger}
          className="compose-angle-picker__trigger"
          disabled={locked}
          title={messages.trigger}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="M3 15a7 7 0 0 1 14 0H3Z" />
            <path d="m10 15 4-4.8M6 13.2l-1.3-.7M10 11V9M14 13.2l1.3-.7" />
            <circle cx="10" cy="15" r="0.8" />
          </svg>
        </PopoverPrimitive.Trigger>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="end"
          className="compose-angle-picker__positioner"
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          collisionPadding={8}
          side="bottom"
          sideOffset={5}
        >
          <PopoverPrimitive.Popup
            aria-label={messages.dialog}
            className="compose-angle-picker__popup"
            data-compose-theme={theme?.resolvedTheme}
            data-compose-ui="angle-picker-popup"
            role="dialog"
            style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}
          >
            <button
              aria-label={messages.dial}
              aria-valuemax={359}
              aria-valuemin={0}
              aria-valuenow={Math.round(dialValue)}
              aria-valuetext={`${Math.round(dialValue)}°`}
              className="compose-angle-picker__dial"
              role="slider"
              style={{ '--compose-angle': `${dialValue}deg` } as CSSProperties}
              type="button"
              onKeyDown={handleDialKeyDown}
              onPointerCancel={handlePointerCancel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <span aria-hidden="true" />
            </button>
            <label className="compose-angle-picker__exact">
              <input
                aria-label={messages.exact}
                step="any"
                type="number"
                value={exactText}
                onBlur={submitExact}
                onChange={(event) => setExactDraft({ source: value, text: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitExact()
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setPopupOpen(false)
                  }
                }}
              />
              <span aria-hidden="true">°</span>
            </label>
            <div className="compose-angle-picker__shortcuts">
              {[0, 90, 180, 270].map((angle) => (
                <button
                  aria-label={messages.shortcut(angle)}
                  aria-pressed={Math.round(dialValue) === angle}
                  key={angle}
                  type="button"
                  onClick={() => commitDial(angle)}
                >
                  {angle}°
                </button>
              ))}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
