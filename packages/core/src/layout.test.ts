import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('Compose Flex Layout', () => {
  it('OpenSpec: compose-document / 可选 Flex Layout Component / 保存合法 Flex 布局（默认值与校验 API）', () => {
    const createDefault = Reflect.get(core, 'createDefaultComposeFlexLayout')
    const isValid = Reflect.get(core, 'isValidComposeLayout')
    expect(typeof createDefault).toBe('function')
    expect(typeof isValid).toBe('function')
    if (typeof createDefault !== 'function' || typeof isValid !== 'function') return

    const first = createDefault()
    const second = createDefault()
    expect(first).toEqual({
      type: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignContent: 'stretch',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      rowGap: 0,
      columnGap: 0,
    })
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(isValid(first)).toBe(true)
    expect(isValid({ ...first, rowGap: -1 })).toBe(false)
  })
})
