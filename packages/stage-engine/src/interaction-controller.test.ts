import { BUILTIN_COMMAND_TYPES } from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createStageInteractionController,
  type StageInteractionEffect,
} from './interaction-controller'
import { document, entity, layoutSnapshot } from './test-fixtures'

const modifiers = { shift: false, alt: false, command: false }

function setup(
  value = document(),
  snapshot = layoutSnapshot(value),
  selectedIds: readonly string[] = ['a'],
) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  let nextId = 0
  controller.updateContext({
    document: value,
    layoutSnapshot: snapshot,
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds,
    idFactory: () => `id-${++nextId}`,
  })
  return { controller, effects }
}

describe('StageInteractionController ECS systems', () => {
  it('OpenSpec: Move System / 松手只派发一次带 operation 的 Entity Transform 命令', () => {
    const { controller, effects } = setup()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'a' },
      modifiers,
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 1,
      point: { x: 30, y: 40 },
      modifiers,
    })
    const commands = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: {
        type: BUILTIN_COMMAND_TYPES.setTransform,
        payload: {
          operation: 'move',
          updates: [{
            entityId: 'a',
            transform: {
              position: { x: 24, y: 32 },
              size: { width: 100, height: 50 },
            },
          }],
        },
      },
    })
  })

  it('OpenSpec: auto-layout-interactions / Flow 拖动 / 使用冻结 Snapshot 并烘焙 Fill 尺寸', () => {
    const flowBase = entity('a')
    const flow = {
      ...flowBase,
      components: {
        ...flowBase.components,
        LayoutItem: {
          ...flowBase.components.LayoutItem,
          positioning: 'flow' as const,
          width: {
            ...(flowBase.components.LayoutItem?.width as object),
            mode: 'fill' as const,
          },
        },
      },
    }
    const parentBase = entity('parent', { childIds: ['a'], width: 400, height: 200 })
    const parent = {
      ...parentBase,
      components: {
        ...parentBase.components,
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
    const value = document([parent, flow], ['parent'])
    const snapshot = {
      ...layoutSnapshot(value),
      boxes: {
        parent: { x: 0, y: 0, width: 400, height: 200, positioning: 'absolute' as const },
        a: { x: 12, y: 16, width: 260, height: 50, positioning: 'flow' as const },
      },
    }
    const { controller, effects } = setup(value, snapshot)
    controller.send({
      type: 'pointer.down', pointerId: 1, button: 0, point: { x: 20, y: 20 },
      hit: { kind: 'entity', entityId: 'a' }, modifiers,
    })
    controller.send({
      type: 'pointer.up', pointerId: 1, point: { x: 50, y: 60 }, modifiers,
    })
    expect(effects.find((effect) => effect.type === 'command.dispatch')).toMatchObject({
      command: {
        payload: {
          operation: 'move',
          updates: [{
            entityId: 'a',
            transform: { size: { width: 260, height: 50 } },
          }],
        },
      },
    })
  })

  it('OpenSpec: auto-layout-interactions / 混合多选移动 / Flow 与 Absolute 共用一次提交', () => {
    const flowBase = entity('flow')
    const flow = {
      ...flowBase,
      components: {
        ...flowBase.components,
        LayoutItem: {
          ...flowBase.components.LayoutItem,
          positioning: 'flow' as const,
        },
      },
    }
    const absolute = entity('absolute', { x: 180, y: 80 })
    const parentBase = entity('parent', { childIds: ['flow', 'absolute'], width: 400, height: 200 })
    const parent = {
      ...parentBase,
      components: {
        ...parentBase.components,
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
    const value = document([parent, flow, absolute], ['parent'])
    const snapshot = {
      ...layoutSnapshot(value),
      boxes: {
        parent: { x: 0, y: 0, width: 400, height: 200, positioning: 'absolute' as const },
        flow: { x: 10, y: 12, width: 100, height: 50, positioning: 'flow' as const },
        absolute: { x: 180, y: 80, width: 100, height: 50, positioning: 'absolute' as const },
      },
    }
    const { controller, effects } = setup(value, snapshot, ['flow', 'absolute'])
    controller.send({
      type: 'pointer.down', pointerId: 1, button: 0, point: { x: 20, y: 20 },
      hit: { kind: 'entity', entityId: 'flow' }, modifiers,
    })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 40, y: 50 }, modifiers })

    const commands = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: {
        payload: {
          operation: 'move',
          updates: [
            { entityId: 'flow', transform: { position: { x: 32, y: 41 } } },
            { entityId: 'absolute', transform: { position: { x: 202, y: 109 } } },
          ],
        },
      },
    })
  })

  it('OpenSpec: auto-layout-interactions / 手势取消 / 清除预览且零事务', () => {
    const { controller, effects } = setup()
    controller.send({
      type: 'pointer.down', pointerId: 1, button: 0, point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'a' }, modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 40, y: 40 }, modifiers })
    expect(controller.getSnapshot().previewTransforms.a).toBeDefined()
    controller.send({ type: 'pointer.cancel', pointerId: 1 })
    expect(controller.getSnapshot().previewTransforms).toEqual({})
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toEqual([])
  })

  it('OpenSpec: auto-layout-interactions / Fill Resize / 只提交活动轴并保留 Flow offset', () => {
    const flowBase = entity('a')
    const flow = {
      ...flowBase,
      components: {
        ...flowBase.components,
        LayoutItem: {
          ...flowBase.components.LayoutItem,
          positioning: 'flow' as const,
          offset: { x: 7, y: 9 },
          width: {
            ...(flowBase.components.LayoutItem?.width as object),
            mode: 'fill' as const,
          },
          height: {
            ...(flowBase.components.LayoutItem?.height as object),
            mode: 'fill' as const,
          },
        },
      },
    }
    const parentBase = entity('parent', { childIds: ['a'], width: 400, height: 200 })
    const parent = {
      ...parentBase,
      components: {
        ...parentBase.components,
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
    const value = document([parent, flow], ['parent'])
    const snapshot = {
      ...layoutSnapshot(value),
      boxes: {
        parent: { x: 0, y: 0, width: 400, height: 200, positioning: 'absolute' as const },
        a: { x: 12, y: 16, width: 260, height: 160, positioning: 'flow' as const },
      },
    }
    const { controller, effects } = setup(value, snapshot)
    controller.send({
      type: 'pointer.down', pointerId: 1, button: 0, point: { x: 272, y: 96 },
      hit: { kind: 'resize', handle: 'e' }, modifiers,
    })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 300, y: 96 }, modifiers })
    expect(effects.find((effect) => effect.type === 'command.dispatch')).toMatchObject({
      command: {
        payload: {
          operation: 'resize',
          updates: [{
            entityId: 'a',
            transform: {
              position: { x: 7, y: 9 },
              size: { height: 50 },
            },
          }],
        },
      },
    })
  })

  it.each([
    ['move', entity('a', { resize: 'free', movable: false }), { kind: 'entity', entityId: 'a' }],
    ['resize', entity('a', { resize: 'none' }), { kind: 'resize', handle: 'se' }],
    ['rotate', entity('a', { resize: 'free', rotatable: false }), { kind: 'rotate' }],
  ] as const)(
    'OpenSpec: TransformConstraints System / %s 被独立约束阻止',
    (_action, constrained, hit) => {
      const { controller } = setup(document([constrained]))
      controller.send({
        type: 'pointer.down',
        pointerId: 1,
        button: 0,
        point: { x: 10, y: 10 },
        hit,
        modifiers,
      })
      expect(controller.getSnapshot().phase).toBe('idle')
    },
  )

  it('OpenSpec: External Preset / 统一 Palette drop 为 preset', () => {
    const { controller, effects } = setup()
    controller.send({
      type: 'external.add',
      item: { kind: 'preset', presetId: 'rectangle' },
    })
    expect(effects).toContainEqual(expect.objectContaining({
      type: 'external.drop',
      item: { kind: 'preset', presetId: 'rectangle' },
    }))
  })

  it('OpenSpec: 生命周期 / dispose 清理订阅与 surface', () => {
    const { controller } = setup()
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.dispose()
    controller.send({ type: 'temporary-pan.start' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('OpenSpec: Paint edit / 渐变控制柄只 preview，松手提交一个 Appearance 命令', () => {
    const painted = {
      ...entity('a'),
      components: {
        ...entity('a').components,
        Appearance: {
          backgroundPaint: {
            kind: 'linear-gradient' as const,
            start: { x: 0, y: 0.5 },
            end: { x: 1, y: 0.5 },
            stops: [
              { id: 'start', position: 0, color: '#ff0000' },
              { id: 'end', position: 1, color: '#0000ff' },
            ],
          },
        },
      },
    }
    const value = document([painted])
    const { controller, effects } = setup(value)
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['a'],
      paintEditing: { entityId: 'a' },
      idFactory: () => 'paint-id',
    })
    expect(controller.getSnapshot().paintHandles).toHaveLength(4)
    controller.send({
      type: 'pointer.down', pointerId: 1, button: 0, point: { x: 100, y: 25 },
      hit: { kind: 'paint-handle', handle: 'linear-end' }, modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 50, y: 25 }, modifiers })
    expect(controller.getSnapshot().paintPreview).toMatchObject({
      paint: { end: { x: 0.5, y: 0.5 } },
    })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 50, y: 25 }, modifiers })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(1)
    expect(effects.find((effect) => effect.type === 'command.dispatch')).toMatchObject({
      command: { type: BUILTIN_COMMAND_TYPES.setAppearance },
    })
  })

  it('OpenSpec: Paint edit / 同一编辑目标切换 Solid 到渐变时发布新的画布控制柄', () => {
    const solid = document([{
      ...entity('a'),
      components: {
        ...entity('a').components,
        Appearance: { backgroundPaint: { kind: 'solid' as const, color: '#2563eb' } },
      },
    }])
    const gradient = {
      ...solid,
      entities: {
        ...solid.entities,
        a: {
          ...solid.entities.a!,
          components: {
            ...solid.entities.a!.components,
            Appearance: {
              backgroundPaint: {
                kind: 'linear-gradient' as const,
                start: { x: 0, y: 0.5 },
                end: { x: 1, y: 0.5 },
                stops: [
                  { id: 'start', position: 0, color: '#2563eb' },
                  { id: 'end', position: 1, color: 'transparent' },
                ],
              },
            },
          },
        },
      },
    }
    const { controller } = setup(solid)
    const context = {
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select' as const,
      selectedIds: ['a'],
      paintEditing: { entityId: 'a' },
      idFactory: () => 'paint-id',
    }
    controller.updateContext({
      ...context,
      document: solid,
      layoutSnapshot: layoutSnapshot(solid),
    })
    expect(controller.getSnapshot().paintHandles).toEqual([])

    controller.updateContext({
      ...context,
      document: gradient,
      layoutSnapshot: layoutSnapshot(gradient, 2),
    })
    expect(controller.getSnapshot().paintHandles).toHaveLength(4)
  })

  it('OpenSpec: Paint sample / 图层取色不改变选择，Alt 复制完整背景 Paint', () => {
    const target = {
      ...entity('a'),
      components: {
        ...entity('a').components,
        Appearance: { backgroundPaint: { kind: 'solid' as const, color: '#111111' } },
      },
    }
    const source = {
      ...entity('b'),
      components: {
        ...entity('b').components,
        Renderer: { type: 'rectangle', props: {} },
        Appearance: {
          backgroundPaint: {
            kind: 'linear-gradient' as const,
            start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 },
            stops: [
              { id: 'left', position: 0, color: '#ff0000' },
              { id: 'right', position: 1, color: '#0000ff' },
            ],
          },
        },
      },
    }
    const value = document([target, source])
    const { controller, effects } = setup(value)
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['a'],
      paintSampling: { entityId: 'a', field: 'backgroundPaint' },
      idFactory: () => 'sample-id',
    })
    controller.send({
      type: 'pointer.down', pointerId: 2, button: 0, point: { x: 20, y: 25 },
      hit: { kind: 'surface' }, modifiers: { ...modifiers, alt: true },
    })
    controller.send({
      type: 'pointer.up', pointerId: 2, point: { x: 20, y: 25 },
      modifiers: { ...modifiers, alt: true },
    })
    expect(effects).toContainEqual(expect.objectContaining({ type: 'paint.sample.complete' }))
    expect(effects.find((effect) => effect.type === 'command.dispatch')).toMatchObject({
      command: {
        payload: { appearance: { backgroundPaint: { kind: 'linear-gradient' } } },
      },
    })
  })

  it('OpenSpec: Paint sample / 图片、SVG 与未知 Renderer 不产生错误的背景取色事务', () => {
    const target = {
      ...entity('a'),
      components: {
        ...entity('a').components,
        Appearance: { backgroundPaint: { kind: 'solid' as const, color: '#111111' } },
      },
    }
    const image = {
      ...entity('image'),
      components: {
        ...entity('image').components,
        Transform: {
          position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, rotation: 0,
        },
        Renderer: { type: 'image', props: {} },
        Appearance: { backgroundPaint: { kind: 'solid' as const, color: '#f00' } },
      },
    }
    const value = document([target, image])
    const { controller, effects } = setup(value)
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['a'],
      paintSampling: { entityId: 'a', field: 'backgroundPaint' },
      idFactory: () => 'sample-id',
    })
    controller.send({
      type: 'pointer.down', pointerId: 3, button: 0, point: { x: 20, y: 25 },
      hit: { kind: 'surface' }, modifiers,
    })
    expect(controller.getSnapshot().paintSample).toMatchObject({ status: 'unavailable', sampledEntityId: 'image' })
    controller.send({ type: 'pointer.up', pointerId: 3, point: { x: 20, y: 25 }, modifiers })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(effects).toContainEqual({ type: 'paint.sample.complete' })
  })
})
