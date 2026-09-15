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
import { ROOT_FRAME_ID, document, entity, layoutSnapshot } from '../test-fixtures'

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
    // 没有命中目标时落点是画板末尾，而不是文档根——v7 的根只接受 Frame。
    expect(resolveSuggestedEntityInsertion(value, null)).toEqual({
      parentId: ROOT_FRAME_ID,
      index: 1,
    })

    // 回退目标不在这份文档里时退回首块根场景。`activeFrameId` 住在页面文件上，切换页面标签
    // 时它与文档各自更新，中间会有一帧对不上——不校验就会读到 undefined 的 Entity。
    expect(resolveSuggestedEntityInsertion(value, null, 'frame-from-another-page')).toEqual({
      parentId: ROOT_FRAME_ID,
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

  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 带锚点复制落到指针处', () => {
    // 两个来源相距 (200, 0)，整组包围盒 300×50、中心 (150, 25)；锚点 (400, 300) 且开着 8 步网格。
    const a = entity('a', { x: 0, y: 0, width: 100, height: 50 })
    const b = entity('b', { x: 200, y: 0, width: 100, height: 50 })
    const value = document([a, b], ['a', 'b'])
    const ids = ['command-a', 'copy-a', 'command-b', 'copy-b', 'batch'][Symbol.iterator]()
    const plan = createPasteFromClipboard(
      value,
      { kind: 'copy', entityIds: ['a', 'b'] },
      { parentId: ROOT_FRAME_ID, index: 2 },
      () => ids.next().value!,
      layoutSnapshot(value),
      { worldPoint: { x: 401, y: 303 } },
    )
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(plan!.command).status).toBe('committed')
    // 中心落到锚点：左上 (251, 278)，再吸到网格 → (248, 280)；相对位置保持 (200, 0)。
    expect(getComposeLayoutItem(runtime.document.entities['copy-a']!)).toMatchObject({
      positioning: 'absolute',
      offset: { x: 248, y: 280 },
    })
    expect(getComposeLayoutItem(runtime.document.entities['copy-b']!)).toMatchObject({
      offset: { x: 448, y: 280 },
    })
    // 来源一个字节不动。
    expect(getComposeLayoutItem(runtime.document.entities.a!).offset).toEqual({ x: 0, y: 0 })
  })

  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 带锚点复制到别的父级换算成局部坐标', () => {
    const source = entity('source', { x: 0, y: 0, width: 100, height: 50 })
    const target = entity('target', { x: 300, y: 100, width: 400, height: 400, childIds: [] })
    const base = document([source, target], ['source', 'target'])
    const value = { ...base, canvas: { ...base.canvas, grid: { ...base.canvas.grid, snapEnabled: false } } }
    const ids = ['command', 'copy'][Symbol.iterator]()
    const plan = createPasteFromClipboard(
      value,
      { kind: 'copy', entityIds: ['source'] },
      { parentId: 'target', index: 0 },
      () => ids.next().value!,
      layoutSnapshot(value),
      { worldPoint: { x: 500, y: 300 } },
    )
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(plan!.command).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.target!)?.childIds).toEqual(['copy'])
    // 世界左上 (450, 275) 减去 target 的世界原点 (300, 100)。
    expect(getComposeLayoutItem(runtime.document.entities.copy!).offset).toEqual({ x: 150, y: 175 })
  })

  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 带锚点剪切搬到指针处', () => {
    const a = entity('a', { x: 0, y: 0, width: 100, height: 50 })
    const b = entity('b')
    const base = document([a, b], ['a', 'b'])
    const value = { ...base, canvas: { ...base.canvas, grid: { ...base.canvas.grid, snapEnabled: false } } }
    // 同父级、顺序也没变：不带锚点会被判成无效落点，带锚点则是「搬到那里」。
    const plan = createPasteFromClipboard(
      value,
      { kind: 'cut', entityIds: ['a'] },
      { parentId: ROOT_FRAME_ID, index: 2 },
      () => 'move-a',
      layoutSnapshot(value),
      { worldPoint: { x: 250, y: 125 } },
    )
    expect(plan).toMatchObject({ clearClipboard: true, nextSelection: ['a'] })
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(plan!.command).status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities.a!).offset).toEqual({ x: 200, y: 100 })
    expect(getComposeHierarchy(runtime.document.entities[ROOT_FRAME_ID]!)?.childIds)
      .toEqual(['b', 'a'])
  })

  it('rejects cutting onto self or an unchanged sibling slot', () => {
    const a = entity('a')
    const b = entity('b')
    const value = document([a, b], ['a', 'b'])

    expect(isInvalidCutInsertion(value, ['a'], { parentId: 'a', index: 0 })).toBe(true)
    expect(isInvalidCutInsertion(value, ['a'], { parentId: ROOT_FRAME_ID, index: 0 })).toBe(true)
    expect(isInvalidCutInsertion(value, ['a'], { parentId: ROOT_FRAME_ID, index: 1 })).toBe(true)
    expect(isInvalidCutInsertion(value, ['a'], { parentId: ROOT_FRAME_ID, index: 2 })).toBe(false)
  })

  it('moves a cut clipboard with a single reorder command', () => {
    const a = entity('a')
    const b = entity('b')
    const value = document([a, b], ['a', 'b'])
    const plan = createPasteFromClipboard(
      value,
      { kind: 'cut', entityIds: ['a'] },
      { parentId: ROOT_FRAME_ID, index: 2 },
      () => 'move-a',
    )

    expect(plan).toMatchObject({
      clearClipboard: true,
      nextSelection: ['a'],
      command: { type: BUILTIN_COMMAND_TYPES.moveEntity },
    })
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(plan!.command).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities[ROOT_FRAME_ID]!)?.childIds)
      .toEqual(['b', 'a'])
  })
})
