import { describe, expect, it, vi } from 'vitest'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentStore } from '@compose-ui/component-library'
import { importSvgAsComponent } from './import-svg-as-component'

/**
 * 一份最小的假 Registry。
 *
 * @remarks
 * `editor` 不依赖 `@compose-ui/materials`——物料由宿主注入，这正是「Preset seed 由调用方注入」
 * 那条边界换来的东西。
 */
function createSeed(presetId: string) {
  const components: Record<string, unknown> = {
    Composition: { presetId, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 1, min: null, max: null },
      height: { mode: 'fixed', value: 1, min: null, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Appearance: {
      backgroundPaint: { kind: 'solid', color: 'transparent' },
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      opacity: 1,
      shadow: null,
    },
  }
  if (presetId === 'frame') {
    return {
      ok: true as const,
      seed: {
        name: 'Frame',
        components: {
          ...components,
          Frame: { size: { width: 1, height: 1 } },
          Hierarchy: { childIds: [] },
          Clip: { enabled: false },
        },
      },
    }
  }
  if (presetId === 'image') {
    return {
      ok: true as const,
      seed: {
        name: 'Image',
        components: {
          ...components,
          Renderer: { type: 'image', props: { asset: null, alt: '', fit: 'contain' } },
        },
      },
    }
  }
  if (presetId === 'curve') {
    return {
      ok: true as const,
      seed: {
        name: 'Curve',
        components: {
          ...components,
          Renderer: { type: 'curve', props: { stroke: '#d8e2f1', strokeWidth: 1 } },
          Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        },
      },
    }
  }
  return { ok: false as const, error: new Error(`no preset ${presetId}`) }
}

/** 一张 1×1 的透明 PNG。 */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function fakes() {
  const created: { name: string }[] = []
  const provider = {
    id: 'local',
    root: { id: 'root' },
    capabilities: { createFile: true },
    referenceScope: 'persistent',
    createFile: vi.fn(async ({ name }: { name: string }) => {
      created.push({ name })
      return { id: `entry-${created.length}`, assetKey: `key-${created.length}`, name }
    }),
  } as unknown as ComposeAssetProvider
  const componentStore = {
    createComponent: vi.fn(async ({ asset, fileName }: { asset: unknown; fileName: string }) => ({
      asset,
      fileName,
      revision: 'rev-1',
      entryId: 'component-entry',
      assetKey: 'component-key',
    })),
  } as unknown as ComposeComponentStore
  let counter = 0
  return {
    provider,
    componentStore,
    created,
    registry: { createSeed } as unknown as ComposeEntityRegistry,
    idFactory: () => `id-${(counter += 1)}`,
  }
}

describe('OpenSpec: svg-import / 资源浏览器上的导入为组件 / 写入次序', () => {
  it('产出的组件文档落到组件 Store，元素 id 成为 Entity 名称', async () => {
    const context = fakes()
    const result = await importSvgAsComponent({
      text: `<svg viewBox="0 0 40 60"><line id="blade" x1="20" y1="47" x2="32" y2="16" stroke="#333"/></svg>`,
      name: 'disconnector',
      parentId: 'folder-1',
      ...context,
    })
    expect(result.diagnostics).toEqual([])
    const asset = (context.componentStore.createComponent as ReturnType<typeof vi.fn>).mock.calls[0]![0].asset
    const names = Object.values(asset.document.entities).map((entity) => (entity as { name: string }).name)
    expect(names).toContain('blade')
  })

  it('内嵌位图先写、引用回填进那个 Entity', async () => {
    const context = fakes()
    await importSvgAsComponent({
      text: `<svg viewBox="0 0 10 10"><image id="logo" href="data:image/png;base64,${PNG}" width="8" height="4"/></svg>`,
      name: 'badge',
      parentId: 'folder-1',
      ...context,
    })
    // 位图先写：组件文档里的引用要等文件写完才存在。
    expect(context.created.map(({ name }) => name)).toEqual(['logo.png'])
    const asset = (context.componentStore.createComponent as ReturnType<typeof vi.fn>).mock.calls[0]![0].asset
    const image = Object.values(asset.document.entities).find(
      (entity) => (entity as { name: string }).name === 'logo',
    ) as { components: { Renderer: { props: { asset: unknown } } } }
    expect(image.components.Renderer.props.asset)
      .toEqual({ providerId: 'local', assetKey: 'key-1', scope: 'persistent' })
  })

  it('没有 svg 根时抛错而不是写下一个空组件', async () => {
    const context = fakes()
    await expect(importSvgAsComponent({
      text: '<html></html>',
      name: 'broken',
      parentId: null,
      ...context,
    })).rejects.toThrow()
    expect(context.componentStore.createComponent).not.toHaveBeenCalled()
  })
})
