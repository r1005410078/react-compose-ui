import { BUILTIN_COMMAND_TYPES } from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createStageInteractionController,
  type StageInteractionEffect,
  type StageInteractionTool,
} from './interaction-controller'
import type { StageMarqueeMode } from './marquee-selection'
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

  it('OpenSpec: 受控工具模式与专属选区反馈 / move 轴 gizmo 只改变对应坐标', () => {
    const { controller } = setup()
    controller.updateContext({
      document: document(),
      layoutSnapshot: layoutSnapshot(document()),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'move' as never,
      selectedIds: ['a'],
      idFactory: () => 'move-axis-id',
    })

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'move-axis', axis: 'x' } as never,
      modifiers,
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 42, y: 55 },
      modifiers,
    })

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'move',
      previewTransforms: {
        a: expect.objectContaining({ x: 32, y: 0 }),
      },
    })
  })

  it('OpenSpec: Headless 绘制会话 / draw tool 只在松手请求绘制提交', () => {
    const { controller, effects } = setup()
    controller.updateContext({
      document: document(),
      layoutSnapshot: layoutSnapshot(document()),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'draw-rectangle' as never,
      selectedIds: [],
      idFactory: () => 'draw-id',
    })
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      cursor: 'crosshair',
      drawing: null,
      marquee: null,
    })

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 12, y: 16 },
      hit: { kind: 'surface' },
      modifiers,
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 52, y: 46 },
      modifiers,
    })
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'draw',
      drawing: { tool: 'draw-rectangle', bounds: { x: 12, y: 16, width: 40, height: 30 } },
      marquee: null,
    })

    controller.send({
      type: 'pointer.up',
      pointerId: 1,
      point: { x: 52, y: 46 },
      modifiers,
    })
    expect(effects).toContainEqual(expect.objectContaining({
      type: 'drawing.commit',
      tool: 'draw-rectangle',
      bounds: { x: 12, y: 16, width: 40, height: 30 },
    }))
  })

  it('OpenSpec: 线段端点选择 / 端点预览只在松手请求一次提交，并允许越过固定端', () => {
    const { controller, effects } = setup()
    const unrestricted = { ...modifiers, command: true }
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 0, y: 0 },
      hit: {
        kind: 'segment-endpoint',
        entityId: 'a',
        endpoint: 'start',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
      modifiers: unrestricted,
    })
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'segment-resize',
      segmentPreview: {
        entityId: 'a',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
    })

    controller.send({
      type: 'pointer.move', pointerId: 1, point: { x: 140, y: 72 }, modifiers: unrestricted,
    })
    expect(controller.getSnapshot()).toMatchObject({
      segmentPreview: {
        entityId: 'a',
        start: { x: 140, y: 72 },
        end: { x: 100, y: 50 },
      },
    })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)

    controller.send({
      type: 'pointer.up', pointerId: 1, point: { x: 140, y: 72 }, modifiers: unrestricted,
    })
    expect(effects.filter((effect) => effect.type === 'segment.commit')).toEqual([
      {
        type: 'segment.commit',
        entityId: 'a',
        start: { x: 140, y: 72 },
        end: { x: 100, y: 50 },
      },
    ])
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(controller.getSnapshot().segmentPreview).toBeNull()
  })

  it('OpenSpec: 线段端点选择 / 从放大命中区边缘拖动时保留抓取偏移', () => {
    const { controller } = setup()
    const unrestricted = { ...modifiers, command: true }
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 8, y: 6 },
      hit: {
        kind: 'segment-endpoint',
        entityId: 'a',
        endpoint: 'start',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
      modifiers: unrestricted,
    })

    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 18, y: 16 },
      modifiers: unrestricted,
    })

    expect(controller.getSnapshot().segmentPreview).toMatchObject({
      start: { x: 10, y: 10 },
      end: { x: 100, y: 50 },
    })
  })

  it('OpenSpec: 线段端点选择 / 取消端点拖拽不会请求提交', () => {
    const { controller, effects } = setup()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 0, y: 0 },
      hit: {
        kind: 'segment-endpoint',
        entityId: 'a',
        endpoint: 'end',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
      modifiers,
    })
    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    expect(controller.getSnapshot().segmentPreview).toBeNull()
    expect(effects.some((effect) => effect.type === 'segment.commit')).toBe(false)
  })

  it('OpenSpec: Headless 绘制会话 / Shift 锁定正方形且指针保持在绘制终点', () => {
    const { controller, effects } = setup()
    controller.updateContext({
      document: document(),
      layoutSnapshot: layoutSnapshot(document()),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'draw-circle' as never,
      selectedIds: [],
      idFactory: () => 'draw-square-id',
    })
    const shiftedModifiers = { ...modifiers, shift: true }

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 12, y: 16 },
      hit: { kind: 'surface' },
      modifiers: shiftedModifiers,
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 52, y: 46 },
      modifiers: shiftedModifiers,
    })

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'draw',
      drawing: {
        tool: 'draw-circle',
        bounds: { x: 12, y: 6, width: 40, height: 40 },
        end: { x: 52, y: 46 },
      },
    })

    controller.send({
      type: 'pointer.up',
      pointerId: 1,
      point: { x: 52, y: 46 },
      modifiers: shiftedModifiers,
    })
    expect(effects).toContainEqual(expect.objectContaining({
      type: 'drawing.commit',
      tool: 'draw-circle',
      bounds: { x: 12, y: 6, width: 40, height: 40 },
      end: { x: 52, y: 46 },
    }))
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

describe('OpenSpec: stage / 可拖拽全局辅助线 / 从标尺创建辅助线', () => {
  function dragFromRuler(axis: 'x' | 'y', to: { x: number; y: number }) {
    const { controller, effects } = setup()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 0, y: 0 },
      hit: { kind: 'ruler', axis },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: to, modifiers })
    controller.send({ type: 'pointer.up', pointerId: 1, point: to, modifiers })
    return effects.filter((effect) => effect.type === 'command.dispatch')
  }

  it('顶部标尺拖出水平辅助线', () => {
    const commands = dragFromRuler('x', { x: 120, y: 200 })

    // axis 'y' 的辅助线以 world.y 定位并渲染为横线；顶部标尺必须拖出横线。
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: {
        type: 'canvas.guide.create',
        payload: { guide: { axis: 'y', position: 200 } },
      },
    })
  })

  it('左侧标尺拖出垂直辅助线', () => {
    const commands = dragFromRuler('y', { x: 120, y: 200 })

    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: {
        type: 'canvas.guide.create',
        payload: { guide: { axis: 'x', position: 120 } },
      },
    })
  })

  it('松手时仍停在标尺内则不创建辅助线', () => {
    expect(dragFromRuler('x', { x: 120, y: -6 })).toHaveLength(0)
    expect(dragFromRuler('y', { x: -6, y: 200 })).toHaveLength(0)
  })
})

describe('OpenSpec: stage / 可拖拽全局辅助线 / 拖回标尺删除辅助线', () => {
  function dragExistingGuide(
    guide: { id: string; axis: 'x' | 'y'; position: number },
    to: { x: number; y: number },
  ) {
    const value = document()
    const withGuide = {
      ...value,
      canvas: { ...value.canvas, guides: [guide] },
    }
    const { controller, effects } = setup(withGuide, layoutSnapshot(withGuide))
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 100 },
      hit: { kind: 'guide', guideId: guide.id },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: to, modifiers })
    const cursor = controller.getSnapshot().cursor
    controller.send({ type: 'pointer.up', pointerId: 1, point: to, modifiers })
    return {
      cursor,
      commands: effects.filter((effect) => effect.type === 'command.dispatch'),
    }
  }

  it('水平辅助线拖回顶部标尺时删除', () => {
    const { commands } = dragExistingGuide({ id: 'g1', axis: 'y', position: 80 }, { x: 120, y: -6 })

    expect(commands[0]).toMatchObject({
      command: { type: 'canvas.guide.delete', payload: { guideId: 'g1' } },
    })
  })

  it('垂直辅助线拖回左侧标尺时删除', () => {
    const { commands } = dragExistingGuide({ id: 'g1', axis: 'x', position: 80 }, { x: -6, y: 120 })

    expect(commands[0]).toMatchObject({
      command: { type: 'canvas.guide.delete', payload: { guideId: 'g1' } },
    })
  })

  it('停留在标尺内时给出删除光标提示', () => {
    const inside = dragExistingGuide({ id: 'g1', axis: 'y', position: 80 }, { x: 120, y: -6 })
    const outside = dragExistingGuide({ id: 'g1', axis: 'y', position: 80 }, { x: 120, y: 200 })

    expect(inside.cursor).toBe('guide-delete')
    expect(outside.cursor).not.toBe('guide-delete')
  })
})

describe('StageInteractionController 画布内文字编辑会话', () => {
  const editableDocument = document([entity('a'), entity('b', { x: 300 })])

  function textSetup(options: {
    readonly tool?: 'select' | 'draw-text' | 'draw-rectangle'
    readonly selectedIds?: readonly string[]
    readonly textEditing?: { readonly entityId: string } | null
    readonly editableIds?: readonly string[]
    readonly drawnEntity?: {
      readonly entityId: string
      readonly tool: 'draw-text' | 'draw-rectangle'
    } | null
    readonly value?: ReturnType<typeof document>
  } = {}) {
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    const editableIds = options.editableIds ?? ['a', 'b']
    const update = (patch: Parameters<typeof textSetup>[0] = {}) => {
      const merged = { ...options, ...patch }
      const value = merged.value ?? editableDocument
      controller.updateContext({
        document: value,
        layoutSnapshot: layoutSnapshot(value),
        viewport: { x: 0, y: 0, zoom: 1 },
        surfaceSize: { width: 800, height: 600 },
        tool: merged.tool ?? 'select',
        selectedIds: merged.selectedIds ?? [],
        textEditing: merged.textEditing ?? null,
        drawnEntity: merged.drawnEntity ?? null,
        isTextEditable: (entityId: string) => (merged.editableIds ?? editableIds).includes(entityId),
        idFactory: () => 'text-edit-id',
      })
    }
    update()
    return { controller, effects, update }
  }

  it('OpenSpec: 文字编辑会话的输入协议 / 按连击计数区分单击与双击', () => {
    const single = textSetup({ selectedIds: ['a'] })
    single.controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'a' },
      clickCount: 1,
      modifiers,
    })
    expect(single.effects.some((effect) => effect.type === 'text-editing.enter')).toBe(false)
    expect(single.controller.getSnapshot().phase).toBe('move')

    const double = textSetup({ selectedIds: ['a'] })
    double.controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'a' },
      clickCount: 2,
      modifiers,
    })
    expect(double.effects).toContainEqual({ type: 'text-editing.enter', entityId: 'a' })
    // 双击进入编辑时不得同时开始移动手势，否则拖选文字会把实体拖走。
    expect(double.controller.getSnapshot().phase).toBe('idle')
  })

  it('OpenSpec: 文字编辑会话的输入协议 / 可编辑判定只来自 context', () => {
    const { controller, effects } = textSetup({ selectedIds: ['a'], editableIds: [] })
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'a' },
      clickCount: 2,
      modifiers,
    })
    controller.send({ type: 'key.down', key: 'Enter' })
    expect(effects.some((effect) => effect.type === 'text-editing.enter')).toBe(false)
  })

  it('OpenSpec: 无 DOM 文字编辑会话 / 单选可编辑 Entity 时 Enter 进入编辑', () => {
    const single = textSetup({ selectedIds: ['a'] })
    single.controller.send({ type: 'key.down', key: 'Enter' })
    expect(single.effects).toContainEqual({ type: 'text-editing.enter', entityId: 'a' })

    const multi = textSetup({ selectedIds: ['a', 'b'] })
    multi.controller.send({ type: 'key.down', key: 'Enter' })
    expect(multi.effects.some((effect) => effect.type === 'text-editing.enter')).toBe(false)
  })

  it('OpenSpec: 文字编辑会话的输入协议 / 新建回灌只消费一次', () => {
    const { effects, update } = textSetup({ tool: 'draw-text' })
    update({ drawnEntity: { entityId: 'a', tool: 'draw-text' } })
    expect(effects.filter((effect) => effect.type === 'text-editing.enter')).toEqual([
      { type: 'text-editing.enter', entityId: 'a' },
    ])

    // context 因无关原因反复更新时不得重复进入。
    update({ drawnEntity: { entityId: 'a', tool: 'draw-text' }, selectedIds: ['a'] })
    update({ drawnEntity: { entityId: 'a', tool: 'draw-text' }, selectedIds: ['a'] })
    expect(effects.filter((effect) => effect.type === 'text-editing.enter')).toHaveLength(1)
  })

  it('OpenSpec: 文字编辑会话的输入协议 / 其他绘制工具创建时不进入会话', () => {
    const { effects, update } = textSetup({ tool: 'draw-rectangle' })
    update({ drawnEntity: { entityId: 'a', tool: 'draw-rectangle' } })
    expect(effects.some((effect) => effect.type === 'text-editing.enter')).toBe(false)
  })

  it('OpenSpec: 无 DOM 文字编辑会话 / 编辑期间屏蔽空间手势', () => {
    const { controller, effects } = textSetup({
      selectedIds: ['a'],
      textEditing: { entityId: 'a' },
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'a' },
      clickCount: 1,
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 60, y: 60 }, modifiers })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 60, y: 60 }, modifiers })

    expect(controller.getSnapshot().phase).toBe('idle')
    expect(controller.getSnapshot().marquee).toBeNull()
    expect(effects.some((effect) => effect.type === 'command.dispatch')).toBe(false)
  })

  it('OpenSpec: 无 DOM 文字编辑会话 / 编辑期间变换手柄不产生空间手势', () => {
    for (const hit of [
      { kind: 'resize', handle: 'se' },
      { kind: 'rotate' },
      { kind: 'move-axis', axis: 'x' },
    ] as const) {
      const { controller, effects } = textSetup({
        selectedIds: ['a'],
        textEditing: { entityId: 'a' },
      })
      controller.send({
        type: 'pointer.down',
        pointerId: 1,
        button: 0,
        point: { x: 100, y: 50 },
        hit,
        clickCount: 1,
        modifiers,
      })
      controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 160, y: 90 }, modifiers })
      controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 160, y: 90 }, modifiers })

      expect(controller.getSnapshot().phase).toBe('idle')
      expect(effects.some((effect) => effect.type === 'command.dispatch')).toBe(false)
      expect(effects.some((effect) => effect.type === 'text-editing.exit')).toBe(false)
    }
  })

  it('OpenSpec: 无 DOM 文字编辑会话 / Esc 与目标外按下退出会话', () => {
    const escape = textSetup({ selectedIds: ['a'], textEditing: { entityId: 'a' } })
    escape.controller.send({ type: 'key.down', key: 'Escape' })
    expect(escape.effects).toContainEqual({ type: 'text-editing.exit' })

    const outside = textSetup({ selectedIds: ['a'], textEditing: { entityId: 'a' } })
    outside.controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 310, y: 10 },
      hit: { kind: 'entity', entityId: 'b' },
      clickCount: 1,
      modifiers,
    })
    expect(outside.effects).toContainEqual({ type: 'text-editing.exit' })
  })

  it('OpenSpec: 无 DOM 文字编辑会话 / 选区变化与目标消失结束会话', () => {
    const selection = textSetup({ selectedIds: ['a'], textEditing: { entityId: 'a' } })
    selection.update({ selectedIds: ['b'], textEditing: { entityId: 'a' } })
    expect(selection.effects).toContainEqual({ type: 'text-editing.exit' })

    const removed = textSetup({ selectedIds: ['a'], textEditing: { entityId: 'a' } })
    removed.update({
      textEditing: { entityId: 'a' },
      value: document([entity('b', { x: 300 })]),
    })
    expect(removed.effects).toContainEqual({ type: 'text-editing.exit' })
    expect(removed.effects.every((effect) => (
      effect.type !== 'command.dispatch'
    ))).toBe(true)
  })
})

describe('StageInteractionController 绘制手势与并发文档变化', () => {
  it('OpenSpec: 直接绘制 Preset / 绘制中途的文档变化不打断手势', () => {
    const value = document([entity('a'), entity('b', { x: 300 })])
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    const update = (next = value) => {
      controller.updateContext({
        document: next,
        layoutSnapshot: layoutSnapshot(next, next === value ? 1 : 2),
        viewport: { x: 0, y: 0, zoom: 1 },
        surfaceSize: { width: 800, height: 600 },
        tool: 'draw-text',
        selectedIds: [],
        idFactory: () => 'draw-id',
      })
    }
    update()

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'surface' },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 90, y: 60 }, modifiers })
    expect(controller.getSnapshot().phase).toBe('draw')

    // 退出文字编辑时删除空文字会改动文档，而它和这次绘制发生在同一次指针按下里。
    // 绘制手势只由世界坐标定义，不引用任何 Entity，因此不应被这类变化打断。
    update(document([entity('b', { x: 300 })]))
    expect(controller.getSnapshot().phase).toBe('draw')

    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 90, y: 60 }, modifiers })
    expect(effects.some((effect) => effect.type === 'drawing.commit')).toBe(true)
  })
})

describe('StageInteractionController 文字工具只按点创建', () => {
  function drawTextSetup() {
    const value = document()
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'draw-text',
      selectedIds: [],
      idFactory: () => 'draw-text-id',
    })
    return { controller, effects }
  }

  it('OpenSpec: 直接绘制 Preset / 文字工具拖拽不改变尺寸', () => {
    const { controller, effects } = drawTextSetup()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 200, y: 160 },
      hit: { kind: 'surface' },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 360, y: 208 }, modifiers })

    // 文字只按点创建：拖多远预览都停在按下点，不存在“拖出一个尺寸”的语义。
    expect(controller.getSnapshot().drawing).toMatchObject({
      tool: 'draw-text',
      bounds: { x: 200, y: 160, width: 0, height: 0 },
    })

    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 360, y: 208 }, modifiers })
    const commit = effects.find((effect) => effect.type === 'drawing.commit')
    expect(commit).toMatchObject({
      tool: 'draw-text',
      bounds: { x: 200, y: 160, width: 0, height: 0 },
    })
  })

  it('OpenSpec: 直接绘制 Preset / 其他绘制工具仍按拖拽尺寸创建', () => {
    const value = document()
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'draw-rectangle',
      selectedIds: [],
      idFactory: () => 'draw-rect-id',
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 200, y: 160 },
      hit: { kind: 'surface' },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 360, y: 208 }, modifiers })
    expect(controller.getSnapshot().drawing).toMatchObject({
      bounds: { x: 200, y: 160, width: 160, height: 48 },
    })
  })
})

describe('StageInteractionController 内容重排实体的缩放', () => {
  function hugHeightEntity(id: string) {
    const base = entity(id)
    const item = base.components.LayoutItem as Record<string, unknown>
    return {
      ...base,
      components: {
        ...base.components,
        LayoutItem: {
          ...item,
          height: { ...(item.height as object), mode: 'hug' },
        },
      },
    }
  }

  function resizeSetup(reflowing: boolean) {
    const value = document([hugHeightEntity('a')])
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['a'],
      contentReflowsWithWidth: () => reflowing,
      idFactory: () => 'resize-id',
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 50 },
      hit: { kind: 'resize', handle: 'se' },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 60, y: 30 }, modifiers })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 60, y: 30 }, modifiers })
    const command = effects.find((effect) => effect.type === 'command.dispatch')
    return { controller, command }
  }

  it('OpenSpec: 受约束变换 System / Hug 高度的重排内容缩放时不被钉成 Fixed', () => {
    // 文字这类内容：宽度变窄后重新换行会长高。若缩放把高度一并写死，长出来的部分
    // 会被自己的框裁掉。因此只钉宽度，高度留给内容决定。
    const { command } = resizeSetup(true)
    expect(command).toMatchObject({
      command: {
        payload: {
          operation: 'resize',
          updates: [{ entityId: 'a', transform: { size: { width: 64, height: 50 } } }],
        },
      },
    })
  })

  it('OpenSpec: 受约束变换 System / 内容不随宽度重排时高度照常缩放', () => {
    const { command } = resizeSetup(false)
    expect(command).toMatchObject({
      command: {
        payload: {
          operation: 'resize',
          updates: [{ entityId: 'a', transform: { size: { width: 64, height: 32 } } }],
        },
      },
    })
  })
})

describe('框选工具与选区布尔组合', () => {
  /** left 占 0..100，right 占 200..300，两者都高 50。 */
  const marqueeDocument = document([
    entity('left', { x: 0, y: 0, width: 100, height: 50 }),
    entity('right', { x: 200, y: 0, width: 100, height: 50 }),
  ])

  function marqueeSetup(options: {
    readonly marqueeMode?: StageMarqueeMode
    readonly selectedIds?: readonly string[]
    readonly tool?: StageInteractionTool
  } = {}) {
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    controller.updateContext({
      document: marqueeDocument,
      layoutSnapshot: layoutSnapshot(marqueeDocument),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: options.tool ?? 'select',
      marqueeMode: options.marqueeMode,
      selectedIds: options.selectedIds ?? [],
      idFactory: () => 'marquee-id',
    })
    const drag = (
      from: { readonly x: number; readonly y: number },
      to: { readonly x: number; readonly y: number },
      hit: { readonly kind: 'surface' } | { readonly kind: 'entity'; readonly entityId: string } = { kind: 'surface' },
      release = modifiers,
    ) => {
      controller.send({ type: 'pointer.down', pointerId: 1, button: 0, point: from, hit, modifiers })
      controller.send({ type: 'pointer.move', pointerId: 1, point: to, modifiers: release })
      const duringDrag = controller.getSnapshot()
      controller.send({ type: 'pointer.up', pointerId: 1, point: to, modifiers: release })
      return duringDrag
    }
    const selection = () => {
      const changes = effects.filter((effect) => effect.type === 'selection.change')
      return changes[changes.length - 1]
    }
    return { controller, drag, effects, selection }
  }

  it('OpenSpec: 框选工具从节点上起框', () => {
    const { controller, drag, effects, selection } = marqueeSetup({ tool: 'marquee' })
    const duringDrag = drag({ x: 10, y: 10 }, { x: 280, y: 40 }, { kind: 'entity', entityId: 'left' })
    expect(duringDrag.phase).toBe('marquee')
    expect(controller.getSnapshot().phase).toBe('idle')
    // 起框而非移动：不得产生任何 transform 命令。
    expect(effects.some((effect) => effect.type === 'command.dispatch')).toBe(false)
    expect(selection()).toMatchObject({ selectedIds: ['left', 'right'] })
  })

  it('OpenSpec: 选择工具保持空白起框', () => {
    const { controller, drag } = marqueeSetup({ tool: 'select', selectedIds: ['left'] })
    const duringDrag = drag({ x: 10, y: 10 }, { x: 40, y: 30 }, { kind: 'entity', entityId: 'left' })
    expect(duringDrag.phase).toBe('move')
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('OpenSpec: 未传入模式时回退相交', () => {
    const { drag, selection } = marqueeSetup()
    drag({ x: -10, y: -10, }, { x: 50, y: 60 })
    expect(selection()).toMatchObject({ selectedIds: ['left'] })
  })

  it('OpenSpec: 框选判定模式协议 / 包含模式排除部分重叠节点', () => {
    const { drag, selection } = marqueeSetup({ marqueeMode: 'contain' })
    drag({ x: -10, y: -10 }, { x: 50, y: 60 })
    expect(selection()).toMatchObject({ selectedIds: [] })
    drag({ x: -10, y: -10 }, { x: 120, y: 60 })
    expect(selection()).toMatchObject({ selectedIds: ['left'] })
  })

  it('OpenSpec: 框选判定模式协议 / 方向决定模式按拖拽方向切换判定', () => {
    const rightward = marqueeSetup({ marqueeMode: 'directional' })
    const rightwardDrag = rightward.drag({ x: -10, y: -10 }, { x: 50, y: 60 })
    expect(rightwardDrag.marqueeHitTest).toBe('contain')
    expect(rightward.selection()).toMatchObject({ selectedIds: [] })

    const leftward = marqueeSetup({ marqueeMode: 'directional' })
    const leftwardDrag = leftward.drag({ x: 50, y: 60 }, { x: -10, y: -10 })
    expect(leftwardDrag.marqueeHitTest).toBe('intersect')
    expect(leftward.selection()).toMatchObject({ selectedIds: ['left'] })
  })

  it('OpenSpec: Shift 加选与 Alt 减选', () => {
    const added = marqueeSetup({ selectedIds: ['right'] })
    added.drag({ x: -10, y: -10 }, { x: 50, y: 60 }, { kind: 'surface' }, { ...modifiers, shift: true })
    expect(added.selection()).toMatchObject({ selectedIds: ['right', 'left'] })

    const subtracted = marqueeSetup({ selectedIds: ['left', 'right'] })
    subtracted.drag({ x: -10, y: -10 }, { x: 50, y: 60 }, { kind: 'surface' }, { ...modifiers, alt: true })
    expect(subtracted.selection()).toMatchObject({ selectedIds: ['right'] })
  })

  it('OpenSpec: 手势预览与原子提交 / 框选不产生文档事务', () => {
    const { drag, effects } = marqueeSetup({ tool: 'marquee' })
    drag({ x: -10, y: -10 }, { x: 400, y: 100 })
    expect(effects.some((effect) => effect.type === 'command.dispatch')).toBe(false)
  })
})

describe('OpenSpec: stage-engine / 画布拖拽 reparent 与容器内重排', () => {
  const dragTo = (
    controller: ReturnType<typeof setup>['controller'],
    to: { x: number; y: number },
    entityId = 'dragged',
  ) => {
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: to, modifiers })
    controller.send({ type: 'pointer.up', pointerId: 1, point: to, modifiers })
  }

  function reparentFixture() {
    const target = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    return document([target, dragged], ['target', 'dragged'])
  }

  it('深入容器内部松手提交一次 reparent，不再发布 Transform 命令', () => {
    const value = reparentFixture()
    const { controller, effects } = setup(value, layoutSnapshot(value), ['dragged'])
    dragTo(controller, { x: 500, y: 100 })

    const commands = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(commands).toHaveLength(1)
    const batch = commands[0] as Extract<StageInteractionEffect, { type: 'command.dispatch' }>
    expect(batch.command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect(JSON.stringify(batch.command)).toContain('"parentId":"target"')
    expect(JSON.stringify(batch.command)).not.toContain(BUILTIN_COMMAND_TYPES.setTransform)
  })

  it('贴边掠过维持既有 Transform 提交', () => {
    const value = reparentFixture()
    const { controller, effects } = setup(value, layoutSnapshot(value), ['dragged'])
    dragTo(controller, { x: 404, y: 100 })

    const commands = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: { type: BUILTIN_COMMAND_TYPES.setTransform },
    })
  })

  it('拖动期间目标被锁定时按既有原子性取消手势', () => {
    const value = reparentFixture()
    const { controller, effects } = setup(value, layoutSnapshot(value), ['dragged'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'dragged' },
      modifiers,
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 500, y: 100 },
      modifiers,
    })
    expect(controller.getSnapshot().dropTarget)
      .toEqual({ kind: 'reparent', containerId: 'target' })

    // 拖动期间目标被锁定。
    const locked = entity('target', {
      x: 400, y: 0, width: 200, height: 200, childIds: [], locked: true,
    })
    const next = document([locked, value.entities.dragged!], ['target', 'dragged'])
    controller.updateContext({
      document: next,
      layoutSnapshot: layoutSnapshot(next),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['dragged'],
      idFactory: () => 'id-late',
    })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 500, y: 100 }, modifiers })

    // 并发文档变化让空间手势整体不兼容，既有规则直接取消，不产生任何命令。
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(controller.getSnapshot().dropTarget).toBeNull()
  })

  it('Escape 取消后不提交任何命令且清除落点', () => {
    const value = reparentFixture()
    const { controller, effects } = setup(value, layoutSnapshot(value), ['dragged'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'dragged' },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 500, y: 100 }, modifiers })
    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(controller.getSnapshot().dropTarget).toBeNull()
  })
})

describe('OpenSpec: stage-engine / Auto Layout 容器内原地重排提交', () => {
  function reorderFixture() {
    const container = entity('container', { x: 0, y: 0, width: 300, height: 100, childIds: ['a', 'b', 'c'] })
    const withLayout = {
      ...container,
      components: {
        ...container.components,
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
    const flow = (id: string, x: number) => {
      const base = entity(id, { x, y: 0, width: 100, height: 100 })
      return {
        ...base,
        components: {
          ...base.components,
          LayoutItem: { ...base.components.LayoutItem, positioning: 'flow' as const },
        },
      }
    }
    return document([withLayout, flow('a', 0), flow('b', 100), flow('c', 200)], ['container'])
  }

  it('容器内重排只发一条 moveEntity，不发 Transform 命令', () => {
    const value = reorderFixture()
    const { controller, effects } = setup(value, layoutSnapshot(value), ['a'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 50, y: 50 },
      hit: { kind: 'entity', entityId: 'a' },
      modifiers,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 280, y: 50 }, modifiers })

    // 拖动中随指针发布插入位置，且此时尚未产生任何事务。
    expect(controller.getSnapshot().dropTarget)
      .toEqual({ kind: 'reorder', containerId: 'container', index: 3 })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)

    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 280, y: 50 }, modifiers })
    const commands = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: {
        type: BUILTIN_COMMAND_TYPES.moveEntity,
        payload: { entityIds: ['a'], parentId: 'container', index: 3 },
      },
    })
  })

  it('拖出容器边界回退为既有 Transform 提交', () => {
    const value = reorderFixture()
    const { controller, effects } = setup(value, layoutSnapshot(value), ['a'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 50, y: 50 },
      hit: { kind: 'entity', entityId: 'a' },
      modifiers,
    })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 50, y: 400 }, modifiers })

    const commands = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      command: { type: BUILTIN_COMMAND_TYPES.setTransform, payload: { operation: 'move' } },
    })
  })
})
