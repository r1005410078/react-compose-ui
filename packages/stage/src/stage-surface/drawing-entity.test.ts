import { describe, expect, it } from 'vitest'
import type { ComposeEntitySeed } from '@compose-ui/component-registry'
import { getComposeLayoutItem, type ComposeFlexLayout } from '@compose-ui/core'
import { entityFromSeed } from './drawing-entity'

const seed: ComposeEntitySeed = {
  name: 'Rectangle',
  components: {
    Composition: { presetId: 'rectangle', baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 240, min: 1, max: null },
      height: { mode: 'fixed', value: 140, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'rectangle', props: {} },
  },
}

const stretchRowLayout: ComposeFlexLayout = {
  type: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignContent: 'stretch',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  rowGap: 0,
  columnGap: 0,
}

describe('OpenSpec: stage-engine / ECS 外部拖入', () => {
  it('落入自由容器保持 Preset 的 Absolute 摆放', () => {
    const entity = entityFromSeed(seed, 'r1', { x: 200, y: 100 })
    expect(getComposeLayoutItem(entity)).toMatchObject({
      positioning: 'absolute',
      offset: { x: 80, y: 30 },
    })
  })

  it('落入 Auto Layout 容器转为 Flow 并采纳交叉轴', () => {
    const entity = entityFromSeed(seed, 'r1', { x: 200, y: 100 }, stretchRowLayout)
    // 与画布 reparent 的 targetManagesFlow 判定一致：进入排队，stretch 交叉轴 fixed→fill。
    expect(getComposeLayoutItem(entity)).toMatchObject({
      positioning: 'flow',
      width: { mode: 'fixed', value: 240 },
      height: { mode: 'fill' },
    })
  })
})
