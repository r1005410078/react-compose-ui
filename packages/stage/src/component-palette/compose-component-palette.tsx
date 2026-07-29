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
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type {
  StageExternalDragItem,
  StageInteractionController,
} from '@compose-ui/stage-engine'
import { getStageMessages } from '../stage-i18n'

/** ComposeComponentPalette 属性。 @public */
export interface ComposeComponentPaletteProps extends HTMLAttributes<HTMLDivElement> {
  readonly registry: ComposeEntityRegistry
  /** 与目标 Stage 共享的实例级 headless controller。 */
  readonly interactionController: StageInteractionController
}

/** 按 Registry 顺序显示可拖入或键盘新增的 Entity Presets。 @public */
export function ComposeComponentPalette({
  registry,
  interactionController,
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
    interactionController.send({ type: 'external.begin', item, clientPoint: startPoint })
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
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
      cleanupRef.current = null
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
        resetClickTimerRef.current = setTimeout(() => {
          suppressClickRef.current = false
          resetClickTimerRef.current = null
        }, 0)
      }
      else interactionController.send({ type: 'external.cancel' })
    }
    const cancel = () => {
      cleanup()
      suppressClickRef.current = false
      interactionController.send({ type: 'external.cancel' })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', cancel)
    cleanupRef.current = cleanup
  }

  const externalLabel = (() => {
    const item = state.external?.item
    if (!item) return null
    if (item.kind === 'assets') {
      return item.items.length === 1 ? item.items[0]?.name : `${item.items.length} assets`
    }
    return registry.getPreset(item.presetId)?.label ?? item.presetId
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
        {registry.listPresets().filter((preset) => !preset.paletteHidden).map((preset) => (
          <li key={preset.id}>
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
                  item: { kind: 'preset', presetId: preset.id },
                })
              }}
              onPointerDown={(event) => start({
                kind: 'preset',
                presetId: preset.id,
              }, event)}
            >
              {preset.icon}
              <span>{preset.label}</span>
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
