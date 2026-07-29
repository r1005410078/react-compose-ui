import { BUILTIN_COMMAND_TYPES } from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createStageInteractionController,
  type StageInteractionEffect,
} from './interaction-controller'
import { document, entity } from './test-fixtures'

const modifiers = { shift: false, alt: false, command: false }

function setup(value = document()) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  let nextId = 0
  controller.updateContext({
    document: value,
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds: ['a'],
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
    controller.updateContext({ ...context, document: solid })
    expect(controller.getSnapshot().paintHandles).toEqual([])

    controller.updateContext({ ...context, document: gradient })
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
