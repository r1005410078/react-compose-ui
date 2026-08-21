import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStageRotatePlugin, STAGE_ROTATE_PLUGIN_ID } from './rotate-plugin'
import { createStagePluginRegistry } from './plugin-registry'
import { createStageSessionArbiter } from './session-arbiter'
import type { StageInteractionEffect } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }
const value = document([entity('a', { x: 0, y: 0, width: 100, height: 50 }), entity('b', { x: 300 })])

function rotateSetup(selectedIds: readonly string[] = ['a']) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const update = (patch: Record<string, unknown> = {}) => {
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'rotate',
      selectedIds,
      textEditing: null,
      drawnEntity: null,
      isTextEditable: () => false,
      idFactory: () => 'rotate-cmd',
      ...patch,
    } as never)
  }
  update()
  return { controller, effects, update }
}

describe('OpenSpec: stage-engine / 受约束变换 System / 旋转工具接管', () => {
  it('在实体上按下同时改选区并开始旋转', () => {
    const { controller, effects } = rotateSetup(['a'])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 40, y: 20 },
      hit: { kind: 'entity', entityId: 'b' },
      modifiers: MODIFIERS,
    })

    expect(effects).toContainEqual({ type: 'selection.change', selectedIds: ['b'] })
    expect(controller.getSnapshot().phase).toBe('rotate')
  })

  it('在空白按下对既有选区开始旋转', () => {
    const { controller } = rotateSetup(['a'])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 500, y: 400 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    })

    // 旋转工具绝不框选：空白按下作用于当前选区。
    expect(controller.getSnapshot().phase).toBe('rotate')
  })

  it('没有选区时空白按下被消费而不落到框选', () => {
    const { controller } = rotateSetup([])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 500, y: 400 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    })

    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('标尺与辅助线命中不被旋转工具接管', () => {
    const { controller } = rotateSetup(['a'])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 4 },
      hit: { kind: 'ruler', axis: 'y' },
      modifiers: MODIFIERS,
    } as never)

    // 标尺保留拖出辅助线的原语义，交给后续插件。
    expect(controller.getSnapshot().phase).toBe('guide-create')
  })

  it('拖动发布旋转预览，松手提交一条命令', () => {
    const { controller, effects } = rotateSetup(['a'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 500, y: 400 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    })
    effects.length = 0

    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 520, y: 300 }, modifiers: MODIFIERS })
    expect(controller.getSnapshot().rotationPreview).not.toBeNull()

    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 520, y: 300 }, modifiers: MODIFIERS })

    const dispatched = effects.filter((item) => item.type === 'command.dispatch')
    expect(dispatched).toHaveLength(1)
    expect(controller.getSnapshot().phase).toBe('idle')
  })
})

describe('OpenSpec: stage-engine / 手势预览与原子提交 / 并发变化中止旋转', () => {
  it('文档变化中止进行中的旋转会话', () => {
    const { controller, update } = rotateSetup(['a'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 500, y: 400 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    })
    expect(controller.getSnapshot().phase).toBe('rotate')

    // 选区被别处的编辑改掉：继续沿用冻结几何会提交出错误的变换。
    update({ selectedIds: ['b'] })

    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('工具切换中止进行中的旋转会话', () => {
    const { controller, update } = rotateSetup(['a'])
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 500, y: 400 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    })

    update({ tool: 'select' })

    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('并发文档变化中止旋转且不提交命令', () => {
    const { controller, effects, update } = rotateSetup(['a'])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 40, y: 20 },
      hit: { kind: 'entity', entityId: 'a' },
      modifiers: MODIFIERS,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 90, y: 60 }, modifiers: MODIFIERS })
    expect(controller.getSnapshot().phase).toBe('rotate')

    // 别处的编辑换掉了 document：选区与 top-level 目标都没变，但旋转按下当刻算好的
    // center / bounds / baseRotation 可能已经过期。
    const next = document([entity('a', { x: 0, y: 0, width: 100, height: 50 }), entity('b', { x: 300 })])
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('idle')

    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 90, y: 60 }, modifiers: MODIFIERS })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
  })

  it('并发布局重排中止旋转', () => {
    const { controller, update } = rotateSetup(['a'])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 40, y: 20 },
      hit: { kind: 'entity', entityId: 'a' },
      modifiers: MODIFIERS,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 90, y: 60 }, modifiers: MODIFIERS })

    // 文档不变、只有布局 revision 前进：Auto Layout 重排同样会挪动世界坐标。
    const solved = layoutSnapshot(value)
    update({ layoutSnapshot: { ...solved, revision: solved.revision + 1 } })

    expect(controller.getSnapshot().phase).toBe('idle')
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / revalidate', () => {
  it('会话未实现 isCompatibleWith 时始终成立', () => {
    const arbiter = createStageSessionArbiter(createStagePluginRegistry([{
      id: 'always',
      priority: 1,
      claim: () => ({ pointerId: 1, update: () => {}, commit: () => {}, cancel: () => {} }),
    }]))
    arbiter.begin({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 0, y: 0 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    }, {} as never)

    const index = createStageSceneIndex(value, layoutSnapshot(value))
    expect(arbiter.revalidate({} as never, index, {} as never)).toBe(false)
    expect(arbiter.hasSession()).toBe(true)
  })
})

describe('OpenSpec: stage-engine / 平移手势插件 / 优先级取自表', () => {
  it('rotate 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_ROTATE_PLUGIN_ID)

    expect(createStageRotatePlugin().priority).toBe(fromTable?.priority)
  })
})
