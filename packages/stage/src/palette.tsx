import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { HTMLAttributes, PointerEvent as ReactPointerEvent } from 'react'
import type { ComponentRegistry } from '@compose-ui/component-registry'
import type {
  StageDragController,
  StageFramePreset,
} from './drag-controller'

/**
 * ComponentPalette 属性。
 *
 * @public
 */
export interface ComponentPaletteProps extends HTMLAttributes<HTMLDivElement> {
  readonly registry: ComponentRegistry
  readonly dragController: StageDragController
  /** 显示在 registry definitions 之前的根级 Frame 预设。 */
  readonly framePresets?: readonly StageFramePreset[]
}

/**
 * 按 registry 顺序显示可拖入或键盘新增的组件 definitions。
 *
 * @public
 */
export function ComponentPalette({
  registry,
  dragController,
  framePresets = [],
  className,
  ...props
}: ComponentPaletteProps) {
  const state = useSyncExternalStore(
    dragController.subscribe,
    dragController.getState,
    dragController.getState,
  )
  const cleanupRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)
  const resetClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    cleanupRef.current?.()
    if (resetClickTimerRef.current !== null) clearTimeout(resetClickTimerRef.current)
  }, [])

  const start = (
    begin: (clientPoint: { x: number; y: number }) => void,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    cleanupRef.current?.()
    suppressClickRef.current = true
    if (resetClickTimerRef.current !== null) clearTimeout(resetClickTimerRef.current)
    begin({ x: event.clientX, y: event.clientY })
    const move = (pointerEvent: PointerEvent) => {
      dragController.move({ x: pointerEvent.clientX, y: pointerEvent.clientY })
    }
    const release = (pointerEvent: PointerEvent) => {
      cleanup()
      dragController.end({ x: pointerEvent.clientX, y: pointerEvent.clientY })
      // Pointer 完成后浏览器可能继续派发 click；延迟复位可避免同一意图再走键盘新增路径。
      resetClickTimerRef.current = setTimeout(() => {
        suppressClickRef.current = false
        resetClickTimerRef.current = null
      }, 0)
    }
    const cancel = () => {
      cleanup()
      suppressClickRef.current = false
      dragController.cancel()
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

  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? 'Component Library'}
      className={['component-palette', className].filter(Boolean).join(' ')}
      role="region"
    >
      <ul>
        {framePresets.map((preset) => (
          <li key={`frame:${preset.id}`}>
            <button
              aria-label={`Add ${preset.label}`}
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
                dragController.addFrame(preset)
              }}
              onPointerDown={(event) => start(
                (point) => dragController.startFrame(preset, point),
                event,
              )}
            >
              {preset.icon}
              <span>{preset.label}</span>
            </button>
          </li>
        ))}
        {registry.list().map((definition) => (
          <li key={definition.type}>
            <button
              aria-label={`Add ${definition.label}`}
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
                dragController.add(definition.type)
              }}
              onPointerDown={(event) => start(
                (point) => dragController.start(definition.type, point),
                event,
              )}
            >
              {definition.icon}
              <span>{definition.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {state.active && (state.componentType || state.framePreset) ? (
        <div className="component-palette__drag-preview" role="status">
          {state.framePreset?.label
            ?? (state.componentType
              ? registry.get(state.componentType)?.label ?? state.componentType
              : null)}
        </div>
      ) : null}
    </div>
  )
}
