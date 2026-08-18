import { describe, expect, it } from 'vitest'
import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
import { buildResizePreviewSolveDocument } from './resize-preview'

function entity(id: string, positioning: 'flow' | 'absolute', widthMode: 'fixed' | 'fill' | 'hug'): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning,
        offset: { x: 0, y: 0 },
        width: { mode: widthMode, value: 120, min: null, max: null },
        height: { mode: 'fixed', value: 40, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
    },
  } as unknown as ComposeEntity
}

function doc(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: {} as ComposeDocument['canvas'],
    rootIds: entities.map((item) => item.id),
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  }
}

describe('OpenSpec: stage / resize 手势实时布局反馈', () => {
  it('Flow 目标两轴强制 fixed，未拖动兄弟保持原引用', () => {
    const value = doc([entity('resized', 'flow', 'fill'), entity('sibling', 'flow', 'fixed')])
    const solve = buildResizePreviewSolveDocument(value, ['resized'])

    expect(solve).not.toBeNull()
    expect(solve!.entities.resized!.components.LayoutItem).toMatchObject({
      width: { mode: 'fixed', value: 120 },
      height: { mode: 'fixed', value: 40 },
    })
    expect(solve!.entities.sibling).toBe(value.entities.sibling)
  })

  it('仅 Absolute 叶子目标时不需要实时求解', () => {
    const value = doc([entity('resized', 'absolute', 'fixed'), entity('sibling', 'flow', 'fixed')])
    expect(buildResizePreviewSolveDocument(value, ['resized'])).toBeNull()
  })

  it('Resize Auto Layout 容器本身也进入实时求解并强制 fixed 两轴', () => {
    const base = entity('container', 'absolute', 'hug')
    const container = {
      ...base,
      components: {
        ...base.components,
        Hierarchy: { childIds: ['child'] },
        Layout: {
          type: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignContent: 'stretch',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          rowGap: 0,
          columnGap: 0,
        },
      },
    } as typeof base
    const value = doc([container, entity('child', 'flow', 'fill')])
    const solve = buildResizePreviewSolveDocument(value, ['container'])

    expect(solve).not.toBeNull()
    // Hug 轴保持 hug 会在求解中重新收缩、覆盖拖动尺寸，必须强制 fixed。
    expect(solve!.entities.container!.components.LayoutItem).toMatchObject({
      width: { mode: 'fixed' },
      height: { mode: 'fixed' },
    })
    expect(solve!.entities.child).toBe(value.entities.child)
  })
})
