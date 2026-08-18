import { describe, expect, it } from 'vitest'
import { createComposeFrameEntity } from '@compose-ui/core'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import { resolveComposeContainerLabels } from './container-labels'

function containerEntity(
  id: string,
  childIds: readonly string[],
  visible = true,
  locked = false,
) {
  return {
    id,
    name: `名称 ${id}`,
    components: {
      Composition: { presetId: 'container', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute' as const,
        offset: { x: 100, y: 200 },
        width: { mode: 'fixed' as const, value: 320, min: 1, max: null },
        height: { mode: 'fixed' as const, value: 240, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto' as const,
      },
      Visibility: { visible },
      Lock: { locked },
      Hierarchy: { childIds: [...childIds] },
      Clip: { enabled: true },
    },
  }
}

function leafEntity(id: string) {
  const base = containerEntity(id, [])
  const components: Record<string, unknown> = { ...base.components }
  delete components.Hierarchy
  delete components.Clip
  components.Renderer = { type: 'test', props: {} }
  return { ...base, components } as unknown as ReturnType<typeof containerEntity>
}

/** v7 的文档根只接受 Frame；夹具把给定的顶层容器挂进这块画板。 */
const ROOT_FRAME_ID = 'frame-root'

function scene(entities: readonly ReturnType<typeof containerEntity>[], rootIds: readonly string[]) {
  const frame = createComposeFrameEntity({ id: ROOT_FRAME_ID, childIds: rootIds })
  const document = {
    schemaVersion: 7,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
    },
    rootIds: [ROOT_FRAME_ID],
    entities: {
      ...Object.fromEntries(entities.map((item) => [item.id, item])),
      [ROOT_FRAME_ID]: frame,
    },
  } as unknown as ComposeDocument
  const layoutSnapshot = {
    revision: 1,
    boxes: {
      // 画板在世界原点；被测容器的局部盒沿用既有夹具值。
      [ROOT_FRAME_ID]: {
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
        positioning: 'absolute' as const,
      },
      ...Object.fromEntries(entities.map((item) => [item.id, {
        x: 100,
        y: 200,
        width: 320,
        height: 240,
        positioning: 'absolute' as const,
      }])),
    },
    diagnostics: [],
  } as ComposeLayoutSnapshot
  return { document, layoutSnapshot }
}

describe('OpenSpec: stage / 顶层容器标题标签', () => {
  it('只有顶层容器进入标签集合', () => {
    const { document, layoutSnapshot } = scene(
      [containerEntity('outer', ['inner']), containerEntity('inner', [])],
      ['outer'],
    )
    const labels = resolveComposeContainerLabels(
      document,
      layoutSnapshot,
      { x: 0, y: 0, zoom: 1 },
    )
    // 画板自身也带标签（Figma 同样给 Frame 画标题）；嵌套容器 inner 仍被排除。
    expect(labels.map((item) => item.entityId)).toEqual([ROOT_FRAME_ID, 'outer'])
  })

  it('非容器根 Entity 不显示标签', () => {
    const { document, layoutSnapshot } = scene([leafEntity('rect')], ['rect'])
    // 只剩画板自己的标签：叶 Entity 不是容器。
    expect(resolveComposeContainerLabels(document, layoutSnapshot, { x: 0, y: 0, zoom: 1 })
      .map((item) => item.entityId)).toEqual([ROOT_FRAME_ID])
  })

  it('标签贴在容器左上角外侧并随视口换算到屏幕坐标', () => {
    const { document, layoutSnapshot } = scene([containerEntity('outer', [])], ['outer'])
    const label = resolveComposeContainerLabels(
      document,
      layoutSnapshot,
      { x: 10, y: 20, zoom: 2 },
    ).find((item) => item.entityId === 'outer')
    expect(label).toMatchObject({ name: '名称 outer', x: 210, maxWidth: 640 })
    expect(label!.y).toBeLessThan(420)
  })

  it('锁定容器的标签只剩信息，不再是交互入口', () => {
    const { document, layoutSnapshot } = scene(
      [containerEntity('outer', [], true, true)],
      ['outer'],
    )
    const label = resolveComposeContainerLabels(
      document,
      layoutSnapshot,
      { x: 0, y: 0, zoom: 1 },
    ).find((item) => item.entityId === 'outer')
    expect(label).toMatchObject({ entityId: 'outer', locked: true })
  })

  it('隐藏与低缩放时不渲染标签', () => {
    const hidden = scene([containerEntity('outer', [], false)], ['outer'])
    expect(resolveComposeContainerLabels(hidden.document, hidden.layoutSnapshot, {
      x: 0, y: 0, zoom: 1,
    }).map((item) => item.entityId)).toEqual([ROOT_FRAME_ID])
    const visible = scene([containerEntity('outer', [])], ['outer'])
    expect(resolveComposeContainerLabels(visible.document, visible.layoutSnapshot, {
      x: 0, y: 0, zoom: 0.05,
    })).toHaveLength(0)
    expect(resolveComposeContainerLabels(
      visible.document,
      visible.layoutSnapshot,
      { x: 0, y: 0, zoom: 1 },
      new Set(['outer']),
    ).map((item) => item.entityId)).toEqual([ROOT_FRAME_ID])
  })
})
