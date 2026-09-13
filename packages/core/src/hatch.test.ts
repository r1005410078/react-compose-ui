import { describe, expect, it } from 'vitest'
import { collectComposeHatchValidationIssues, getComposeHatch, isValidComposeHatch } from './hatch'
import { validateComposeDocument } from './document'
import type { ComposeEntity, JsonObject } from './document-types'
import { documentFixture, rendererEntity } from './test-fixtures'

describe('Hatch Component', () => {
  it('接受一个带有限落点的填充', () => {
    expect(isValidComposeHatch({ seed: { x: 12.5, y: -3 } })).toBe(true)
  })

  it('拒绝缺席或非有限的 seed', () => {
    expect(isValidComposeHatch({})).toBe(false)
    expect(isValidComposeHatch({ seed: { x: 0, y: Number.NaN } })).toBe(false)
    expect(collectComposeHatchValidationIssues({}).map(({ path }) => path)).toEqual([['seed']])
  })

  it('拒绝未知字段', () => {
    // 边界对象的标识刻意不存：存了就要回答「这条边是与哪个对象的第几个交点」。
    expect(isValidComposeHatch({ seed: { x: 0, y: 0 }, boundaryIds: ['a'] })).toBe(false)
  })

  it('缺席即不是填充', () => {
    const entity = { id: 'a', name: 'a', components: {} } satisfies ComposeEntity
    expect(getComposeHatch(entity)).toBeUndefined()
    expect(getComposeHatch(undefined)).toBeUndefined()
  })
})

describe('Hatch 的文档级组合', () => {
  const closedSquare = {
    kind: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    closed: true,
  }

  function issueCodes(components: Readonly<Record<string, JsonObject>>) {
    const result = validateComposeDocument(
      documentFixture({ hatched: rendererEntity('hatched', { components }) }),
    )
    return result.valid ? [] : result.issues.map(({ code }) => code)
  }

  it('与 Curve 组合时合法', () => {
    expect(issueCodes({ Curve: closedSquare, Hatch: { seed: { x: 50, y: 50 } } })).toEqual([])
  })

  it('没有 Curve 时拒绝', () => {
    expect(issueCodes({ Hatch: { seed: { x: 50, y: 50 } } })).toContain('hatch.missing-curve')
  })

  it('字段非法时报 hatch.invalid', () => {
    expect(issueCodes({ Curve: closedSquare, Hatch: {} })).toContain('hatch.invalid')
  })
})
