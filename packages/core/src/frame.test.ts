import { describe, expect, it } from 'vitest'
import {
  createComposeFrame,
  getComposeFrameGuides,
  isComposeFrameEntity,
  isWithinFrame,
  listComposeFrameIds,
  resolveOwningFrameId,
} from './frame'
import { validateComposeDocument } from './document'
import { ROOT_FRAME_ID, containerEntity, documentFixture, frameEntity, rendererEntity } from './test-fixtures'

/** 根 Frame → Container → 嵌套 Frame → 叶子的四层文档。 */
function nestedDocument() {
  const document = documentFixture(
    {
      outer: containerEntity('outer', ['inner-frame']),
      'inner-frame': frameEntity('inner-frame', ['leaf'], { width: 200, height: 120 }),
      leaf: rendererEntity('leaf'),
    },
    ['outer'],
  )
  expect(validateComposeDocument(document).valid).toBe(true)
  return document
}

describe('Frame Component 与隔离边界', () => {
  it('createComposeFrame 每次返回可独立修改的新对象', () => {
    const first = createComposeFrame()
    const second = createComposeFrame()
    expect(first).toEqual(second)
    expect(first.size).not.toBe(second.size)
    expect(first.guides).toEqual([])
  })

  it('isComposeFrameEntity 只认 Frame Component', () => {
    const document = nestedDocument()
    expect(isComposeFrameEntity(document.entities[ROOT_FRAME_ID])).toBe(true)
    expect(isComposeFrameEntity(document.entities.outer)).toBe(false)
    expect(isComposeFrameEntity(undefined)).toBe(false)
  })

  it('resolveOwningFrameId 返回最近祖先 Frame 而不是文档根', () => {
    const document = nestedDocument()
    expect(resolveOwningFrameId(document, 'leaf')).toBe('inner-frame')
    expect(resolveOwningFrameId(document, 'outer')).toBe(ROOT_FRAME_ID)
    // Frame 自身的动画清单挂在它自己身上，因此它属于自己。
    expect(resolveOwningFrameId(document, 'inner-frame')).toBe('inner-frame')
    expect(resolveOwningFrameId(document, 'missing')).toBeNull()
  })

  it('isWithinFrame 以最近 Frame 判定跨边界', () => {
    const document = nestedDocument()
    expect(isWithinFrame(document, 'leaf', 'inner-frame')).toBe(true)
    // leaf 在嵌套 Frame 内，因此不属于外层 Frame 的动画时间轴。
    expect(isWithinFrame(document, 'leaf', ROOT_FRAME_ID)).toBe(false)
  })

  it('listComposeFrameIds 列出全部 Frame', () => {
    expect([...listComposeFrameIds(nestedDocument())].sort()).toEqual(['frame-root', 'inner-frame'])
  })

  it('getComposeFrameGuides 归一化缺省 guides', () => {
    const document = nestedDocument()
    expect(getComposeFrameGuides(document.entities[ROOT_FRAME_ID])).toEqual([])
    expect(getComposeFrameGuides(document.entities.leaf)).toEqual([])
  })
})
