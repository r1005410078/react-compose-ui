import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ComposeDocument } from '@compose-ui/core'
import type { ComposeEntityRegistry, ComposeRendererDefinition } from '@compose-ui/component-registry'
import { createStageSceneIndex } from '@compose-ui/stage-engine'
import { useStageCulling } from './use-stage-culling'

/** 一块场景里一行小字加一条导线；盒来自快照，索引由它们建出来。 */
function fixture() {
  const leaf = (id: string, type: string) => ({
    id,
    name: id,
    components: {
      Composition: { presetId: type, baseComponentKeys: ['Renderer'], capabilityIds: [] },
      Renderer: { type, props: {} },
      Visibility: { visible: true },
      Lock: { locked: false },
      Transform: { rotation: 0 },
      LayoutItem: { positioning: 'absolute', offset: { x: 0, y: 0 } },
    },
  })
  const document = {
    schemaVersion: 7,
    rootIds: ['frame'],
    canvas: {},
    entities: {
      frame: {
        id: 'frame',
        name: '场景',
        components: {
          Composition: { presetId: 'frame', baseComponentKeys: [], capabilityIds: [] },
          Visibility: { visible: true },
          Lock: { locked: false },
          Transform: { rotation: 0 },
          LayoutItem: { positioning: 'absolute', offset: { x: 0, y: 0 } },
          Hierarchy: { childIds: ['label', 'wire'] },
        },
      },
      label: leaf('label', 'text'),
      wire: leaf('wire', 'curve'),
    },
  } as unknown as ComposeDocument
  const snapshot = {
    revision: 1,
    boxes: {
      frame: { x: 0, y: 0, width: 1000, height: 800 },
      label: { x: 10, y: 10, width: 60, height: 15 },
      wire: { x: 10, y: 100, width: 300, height: 0.5 },
    },
    diagnostics: [],
  } as never
  return createStageSceneIndex(document, snapshot)
}

const definitions: Record<string, Partial<ComposeRendererDefinition>> = {
  text: { minimumLegibleSize: { height: 5 } },
  curve: { minimumLegibleSize: { width: 1, height: 1 } },
}
const registry = {
  getRenderer: (type: string) => definitions[type] as ComposeRendererDefinition | undefined,
} satisfies Pick<ComposeEntityRegistry, 'getRenderer'>

function culling(zoom: number, selectedIds: readonly string[] = []) {
  const index = fixture()
  return renderHook(() => useStageCulling({
    index,
    previewTransforms: {},
    registry,
    selectedIds,
    surfaceMeasured: true,
    surfaceSize: { width: 800, height: 600 },
    textEditingEntityId: null,
    viewport: { x: 0, y: 0, zoom },
  })).result.current
}

describe('useStageCulling / 细节裁剪', () => {
  it('OpenSpec: 场景只渲染与裁剪窗口相交的子树 / 读不出来的文字不建节点', () => {
    // 缩放 0.1 时那行字的盒高 1.5 像素；导线又细又长，宽度轴远高于一像素，照画。
    const far = culling(0.1)
    expect(far.culledEntityIds.has('label')).toBe(true)
    expect(far.detailCulledEntityIds.has('label')).toBe(true)
    expect(far.culledEntityIds.has('wire')).toBe(false)
    // 缩放 1 时它 15 像素高，可读。
    const near = culling(1)
    expect(near.culledEntityIds.has('label')).toBe(false)
  })

  it('OpenSpec: 场景只渲染与裁剪窗口相交的子树 / 被裁掉的小字选中即出现', () => {
    const selected = culling(0.1, ['label'])
    expect(selected.culledEntityIds.has('label')).toBe(false)
    expect(selected.detailCulledEntityIds.has('label')).toBe(false)
  })
})
