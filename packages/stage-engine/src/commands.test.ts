import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeHierarchy,
  getComposeTransform,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  createDuplicateCommand,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
} from './commands'
import { document, entity } from './test-fixtures'

describe('Stage ECS commands', () => {
  it('OpenSpec: Entity 分组 / 创建可渲染无关的 Container 组合并保持世界位置', () => {
    const value = document([
      entity('a', { x: 20, y: 30 }),
      entity('b', { x: 150, y: 60 }),
    ])
    const runtime = createTransactionRuntime({
      document: value,
    })
    const result = runtime.dispatch(createGroupCommand(value, ['a', 'b'], 'container'))
    expect(result.status).toBe('committed')
    const current = runtime.getState().document
    expect(current.rootIds).toEqual(['container'])
    expect(getComposeHierarchy(current.entities.container!)?.childIds).toEqual(['a', 'b'])
    expect(getComposeTransform(current.entities.container!)).toEqual({
      position: { x: 20, y: 30 },
      size: { width: 230, height: 80 },
      rotation: 0,
    })
    expect(getComposeTransform(current.entities.a!).position).toEqual({ x: 0, y: 0 })
    expect(getComposeTransform(current.entities.b!).position).toEqual({ x: 130, y: 30 })

    const ungroup = runtime.dispatch(createUngroupCommand(current, 'container'))
    expect(ungroup.status).toBe('committed')
    expect(runtime.getState().document.rootIds).toEqual(['a', 'b'])
  })

  it('OpenSpec: Entity reparent / 使用一个 batch 同步层级和局部 Transform', () => {
    const child = entity('child', { x: 300, y: 120 })
    const container = entity('container', {
      x: 100,
      y: 50,
      width: 400,
      height: 300,
      childIds: [],
    })
    const value = document([child, container], ['child', 'container'])
    const command = createReparentCommand(value, ['child'], 'container', 0)
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    const runtime = createTransactionRuntime({
      document: value,
    })
    expect(runtime.dispatch(command).status).toBe('committed')
    const current = runtime.getState().document
    expect(getComposeHierarchy(current.entities.container!)?.childIds).toEqual(['child'])
    expect(getComposeTransform(current.entities.child!).position).toEqual({ x: 200, y: 70 })
  })

  it('OpenSpec: Entity duplicate / 深复制 Components 并重映射 Hierarchy', () => {
    const child = entity('child')
    const container = entity('container', { childIds: ['child'] })
    const value = document([container, child], ['container'])
    const ids = ['container-copy', 'child-copy'][Symbol.iterator]()
    const result = createDuplicateCommand(value, 'container', () => ids.next().value!)
    expect(result?.rootId).toBe('container-copy')
    expect(result?.command.type).toBe(BUILTIN_COMMAND_TYPES.duplicateEntity)
    const payload = result?.command.payload
    expect(payload?.entities).toMatchObject({
      'container-copy': {
        components: { Hierarchy: { childIds: ['child-copy'] } },
      },
      'child-copy': { id: 'child-copy' },
    })
  })
})
