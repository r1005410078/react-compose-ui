import { describe, expect, it } from 'vitest'
import {
  applyComposeComponentOverrides,
  parseComposeComponentAsset,
  serializeComposeComponentAsset,
} from './index'
import type { ComposeBaseComponentAsset, ComposeDocument, ComposeEntity } from './index'
import { ROOT_FRAME_ID, componentDocumentFixture } from './test-fixtures'

/** 以单个 Frame 为根、内含一个 Container 的组件文档。 */
function containerRootDocument(): ComposeDocument {
  const root: ComposeEntity = {
    id: 'root',
    name: 'Container',
    components: {
      Composition: {
        presetId: 'container',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Hierarchy'],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 200, min: 1, max: null },
        height: { mode: 'fixed', value: 100, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#123456' } },
    },
  }
  return componentDocumentFixture({ root }, ['root'])
}

function containerRootAsset(): ComposeBaseComponentAsset {
  return {
    schemaVersion: 2,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: containerRootDocument(),
  }
}

describe('组件根必须是单个 Frame', () => {
  it('OpenSpec: component-library / Component Asset v1 判别协议 / 要求单个 Frame 根', () => {
    const parsed = parseComposeComponentAsset(serializeComposeComponentAsset(containerRootAsset()))
    expect(parsed.ok).toBe(true)
  })

  it('覆盖应用后仍接受单个 Frame 根', () => {
    const applied = applyComposeComponentOverrides(containerRootDocument(), [{
      id: 'op-1',
      kind: 'set-field',
      entityId: 'root',
      componentKey: 'Appearance',
      fieldPath: ['backgroundPaint', 'color'],
      value: '#abcdef',
    }])
    expect(applied.ok).toBe(true)
  })

  it('多根仍被拒绝', () => {
    const base = containerRootDocument()
    const second: ComposeEntity = { ...base.entities[ROOT_FRAME_ID]!, id: 'frame-2' }
    const applied = applyComposeComponentOverrides(
      {
        ...base,
        rootIds: [ROOT_FRAME_ID, 'frame-2'],
        entities: { ...base.entities, 'frame-2': second },
      },
      [],
    )
    expect(applied.ok).toBe(false)
  })

  it('根不是 Frame 时被拒绝', () => {
    const base = containerRootDocument()
    // 只保留 Container 作为唯一根：文档拓扑仍然自洽，唯一的问题就是根不是 Frame。
    const parsed = parseComposeComponentAsset(serializeComposeComponentAsset({
      ...containerRootAsset(),
      document: { ...base, rootIds: ['root'], entities: { root: base.entities.root! } },
    }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      // 根不是 Frame 是 v7 文档层的不变量，Parser 原样透传文档校验的稳定 issue。
      expect(parsed.issues).toContainEqual(expect.objectContaining({
        code: 'document.root-not-frame',
        path: ['document', 'rootIds', 0],
      }))
    }
  })
})
