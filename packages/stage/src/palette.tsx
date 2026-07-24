import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { HTMLAttributes, PointerEvent as ReactPointerEvent } from 'react'
import type { ComponentRegistry } from '@compose-ui/component-registry'
import type { StageDragController } from './drag-controller'

/**
 * ComponentPalette 属性。
 *
 * @public
 */
export interface ComponentPaletteProps extends HTMLAttributes<HTMLDivElement> {
  readonly registry: ComponentRegistry
  readonly dragController: StageDragController
}

/**
 * 按 registry 顺序显示可拖入或键盘新增的组件 definitions。
 *
 * @public
 */
export function ComponentPalette({
  registry,
  dragController,
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

  const start = (componentType: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    cleanupRef.current?.()
    suppressClickRef.current = true
    if (resetClickTimerRef.current !== null) clearTimeout(resetClickTimerRef.current)
    dragController.start(componentType, { x: event.clientX, y: event.clientY })
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
      aria-label={props['aria-label'] ?? '组件库'}
      className={['component-palette', className].filter(Boolean).join(' ')}
      role="region"
    >
      <ul>
        {registry.list().map((definition) => (
          <li key={definition.type}>
            <button
              aria-label={`添加${definition.label}`}
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
              onPointerDown={(event) => start(definition.type, event)}
            >
              {definition.icon}
              <span>{definition.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {state.active && state.componentType ? (
        <div className="component-palette__drag-preview" role="status">
          {registry.get(state.componentType)?.label ?? state.componentType}
        </div>
      ) : null}
    </div>
  )
}
