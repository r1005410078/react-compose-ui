import { describe, expect, it } from 'vitest'
import { nextInstanceDrillDownTarget, resolveInstanceDrillDownPath } from './instance-drilldown'

/** 用绝对坐标搭一棵内部实体 DOM，jsdom 不做布局，因此直接桩掉 getBoundingClientRect。 */
function node(id: string, rect: { x: number; y: number; width: number; height: number }) {
  const element = document.createElement('div')
  element.dataset.componentInstanceEntityId = id
  element.getBoundingClientRect = () => ({
    x: rect.x,
    y: rect.y,
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  }) as DOMRect
  return element
}

/** 组件根始终是实例内最外层的标记元素，测试夹具据此搭建。 */
function hostWithRoot() {
  const host = document.createElement('div')
  const root = node('component-root', { x: 0, y: 0, width: 200, height: 200 })
  host.append(root)
  return { host, root }
}

describe('组件实例内部下钻命中', () => {
  it('命中路径由浅到深且不含组件根', () => {
    const { host, root } = hostWithRoot()
    const outer = node('outer', { x: 0, y: 0, width: 100, height: 100 })
    const inner = node('inner', { x: 10, y: 10, width: 20, height: 20 })
    outer.append(inner)
    root.append(outer)

    expect(resolveInstanceDrillDownPath(host, { x: 15, y: 15 })).toEqual(['outer', 'inner'])
    // 只落在外层范围内时停在外层，不会误报更深的兄弟节点。
    expect(resolveInstanceDrillDownPath(host, { x: 80, y: 80 })).toEqual(['outer'])
  })

  it('只命中组件根时路径为空', () => {
    const { host } = hostWithRoot()
    // 组件根等同于实例节点本身，不应产生内部选区。
    expect(resolveInstanceDrillDownPath(host, { x: 5, y: 5 })).toEqual([])
  })

  it('点在所有内部实体之外时返回空路径', () => {
    const { host } = hostWithRoot()
    expect(resolveInstanceDrillDownPath(host, { x: 500, y: 500 })).toEqual([])
  })

  it('同层重叠时取 DOM 顺序靠后的节点', () => {
    const { host, root } = hostWithRoot()
    // 后渲染的兄弟在上层，命中应与视觉层叠一致。
    root.append(node('below', { x: 0, y: 0, width: 50, height: 50 }))
    root.append(node('above', { x: 0, y: 0, width: 50, height: 50 }))
    expect(resolveInstanceDrillDownPath(host, { x: 10, y: 10 })).toEqual(['above'])
  })

  it('逐层下钻：一次双击只前进一层', () => {
    const path = ['a', 'b', 'c']
    expect(nextInstanceDrillDownTarget(path, null)).toBe('a')
    expect(nextInstanceDrillDownTarget(path, 'a')).toBe('b')
    expect(nextInstanceDrillDownTarget(path, 'b')).toBe('c')
    // 已在最深层则保持不动，避免末端双击产生选区抖动。
    expect(nextInstanceDrillDownTarget(path, 'c')).toBe('c')
    // 当前选区不在本次命中路径上时从最浅层重新开始。
    expect(nextInstanceDrillDownTarget(path, 'x')).toBe('a')
    expect(nextInstanceDrillDownTarget([], 'a')).toBeNull()
  })
})
