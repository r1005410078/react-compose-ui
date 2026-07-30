import { describe, expect, it } from 'vitest'
import type { ComposeGradientStop } from '@compose-ui/core'
import {
  gradientAngle,
  gradientPaintWithAngle,
  insertGradientStop,
  largestGradientGapPosition,
  moveGradientStop,
  nextGradientStopId,
  removeGradientStop,
  updateGradientGeometry,
  type ComposeGradientPaint,
} from './gradient-model'

function linear(stops: readonly ComposeGradientStop[]): ComposeGradientPaint {
  return {
    kind: 'linear-gradient',
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
    stops,
  }
}

describe('OpenSpec: components / Compose Color/Paint Picker 与会话颜色历史 / 完整管理渐变色标', () => {
  it('在最大空档左侧优先插入插值色标，并使用首个未占用 ID', () => {
    const source = linear([
      { id: 'paint-stop-0', position: 0, color: '#000000' },
      { id: 'paint-stop-end', position: 1, color: '#ffffff' },
    ])

    expect(largestGradientGapPosition(source.stops)).toBe(0.5)
    expect(nextGradientStopId(source.stops)).toBe('paint-stop-1')

    const first = insertGradientStop(source)!
    const second = insertGradientStop(first.paint)!
    expect(first.stop).toEqual({
      id: 'paint-stop-1',
      position: 0.5,
      color: '#808080',
    })
    expect(second.stop.position).toBe(0.25)
    expect(second.paint.stops.map((stop) => stop.position)).toEqual([0, 0.25, 0.5, 1])
  })

  it('限制 2–8 个色标，并在删除后选择右侧或最后一个相邻色标', () => {
    const source = linear([
      { id: 'a', position: 0, color: '#000000' },
      { id: 'b', position: 0.5, color: '#808080' },
      { id: 'c', position: 1, color: '#ffffff' },
    ])
    const middleRemoved = removeGradientStop(source, 'b')!
    expect(middleRemoved.selectedStopId).toBe('c')
    expect(removeGradientStop(middleRemoved.paint, 'a')).toBeNull()

    let maximum = source
    while (maximum.stops.length < 8) maximum = insertGradientStop(maximum)!.paint
    expect(insertGradientStop(maximum)).toBeNull()
  })

  it('稳定排序移动后的色标，并把位置限制在轨道范围', () => {
    const source = linear([
      { id: 'a', position: 0, color: '#000000' },
      { id: 'b', position: 0.5, color: '#808080' },
      { id: 'c', position: 1, color: '#ffffff' },
    ])
    const moved = moveGradientStop(source, 'b', 2)
    expect(moved.stops.map((stop) => [stop.id, stop.position])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 1],
    ])
  })
})

describe('OpenSpec: components / Compose Color/Paint Picker 与会话颜色历史 / 编辑三类渐变几何', () => {
  it('在线性方向角与端点间双向换算', () => {
    const source = linear([
      { id: 'a', position: 0, color: '#000000' },
      { id: 'b', position: 1, color: '#ffffff' },
    ])
    const vertical = gradientPaintWithAngle(source, 90)
    expect(vertical).toMatchObject({
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    })
    expect(gradientAngle(vertical)).toBe(90)
  })

  it('编辑径向中心和双轴半径，并编辑角向中心和起始角', () => {
    const radial: ComposeGradientPaint = {
      kind: 'radial-gradient',
      center: { x: 0.5, y: 0.5 },
      radiusX: 0.4,
      radiusY: 0.3,
      stops: [
        { id: 'a', position: 0, color: '#000000' },
        { id: 'b', position: 1, color: '#ffffff' },
      ],
    }
    expect(updateGradientGeometry(radial, 'radial-center', { x: 0.6, y: 0.7 }))
      .toMatchObject({ center: { x: 0.6, y: 0.7 } })
    expect(updateGradientGeometry(radial, 'radial-radius-y', { x: 0.5, y: 0.9 }))
      .toMatchObject({ radiusY: 0.4 })

    const angular: ComposeGradientPaint = {
      kind: 'angular-gradient',
      center: { x: 0.5, y: 0.5 },
      angle: 0,
      stops: radial.stops,
    }
    expect(updateGradientGeometry(angular, 'angular-center', { x: 0.4, y: 0.6 }))
      .toMatchObject({ center: { x: 0.4, y: 0.6 } })
    expect(updateGradientGeometry(angular, 'angular-arm', { x: 0.5, y: 1 }))
      .toMatchObject({ angle: 90 })
  })
})
