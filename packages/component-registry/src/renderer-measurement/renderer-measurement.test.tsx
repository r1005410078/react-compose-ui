import type { ComposeEntity } from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import { createComposeEntityRegistry } from '../registry'
import { createComposeRendererMeasurementAdapter } from './renderer-measurement'

function Renderer() {
  return null
}

function entity(text = 'Hello'): ComposeEntity {
  return {
    id: 'text-1',
    name: 'Text',
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'hug', value: 100, min: null, max: null },
        height: { mode: 'hug', value: 30, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'host-text', props: { text } },
    },
  }
}

const constraints = {
  width: { mode: 'at-most' as const, value: 200 },
  height: { mode: 'undefined' as const },
}

describe('OpenSpec: component-registry / Renderer measurement adapter', () => {
  it('Registry 在初始化时拒绝不完整 measurement definition', () => {
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'broken',
        label: 'Broken',
        renderer: Renderer,
        measurement: { measure: null } as never,
      }],
    })).toThrow(/measurement\.measure/)
  })

  it('把 Exactly/AtMost/Undefined 原样交给同步 measurer 并隔离 definition', () => {
    const measure = vi.fn(() => ({ width: 120, height: 24, baseline: 18 }))
    const source = {
      type: 'host-text',
      label: 'Host text',
      renderer: Renderer,
      measurement: { measure },
    }
    const registry = createComposeEntityRegistry({ renderers: [source] })
    const adapter = createComposeRendererMeasurementAdapter({ registry })

    expect(adapter.measure({ entity: entity(), ...constraints })).toEqual({
      width: 120,
      height: 24,
      baseline: 18,
    })
    expect(measure).toHaveBeenCalledWith(expect.objectContaining(constraints))
    expect(registry.getRenderer('host-text')?.measurement).not.toBe(source.measurement)
    expect(Object.isFrozen(registry.getRenderer('host-text')?.measurement)).toBe(true)
    adapter.dispose()
  })

  it('prepare 期间返回诊断，完成后只通知对应 Entity 并丢弃迟到结果', async () => {
    const pending: Array<(value: { width: number; height: number }) => void> = []
    let invalidate: (() => void) | undefined
    const unsubscribe = vi.fn()
    const registry = createComposeEntityRegistry({
      renderers: [{
        type: 'host-text',
        label: 'Host text',
        renderer: Renderer,
        measurement: {
          prepare: ({ signal }) => new Promise<{ width: number; height: number }>((resolve, reject) => {
            pending.push(resolve)
            signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
          measure: ({ prepared }) => prepared as { width: number; height: number },
          subscribe: (input) => {
            invalidate = input.invalidate
            return unsubscribe
          },
        },
      }],
    })
    const adapter = createComposeRendererMeasurementAdapter({ registry })
    const listener = vi.fn()
    adapter.subscribe(listener)

    expect(adapter.measure({ entity: entity(), ...constraints })).toBeNull()
    expect(adapter.getDiagnostic?.('text-1')?.code).toBe('measurement.preparing')
    await Promise.resolve()
    invalidate?.()
    expect(listener).toHaveBeenLastCalledWith(['text-1'])
    expect(adapter.measure({ entity: entity(), ...constraints })).toBeNull()
    await Promise.resolve()

    pending[0]?.({ width: 999, height: 999 })
    pending[1]?.({ width: 88, height: 22 })
    await vi.waitFor(() => {
      expect(adapter.getDiagnostic?.('text-1')).toBeUndefined()
    })

    expect(adapter.measure({ entity: entity(), ...constraints })).toEqual({ width: 88, height: 22 })
    expect(adapter.getDiagnostic?.('text-1')).toBeUndefined()
    adapter.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('隔离抛错和非法 baseline，并在输入 revision 后恢复', () => {
    let fail = true
    const registry = createComposeEntityRegistry({
      renderers: [{
        type: 'host-text',
        label: 'Host text',
        renderer: Renderer,
        measurement: {
          measure: () => {
            if (fail) throw new Error('boom')
            return { width: 40, height: 20, baseline: 30 }
          },
        },
      }],
    })
    const adapter = createComposeRendererMeasurementAdapter({ registry })

    expect(adapter.measure({ entity: entity(), ...constraints })).toBeNull()
    expect(adapter.getDiagnostic?.('text-1')?.code).toBe('measurement.failed')
    fail = false
    expect(adapter.measure({ entity: entity('changed'), ...constraints })).toBeNull()
    expect(adapter.getDiagnostic?.('text-1')?.code).toBe('measurement.invalid')
    adapter.dispose()
  })
})
