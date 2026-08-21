import { describe, expect, it } from 'vitest'
import { instanceSelectionScreenBounds } from './instance-selection-bounds'

function rectOf(x: number, y: number, width: number, height: number) {
  return () => ({
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect
}

/** 搭一个 surface > 实例节点 > 内部实体 的最小 DOM。 */
function surfaceWith(innerId: string) {
  const surface = document.createElement('div')
  surface.getBoundingClientRect = rectOf(100, 50, 800, 600)
  const host = document.createElement('div')
  host.dataset.entityId = 'instance-1'
  const inner = document.createElement('div')
  inner.dataset.componentInstanceEntityId = innerId
  inner.getBoundingClientRect = rectOf(180, 120, 240, 140)
  host.append(inner)
  surface.append(host)
  return surface
}

describe('实例内部选中框几何', () => {
  it('把内部实体视口矩形转换为 surface 相对坐标', () => {
    const surface = surfaceWith('inner-1')
    expect(instanceSelectionScreenBounds(surface, 'instance-1/inner-1')).toEqual({
      x: 80,
      y: 70,
      width: 240,
      height: 140,
    })
  })

  it('非复合地址返回 null', () => {
    const surface = surfaceWith('inner-1')
    expect(instanceSelectionScreenBounds(surface, 'instance-1')).toBeNull()
  })

  it('内部实体尚未渲染时返回 null', () => {
    const surface = surfaceWith('inner-1')
    // 快照切换或未展开时对应 DOM 可能还不存在，不能抛错。
    expect(instanceSelectionScreenBounds(surface, 'instance-1/missing')).toBeNull()
  })

  it('宿主实例不在 surface 中时返回 null', () => {
    const surface = surfaceWith('inner-1')
    expect(instanceSelectionScreenBounds(surface, 'other/inner-1')).toBeNull()
  })
})
