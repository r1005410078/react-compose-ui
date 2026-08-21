import { describe, expect, it } from 'vitest'
import { createComposeFrameEntity } from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity, ComposeLayoutSnapshot } from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import { resolveRootLanding } from './root-landing'

const FRAME_ID = 'frame-root'

function documentWith(): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
    },
    rootIds: [FRAME_ID],
    entities: {
      [FRAME_ID]: createComposeFrameEntity({
        id: FRAME_ID,
        offset: { x: 100, y: 200 },
        size: { width: 1280, height: 720 },
      }),
    },
  } as unknown as ComposeDocument
}

function snapshotWith(): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: {
      [FRAME_ID]: { x: 100, y: 200, width: 1280, height: 720, positioning: 'absolute' },
    },
    diagnostics: [],
  } as ComposeLayoutSnapshot
}

/** getPreset 只被升格分支用于取场景默认名。 */
const registry = {
  getPreset: (id: string) => (id === 'frame' ? { defaultName: '场景' } : undefined),
} as unknown as ComposeEntityRegistry

function rectangleCandidate(id: string): ComposeEntity {
  return {
    id,
    name: 'Rectangle',
    components: {
      Composition: { presetId: 'rectangle', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 50, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'rectangle', props: {} },
    },
  } as unknown as ComposeEntity
}

function containerCandidate(id: string): ComposeEntity {
  const base = rectangleCandidate(id)
  const components: Record<string, unknown> = { ...base.components }
  delete components.Renderer
  components.Hierarchy = { childIds: [] }
  // 容器 Preset 的默认 Clip 是双向裁剪；升格路径必须把它归一为不裁剪。
  components.Clip = { enabled: true, horizontal: 'clip', vertical: 'clip' }
  return { ...base, name: 'Container', components } as unknown as ComposeEntity
}

describe('OpenSpec: stage / 空白工作区的新建落点', () => {
  it('在场景外绘制矩形落进激活场景并保留落点：越界局部坐标不钳制', () => {
    const landing = resolveRootLanding(
      {
        document: documentWith(),
        layoutSnapshot: snapshotWith(),
        registry,
        activeFrameId: FRAME_ID,
      },
      { x: 2000, y: -300, width: 100, height: 50 },
      (bounds) => ({
        ...rectangleCandidate('rect'),
        components: {
          ...rectangleCandidate('rect').components,
          LayoutItem: {
            ...(rectangleCandidate('rect').components.LayoutItem as Record<string, unknown>),
            offset: { x: bounds.x, y: bounds.y },
          },
        },
      } as unknown as ComposeEntity),
    )
    expect(landing?.parentId).toBe(FRAME_ID)
    // 局部坐标 = 世界落点 − 场景原点 (100, 200)，即使越出 1280×720 也保持原值。
    expect(landing?.bounds).toMatchObject({ x: 1900, y: -500, width: 100, height: 50 })
  })

  it('在场景外绘制容器升格为新场景且 Clip 归一为不裁剪', () => {
    const landing = resolveRootLanding(
      {
        document: documentWith(),
        layoutSnapshot: snapshotWith(),
        registry,
        activeFrameId: FRAME_ID,
      },
      { x: 2000, y: 100, width: 400, height: 300 },
      () => containerCandidate('drawn'),
    )
    expect(landing?.parentId).toBeNull()
    expect(landing?.entity.components.Frame).toBeDefined()
    // 与「新建场景」命令的默认一致：新场景不裁剪，需要时由用户显式开启。
    expect(landing?.entity.components.Clip).toEqual({
      enabled: false,
      horizontal: 'visible',
      vertical: 'visible',
    })
  })
})
