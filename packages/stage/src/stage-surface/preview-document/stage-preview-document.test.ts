import { describe, expect, it } from 'vitest'
import { getComposeTransformPivot, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
import { transformDocument } from './stage-preview-document'

/** 铰点在左边中点的刀身：`Transform.pivot` 是归一化盒坐标。 */
function hinged(): ComposeDocument {
  const entity = {
    id: 'p',
    name: 'p',
    components: {
      Composition: { presetId: null, baseComponentKeys: ['Transform', 'LayoutItem'], capabilityIds: [] },
      Transform: { rotation: 0, pivot: { x: 0, y: 0.5 } },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 10, y: 20 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 50, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
    },
  } as unknown as ComposeEntity
  return { schemaVersion: 7, rootIds: ['p'], entities: { p: entity } } as unknown as ComposeDocument
}

describe('OpenSpec: stage / 手势预览保留旋转基点', () => {
  it('预览文档保留 Transform.pivot', () => {
    /*
     * 整个替换掉 `Transform` 会把 `pivot` 一起抹掉，预览于是绕盒中心转、提交按基点转——
     * 症状是拖动中看到的姿态与松手后不一致，对象在提交那一刻跳一下，且只在非中心基点上出现。
     */
    const previewed = transformDocument(hinged(), {
      p: { x: 10, y: 20, width: 100, height: 50, rotation: 90 },
    })

    expect(getComposeTransformPivot(previewed.entities.p!)).toEqual({ x: 0, y: 0.5 })
    expect(previewed.entities.p!.components.Transform).toMatchObject({ rotation: 90 })
  })
})
