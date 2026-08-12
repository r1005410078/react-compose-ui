import { describe, expect, it } from 'vitest'
import {
  COMPOSE_INSTANCE_PATH_SEPARATOR,
  decodeComposeInstancePath,
  encodeComposeInstancePath,
  isComposeInstancePath,
  composeInstancePathHostId,
} from './index'

describe('组件实例复合地址', () => {
  it('宿主实体 ID 保持裸字符串且不被识别为复合地址', () => {
    expect(isComposeInstancePath('entity-1')).toBe(false)
    expect(composeInstancePathHostId('entity-1')).toBe('entity-1')
  })

  it('编解码单层实例内部地址', () => {
    const address = encodeComposeInstancePath(['instance-1', 'inner-a'])
    expect(address).toBe(`instance-1${COMPOSE_INSTANCE_PATH_SEPARATOR}inner-a`)
    expect(isComposeInstancePath(address)).toBe(true)
    const decoded = decodeComposeInstancePath(address)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.segments).toEqual(['instance-1', 'inner-a'])
  })

  it('嵌套实例逐层拼接并保留宿主实体 ID', () => {
    const address = encodeComposeInstancePath(['instance-1', 'inner-a', 'instance-2', 'inner-b'])
    expect(composeInstancePathHostId(address)).toBe('instance-1')
    const decoded = decodeComposeInstancePath(address)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.segments).toHaveLength(4)
  })

  it('拒绝含分隔符的实体 ID 以防地址歧义', () => {
    expect(() => encodeComposeInstancePath(['instance-1', `a${COMPOSE_INSTANCE_PATH_SEPARATOR}b`]))
      .toThrowError(/分隔符/)
  })

  it('拒绝空段与单段地址', () => {
    expect(() => encodeComposeInstancePath(['instance-1'])).toThrowError(/至少两段/)
    expect(decodeComposeInstancePath(`instance-1${COMPOSE_INSTANCE_PATH_SEPARATOR}`).ok).toBe(false)
  })

  it('拒绝超过八层嵌套的地址', () => {
    const segments = Array.from({ length: 18 }, (_, index) => `s-${index}`)
    expect(() => encodeComposeInstancePath(segments)).toThrowError(/嵌套层数/)
  })
})
