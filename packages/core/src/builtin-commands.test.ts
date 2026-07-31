import { describe, expect, it } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  createTransactionRuntime,
  getComposeComposition,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
} from './index'
import { containerEntity, documentFixture, rendererEntity, transform } from './test-fixtures'

let commandId = 0
function dispatch(
  runtime: ReturnType<typeof createTransactionRuntime>,
  type: string,
  payload: JsonObject,
) {
  const command: EditorCommand = {
    id: `command-${commandId++}`,
    type,
    payload,
    meta: { label: type, source: 'test' },
  }
  return runtime.dispatch(command)
}

describe('ComposeDocument v6 built-in commands', () => {
  it('OpenSpec: command-transaction / 输出 Paint 配置事务 / 提交并撤销输出渐变', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    const backgroundPaint = {
      kind: 'linear-gradient' as const,
      start: { x: 0, y: 0.5 },
      end: { x: 1, y: 0.5 },
      stops: [
        { id: 'start', position: 0, color: '#0cdeab' as const },
        { id: 'end', position: 1, color: '#06785c' as const },
      ],
    }

    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.configureOutput, {
      width: 1440,
      height: 900,
      backgroundPaint,
    }).status).toBe('committed')
    expect(runtime.document.output).toEqual({ width: 1440, height: 900, backgroundPaint })
    runtime.undo()
    expect(runtime.document.output).toEqual(documentFixture().output)
    runtime.redo()
    expect(runtime.document.output).toEqual({ width: 1440, height: 900, backgroundPaint })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.configureOutput, {
      width: 1440,
      height: 900,
      backgroundColor: '#0cdeab',
    }).status).toBe('rejected')
  })

  it('OpenSpec: command-transaction / Entity 与 Component 内置命令 / 原子修改 Component', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.addComponent, {
      entityId: 'rectangle',
      key: 'GeometryConstraints',
      value: {
        movable: true,
        resize: 'free',
        rotatable: true,
      },
    }).status).toBe('committed')
    expect(runtime.document.entities.rectangle?.components.GeometryConstraints).toBeDefined()
    runtime.undo()
    expect(runtime.document.entities.rectangle?.components.GeometryConstraints).toBeUndefined()
    runtime.redo()
    expect(runtime.document.entities.rectangle?.components.GeometryConstraints).toBeDefined()
  })

  it('OpenSpec: command-transaction / Entity 与 Component 内置命令 / 保护基础 Component', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.removeComponent, {
      entityId: 'rectangle',
      key: 'Transform',
    }).status).toBe('rejected')
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.removeComponent, {
      entityId: 'rectangle',
      key: 'Composition',
    }).status).toBe('rejected')
  })

  it('OpenSpec: command-transaction / 受约束 Transform 命令 / 拒绝绕过几何限制', () => {
    const limited = rendererEntity('limited', {
      components: {
        GeometryConstraints: {
          movable: false,
          resize: 'none',
          rotatable: false,
        },
      },
    })
    const runtime = createTransactionRuntime({ document: documentFixture({ limited }) })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.setTransform, {
      operation: 'move',
      updates: [{ entityId: 'limited', transform: transform(10, 0) }],
    }).status).toBe('rejected')
    expect(getComposeSpatialTransform(runtime.document.entities.limited!)).toEqual(transform())
  })

  it('OpenSpec: command-transaction / 受约束 Transform 命令 / 提交合法多选变换', () => {
    const first = rendererEntity('first')
    const second = rendererEntity('second', { transform: transform(100, 0) })
    const runtime = createTransactionRuntime({
      document: documentFixture({ first, second }),
    })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.setTransform, {
      operation: 'move',
      updates: [
        { entityId: 'first', transform: transform(20, 30) },
        { entityId: 'second', transform: transform(120, 30) },
      ],
    }).status).toBe('committed')
    expect(runtime.entries).toHaveLength(2)
    runtime.undo()
    expect(getComposeSpatialTransform(runtime.document.entities.first!)).toEqual(transform())
    expect(getComposeSpatialTransform(runtime.document.entities.second!)).toEqual(transform(100, 0))
  })

  it('OpenSpec: auto-layout-interactions / Flow 移动 / 原子转 Absolute 并烘焙 Fill 尺寸', () => {
    const flow = rendererEntity('flow', {
      layoutItem: {
        positioning: 'flow',
        offset: { x: 7, y: 9 },
        width: { mode: 'fill', value: 80, min: 1, max: null },
        height: { mode: 'fixed', value: 50, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
    })
    const parentBase = containerEntity('parent', ['flow'])
    const parent = {
      ...parentBase,
      components: {
        ...parentBase.components,
        Composition: {
          ...parentBase.components.Composition,
          baseComponentKeys: [...getComposeComposition(parentBase).baseComponentKeys, 'Layout'],
        },
        Layout: {
          type: 'flex' as const,
          flexDirection: 'row' as const,
          flexWrap: 'nowrap' as const,
          alignContent: 'stretch' as const,
          justifyContent: 'flex-start' as const,
          alignItems: 'stretch' as const,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          rowGap: 0,
          columnGap: 0,
        },
      },
    }
    const runtime = createTransactionRuntime({
      document: documentFixture({ parent, flow }, ['parent']),
    })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.setTransform, {
      operation: 'move',
      updates: [{ entityId: 'flow', transform: transform(30, 40, 240, 50) }],
    }).status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities.flow!)).toMatchObject({
      positioning: 'absolute',
      offset: { x: 30, y: 40 },
      width: { mode: 'fixed', value: 240 },
      height: { mode: 'fixed', value: 50 },
    })
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: auto-layout-interactions / Fill Resize / 只把变更轴转换为 Fixed', () => {
    const flow = rendererEntity('flow', {
      layoutItem: {
        positioning: 'flow',
        offset: { x: 0, y: 0 },
        width: { mode: 'fill', value: 80, min: 1, max: null },
        height: { mode: 'fill', value: 50, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
    })
    const parentBase = containerEntity('parent', ['flow'])
    const parent = {
      ...parentBase,
      components: {
        ...parentBase.components,
        Composition: {
          ...parentBase.components.Composition,
          baseComponentKeys: [...getComposeComposition(parentBase).baseComponentKeys, 'Layout'],
        },
        Layout: {
          type: 'flex' as const,
          flexDirection: 'row' as const,
          flexWrap: 'nowrap' as const,
          alignContent: 'stretch' as const,
          justifyContent: 'flex-start' as const,
          alignItems: 'stretch' as const,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          rowGap: 0,
          columnGap: 0,
        },
      },
    }
    const runtime = createTransactionRuntime({
      document: documentFixture({ parent, flow }, ['parent']),
    })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.setTransform, {
      operation: 'resize',
      updates: [{ entityId: 'flow', transform: transform(0, 0, 180, 50) }],
    }).status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities.flow!)).toMatchObject({
      positioning: 'flow',
      width: { mode: 'fixed', value: 180 },
      height: { mode: 'fill', value: 50 },
    })
    const beforeRotation = getComposeLayoutItem(runtime.document.entities.flow!)
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.setTransform, {
      operation: 'rotate',
      updates: [{ entityId: 'flow', transform: transform(0, 0, 180, 50, 45) }],
    }).status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities.flow!)).toEqual(beforeRotation)
  })

  it.each([
    {
      resize: 'horizontal' as const,
      next: transform(0, 0, 120, 80),
    },
    {
      resize: 'vertical' as const,
      next: transform(0, 0, 80, 120),
    },
    {
      resize: 'preserve-aspect' as const,
      next: transform(0, 0, 120, 80),
    },
  ])('OpenSpec: command-transaction / 受约束 Transform 命令 / set 不可绕过 $resize', ({
    resize,
    next,
  }) => {
    const limited = rendererEntity('limited', {
      components: {
        GeometryConstraints: {
          movable: true,
          resize,
          rotatable: true,
        },
      },
    })
    const runtime = createTransactionRuntime({ document: documentFixture({ limited }) })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.setTransform, {
      operation: 'set',
      updates: [{ entityId: 'limited', transform: next }],
    }).status).toBe('rejected')
    expect(getComposeSpatialTransform(runtime.document.entities.limited!)).toEqual(transform())
  })

  it('OpenSpec: command-transaction / 能力原子事务 / 添加多 Component 能力', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.batch, {
      commands: [
        {
          id: 'add-hierarchy',
          type: BUILTIN_COMMAND_TYPES.addComponent,
          payload: {
            entityId: 'rectangle',
            key: 'Hierarchy',
            value: { childIds: [] },
          },
        },
        {
          id: 'add-clip',
          type: BUILTIN_COMMAND_TYPES.addComponent,
          payload: {
            entityId: 'rectangle',
            key: 'Clip',
            value: { enabled: true },
          },
        },
        {
          id: 'record-capability',
          type: BUILTIN_COMMAND_TYPES.updateComponent,
          payload: {
            entityId: 'rectangle',
            key: 'Composition',
            value: {
              ...(runtime.document.entities.rectangle!.components.Composition as object),
              capabilityIds: ['container'],
            },
          },
        },
      ],
    }).status).toBe('committed')
    expect(runtime.document.entities.rectangle?.components.Hierarchy).toEqual({ childIds: [] })
    expect(runtime.document.entities.rectangle?.components.Clip).toEqual({ enabled: true })
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: command-transaction / 能力原子事务 / 能力事务失败', () => {
    const locked = rendererEntity('locked', { locked: true })
    const runtime = createTransactionRuntime({ document: documentFixture({ locked }) })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.batch, {
      commands: [{
        id: 'add-hierarchy',
        type: BUILTIN_COMMAND_TYPES.addComponent,
        payload: {
          entityId: 'locked',
          key: 'Hierarchy',
          value: { childIds: [] },
        },
      }],
    }).status).toBe('rejected')
    expect(runtime.document.entities.locked?.components.Hierarchy).toBeUndefined()
  })

  it('创建、移动、删除和复制 Entity 保持拓扑与撤销', () => {
    const parent = containerEntity('parent')
    const runtime = createTransactionRuntime({ document: documentFixture({ parent }) })
    const child = rendererEntity('child')
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.createEntity, {
      entity: child as unknown as JsonObject,
      parentId: 'parent',
    }).status).toBe('committed')
    expect((runtime.document.entities.parent?.components.Hierarchy as { childIds: string[] }).childIds)
      .toEqual(['child'])
    const copy: ComposeEntity = { ...child, id: 'copy', name: 'copy' }
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.duplicateEntity, {
      entities: { copy: copy as unknown as JsonObject },
      rootIds: ['copy'],
      parentId: null,
    }).status).toBe('committed')
    expect(runtime.document.rootIds).toEqual(['parent', 'copy'])
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.deleteEntity, {
      entityIds: ['parent'],
    }).status).toBe('committed')
    expect(runtime.document.entities.child).toBeUndefined()
  })

  it('含子项 Hierarchy 不可移除', () => {
    const child = rendererEntity('child')
    const parent = {
      ...containerEntity('parent', ['child'], { renderer: true }),
      components: {
        ...containerEntity('parent', ['child'], { renderer: true }).components,
        Composition: {
          presetId: 'rectangle',
          baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Appearance', 'Renderer'],
          capabilityIds: ['container'],
        },
      },
    }
    const runtime = createTransactionRuntime({
      document: documentFixture({ parent, child }, ['parent']),
    })
    expect(dispatch(runtime, BUILTIN_COMMAND_TYPES.removeComponent, {
      entityId: 'parent',
      key: 'Hierarchy',
    }).status).toBe('rejected')
  })

  it('OpenSpec: command-transaction / batch 构造器 / 无强转创建可执行的原子 batch', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    const children: readonly EditorCommand[] = [
      {
        id: 'child-rename',
        type: BUILTIN_COMMAND_TYPES.renameEntity,
        payload: { entityId: 'rectangle', name: 'Renamed' },
      },
      {
        id: 'child-hide',
        type: BUILTIN_COMMAND_TYPES.setVisibility,
        payload: { entityIds: ['rectangle'], visible: false },
      },
    ]
    const command = createComposeBatchCommand({
      id: 'batch-1',
      commands: children,
      meta: { label: 'Batch update', source: 'test', targetIds: ['rectangle'] },
    })

    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    const result = runtime.dispatch(command)
    expect(result.status).toBe('committed')
    expect(runtime.document.entities.rectangle?.name).toBe('Renamed')
    expect(runtime.document.entities.rectangle?.components.Visibility).toEqual({ visible: false })
    expect(runtime.entries).toHaveLength(2)
  })
})
