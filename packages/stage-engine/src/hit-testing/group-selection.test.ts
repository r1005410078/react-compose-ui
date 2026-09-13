import { createComposeGroupEntitySeed, encodeComposeInstancePath } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { document, entity, ROOT_FRAME_ID } from '../test-fixtures'
import { resolveStageGroupHit } from './group-selection'
import type { ComposeDocument } from '@compose-ui/core'

/*
 * 结构：根 Frame › outer(Group) › [ inner(Group) › [ leaf ], sibling ]、以及一个游离的 free。
 * 两层 Group 嵌套是判别性夹具：一层分不出「最外层」与「穿过一层」。
 */
const value: ComposeDocument = document(
  [
    createComposeGroupEntitySeed({ id: 'outer', childIds: ['inner', 'sibling'] }),
    createComposeGroupEntitySeed({ id: 'inner', childIds: ['leaf'] }),
    entity('leaf', { x: 0, y: 0, width: 40, height: 40 }),
    entity('sibling', { x: 100, y: 0, width: 40, height: 40 }),
    entity('free', { x: 300, y: 0, width: 40, height: 40 }),
  ],
  ['outer', 'free'],
)

const parents: Record<string, string> = {
  outer: ROOT_FRAME_ID,
  free: ROOT_FRAME_ID,
  inner: 'outer',
  sibling: 'outer',
  leaf: 'inner',
}
const getParentId = (id: string) => parents[id] ?? null

const resolve = (
  entityId: string,
  selectedIds: readonly string[] = [],
  over: { readonly clickCount?: number; readonly deep?: boolean } = {},
) => resolveStageGroupHit({ document: value, getParentId, entityId, selectedIds, ...over })

describe('OpenSpec: stage-engine / Group 命中先选组，双击穿过一层', () => {
  it('没有选区时，单击 Group 深处的叶子选中最外层的 Group', () => {
    expect(resolve('leaf')).toEqual({ entityId: 'outer', descended: false })
    expect(resolve('sibling')).toEqual({ entityId: 'outer', descended: false })
  })

  it('不在任何 Group 里的命中原样返回', () => {
    expect(resolve('free')).toEqual({ entityId: 'free', descended: false })
    expect(resolve('outer')).toEqual({ entityId: 'outer', descended: false })
  })

  it('双击穿过一层：落到最外层门槛的直接子级', () => {
    // 选中 outer 自己不算进入，因此门槛仍是 outer；穿过它落到 inner，而不是一口气到 leaf。
    expect(resolve('leaf', ['outer'], { clickCount: 2 })).toEqual({ entityId: 'inner', descended: true })
    // 兄弟没有再套一层，穿过 outer 就是它自己。
    expect(resolve('sibling', ['outer'], { clickCount: 2 })).toEqual({ entityId: 'sibling', descended: true })
  })

  it('已进入的 Group 不再是门槛：选中了里面任何一项，单击兄弟直接选中兄弟', () => {
    expect(resolve('sibling', ['inner'])).toEqual({ entityId: 'sibling', descended: false })
    // inner 还没进入（选区里没有它的后代），点它的叶子仍先选 inner。
    expect(resolve('leaf', ['sibling'])).toEqual({ entityId: 'inner', descended: false })
    // 进入到最里层之后一切直接命中。
    expect(resolve('leaf', ['leaf'])).toEqual({ entityId: 'leaf', descended: false })
    expect(resolve('leaf', ['leaf'], { clickCount: 2 })).toEqual({ entityId: 'leaf', descended: false })
  })

  it('选中 Group 自己不算进入：再点它的子级仍是这个 Group', () => {
    expect(resolve('sibling', ['outer'])).toEqual({ entityId: 'outer', descended: false })
  })

  it('复合地址按宿主实例算进入', () => {
    // sibling 当作一个实例宿主：选区停在它内部时，outer 已经进入过。
    expect(resolve('sibling', [encodeComposeInstancePath(['sibling', 'part'])]))
      .toEqual({ entityId: 'sibling', descended: false })
  })

  it('深选无视门槛', () => {
    expect(resolve('leaf', [], { deep: true })).toEqual({ entityId: 'leaf', descended: false })
    expect(resolve('leaf', [], { deep: true, clickCount: 2 })).toEqual({ entityId: 'leaf', descended: false })
  })

  it('锁定的门槛不下钻', () => {
    const locked: ComposeDocument = {
      ...value,
      entities: {
        ...value.entities,
        outer: {
          ...value.entities.outer!,
          components: { ...value.entities.outer!.components, Lock: { locked: true } },
        },
      },
    }
    expect(resolveStageGroupHit({
      document: locked,
      getParentId,
      entityId: 'leaf',
      selectedIds: [],
      clickCount: 2,
    })).toEqual({ entityId: 'outer', descended: false })
  })

  it('选区里已消失的 ID 不参与进入判定', () => {
    expect(resolve('leaf', ['ghost'])).toEqual({ entityId: 'outer', descended: false })
  })
})
