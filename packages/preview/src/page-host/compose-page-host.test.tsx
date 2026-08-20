import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  createEmptyComposePageFile,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeNavigationPort,
  type ComposeNavigationSnapshot,
  type ComposePageFile,
  type ComposePageLoader,
  type ComposePageReference,
} from '@compose-ui/core'
import type { ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposePageHost } from './compose-page-host'

afterEach(cleanup)

const PROVIDER_ID = 'memory'

function reference(assetKey: string): ComposePageReference {
  return { kind: 'page', providerId: PROVIDER_ID, assetKey, scope: 'persistent' }
}

function leaf(id: string, components: ComposeEntity['components']): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 40, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

function documentOf(
  entities: Record<string, ComposeEntity>,
  frames: readonly { readonly id: string; readonly childIds: readonly string[] }[],
): ComposeDocument {
  const frameEntities = Object.fromEntries(frames.map((frame) => [
    frame.id,
    createComposeFrameEntity({
      id: frame.id,
      childIds: frame.childIds,
      size: { width: 400, height: 300 },
    }),
  ]))
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: frames.map((frame) => frame.id),
    entities: { ...entities, ...frameEntities },
  }
}

/** 最小导航端口：语义与 `@compose-ui/pages` 的会话一致，但不引入跨包依赖。 */
function testNavigation(initialPageKey: string, available: Iterable<string>) {
  const keys = new Set(available)
  const listeners = new Set<() => void>()
  let current: ComposePageReference | null = reference(initialPageKey)
  let backStack: ComposePageReference[] = []
  let issue: ComposeNavigationSnapshot['issue'] = null
  let snapshot: ComposeNavigationSnapshot = {
    currentPageKey: current.assetKey,
    current,
    canGoBack: false,
    issue: null,
  }
  const publish = () => {
    snapshot = {
      currentPageKey: current?.assetKey ?? null,
      current,
      canGoBack: backStack.length > 0,
      issue,
    }
    listeners.forEach((listener) => { listener() })
  }
  const port: ComposeNavigationPort = {
    getSnapshot: () => snapshot,
    referenceFor: reference,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async navigate(target) {
      if (!keys.has(target.assetKey)) {
        issue = {
          code: 'navigation.target-missing',
          reference: target,
          message: `找不到页面 ${target.assetKey}`,
        }
        publish()
        return
      }
      if (current) backStack = [...backStack, current]
      current = target
      issue = null
      publish()
    },
    async back() {
      const previous = backStack.pop()
      if (!previous) return
      current = previous
      issue = null
      publish()
    },
  }
  return port
}

function loaderOf(pages: Record<string, ComposePageFile>): ComposePageLoader {
  return {
    async load(target) {
      const page = pages[target.assetKey]
      if (!page) throw new Error(`缺少页面 ${target.assetKey}`)
      return page
    },
  }
}

function registry() {
  return createComposeEntityRegistry({
    renderers: [
      {
        type: 'label',
        label: 'Label',
        renderer: ({ props }) => <span>{String(props.text)}</span>,
      },
      {
        type: 'action',
        label: 'Action',
        renderer: ({ props }) => (
          <button
            type="button"
            onClick={typeof props.onClick === 'function' ? props.onClick as () => void : undefined}
          >
            {String(props.label)}
          </button>
        ),
        propContracts: [
          {
            name: 'label',
            kind: 'value',
            label: 'Label',
            affectsMeasurement: false,
            validate: (value) => typeof value === 'string' || 'string required',
          },
          { name: 'onClick', kind: 'method', label: 'Click', role: 'event-handler' },
        ],
      },
    ],
  })
}

function pageWith(document: ComposeDocument, activeFrameId: string): ComposePageFile {
  return { ...createEmptyComposePageFile(), document, activeFrameId }
}

/** 首页含一个可点击跳转的 Entity；详情页只有一段文本。 */
function twoPageFixture() {
  const home = pageWith(
    documentOf(
      {
        cta: leaf('cta', {
          Renderer: { type: 'label', props: { text: 'Go to detail' } },
          Interaction: {
            version: 1,
            triggers: [{ event: 'click', action: { type: 'navigate', target: reference('detail') } }],
          },
        }),
      },
      [{ id: 'home-frame', childIds: ['cta'] }],
    ),
    'home-frame',
  )
  const detail = pageWith(
    documentOf(
      { headline: leaf('headline', { Renderer: { type: 'label', props: { text: 'Detail page' } } }) },
      [{ id: 'detail-frame', childIds: ['headline'] }],
    ),
    'detail-frame',
  )
  return { home, detail }
}

describe('OpenSpec: 页面宿主与跳转执行', () => {
  it('点击跳转到另一个页面', async () => {
    const { home, detail } = twoPageFixture()
    const navigation = testNavigation('home', ['home', 'detail'])
    render(
      <ComposePageHost
        navigation={navigation}
        pageLoader={loaderOf({ home, detail })}
        registry={registry()}
      />,
    )

    const cta = await screen.findByRole('button', { name: 'cta' })
    await act(async () => { fireEvent.click(cta) })
    await waitFor(() => { expect(screen.getByText('Detail page')).toBeTruthy() })
    expect(screen.queryByText('Go to detail')).toBeNull()
  })

  it('切页释放上一页的 setup scope', async () => {
    const cleanupSpy = vi.fn()
    const { detail } = twoPageFixture()
    const home = pageWith(
      documentOf(
        {
          cta: leaf('cta', {
            Renderer: { type: 'label', props: { text: 'Go to detail' } },
            Interaction: {
              version: 1,
              triggers: [{ event: 'click', action: { type: 'navigate', target: reference('detail') } }],
            },
          }),
        },
        [{ id: 'home-frame', childIds: ['cta'] }],
      ),
      'home-frame',
    )
    const homeWithScript: ComposePageFile = {
      ...home,
      setupScript: { providerId: PROVIDER_ID, assetKey: 'home.setup.js', scope: 'persistent' },
    }
    const scriptModuleLoader: ComposeScriptModuleLoader = {
      load: async () => ({
        revision: '1',
        module: {
          setup: (ctx: import('@compose-ui/script-runtime').ComposePageScriptContext) => {
            ctx.effect(() => cleanupSpy)
            return { ready: true }
          },
        },
      }),
    }

    const navigation = testNavigation('home', ['home', 'detail'])
    render(
      <ComposePageHost
        navigation={navigation}
        pageLoader={loaderOf({ home: homeWithScript, detail })}
        registry={registry()}
        scriptModuleLoader={scriptModuleLoader}
      />,
    )

    const cta = await screen.findByRole('button', { name: 'cta' })
    await waitFor(() => { expect(cleanupSpy).not.toHaveBeenCalled() })
    await act(async () => { fireEvent.click(cta) })
    await waitFor(() => { expect(screen.getByText('Detail page')).toBeTruthy() })
    // effect cleanup 只在 scope.dispose() 时执行，因此它被调用即证明旧作用域已释放。
    await waitFor(() => { expect(cleanupSpy).toHaveBeenCalled() })
  })

  it('只渲染激活场景', async () => {
    const detail = pageWith(
      documentOf(
        {
          first: leaf('first', { Renderer: { type: 'label', props: { text: 'First frame' } } }),
          second: leaf('second', { Renderer: { type: 'label', props: { text: 'Second frame' } } }),
          third: leaf('third', { Renderer: { type: 'label', props: { text: 'Third frame' } } }),
        },
        [
          { id: 'frame-a', childIds: ['first'] },
          { id: 'frame-b', childIds: ['second'] },
          { id: 'frame-c', childIds: ['third'] },
        ],
      ),
      'frame-b',
    )
    render(
      <ComposePageHost
        navigation={testNavigation('detail', ['detail'])}
        pageLoader={loaderOf({ detail })}
        registry={registry()}
      />,
    )

    await waitFor(() => { expect(screen.getByText('Second frame')).toBeTruthy() })
    expect(screen.queryByText('First frame')).toBeNull()
    expect(screen.queryByText('Third frame')).toBeNull()
  })

  it('不抢走物料自身交互', async () => {
    const onAdd = vi.fn()
    const home = pageWith(
      documentOf(
        {
          card: {
            ...leaf('card', {
              Hierarchy: { childIds: ['action'] },
              Interaction: {
                version: 1,
                triggers: [{
                  event: 'click',
                  action: { type: 'navigate', target: reference('detail') },
                }],
              },
            }),
            name: 'Card',
          },
          action: leaf('action', {
            Renderer: { type: 'action', props: { label: 'Add' } },
            Bindings: { version: 1, rendererProps: { fields: { onClick: { scope: 'page', exportName: 'onAdd' } } } },
          }),
        },
        [{ id: 'home-frame', childIds: ['card'] }],
      ),
      'home-frame',
    )
    const homeWithScript: ComposePageFile = {
      ...home,
      setupScript: { providerId: PROVIDER_ID, assetKey: 'home.setup.js', scope: 'persistent' },
    }
    const { detail } = twoPageFixture()
    const scriptModuleLoader: ComposeScriptModuleLoader = {
      load: async () => ({ revision: '1', module: { setup: () => ({ onAdd }) } }),
    }

    render(
      <ComposePageHost
        navigation={testNavigation('home', ['home', 'detail'])}
        pageLoader={loaderOf({ home: homeWithScript, detail })}
        registry={registry()}
        scriptModuleLoader={scriptModuleLoader}
      />,
    )

    const materialButton = await screen.findByRole('button', { name: 'Add' })
    await act(async () => { fireEvent.click(materialButton) })
    // 物料自己的页面方法被调用，同时事件冒泡到卡片触发跳转——两者都发生，谁也不吞掉谁。
    expect(onAdd).toHaveBeenCalledTimes(1)
    await waitFor(() => { expect(screen.getByText('Detail page')).toBeTruthy() })
  })

  it('键盘触发跳转', async () => {
    const { home, detail } = twoPageFixture()
    const navigation = testNavigation('home', ['home', 'detail'])
    render(
      <ComposePageHost
        navigation={navigation}
        pageLoader={loaderOf({ home, detail })}
        registry={registry()}
      />,
    )

    const cta = await screen.findByRole('button', { name: 'cta' })
    expect(cta.getAttribute('tabindex')).toBe('0')
    await act(async () => { fireEvent.keyDown(cta, { key: 'Enter' }) })
    await waitFor(() => { expect(screen.getByText('Detail page')).toBeTruthy() })
  })

  it('跳转失败保留当前页', async () => {
    const home = pageWith(
      documentOf(
        {
          cta: leaf('cta', {
            Renderer: { type: 'label', props: { text: 'Go nowhere' } },
            Interaction: {
              version: 1,
              triggers: [{ event: 'click', action: { type: 'navigate', target: reference('gone') } }],
            },
          }),
        },
        [{ id: 'home-frame', childIds: ['cta'] }],
      ),
      'home-frame',
    )
    render(
      <ComposePageHost
        navigation={testNavigation('home', ['home'])}
        pageLoader={loaderOf({ home })}
        registry={registry()}
      />,
    )

    const cta = await screen.findByRole('button', { name: 'cta' })
    await act(async () => { fireEvent.click(cta) })
    await waitFor(() => {
      expect(screen.getByTestId('compose-page-host-navigation-issue')).toBeTruthy()
    })
    expect(screen.getByText('Go nowhere')).toBeTruthy()
  })

  it('没有导航端口时 Interaction 不产生 button 语义', async () => {
    const { home } = twoPageFixture()
    const { ComposePreview } = await import('../compose-preview')
    render(
      <ComposePreview document={home.document} frameId="home-frame" registry={registry()} />,
    )
    await waitFor(() => { expect(screen.getByText('Go to detail')).toBeTruthy() })
    expect(screen.queryByRole('button', { name: 'cta' })).toBeNull()
  })
})
