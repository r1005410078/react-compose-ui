import { describe, expect, it } from 'vitest'
import {
  DYNAMIC_INPUT_BOX_HEIGHT,
  dynamicInputBoxWidth,
  resolveStageDynamicInput,
} from './dynamic-input-geometry'

const idle = { text: '0', state: 'idle' } as const

/** 从一条 `M x y L x y` 取出两个端点。 */
function lineEnds(d: string) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  return { a: { x: nums[0]!, y: nums[1]! }, b: { x: nums[2]!, y: nums[3]! } }
}

describe('OpenSpec: stage / 取点过程中的动态输入', () => {
  describe('绝对坐标', () => {
    it('两个框并排贴在光标右下且带 X/Y 前缀，不画任何标注', () => {
      const result = resolveStageDynamicInput({
        kind: 'absolute',
        origin: null,
        point: { x: 200, y: 150 },
        first: { text: '1240', state: 'active' },
        second: { text: '620', state: 'idle' },
      })
      expect(result.guides).toHaveLength(0)
      expect(result.boxes.map((box) => box.prefix)).toEqual(['X', 'Y'])
      expect(result.boxes[0]!.y).toBe(result.boxes[1]!.y)
      expect(result.boxes[0]!.x).toBeGreaterThan(200)
      // 并排：第二个框紧跟在第一个右边。
      expect(result.boxes[1]!.x).toBeGreaterThan(result.boxes[0]!.x + result.boxes[0]!.width)
    })
  })

  describe('极坐标', () => {
    const origin = { x: 200, y: 300 }
    const point = { x: 500, y: 300 }

    it('角度弧的半径等于当前长度', () => {
      const result = resolveStageDynamicInput({
        kind: 'polar', origin, point: { x: 400, y: 200 },
        first: { text: '283', state: 'idle' }, second: { text: '45°', state: 'idle' },
      })
      const length = Math.hypot(400 - origin.x, 200 - origin.y)
      const arc = result.guides.find((d) => d.includes('A'))!
      const radii = arc.match(/A(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/)!
      expect(Number(radii[1])).toBeCloseTo(length, 6)
      // 固定的小半径在小角度下退化成几个像素，等于没画。
      expect(Number(radii[2])).toBeCloseTo(length, 6)
    })

    it('长度框落在标注线的中点上，标注在框后断开', () => {
      const result = resolveStageDynamicInput({
        kind: 'polar', origin, point,
        first: { text: '300', state: 'idle' }, second: { text: '0°', state: 'idle' },
      })
      const boxWidth = dynamicInputBoxWidth('300')
      const lengthBox = result.boxes[0]!
      // 标注线与预览线平行、垂直偏移；水平线的标注因此也是水平的，中点 x 在两端之间。
      expect(lengthBox.x + boxWidth / 2).toBeCloseTo((origin.x + point.x) / 2, 6)

      // 断开的两段各自的近端，正好落在框的两侧。
      const segments = result.guides
        .map(lineEnds)
        .filter(({ a, b }) => Math.abs(a.y - b.y) < 0.001 && a.y !== origin.y)
      expect(segments).toHaveLength(2)
      const gapLeft = Math.max(...segments.map(({ b }) => b.x).filter((x) => x < point.x))
      expect(gapLeft).toBeLessThan(lengthBox.x)
    })

    it('弧短于框宽时不断开，框推到弧的径向外侧', () => {
      // 5° 的小角：弧长远小于框宽，断开会让框把整条弧吃掉。
      const radians = (5 * Math.PI) / 180
      const near = { x: origin.x + 60 * Math.cos(radians), y: origin.y + 60 * Math.sin(radians) }
      const result = resolveStageDynamicInput({
        kind: 'polar', origin, point: near,
        first: { text: '60', state: 'idle' }, second: { text: '5°', state: 'idle' },
      })
      const arcs = result.guides.filter((d) => d.includes('A'))
      expect(arcs).toHaveLength(1)
      // 框心到原点比半径更远——它在弧的外面。
      const angleBox = result.boxes[1]!
      const center = {
        x: angleBox.x + angleBox.width / 2,
        y: angleBox.y + DYNAMIC_INPUT_BOX_HEIGHT / 2,
      }
      expect(Math.hypot(center.x - origin.x, center.y - origin.y)).toBeGreaterThan(60)
    })

    it('锁定长度时画一个半径等于该长度的圆', () => {
      const result = resolveStageDynamicInput({
        kind: 'polar', origin, point,
        first: { text: '300', state: 'locked' }, second: { text: '0°', state: 'active' },
      })
      expect(result.locks).toHaveLength(1)
      expect(result.locks[0]).toContain('A300 300')
    })
  })

  describe('直角坐标', () => {
    const origin = { x: 200, y: 400 }

    it('标注摆在靠近光标的那两条边外侧', () => {
      // 往右上拖：宽标注在上边之上、高标注在右边之右。
      const upRight = resolveStageDynamicInput({
        kind: 'cartesian', origin, point: { x: 500, y: 200 },
        first: { text: '300', state: 'active' }, second: { text: '200', state: 'idle' },
      })
      expect(upRight.boxes[0]!.y).toBeLessThan(200)
      expect(upRight.boxes[1]!.x).toBeGreaterThan(500)

      // 往左下拖：两条都换边，否则视线要在光标与标注之间来回跳。
      const downLeft = resolveStageDynamicInput({
        kind: 'cartesian', origin, point: { x: -100, y: 600 },
        first: { text: '300', state: 'active' }, second: { text: '200', state: 'idle' },
      })
      expect(downLeft.boxes[0]!.y).toBeGreaterThan(600)
      expect(downLeft.boxes[1]!.x).toBeLessThan(-100)
    })

    it('不画角度弧', () => {
      const result = resolveStageDynamicInput({
        kind: 'cartesian', origin, point: { x: 500, y: 200 },
        first: idle, second: idle,
      })
      // 矩形轴对齐，角度恒为 0——画一条永远指向 0° 的弧是噪音。
      expect(result.guides.filter((d) => d.includes('A'))).toHaveLength(0)
    })

    it('锁定宽度时画一条竖线示意锁在哪', () => {
      const result = resolveStageDynamicInput({
        kind: 'cartesian', origin, point: { x: 500, y: 200 },
        first: { text: '300', state: 'locked' }, second: { text: '200', state: 'active' },
      })
      expect(result.locks).toHaveLength(1)
      expect(result.locks[0]).toContain('M500 ')
    })
  })

  describe('单字段：半径与直径', () => {
    const origin = { x: 200, y: 200 }
    const point = { x: 350, y: 200 }
    const first = { text: '150', state: 'active' } as const

    it('只出一个框，且不画角度弧', () => {
      const result = resolveStageDynamicInput({
        kind: 'radius', origin, point, first, second: idle,
      })
      // 圆是旋转对称的，半径点的角度对结果没有任何影响。
      expect(result.boxes).toHaveLength(1)
      expect(result.guides.filter((d) => d.includes('A'))).toHaveLength(0)
      // 锁定是 `Tab` 的产物，而 `Tab` 在只有一个字段时没有去处。
      expect(result.locks).toHaveLength(0)
    })

    it('直径的标注跨整条直径，框带 ⌀ 前缀', () => {
      const result = resolveStageDynamicInput({
        kind: 'diameter', origin, point, first: { text: '300', state: 'active' }, second: idle,
      })
      expect(result.boxes[0]!.prefix).toBe('\u2300')
      // 延伸线的两端是落点与它关于圆心的对径点（50,200），不是圆心。
      expect(result.guides[0]).toContain('M50 200')
      expect(result.guides[1]).toContain('M350 200')
    })
  })

  describe('被量的那一段', () => {
    const origin = { x: 200, y: 200 }
    const point = { x: 350, y: 200 }

    it('声明了才画，且直径跨整条直径', () => {
      const base = { origin, point, first: idle, second: idle }
      // 提示没声明：那条命令的预览几何里已经含了这一段，再画一遍就是同一条线加粗。
      expect(resolveStageDynamicInput({ ...base, kind: 'polar' }).measured).toBeNull()
      expect(resolveStageDynamicInput({ ...base, kind: 'polar', measured: true }).measured)
        .toBe('M200 200L350 200')
      expect(resolveStageDynamicInput({ ...base, kind: 'diameter', measured: true }).measured)
        .toBe('M50 200L350 200')
    })
  })

  describe('候选落点到光标的连线', () => {
    it('两点分开时接上，重合时为 null', () => {
      const base = {
        kind: 'polar' as const, origin: { x: 200, y: 200 }, first: idle, second: idle,
      }
      // 正在键入：几何停在 400，光标还在 500。
      expect(resolveStageDynamicInput({
        ...base, point: { x: 400, y: 200 }, cursor: { x: 500, y: 200 },
      }).connector).toBe('M400 200L500 200')

      // 没在键入：两者重合，连线没有可说的东西。
      expect(resolveStageDynamicInput({
        ...base, point: { x: 500, y: 200 }, cursor: { x: 500, y: 200 },
      }).connector).toBeNull()

      // 调用方没给光标：不画。
      expect(resolveStageDynamicInput({
        ...base, point: { x: 500, y: 200 },
      }).connector).toBeNull()
    })
  })
})
