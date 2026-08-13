import { describe, expect, it } from 'vitest'
import type { ComposeEntity } from './document-types'
import { containerEntity, documentFixture, rendererEntity } from './test-fixtures'
import {
  collectComposeSwitcherHiddenIds,
  isValidComposeWidgetSwitcher,
  resolveComposeActiveChildId,
  resolveComposeSwitcherPreview,
} from './widget-switcher'

function switcherEntity(
  id: string,
  childIds: readonly string[],
  activeIndex = 0,
): ComposeEntity {
  const base = containerEntity(id, childIds)
  return {
    ...base,
    components: { ...base.components, WidgetSwitcher: { activeIndex } },
  }
}

describe('WidgetSwitcher 活动子项解析', () => {
  it('OpenSpec: 可选 WidgetSwitcher Component / 索引越界钳制', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b'], 5),
      a: rendererEntity('a'),
      b: rendererEntity('b'),
    }, ['switcher'])
    expect(resolveComposeActiveChildId(value, 'switcher')).toBe('b')
    // 钳制只发生在读取侧，文档本身不被改写。
    expect(value.entities.switcher!.components.WidgetSwitcher).toEqual({ activeIndex: 5 })
  })

  it('OpenSpec: 可选 WidgetSwitcher Component / 空 switcher', () => {
    const value = documentFixture({ switcher: switcherEntity('switcher', []) }, ['switcher'])
    expect(resolveComposeActiveChildId(value, 'switcher')).toBeNull()
    expect(collectComposeSwitcherHiddenIds(value).size).toBe(0)
  })

  it('负索引钳制到首个子项，非 switcher 返回 null', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b'], -3),
      container: containerEntity('container', ['a']),
      a: rendererEntity('a'),
      b: rendererEntity('b'),
    }, ['switcher', 'container'])
    expect(resolveComposeActiveChildId(value, 'switcher')).toBe('a')
    expect(resolveComposeActiveChildId(value, 'container')).toBeNull()
    expect(resolveComposeActiveChildId(value, 'missing')).toBeNull()
  })
})

describe('WidgetSwitcher 隐藏集合', () => {
  it('OpenSpec: 可选 WidgetSwitcher Component / 只隐藏非活动直接子项', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b'], 0),
      container: containerEntity('container', ['c']),
      a: containerEntity('a', ['a-child']),
      'a-child': rendererEntity('a-child'),
      b: containerEntity('b', ['b-child']),
      'b-child': rendererEntity('b-child'),
      c: rendererEntity('c'),
    }, ['switcher', 'container'])
    const hidden = collectComposeSwitcherHiddenIds(value)
    // 后代由各渲染入口的递归自然剪掉，集合里只保留直接子项。
    expect([...hidden]).toEqual(['b'])
    expect(value.entities.b!.components.Visibility).toEqual({ visible: true })
  })

  it('OpenSpec: 可选 WidgetSwitcher Component / 预览覆盖优先于活动索引', () => {
    const value = documentFixture({
      first: switcherEntity('first', ['a', 'b'], 0),
      second: switcherEntity('second', ['c', 'd'], 0),
      a: rendererEntity('a'),
      b: rendererEntity('b'),
      c: rendererEntity('c'),
      d: rendererEntity('d'),
    }, ['first', 'second'])
    const hidden = collectComposeSwitcherHiddenIds(value, {
      previewChildIdByEntityId: { first: 'b' },
    })
    expect([...hidden].sort()).toEqual(['a', 'd'])
  })

  it('预览目标不是该 switcher 的直接子项时回落到活动索引', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b'], 1),
      a: rendererEntity('a'),
      b: rendererEntity('b'),
    }, ['switcher'])
    const hidden = collectComposeSwitcherHiddenIds(value, {
      previewChildIdByEntityId: { switcher: 'stranger' },
    })
    expect([...hidden]).toEqual(['a'])
  })
})

describe('isValidComposeWidgetSwitcher', () => {
  it('只接受整数 activeIndex', () => {
    expect(isValidComposeWidgetSwitcher({ activeIndex: 0 })).toBe(true)
    expect(isValidComposeWidgetSwitcher({ activeIndex: -1 })).toBe(true)
    expect(isValidComposeWidgetSwitcher({ activeIndex: 1.5 })).toBe(false)
    expect(isValidComposeWidgetSwitcher({})).toBe(false)
    expect(isValidComposeWidgetSwitcher(null)).toBe(false)
  })
})

describe('选中即预览派生', () => {
  it('OpenSpec: 选中 WidgetSwitcher 后代时临时预览该分支 / 选中非活动子项', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b'], 0),
      a: rendererEntity('a'),
      b: containerEntity('b', ['leaf']),
      leaf: rendererEntity('leaf'),
    }, ['switcher'])
    // 选中的是深层后代，覆盖仍要落到 switcher 的直接子项上。
    const preview = resolveComposeSwitcherPreview(value, ['leaf'])
    expect(preview.previewChildIdByEntityId).toEqual({ switcher: 'b' })
    expect([...collectComposeSwitcherHiddenIds(value, preview)]).toEqual(['a'])
  })

  it('OpenSpec: 选中 WidgetSwitcher 后代时临时预览该分支 / 取消选择后回到活动索引', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b'], 0),
      a: rendererEntity('a'),
      b: rendererEntity('b'),
    }, ['switcher'])
    const preview = resolveComposeSwitcherPreview(value, [])
    expect(preview.previewChildIdByEntityId).toEqual({})
    expect([...collectComposeSwitcherHiddenIds(value, preview)]).toEqual(['b'])
  })

  it('同一 switcher 的多个分支被同时选中时只预览第一个', () => {
    const value = documentFixture({
      switcher: switcherEntity('switcher', ['a', 'b', 'c'], 0),
      a: rendererEntity('a'),
      b: rendererEntity('b'),
      c: rendererEntity('c'),
    }, ['switcher'])
    const preview = resolveComposeSwitcherPreview(value, ['c', 'b'])
    expect(preview.previewChildIdByEntityId).toEqual({ switcher: 'c' })
  })

  it('嵌套 switcher 逐层预览到根', () => {
    const value = documentFixture({
      outer: switcherEntity('outer', ['x', 'y'], 0),
      x: rendererEntity('x'),
      y: switcherEntity('y', ['m', 'n'], 0),
      m: rendererEntity('m'),
      n: rendererEntity('n'),
    }, ['outer'])
    const preview = resolveComposeSwitcherPreview(value, ['n'])
    expect(preview.previewChildIdByEntityId).toEqual({ outer: 'y', y: 'n' })
    expect([...collectComposeSwitcherHiddenIds(value, preview)].sort()).toEqual(['m', 'x'])
  })
})
