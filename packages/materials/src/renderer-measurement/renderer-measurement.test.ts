import type { ComposeEntity, ComposeRenderer } from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeRendererMeasurementAdapter } from '@compose-ui/component-registry'
import { createComposeBasicMaterials } from '../create-basic-materials'

const baseEntity: ComposeEntity = {
  id: 'measured',
  name: 'Measured',
  components: {
    Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'hug', value: 100, min: null, max: null },
      height: { mode: 'hug', value: 40, min: null, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'text', props: {} },
  },
}

const undefinedConstraint = { mode: 'undefined' as const }

function renderer(type: string, props: ComposeRenderer['props']): ComposeRenderer {
  return { type, props }
}

function definition(type: string) {
  const found = createComposeBasicMaterials().registry.getRenderer(type)?.measurement
  if (!found) throw new Error(`${type} measurement missing`)
  return found
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenSpec: basic-materials / built-in Hug measurement', () => {
  it('Rectangle 等无 intrinsic size 的叶子发布 fallback 诊断', () => {
    const registry = createComposeBasicMaterials().registry
    const adapter = createComposeRendererMeasurementAdapter({ registry })
    const rectangle = {
      ...baseEntity,
      components: {
        ...baseEntity.components,
        Renderer: { type: 'rectangle', props: {} },
      },
    }

    expect(adapter.measure({
      entity: rectangle,
      width: undefinedConstraint,
      height: undefinedConstraint,
    })).toBeNull()
    expect(adapter.getDiagnostic?.(rectangle.id)?.code).toBe('measurement.unregistered')
    adapter.dispose()
  })

  it('Text 使用隔离 host、AtMost 换行约束并返回 baseline', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 180,
      height: 48,
      x: 0,
      y: 0,
      top: 0,
      right: 180,
      bottom: 48,
      left: 0,
      toJSON: () => ({}),
    })
    const measured = definition('text').measure({
      entity: baseEntity,
      renderer: renderer('text', { text: 'long text', fontSize: 20 }),
      props: { text: 'long text', fontSize: 20 },
      authoredProps: { text: 'long text', fontSize: 20 },
      prepared: undefined,
      width: { mode: 'at-most', value: 120 },
      height: undefinedConstraint,
    })

    expect(measured).toEqual({ width: 120, height: 48, baseline: 16 })
    expect(document.querySelector('[data-compose-measurement-host]')).toBeNull()
    rect.mockRestore()
  })

  it('OpenSpec: 内建 Text 物料 / 空内容仍量出行高而不是无效尺寸', () => {
    // 点击创建的文字以空内容进入编辑；若测量返回 null，Stage 会报「返回了无效内容尺寸」
    // 并且 Hug 拿不到高度，光标无处落脚。
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 0,
      height: 16,
      x: 0,
      y: 0,
      top: 0,
      right: 0,
      bottom: 16,
      left: 0,
      toJSON: () => ({}),
    })
    const measured = definition('text').measure({
      entity: baseEntity,
      renderer: renderer('text', { text: '', fontSize: 12 }),
      props: { text: '', fontSize: 12 },
      authoredProps: { text: '', fontSize: 12 },
      prepared: undefined,
      width: undefinedConstraint,
      height: undefinedConstraint,
    })

    expect(measured).not.toBeNull()
    expect(measured?.height).toBe(16)
    // 留出光标宽度，编辑边框才可见、空文字也仍可被指针命中。
    expect(measured?.width).toBeGreaterThan(0)
    expect(document.querySelector('[data-compose-measurement-host]')).toBeNull()
    rect.mockRestore()
  })

  it('OpenSpec: basic-materials / Figma 基线的 Text 默认值与排版 / 编辑文字排版', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 30,
      height: 16,
      x: 0,
      y: 0,
      top: 0,
      right: 30,
      bottom: 16,
      left: 0,
      toJSON: () => ({}),
    })
    const append = vi.spyOn(document.body, 'append')
    const measured = definition('text').measure({
      entity: baseEntity,
      renderer: renderer('text', {
        text: 'Text',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 12,
        textCase: 'uppercase',
      }),
      props: {
        text: 'Text',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 12,
        textCase: 'uppercase',
      },
      authoredProps: {},
      prepared: undefined,
      width: undefinedConstraint,
      height: undefinedConstraint,
    })

    expect(measured).toMatchObject({ width: 30, height: 16 })
    expect(measured?.baseline).toBeCloseTo(9.6)
    const host = append.mock.calls[0]?.[0] as HTMLElement
    expect(host.style.textTransform).toBe('uppercase')
    expect(host.style.fontSize).toBe('12px')
    append.mockRestore()
    rect.mockRestore()
  })

  it('Image 使用 resolved revision 的自然尺寸并保持宽高比', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 640, height: 320, close })))
    const resolve = vi.fn(async () => ({
      blob: new Blob(['image']),
      mediaType: 'image/png',
      revision: 'r2',
    }))
    const measurement = definition('image')
    const imageRenderer = renderer('image', {
      asset: { providerId: 'memory', assetKey: 'hero', scope: 'persistent' },
    })
    const prepared = await measurement.prepare?.({
      entity: baseEntity,
      renderer: imageRenderer,
      props: imageRenderer.props,
      authoredProps: imageRenderer.props,
      assetResolver: { resolve },
      signal: new AbortController().signal,
    })

    expect(prepared).toEqual({ width: 640, height: 320, revision: 'r2' })
    expect(measurement.measure({
      entity: baseEntity,
      renderer: imageRenderer,
      props: imageRenderer.props,
      authoredProps: imageRenderer.props,
      prepared,
      width: { mode: 'at-most', value: 320 },
      height: undefinedConstraint,
    })).toEqual({ width: 320, height: 160 })
    expect(close).toHaveBeenCalledOnce()
  })

  it('SVG 解析 viewBox 并订阅 revision', async () => {
    const svg = definition('svg')
    const svgRenderer = renderer('svg', {
      asset: { providerId: 'memory', assetKey: 'logo', scope: 'persistent' },
    })
    const svgPrepared = await svg.prepare?.({
      entity: baseEntity,
      renderer: svgRenderer,
      props: svgRenderer.props,
      authoredProps: svgRenderer.props,
      assetResolver: {
        resolve: async () => ({
          blob: new Blob(['<svg viewBox="0 0 200 80"></svg>']),
          mediaType: 'image/svg+xml',
          revision: 'svg-3',
        }),
      },
      signal: new AbortController().signal,
    })
    expect(svgPrepared).toEqual({ width: 200, height: 80, revision: 'svg-3' })

  })
})
