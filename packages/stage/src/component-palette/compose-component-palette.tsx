import { useEffect, useRef, useSyncExternalStore } from 'react'
import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
} from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import type { ComposeComponentRegistry } from '@compose-ui/component-registry'
import type {
  StageExternalDragItem,
  StageInteractionController,
} from '@compose-ui/stage-engine'
import type { ComposeStageFramePreset } from '../frame-preset'
import { getStageMessages } from '../stage-i18n'

/**
 * ComposeComponentPalette 属性。
 *
 * @public
 */
export interface ComposeComponentPaletteProps extends HTMLAttributes<HTMLDivElement> {
  readonly registry: ComposeComponentRegistry
  /** 与目标 Stage 共享的实例级 headless controller。 */
  readonly interactionController: StageInteractionController
  /** 显示在 registry definitions 之前的根级 Frame 预设。 */
  readonly framePresets?: readonly ComposeStageFramePreset[]
}

/**
 * 按 registry 顺序显示可拖入或键盘新增的组件 definitions。
 *
 * @public
 */
export function ComposeComponentPalette({
  registry,
  interactionController,
  framePresets = [],
  className,
  style,
  ...props
}: ComposeComponentPaletteProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = i18n?.locale ?? 'zh-CN'
  const messages = getStageMessages(resolvedLocale, i18n?.formatMessage)
  const state = useSyncExternalStore(
    interactionController.subscribe,
    interactionController.getSnapshot,
    interactionController.getSnapshot,
  )
  const cleanupRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)
  const resetClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    cleanupRef.current?.()
    if (resetClickTimerRef.current !== null) clearTimeout(resetClickTimerRef.current)
  }, [])

  const start = (
    item: StageExternalDragItem,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    cleanupRef.current?.()
    suppressClickRef.current = false
    if (resetClickTimerRef.current !== null) clearTimeout(resetClickTimerRef.current)
    const startPoint = { x: event.clientX, y: event.clientY }
    let dragged = false
    interactionController.send({
      type: 'external.begin',
      item,
      clientPoint: startPoint,
    })
    const move = (pointerEvent: PointerEvent) => {
      dragged ||= Math.hypot(
        pointerEvent.clientX - startPoint.x,
        pointerEvent.clientY - startPoint.y,
      ) >= 4
      interactionController.send({
        type: 'external.move',
        clientPoint: { x: pointerEvent.clientX, y: pointerEvent.clientY },
      })
    }
    const release = (pointerEvent: PointerEvent) => {
      cleanup()
      dragged ||= Math.hypot(
        pointerEvent.clientX - startPoint.x,
        pointerEvent.clientY - startPoint.y,
      ) >= 4
      if (dragged) {
        suppressClickRef.current = true
        interactionController.send({
          type: 'external.end',
          clientPoint: { x: pointerEvent.clientX, y: pointerEvent.clientY },
        })
        // 真正拖放后浏览器仍会派发 click；延迟复位避免同一意图再走键盘新增。
        resetClickTimerRef.current = setTimeout(() => {
          suppressClickRef.current = false
          resetClickTimerRef.current = null
        }, 0)
      }
      else {
        interactionController.send({ type: 'external.cancel' })
      }
    }
    const cancel = () => {
      cleanup()
      suppressClickRef.current = false
      interactionController.send({ type: 'external.cancel' })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
      cleanupRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', cancel)
    cleanupRef.current = cleanup
  }
  const externalLabel = (() => {
    const item = state.external?.item
    if (!item) return null
    if (item.kind === 'frame') {
      return framePresets.find((preset) => preset.id === item.presetId)?.label
        ?? item.presetId
    }
    if (item.kind === 'assets') {
      return item.items.length === 1 ? item.items[0]?.name : `${item.items.length} assets`
    }
    return registry.get(item.componentType)?.label ?? item.componentType
  })()

  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? messages.library}
      className={['component-palette', className].filter(Boolean).join(' ')}
      data-compose-theme={theme?.resolvedTheme}
      lang={resolvedLocale}
      role="region"
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      <ul>
        {framePresets.map((preset) => (
          <li key={`frame:${preset.id}`}>
            <button
              aria-label={messages.add(preset.label)}
              type="button"
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  if (resetClickTimerRef.current !== null) {
                    clearTimeout(resetClickTimerRef.current)
                    resetClickTimerRef.current = null
                  }
                  return
                }
                interactionController.send({
                  type: 'external.add',
                  item: { kind: 'frame', presetId: preset.id },
                })
              }}
              onPointerDown={(event) => start({
                kind: 'frame',
                presetId: preset.id,
              }, event)}
            >
              {preset.icon}
              <span>{preset.label}</span>
            </button>
          </li>
        ))}
        {registry.list().filter((definition) => !definition.paletteHidden).map((definition) => (
          <li key={definition.type}>
            <button
              aria-label={messages.add(definition.label)}
              type="button"
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  if (resetClickTimerRef.current !== null) {
                    clearTimeout(resetClickTimerRef.current)
                    resetClickTimerRef.current = null
                  }
                  return
                }
                interactionController.send({
                  type: 'external.add',
                  item: { kind: 'component', componentType: definition.type },
                })
              }}
              onPointerDown={(event) => start({
                kind: 'component',
                componentType: definition.type,
              }, event)}
            >
              {definition.icon}
              <span>{definition.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {state.external ? (
        <div className="component-palette__drag-preview" role="status">
          {externalLabel}
        </div>
      ) : null}
    </div>
  )
}
