import { describe, expect, it } from 'vitest'
import {
  applyComposeComponentOverrides,
  parseComposeComponentAsset,
  serializeComposeComponentAsset,
} from './index'
import type { ComposeBaseComponentAsset, ComposeDocument, ComposeEntity } from './index'
import { documentFixture } from './test-fixtures'

/** 以 Container（含 Hierarchy 与 Appearance）为唯一根的组件文档。 */
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
  return documentFixture({ root }, ['root'])
}

function containerRootAsset(): ComposeBaseComponentAsset {
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: containerRootDocument(),
  }
}

describe('组件根放宽为任意单根', () => {
  it('Parser 接受以 Container 为唯一根的 Base', () => {
    const parsed = parseComposeComponentAsset(serializeComposeComponentAsset(containerRootAsset()))
    expect(parsed.ok).toBe(true)
  })

  it('覆盖应用后仍接受非 Group 单根', () => {
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
    const second: ComposeEntity = {
      ...base.entities.root!,
      id: 'root-2',
    }
    const applied = applyComposeComponentOverrides(
      { ...base, rootIds: ['root', 'root-2'], entities: { ...base.entities, 'root-2': second } },
      [],
    )
    expect(applied.ok).toBe(false)
  })
})
