import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

function PalettePresetIcon({ presetId }: { readonly presetId: string }) {
  const normalizedId = presetId.toLowerCase()
  if (normalizedId === 'container') {
    return (
      <svg className="component-palette__tile-icon-svg" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="16" x="4" y="4" />
        <path d="M8 8h8v8H8z" />
      </svg>
    )
  }
  if (normalizedId === 'rectangle') {
    return (
      <svg className="component-palette__tile-icon-svg" viewBox="0 0 24 24">
        <rect height="12" rx="1.5" width="18" x="3" y="6" />
      </svg>
    )
  }
  if (normalizedId === 'text') {
    return (
      <svg className="component-palette__tile-icon-svg" viewBox="0 0 24 24">
        <path d="M5 5h14M12 5v14M8.5 19h7" />
      </svg>
    )
  }
  if (normalizedId.includes('page') || normalizedId.includes('slot')) {
    return (
      <svg className="component-palette__tile-icon-svg" viewBox="0 0 24 24">
        <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" />
      </svg>
    )
  }
  if (normalizedId.includes('chart') || normalizedId.includes('echart')) {
    return (
      <svg className="component-palette__tile-icon-svg" viewBox="0 0 24 24">
        <path d="M4 20V4M4 20h16M8 17v-5M12 17V7M16 17v-8" />
      </svg>
    )
  }
  return (
    <svg className="component-palette__tile-icon-svg" viewBox="0 0 24 24">
      <rect height="14" rx="2" width="16" x="4" y="5" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
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
  const [basicExpanded, setBasicExpanded] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const visiblePresets = registry.listPresets().filter((preset) => !preset.paletteHidden)
  const basicCategoryId = 'compose-component-palette-basic'

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
    setIsDragging(false)
    if (resetClickTimerRef.current !== null) clearTimeout(resetClickTimerRef.current)
    const startPoint = { x: event.clientX, y: event.clientY }
    let dragged = false
    interactionController.send({ type: 'external.begin', item, clientPoint: startPoint })
    const move = (pointerEvent: PointerEvent) => {
      const crossedThreshold = Math.hypot(
        pointerEvent.clientX - startPoint.x,
        pointerEvent.clientY - startPoint.y,
      ) >= 4
      if (!dragged && crossedThreshold) setIsDragging(true)
      dragged ||= crossedThreshold
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
      setIsDragging(false)
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
      setIsDragging(false)
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
  const previewPoint = isDragging ? state.external?.clientPoint : null
  const previewPresetId = state.external?.item.kind === 'preset'
    ? state.external.item.presetId
    : 'asset'

  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? messages.libraryContent}
      className={['component-palette', className].filter(Boolean).join(' ')}
      data-compose-theme={theme?.resolvedTheme}
      lang={resolvedLocale}
      role="region"
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      <section className="component-palette__category">
        <button
          aria-controls={basicCategoryId}
          aria-expanded={basicExpanded}
          className="component-palette__category-trigger"
          type="button"
          onClick={() => setBasicExpanded((expanded) => !expanded)}
        >
          <span aria-hidden="true" className="component-palette__category-chevron">
            <svg viewBox="0 0 12 12"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg>
          </span>
          <span>{messages.basicCategory(visiblePresets.length)}</span>
        </button>
        {basicExpanded ? (
          <ul
            aria-label={messages.basicCategoryItems}
            className="component-palette__grid"
            id={basicCategoryId}
          >
            {visiblePresets.map((preset) => (
              <li key={preset.id}>
                <button
                  aria-label={messages.add(preset.label)}
                  className="component-palette__tile"
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
                  <span aria-hidden="true" className="component-palette__tile-icon">
                    <PalettePresetIcon presetId={preset.id} />
                  </span>
                  <span className="component-palette__tile-label">{preset.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {previewPoint ? (
        <div
          className="component-palette__drag-preview"
          role="status"
          style={{
            left: `${previewPoint.x + 12}px`,
            top: `${previewPoint.y + 12}px`,
          }}
        >
          <span aria-hidden="true" className="component-palette__drag-preview-icon">
            <PalettePresetIcon presetId={previewPresetId} />
          </span>
          <span>{externalLabel}</span>
        </div>
      ) : null}
    </div>
  )
}
