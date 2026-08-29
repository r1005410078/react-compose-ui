import { describe, expect, it } from 'vitest'
import { stageResizeReadout } from './resize-readout'

const viewport = { x: 0, y: 0, zoom: 1 }

describe('OpenSpec: stage / 缩放手柄的尺寸读数', () => {
  it('两个框是新包围盒的宽与高', () => {
    const annotation = stageResizeReadout(
      { origin: { x: 10, y: 20 }, point: { x: 210, y: 140 } },
      viewport,
    )

    expect(annotation.boxes.map(({ text }) => text)).toEqual(['200', '120'])
  })

  it('读数不挂光标条也不挂锁', () => {
    /*
     * 光标条是「这里能打字」的那个记号。读数不可键入，挂上它就是在撒谎——而两个东西长得
     * 一样却行为不同，是最难自己发现的一类缺陷。
     */
    const annotation = stageResizeReadout(
      { origin: { x: 0, y: 0 }, point: { x: 100, y: 60 } },
      viewport,
    )

    expect(annotation.boxes.map(({ state }) => state)).toEqual(['idle', 'idle'])
    expect(annotation.boxes.map(({ adornment }) => adornment)).toEqual([null, null])
  })

  it('读的是量值，反向拖不出现负数', () => {
    // `cartesian` 返回量值：屏幕上出现 `-200` 会让用户以为自己拖错了方向。
    const annotation = stageResizeReadout(
      { origin: { x: 210, y: 140 }, point: { x: 10, y: 20 } },
      viewport,
    )

    expect(annotation.boxes.map(({ text }) => text)).toEqual(['200', '120'])
  })

  it('框位置跟着视口缩放走', () => {
    // `world = (屏幕 − 视口) / zoom`：读数画在屏幕上，缩放变了框就得跟着挪。
    const at = (zoom: number) => stageResizeReadout(
      { origin: { x: 0, y: 0 }, point: { x: 100, y: 60 } },
      { x: 0, y: 0, zoom },
    ).boxes[0]!

    expect(at(2).x).not.toBeCloseTo(at(1).x)
    // 数值本身是世界量，与缩放无关。
    expect(at(2).text).toBe(at(1).text)
  })
})
