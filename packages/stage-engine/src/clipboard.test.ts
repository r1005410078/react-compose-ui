import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeHierarchy,
  getComposeLayoutItem,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  createEntityClipboard,
  createPasteFromClipboard,
  isInvalidCutInsertion,
  resolveSuggestedEntityInsertion,
} from './clipboard'
import { document, entity } from './test-fixtures'

describe('entity clipboard planner', () => {
  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 规范化多选复制来源', () => {
    const child = entity('child')
    const locked = entity('locked', { locked: true })
    const container = entity('container', { childIds: ['child'] })
    const value = document([container, child, locked], ['container', 'locked'])

    expect(createEntityClipboard(value, ['container', 'child', 'locked'], 'copy')).toEqual({
      kind: 'copy',
      entityIds: ['container', 'locked'],
    })
    expect(createEntityClipboard(value, ['container', 'child', 'locked'], 'cut')).toEqual({
      kind: 'cut',
      entityIds: ['container'],
    })
  })

  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 建议落点', () => {
    const leaf = entity('leaf')
    const container = entity('container', { childIds: ['leaf'] })
    const value = document([container, leaf], ['container'])

    expect(resolveSuggestedEntityInsertion(value, 'container')).toEqual({
      parentId: 'container',
      index: 1,
    })
    expect(resolveSuggestedEntityInsertion(value, 'leaf')).toEqual({
      parentId: 'container',
      index: 1,
    })
    expect(resolveSuggestedEntityInsertion(value, null)).toEqual({
      parentId: null,
      index: 1,
    })
  })

  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 复制到指定父级', () => {
    const source = entity('source', { x: 40, y: 50 })
    const target = entity('target', { childIds: [] })
    const value = document([source, target], ['source', 'target'])
    const ids = ['command', 'copy'][Symbol.iterator]()
    const plan = createPasteFromClipboard(
      value,
      { kind: 'copy', entityIds: ['source'] },
      { parentId: 'target', index: 0 },
      () => ids.next().value!,
    )

    expect(plan?.clearClipboard).toBe(false)
    expect(plan?.nextSelection).toEqual(['copy'])
    expect(plan?.command.payload).toMatchObject({
      parentId: 'target',
      index: 0,
    })
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(plan!.command).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.target!)?.childIds).toEqual(['copy'])
    expect(getComposeLayoutItem(runtime.document.entities.copy!)).toMatchObject({
      offset: { x: 40, y: 50 },
    })
  })

  it('rejects cutting onto self or an unchanged sibling slot', () => {
    const a = entity('a')
    const b = entity('b')
    const value = document([a, b], ['a', 'b'])

    expect(isInvalidCutInsertion(value, ['a'], { parentId: 'a', index: 0 })).toBe(true)
    expect(isInvalidCutInsertion(value, ['a'], { parentId: null, index: 0 })).toBe(true)
    expect(isInvalidCutInsertion(value, ['a'], { parentId: null, index: 1 })).toBe(true)
    expect(isInvalidCutInsertion(value, ['a'], { parentId: null, index: 2 })).toBe(false)
  })

  it('moves a cut clipboard with a single reorder command', () => {
    const a = entity('a')
    const b = entity('b')
    const value = document([a, b], ['a', 'b'])
    const plan = createPasteFromClipboard(
      value,
      { kind: 'cut', entityIds: ['a'] },
      { parentId: null, index: 2 },
      () => 'move-a',
    )

    expect(plan).toMatchObject({
      clearClipboard: true,
      nextSelection: ['a'],
      command: { type: BUILTIN_COMMAND_TYPES.moveEntity },
    })
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(plan!.command).status).toBe('committed')
    expect(runtime.document.rootIds).toEqual(['b', 'a'])
  })
})
