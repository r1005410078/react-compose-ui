import { describe, expect, it } from 'vitest'
import { CAD_COMPONENT_KEYS, createCadLineEntity, getCadInsert, getCadLine } from '../document'
import { translateCadEntity } from './cad-translate'

describe('CAD 位移', () => {
  it('OpenSpec: cad-document / CAD 几何位移 / 直线两端各加位移', () => {
    const line = createCadLineEntity('line-1', {
      layerId: '0', start: { x: 10, y: 20 }, end: { x: 40, y: 60 },
    })
    const moved = translateCadEntity(line, { x: 5, y: -3 })
    expect(getCadLine(moved)).toEqual({ start: { x: 15, y: 17 }, end: { x: 45, y: 57 } })
  })

  /**
   * @remarks
   * 块存在的理由就是「改一次定义，全部实例跟着变」。位移若下沉到块内几何，移动一个实例会把
   * 所有实例一起搬走——而那种缺陷要等到图上有第二个实例才暴露。
   */
  it('OpenSpec: cad-document / CAD 几何位移 / 块实例只改插入点', () => {
    const instance = {
      id: 'insert-1',
      name: 'Insert',
      components: {
        [CAD_COMPONENT_KEYS.placement]: { layerId: '0' },
        [CAD_COMPONENT_KEYS.insert]: {
          blockId: 'block-1',
          position: { x: 100, y: 50 },
          rotation: 30,
          scale: { x: 1, y: -1 },
        },
      },
    }
    const moved = translateCadEntity(instance, { x: -10, y: 10 })
    expect(getCadInsert(moved)).toEqual({
      blockId: 'block-1',
      position: { x: 90, y: 60 },
      rotation: 30,
      scale: { x: 1, y: -1 },
    })
  })

  it('OpenSpec: cad-document / CAD 几何位移 / 认不出的 Entity 原样返回', () => {
    const stranger = { id: 'x', name: 'X', components: { Unknown: { value: 1 } } }
    expect(translateCadEntity(stranger, { x: 5, y: 5 })).toBe(stranger)
  })
})
