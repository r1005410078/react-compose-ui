import { describe, expect, it } from 'vitest'
import {
  evaluateComposePaintAtLocalPoint,
  isComposeColor,
  isValidComposePaint,
  normalizeComposeColor,
  normalizeComposePaint,
} from './paint'

describe('OpenSpec: compose-document / Paint v5', () => {
  it('规范化 HEX 与透明色，同时拒绝不是文档颜色的 CSS 字符串', () => {
    expect(normalizeComposeColor('#AbC')).toBe('#aabbcc')
    expect(normalizeComposeColor('#1234')).toBe('#11223344')
    expect(normalizeComposeColor('#ffffff00')).toBe('transparent')
    expect(isComposeColor('#aabbcc')).toBe(true)
    expect(isComposeColor('#ABC')).toBe(false)
    expect(normalizeComposeColor('rgb(1 2 3)')).toBeNull()
  })

  it('保持 2–8 个唯一 stop、有限几何和规范化角度的不变量', () => {
    const normalized = normalizeComposePaint({
      kind: 'angular-gradient',
      center: { x: 0.5, y: 0.5 },
      angle: 450,
      stops: [
        { id: 'end', position: 1, color: '#ffffff' },
        { id: 'start', position: 0, color: '#000000' },
      ],
    })
    expect(normalized).toEqual({
      kind: 'angular-gradient',
      center: { x: 0.5, y: 0.5 },
      angle: 90,
      stops: [
        { id: 'start', position: 0, color: '#000000' },
        { id: 'end', position: 1, color: '#ffffff' },
      ],
    })
    expect(isValidComposePaint(normalized)).toBe(true)
    expect(isValidComposePaint({ kind: 'solid', color: '#fff' })).toBe(false)
    expect(isValidComposePaint({
      kind: 'linear-gradient', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, stops: [],
    })).toBe(false)
  })

  it('在归一化局部坐标解析线性渐变颜色', () => {
    const paint = normalizeComposePaint({
      kind: 'linear-gradient',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      stops: [
        { id: 'black', position: 0, color: '#000000' },
        { id: 'white', position: 1, color: '#ffffff' },
      ],
    })
    expect(paint).not.toBeNull()
    if (paint) expect(evaluateComposePaintAtLocalPoint(paint, { x: 0.5, y: 0.5 })).toBe('#808080')
  })
})
