import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createEmptyComposePageFile,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { ComposeLayoutRuntime } from '@compose-ui/layout-engine'
import type { ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import { ComposePreview as ComposePreviewBase } from '../index'

afterEach(cleanup)

function entity(
  id: string,
  components: ComposeEntity['components'],
  name = id,
): ComposeEntity {
  const sourceTransform = components.Transform as {
    position?: { x: number; y: number }
    size?: { width: number; height: number }
    rotation?: number
  } | undefined
  const position = sourceTransform?.position ?? { x: 0, y: 0 }
  const size = sourceTransform?.size ?? { width: 100, height: 100 }
  return {
    id,
    name,
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: Object.keys(components),
        capabilityIds: [],
      },
      LayoutItem: {
        positioning: 'absolute',
        offset: position,
        width: { mode: 'fixed', value: size.width, min: 1, max: null },
        height: { mode: 'fixed', value: size.height, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
      Transform: { rotation: sourceTransform?.rotation ?? 0 },
    },
  }
}

function document(): ComposeDocument {
  const entities: Record<string, ComposeEntity> = {
    desktop: entity('desktop', {
      Transform: {
        position: { x: -500, y: 200 },
        size: { width: 800, height: 600 },
        rotation: 0,
      },
      Hierarchy: { childIds: ['group', 'hidden', 'unknown'] },
      Clip: { enabled: true },
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#fef3c7' },
        borderColor: '#92400e',
        borderWidth: 2,
        borderRadius: 10,
        opacity: 0.95,
        shadow: {
          color: '#000000',
          offsetX: 1,
          offsetY: 3,
          blur: 5,
          spread: 0,
        },
      },
      Renderer: { type: 'surface', props: { text: 'Desktop surface' } },
    }, 'Desktop'),
    group: entity('group', {
      Transform: {
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 },
        rotation: 15,
      },
      Hierarchy: { childIds: ['text'] },
      Clip: { enabled: false },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#ddeeff' }, borderRadius: 6 },
    }, 'Nested Container'),
    text: entity('text', {
      Transform: {
        position: { x: 20, y: 30 },
        size: { width: 120, height: 50 },
        rotation: -5,
      },
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#ffffff' },
        borderColor: '#172033',
        borderWidth: 1,
        opacity: 0.8,
      },
      Renderer: { type: 'text', props: { text: 'Desktop text' } },
    }, 'Text'),
    hidden: entity('hidden', {
      Visibility: { visible: false },
      Renderer: { type: 'text', props: { text: 'Hidden text' } },
    }, 'Hidden'),
    unknown: entity('unknown', {
      Renderer: { type: 'missing', props: {} },
    }, 'Unknown'),
    mobile: entity('mobile', {
      Transform: {
        position: { x: 600, y: 200 },
        size: { width: 390, height: 844 },
        rotation: 0,
      },
      Hierarchy: { childIds: ['mobile-text'] },
      Clip: { enabled: true },
    }, 'Mobile'),
    'mobile-text': entity('mobile-text', {
      Renderer: { type: 'text', props: { text: 'Mobile text' } },
    }, 'Mobile Text'),
  }
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: {
      ...createDefaultOutputSettings(),
      width: 1440,
      height: 900,
      backgroundPaint: { kind: 'solid', color: '#eef2ff' },
    },
    rootIds: ['desktop', 'mobile'],
    entities,
  }
}

function snapshot(value: ComposeDocument): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.values(value.entities).map((item) => {
      const layoutItem = item.components.LayoutItem as unknown as {
        positioning: 'absolute' | 'flow'
        offset: { x: number; y: number }
        width: { value: number }
        height: { value: number }
      }
      return [item.id, {
        x: layoutItem.offset.x,
        y: layoutItem.offset.y,
        width: layoutItem.width.value,
        height: layoutItem.height.value,
        positioning: layoutItem.positioning,
      }]
    })),
    diagnostics: [],
  }
}

function ComposePreview(props: ComponentProps<typeof ComposePreviewBase>) {
  const source = props.document ?? props.page?.document
  if (!source) throw new Error('test preview requires a document or page')
  return <ComposePreviewBase {...props} layoutSnapshot={snapshot(source)} />
}

function registry() {
  return createComposeEntityRegistry({
    renderers: [
      {
        type: 'text',
        label: '文本',
        renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
      },
      {
        type: 'surface',
        label: '表面',
        renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
      },
    ],
  })
}

describe('ComposePreview', () => {
  it('OpenSpec: hug-content-layout / Preview 独立解析 Hug / 异步 Runtime 使用 Registry measurement', async () => {
    const base = document()
    const text = base.entities.text!
    const value: ComposeDocument = {
      ...base,
      rootIds: ['text'],
      entities: {
        text: {
          ...text,
          components: {
            ...text.components,
            LayoutItem: {
              ...(text.components.LayoutItem as object),
              positioning: 'absolute',
              width: { mode: 'hug', value: 120, min: null, max: null },
              height: { mode: 'hug', value: 50, min: null, max: null },
            },
          },
        },
      },
    }
    const measuredRegistry = createComposeEntityRegistry({
      renderers: [{
        type: 'text',
        label: '文本',
        renderer: ({ props }) => <span>{String(props.text)}</span>,
        measurement: { measure: () => ({ width: 60, height: 24, baseline: 18 }) },
      }],
    })
    render(<ComposePreviewBase document={value} registry={measuredRegistry} />)

    await waitFor(() => {
      expect(screen.getByTestId('compose-preview-entity-text')).toHaveStyle({
        width: '62px',
        height: '26px',
      })
    })
    expect(screen.queryByTestId('compose-preview-layout-diagnostics')).not.toBeInTheDocument()
  })

  it('OpenSpec: hug-content-layout / Preview 独立测量 / 注入 Runtime 时挂接 adapter 但不释放宿主 Runtime', () => {
    const value = document()
    const setMeasurementPort = vi.fn()
    const dispose = vi.fn()
    const layoutState = { status: 'ready' as const, document: value, snapshot: snapshot(value) }
    const runtime: ComposeLayoutRuntime = {
      getState: () => layoutState,
      updateDocument: vi.fn(),
      setMeasurementPort,
      subscribe: () => () => undefined,
      dispose,
    }
    const view = render(
      <ComposePreviewBase document={value} layoutRuntime={runtime} registry={registry()} />,
    )

    expect(setMeasurementPort).toHaveBeenCalledWith(expect.objectContaining({
      measure: expect.any(Function),
    }))
    view.unmount()
    expect(setMeasurementPort).toHaveBeenLastCalledWith(undefined)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('OpenSpec: replace-nodes-with-ecs-entities / Renderer 与 Hierarchy 可组合', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    expect(screen.getByText('preview:Desktop surface')).toBeInTheDocument()
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
  })

  it('OpenSpec: replace-nodes-with-ecs-entities / Preview 资源解析', () => {
    const assetResolver = { resolve: vi.fn() }
    const assetRegistry = createComposeEntityRegistry({
      renderers: [{
        type: 'text',
        label: '文本',
        renderer: ({ assetResolver: received }) => (
          <span>{received === assetResolver ? 'resolver connected' : 'resolver missing'}</span>
        ),
      }],
    })
    render(
      <ComposePreview
        assetResolver={assetResolver}
        document={document()}
        registry={assetRegistry}
        target={{ kind: 'container', entityId: 'group' }}
      />,
    )

    expect(screen.getByText('resolver connected')).toBeInTheDocument()
  })

  it('保留标准 section 属性', () => {
    const click = vi.fn()
    render(
      <ComposePreview
        aria-label="Document preview"
        className="host-preview"
        document={document()}
        onClick={click}
        registry={registry()}
      />,
    )

    const preview = screen.getByRole('region', { name: 'Document preview' })
    expect(preview).toHaveClass('host-preview')
    fireEvent.click(preview)
    expect(click).toHaveBeenCalledOnce()
  })

  it('预览指定 Container 并应用嵌套局部变换', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    const container = screen.getByTestId('compose-preview-container')
    expect(container).toHaveStyle({ width: '800px', height: '600px', overflow: 'hidden' })
    expect(container).not.toHaveStyle({ left: '-500px', top: '200px' })
    expect(screen.getByTestId('compose-preview-entity-group')).toHaveStyle({
      left: '100px',
      top: '80px',
      transform: 'rotate(15deg)',
      overflow: 'visible',
    })
    expect(screen.getByTestId('compose-preview-entity-text')).toHaveStyle({
      left: '20px',
      top: '30px',
      transform: 'rotate(-5deg)',
    })
    expect(screen.queryByText('Hidden text')).not.toBeInTheDocument()
    expect(screen.queryByText('Mobile text')).not.toBeInTheDocument()
  })

  it('OpenSpec: basic-materials / Preview 暂时忽略 Layout 并保留子项 Transform', () => {
    const value = document()
    const desktop = value.entities.desktop!
    const layoutDocument: ComposeDocument = {
      ...value,
      entities: {
        ...value.entities,
        desktop: {
          ...desktop,
          components: {
            ...desktop.components,
            Composition: {
              ...desktop.components.Composition!,
              baseComponentKeys: [
                ...(desktop.components.Composition!.baseComponentKeys as readonly string[]),
                'Layout',
              ],
            },
            Layout: {
              type: 'flex',
              flexDirection: 'column',
              flexWrap: 'wrap',
              alignContent: 'center',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              rowGap: 24,
              columnGap: 24,
            },
          },
        },
      },
    }
    render(
      <ComposePreview
        document={layoutDocument}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    expect(screen.getByTestId('compose-preview-container').style.display).toBe('')
    expect(screen.getByTestId('compose-preview-entity-group')).toHaveStyle({
      position: 'absolute',
      left: '100px',
      top: '80px',
    })
  })

  it('按 Appearance 与 Clip 渲染外观', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    const container = screen.getByTestId('compose-preview-container')
    expect(container).toHaveStyle({
      borderRadius: '10px',
      opacity: '0.95',
    })
    expect(container.lastElementChild).toHaveAttribute('data-compose-entity-border')
    expect(container.lastElementChild).toHaveStyle({ border: '2px solid #92400e' })
    expect(container.style.boxShadow).toContain('1px 3px 5px 0px #000000')
  })

  it('OpenSpec: Preview 原生 Container 滚动 / 映射分轴 overflow 且重挂载不保存位置', () => {
    const value = document()
    const desktop = value.entities.desktop!
    const scrolling: ComposeDocument = {
      ...value,
      entities: {
        ...value.entities,
        desktop: {
          ...desktop,
          components: {
            ...desktop.components,
            Clip: { enabled: true, horizontal: 'clip', vertical: 'scroll' },
          },
        },
      },
    }
    const view = render(
      <ComposePreview
        document={scrolling}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )
    const container = screen.getByTestId('compose-preview-container')
    expect(container).toHaveStyle({ overflowX: 'hidden', overflowY: 'auto' })
    container.scrollTop = 42
    view.unmount()
    render(
      <ComposePreview
        document={scrolling}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )
    expect(screen.getByTestId('compose-preview-container').scrollTop).toBe(0)
  })

  it('滚动内容尺寸包含 Auto Layout 的底部和右侧内边距', () => {
    const value = document()
    const desktop = value.entities.desktop!
    const group = value.entities.group!
    const padded: ComposeDocument = {
      ...value,
      entities: {
        ...value.entities,
        desktop: {
          ...desktop,
          components: {
            ...desktop.components,
            LayoutItem: {
              ...desktop.components.LayoutItem!,
              height: { mode: 'fixed', value: 200, min: 1, max: null },
            },
            Layout: {
              type: 'flex',
              flexDirection: 'column',
              flexWrap: 'nowrap',
              alignContent: 'stretch',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              padding: { top: 40, right: 40, bottom: 40, left: 40 },
              rowGap: 0,
              columnGap: 0,
            },
            Clip: { enabled: true, horizontal: 'clip', vertical: 'scroll' },
          },
        },
        group: {
          ...group,
          components: {
            ...group.components,
            LayoutItem: {
              ...group.components.LayoutItem!,
              offset: { x: 100, y: 80 },
              width: { mode: 'fixed', value: 700, min: 1, max: null },
              height: { mode: 'fixed', value: 200, min: 1, max: null },
            },
          },
        },
      },
    }

    render(
      <ComposePreview
        document={padded}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    expect(screen.getByTestId('compose-preview-content-extent-desktop')).toHaveStyle({
      width: '842px',
      height: '322px',
    })
  })

  it('未知 Renderer 降级且不影响其他 Entity', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )
    expect(screen.getByRole('status', { name: /missing/ })).toBeInTheDocument()
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
  })

  it('拒绝不存在或没有 Hierarchy 的 target', () => {
    const view = render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'missing-container' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('missing-container')

    view.rerender(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'text' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('text')
  })

  it('预览完整文档并忽略画布编辑元数据', () => {
    render(<ComposePreview document={document()} registry={registry()} />)

    expect(screen.getByTestId('compose-preview-document')).toHaveStyle({
      width: '1440px',
      height: '900px',
      overflow: 'hidden',
    })
    expect(screen.getByTestId('compose-preview-output-paint')).toHaveAttribute('data-compose-paint', 'solid')
    expect(screen.getByTestId('compose-preview-entity-desktop')).toHaveStyle({
      left: '-500px',
      top: '200px',
    })
    expect(screen.getByText('preview:Mobile text')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-ruler-x')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Stage 编辑覆盖层')).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview 输出背景 Paint / 预览渐变输出背景', () => {
    const value = document()
    render(
      <ComposePreview
        document={{
          ...value,
          output: {
            ...value.output,
            backgroundPaint: {
              kind: 'angular-gradient',
              center: { x: 0.5, y: 0.5 },
              angle: 45,
              stops: [
                { id: 'start', position: 0, color: '#0cdeab' },
                { id: 'end', position: 1, color: '#06785c' },
              ],
            },
          },
        }}
        registry={registry()}
      />,
    )

    expect(screen.getByTestId('compose-preview-output-paint')).toHaveAttribute('data-compose-paint', 'angular-gradient')
  })

  it('OpenSpec: compose-preview / Preview 页面 setup 运行 / 点击方法更新绑定值且实例隔离', async () => {
    const text = entity('count', {
      Renderer: { type: 'counter-text', props: { text: 'fallback' } },
      Bindings: { version: 1, props: { text: { scope: 'page', exportName: 'num' } } },
    })
    const button = entity('add', {
      Transform: { position: { x: 0, y: 120 }, size: { width: 100, height: 40 }, rotation: 0 },
      Renderer: { type: 'counter-button', props: { label: 'Add' } },
      Bindings: { version: 1, props: { onClick: { scope: 'page', exportName: 'onAdd' } } },
    })
    const value: ComposeDocument = {
      ...document(),
      rootIds: ['count', 'add'],
      entities: { count: text, add: button },
    }
    const page = {
      ...createEmptyComposePageFile(),
      document: value,
      setupScript: {
        providerId: 'memory',
        assetKey: 'counter.setup.js',
        scope: 'persistent' as const,
      },
    }
    const loader: ComposeScriptModuleLoader = {
      load: async () => ({
        revision: '1',
        module: {
          setup: (ctx: import('@compose-ui/script-runtime').ComposePageScriptContext) => {
            const num = ctx.state(0)
            return { num, onAdd: () => { num.value += 1 } }
          },
        },
      }),
    }
    const boundRegistry = createComposeEntityRegistry({
      renderers: [
        {
          type: 'counter-text',
          label: 'Counter text',
          renderer: ({ props }) => <output>{String(props.text)}</output>,
          propContracts: [{
            name: 'text',
            kind: 'value',
            label: 'Text',
            validate: (candidate) => typeof candidate === 'number' || 'number required',
          }],
        },
        {
          type: 'counter-button',
          label: 'Counter button',
          renderer: ({ props }) => (
            <button
              type="button"
              onClick={typeof props.onClick === 'function'
                ? props.onClick as () => void
                : undefined}
            >
              {String(props.label)}
            </button>
          ),
          propContracts: [{
            name: 'onClick',
            kind: 'method',
            label: 'Click',
            role: 'event-handler',
          }],
        },
      ],
    })

    render(
      <div>
        <ComposePreview page={page} registry={boundRegistry} scriptModuleLoader={loader} />
        <ComposePreview page={page} registry={boundRegistry} scriptModuleLoader={loader} />
      </div>,
    )
    await waitFor(() => {
      expect(screen.getAllByText('0')).toHaveLength(2)
    })
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]!)
      // State 更新经 runtime microtask scheduler 刷新，再由 Renderer 订阅触发 React 更新。
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(screen.getAllByText('1')).toHaveLength(1)
      expect(screen.getAllByText('0')).toHaveLength(1)
    })
  })
})
