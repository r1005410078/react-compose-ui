import { describe, expect, it } from 'vitest'
import { planPropertyActionRail } from './binding-entry-model'

describe('OpenSpec: property-panel / 自适应属性操作轨道', () => {
  it('OpenSpec: property-panel / 自适应属性操作轨道 / 默认三图标操作列容纳绑定与重置', () => {
    expect(planPropertyActionRail({
      actionWidth: 76,
      actions: [{ id: 'reset', priority: 20 }],
      targets: [{ id: 'value', state: 'bound' }],
    })).toEqual({
      slots: 3,
      bindingEntry: 'direct',
      bindingState: 'bound',
      directActionIds: ['reset'],
      overflowActionIds: [],
    })
  })

  it('OpenSpec: property-panel / 自适应属性操作轨道 / 超过三项操作时使用最后一个更多图标', () => {
    expect(planPropertyActionRail({
      actionWidth: 76,
      actions: [
        { id: 'presence', priority: 10 },
        { id: 'reset', priority: 20 },
        { id: 'delete', priority: 30 },
        { id: 'move', priority: 40 },
      ],
      targets: [],
    })).toEqual({
      slots: 3,
      bindingEntry: 'none',
      directActionIds: ['presence', 'reset'],
      overflowActionIds: ['delete', 'move'],
    })
  })

  it('OpenSpec: property-panel / 自适应属性操作轨道 / 缩窄或扩大操作列逐步收纳操作', () => {
    expect(planPropertyActionRail({
      actionWidth: 36,
      actions: [{ id: 'reset', priority: 20 }],
      targets: [{ id: 'value', state: 'literal' }],
    })).toEqual({
      slots: 1,
      bindingEntry: 'combined',
      bindingState: 'literal',
      directActionIds: [],
      overflowActionIds: ['reset'],
    })

    expect(planPropertyActionRail({
      actionWidth: 76,
      actions: [
        { id: 'presence', priority: 10 },
        { id: 'reset', priority: 20 },
        { id: 'delete', priority: 30 },
      ],
      targets: [{ id: 'value', state: 'bound' }],
    })).toEqual({
      slots: 3,
      bindingEntry: 'direct',
      bindingState: 'bound',
      directActionIds: ['presence'],
      overflowActionIds: ['reset', 'delete'],
    })
  })

  it('为多目标生成一个目标聚合入口并使用最高严重度状态', () => {
    expect(planPropertyActionRail({
      actionWidth: 36,
      actions: [],
      targets: [
        { id: 'x', state: 'bound' },
        { id: 'y', state: 'invalid' },
      ],
    })).toEqual({
      slots: 1,
      bindingEntry: 'targets',
      bindingState: 'invalid',
      directActionIds: [],
      overflowActionIds: [],
    })
  })

  it('没有绑定目标时保持普通动作的既有溢出规划', () => {
    expect(planPropertyActionRail({
      actionWidth: 36,
      actions: [
        { id: 'presence', priority: 10 },
        { id: 'reset', priority: 20 },
      ],
      targets: [],
    })).toEqual({
      slots: 1,
      bindingEntry: 'none',
      directActionIds: [],
      overflowActionIds: ['presence', 'reset'],
    })
  })
})
