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
    /*
     * 这条用例原本拿 `boundaryIds` 当未知字段的例子，理由是「存了就要回答这条边是与哪个对象
     * 的第几个交点」。那条禁令**针对的是「边」级引用**（第几个交点、用到了哪几段），而
     * `boundaryIds` 是 **Entity 级**的，它不回答那个问题，因此被放行。禁令的「边」级那一半
     * 原样成立——段下标在顶点被增删之后就错位，所以仍然不存。
     */
    expect(isValidComposeHatch({ seed: { x: 0, y: 0 }, boundaryEdges: [0, 1] })).toBe(false)
    expect(isValidComposeHatch({ seed: { x: 0, y: 0 }, rings: [] })).toBe(false)
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

  it('边界清单缺席时合法——缺席即不跟随，因此既有文档不需要迁移', () => {
    expect(issueCodes({ Curve: closedSquare, Hatch: { seed: { x: 50, y: 50 } } })).toEqual([])
  })

  it('带边界清单时合法', () => {
    expect(issueCodes({
      Curve: closedSquare,
      Hatch: { seed: { x: 50, y: 50 }, boundaryIds: ['rect', 'circle'] },
    })).toEqual([])
  })

  it('空的边界清单非法', () => {
    // 缺席与空列表会让「跟不跟随」在两处读出不同答案，与 Ports「空 items 非法」同一条判断。
    expect(issueCodes({
      Curve: closedSquare,
      Hatch: { seed: { x: 50, y: 50 }, boundaryIds: [] },
    })).toContain('hatch.invalid')
  })

  it('清单里混进非字符串时非法', () => {
    expect(issueCodes({
      Curve: closedSquare,
      Hatch: { seed: { x: 50, y: 50 }, boundaryIds: ['rect', 7] },
    })).toContain('hatch.invalid')
  })
})
