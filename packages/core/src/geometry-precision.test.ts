import { describe, expect, it } from 'vitest'
import {
  COMPOSE_GEOMETRY_PRECISION,
  formatComposeNumber,
  roundComposeGeometry,
} from './geometry-precision'

describe('几何数值精度约定', () => {
  it('量化掉浮点残渣', () => {
    expect(roundComposeGeometry(82.96874999999991)).toBe(82.97)
    expect(roundComposeGeometry(373.3592610597958)).toBe(373.36)
  })

  it('已经是整数的值不引入误差', () => {
    expect(roundComposeGeometry(80)).toBe(80)
    expect(roundComposeGeometry(0)).toBe(0)
    expect(roundComposeGeometry(-16)).toBe(-16)
  })

  it('负数按绝对值同样精度量化', () => {
    expect(roundComposeGeometry(-82.96874999999991)).toBe(-82.97)
  })

  it('非有限数原样返回——量化不承担校验职责', () => {
    expect(roundComposeGeometry(Number.NaN)).toBeNaN()
    expect(roundComposeGeometry(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })

  it('格式化整数不补零、小数不留尾随零', () => {
    expect(formatComposeNumber(1280)).toBe('1280')
    expect(formatComposeNumber(82.96874999999991)).toBe('82.97')
    expect(formatComposeNumber(0.5)).toBe('0.5')
    expect(formatComposeNumber(0.5000001)).toBe('0.5')
    expect(formatComposeNumber(-0)).toBe('0')
  })

  it('精度常量与实现一致', () => {
    expect(COMPOSE_GEOMETRY_PRECISION).toBe(2)
    expect(formatComposeNumber(1 / 3)).toBe('0.33')
  })
})
