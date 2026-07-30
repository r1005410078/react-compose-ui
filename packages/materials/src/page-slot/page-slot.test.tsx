import type {
  ComposeDocument,
  ComposePageDocumentLoader,
  ComposePageReference,
} from '@compose-ui/core'
import { COMPOSE_PAGE_NEST_DEPTH_LIMIT, createEmptyComposePageDocument } from '@compose-ui/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import { ComposePageSlotNestProvider } from './nest-context'

const reference: ComposePageReference = {
  kind: 'page',
  providerId: 'memory',
  assetKey: 'Pages/Home.page.json',
  scope: 'persistent',
}

function entity(id: string, components: Record<string, unknown>) {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { position: { x: 0, y: 0 }, size: { width: 100, height: 80 }, rotation: 0 },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

/** 一份内含 page-slot 实体的外层文档。 */
function outerDocument(): ComposeDocument {
  return {
    ...createEmptyComposePageDocument(),
    rootIds: ['slot'],
    entities: {
      slot: entity('slot', {
        Renderer: { type: 'page-slot', props: { page: reference } },
      }),
    },
  } as ComposeDocument
}

/** 被引用页面的文档，含一个可见的矩形实体。 */
function nestedDocument(): ComposeDocument {
  return {
    ...createEmptyComposePageDocument(),
    rootIds: ['nested-rect'],
    entities: {
      'nested-rect': entity('nested-rect', {
        Renderer: { type: 'rectangle', props: {} },
      }),
    },
  } as ComposeDocument
}

function renderSlot(options: {
  readonly loader?: ComposePageDocumentLoader
  readonly mode?: 'editor' | 'preview'
  readonly ancestors?: readonly string[]
  readonly page?: unknown
} = {}) {
  const materials = createComposeBasicMaterials()
  const definition = materials.rendererDefinitions
    .find((item) => item.type === 'page-slot')
  if (!definition) throw new Error('page-slot renderer definition is missing')
  const Renderer = definition.renderer
  render(
    <ComposePageSlotNestProvider
      ancestorPageKeys={options.ancestors ?? []}
      depth={options.ancestors?.length ?? 0}
    >
      <Renderer
        entity={outerDocument().entities.slot!}
        mode={options.mode ?? 'preview'}
        pageDocumentPort={options.loader}
        props={{ page: (options.page === undefined ? reference : options.page) as never }}
        registry={materials.registry}
        renderer={{ type: 'page-slot', props: {} }}
      />
    </ComposePageSlotNestProvider>,
  )
  return { materials }
}

afterEach(cleanup)

describe('OpenSpec: basic-materials / Page Slot 编辑态不抢命中测试', () => {
  it('编辑模式下嵌套内容整体不接收指针事件', async () => {
    const load = vi.fn(async () => nestedDocument())
    renderSlot({ loader: { load }, mode: 'editor' })

    const nested = await screen.findByTestId('compose-page-slot-content')
    expect(nested).toHaveStyle({ pointerEvents: 'none' })
  })

  it('预览模式下嵌套内容正常接收指针事件', async () => {
    const load = vi.fn(async () => nestedDocument())
    renderSlot({ loader: { load }, mode: 'preview' })

    const nested = await screen.findByTestId('compose-page-slot-content')
    expect(nested).not.toHaveStyle({ pointerEvents: 'none' })
  })
})

describe('OpenSpec: basic-materials / Page Slot 加载状态与嵌套护栏', () => {
  it('加载中先呈现忙碌状态，完成后替换为页面内容', async () => {
    let resolveLoad: ((document: ComposeDocument) => void) | undefined
    const load = vi.fn(() => new Promise<ComposeDocument>((resolve) => { resolveLoad = resolve }))
    renderSlot({ loader: { load } })

    expect(screen.getByTestId('compose-page-slot-loading')).toHaveAttribute('aria-busy', 'true')

    resolveLoad?.(nestedDocument())

    await waitFor(() => {
      expect(screen.getByTestId('compose-page-slot-content')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('compose-page-slot-loading')).not.toBeInTheDocument()
  })

  it('加载失败以警示语义呈现并可重试', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(nestedDocument())
    renderSlot({ loader: { load } })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('data-testid', 'compose-page-slot-error')

    screen.getByRole('button', { name: '重试' }).click()

    await waitFor(() => { expect(load).toHaveBeenCalledTimes(2) })
  })

  it('目标页面为空时呈现空状态', async () => {
    const load = vi.fn(async () => createEmptyComposePageDocument())
    renderSlot({ loader: { load } })

    expect(await screen.findByTestId('compose-page-slot-empty')).toBeInTheDocument()
  })

  it('自环引用以警示语义阻断且不发起加载', () => {
    const load = vi.fn()
    renderSlot({ loader: { load }, ancestors: [reference.assetKey] })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-testid', 'compose-page-slot-cycle')
    expect(load).not.toHaveBeenCalled()
  })

  it('超出深度上限以警示语义阻断且不发起加载', () => {
    const load = vi.fn()
    const ancestors = Array.from({ length: COMPOSE_PAGE_NEST_DEPTH_LIMIT }, (_, i) => `p${i}`)
    renderSlot({ loader: { load }, ancestors })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-testid', 'compose-page-slot-depth')
    expect(load).not.toHaveBeenCalled()
  })

  it('未设置引用或未注入加载端口时呈现占位且不加载', () => {
    const load = vi.fn()
    renderSlot({ loader: { load }, page: null })
    expect(screen.getByTestId('compose-page-slot-placeholder')).toBeInTheDocument()
    expect(load).not.toHaveBeenCalled()

    cleanup()
    renderSlot({ loader: undefined })
    expect(screen.getByTestId('compose-page-slot-placeholder')).toBeInTheDocument()
  })
})
