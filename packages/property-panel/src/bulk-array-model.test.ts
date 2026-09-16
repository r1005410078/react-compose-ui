import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  formatComposeBulkArray,
  isComposeBulkArrayItem,
  parseComposeBulkArray,
} from './bulk-array-model'

const numberSchema = v.pipe(v.number(), v.minValue(0))

describe('OpenSpec: property-panel / 基本类型数组的批量录入', () => {
  it('换行、制表符与逗号解析出同一串数', () => {
    // 从表格里复制一列得到换行、复制一行得到制表符、从 CSV 粘来得到逗号，
    // 用户不该为了这个差别做第二次操作。
    const expected = { ok: true, items: [18, 28, 22] }
    for (const text of ['18\n28\n22', '18\t28\t22', '18,28,22', ' 18 , 28 ,\n 22 ']) {
      expect(parseComposeBulkArray(text, numberSchema, 'number'), text).toEqual(expected)
    }
  })

  it('空项丢掉，首尾空白去掉', () => {
    expect(parseComposeBulkArray('18\n\n\n28\n', numberSchema, 'number'))
      .toEqual({ ok: true, items: [18, 28] })
  })

  it('非法项整体拒绝并报出是第几项', () => {
    /*
     * 判别性的那一半：只收合法的那些会让用户贴进 20 个数、看到 18 个，而屏幕上没有任何
     * 东西说明少掉的是哪两个。
     */
    expect(parseComposeBulkArray('18\n28\nabc\n36', numberSchema, 'number'))
      .toEqual({ ok: false, position: 3, text: 'abc' })
    // `12abc` 必须被拒而不是读成 12——那正是 parseFloat 会犯的错。
    expect(parseComposeBulkArray('12abc', numberSchema, 'number'))
      .toEqual({ ok: false, position: 1, text: '12abc' })
    // Schema 自己的约束同样算数。
    expect(parseComposeBulkArray('18\n-3', numberSchema, 'number'))
      .toEqual({ ok: false, position: 2, text: '-3' })
  })

  it('渲染与解析往返恒等，「打开不改再确认」因此无变化', () => {
    const items = [18, 28, 22, 36]
    expect(parseComposeBulkArray(formatComposeBulkArray(items), numberSchema, 'number'))
      .toEqual({ ok: true, items })
  })

  it('只有基本类型进这个入口', () => {
    expect(isComposeBulkArrayItem('number')).toBe(true)
    expect(isComposeBulkArrayItem('string')).toBe(true)
    // 「一行一个对象」没有意义。
    expect(isComposeBulkArrayItem('object')).toBe(false)
    expect(isComposeBulkArrayItem('array')).toBe(false)
  })
})
