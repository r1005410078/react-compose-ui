import type {
  ComposeDocument,
  ComposePageDocumentLoader,
  ComposePageReference,
} from '@compose-ui/core'
import {
  COMPOSE_PAGE_MEDIA_TYPE,
  COMPOSE_PAGE_NEST_DEPTH_LIMIT,
  createDefaultComposeLayoutItem,
  createEmptyComposePageDocument,
  serializeComposePageDocument,
} from '@compose-ui/core'
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
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(100, 80),
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

/**
 * 被引用页面的文档，含两个根实体，其中一个是带子节点的容器。
 *
 * @remarks
 * 用于锁定两处曾经缺失的行为：多个根实体必须各自按几何定位（否则会堆在原点且无尺寸，
 * 表现为只看到第一个），容器必须递归渲染 Hierarchy 子节点。
 */
function nestedTreeDocument(): ComposeDocument {
  return {
    ...createEmptyComposePageDocument(),
    rootIds: ['first', 'group'],
    entities: {
      first: entity('first', { Renderer: { type: 'rectangle', props: {} } }),
      group: entity('group', { Hierarchy: { childIds: ['child'] } }),
      child: entity('child', { Renderer: { type: 'rectangle', props: {} } }),
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

describe('OpenSpec: basic-materials / 页面拖入画布创建 Page Slot', () => {
  const preset = () => {
    const materials = createComposeBasicMaterials()
    const found = materials.presets.find((item) => item.id === 'page-slot')
    if (!found) throw new Error('page-slot preset is missing')
    return found
  }

  it('只按媒体类型接受页面，与文件名无关', () => {
    const accepts = preset().assetDrop?.accepts
    expect(accepts).toBeDefined()
    expect(accepts?.({ mediaType: COMPOSE_PAGE_MEDIA_TYPE, name: 'Home.page.json' })).toBe(true)
    // 文件名带后缀但媒体类型不是页面：拒绝。身份判据只有媒体类型。
    expect(accepts?.({ mediaType: 'application/json', name: 'Home.page.json' })).toBe(false)
    // 反之，媒体类型是页面而文件名不带后缀：接受。
    expect(accepts?.({ mediaType: COMPOSE_PAGE_MEDIA_TYPE, name: 'Home.json' })).toBe(true)
    expect(accepts?.({ mediaType: 'image/svg+xml', name: 'logo.svg' })).toBe(false)
  })

  it('创建的实体携带页面引用并采用被引用页面的输出尺寸', async () => {
    const nested = nestedDocument()
    const seed = await preset().assetDrop?.createSeed({
      reference: { providerId: 'memory', assetKey: 'Pages/Home.page.json', scope: 'persistent' },
      resolved: {
        blob: new Blob([serializeComposePageDocument(nested)]),
        revision: '1',
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
      },
      name: 'Home.page.json',
    })

    const renderer = seed?.components.Renderer as { type: string; props: { page: unknown } }
    expect(renderer.type).toBe('page-slot')
    expect(renderer.props.page).toEqual({
      kind: 'page',
      providerId: 'memory',
      assetKey: 'Pages/Home.page.json',
      scope: 'persistent',
    })
    const layoutItem = seed?.components.LayoutItem as {
      width: { value: number }
      height: { value: number }
    }
    expect({ width: layoutItem.width.value, height: layoutItem.height.value }).toEqual({
      width: nested.output.width,
      height: nested.output.height,
    })
  })

  it('页面内容不可解析时回退到默认尺寸', async () => {
    const seed = await preset().assetDrop?.createSeed({
      reference: { providerId: 'memory', assetKey: 'Pages/Broken.page.json', scope: 'persistent' },
      resolved: {
        blob: new Blob(['{ broken']),
        revision: '1',
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
      },
      name: 'Broken.page.json',
    })

    const layoutItem = seed?.components.LayoutItem as {
      width: { value: number }
      height: { value: number }
    }
    expect(layoutItem.width.value).toBeGreaterThan(0)
    expect(layoutItem.height.value).toBeGreaterThan(0)
  })
})

describe('OpenSpec: basic-materials / Page Slot 递归渲染被引用页面', () => {
  it('多个根实体都渲染，并各自带绝对定位与几何', async () => {
    const load = vi.fn(async () => nestedTreeDocument())
    renderSlot({ loader: { load } })

    await screen.findByTestId('compose-page-slot-content')
    const first = document.querySelector('[data-page-slot-entity-id="first"]')
    const group = document.querySelector('[data-page-slot-entity-id="group"]')
    expect(first).not.toBeNull()
    expect(group).not.toBeNull()
    // 定位包装缺失时所有实体会堆在原点且没有尺寸，表现为只看到第一个。
    expect(first).toHaveStyle({ position: 'absolute' })
    expect((first as HTMLElement).style.width).not.toBe('')
  })

  it('容器递归渲染 Hierarchy 子节点', async () => {
    const load = vi.fn(async () => nestedTreeDocument())
    renderSlot({ loader: { load } })

    await screen.findByTestId('compose-page-slot-content')
    const group = document.querySelector('[data-page-slot-entity-id="group"]')
    expect(group?.querySelector('[data-page-slot-entity-id="child"]')).not.toBeNull()
  })

  it('不可见实体及其子树不渲染', async () => {
    const load = vi.fn(async () => {
      const base = nestedTreeDocument()
      return {
        ...base,
        entities: {
          ...base.entities,
          group: {
            ...base.entities.group!,
            components: {
              ...base.entities.group!.components,
              Visibility: { visible: false },
            },
          },
        },
      } as ComposeDocument
    })
    renderSlot({ loader: { load } })

    await screen.findByTestId('compose-page-slot-content')
    expect(document.querySelector('[data-page-slot-entity-id="group"]')).toBeNull()
    expect(document.querySelector('[data-page-slot-entity-id="child"]')).toBeNull()
  })
})
