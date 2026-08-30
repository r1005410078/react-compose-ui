import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStageRotatePlugin, STAGE_ROTATE_PLUGIN_ID } from './rotate-plugin'
import { createStagePluginRegistry } from './stage-kernel-profile'
import { createStageSessionArbiter } from './stage-kernel-profile'
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

describe('OpenSpec: stage-engine / 旋转工具插件 / 绕 Entity 自己的旋转基点', () => {
  /** 铰点在左边中点的刀身：`Transform.pivot` 是归一化盒坐标。 */
  const hinged = document([entity('p', { x: 0, y: 0, width: 100, height: 50, pivot: { x: 0, y: 0.5 } })])

  function hingedSetup() {
    const effects: StageInteractionEffect[] = []
    const controller = createStageInteractionController()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (next) => effects.push(...next),
    })
    controller.updateContext({
      document: hinged,
      layoutSnapshot: layoutSnapshot(hinged),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'rotate',
      selectedIds: ['p'],
      textEditing: null,
      drawnEntity: null,
      isTextEditable: () => false,
      idFactory: () => 'rotate-cmd',
    } as never)
    return { controller, effects }
  }

  it('单选时旋转中心是基点，不是包围盒中心', () => {
    const { controller } = hingedSetup()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 25 },
      hit: { kind: 'blank' },
      modifiers: MODIFIERS,
    } as never)

    // 铰点在盒的左边中点 `(0, 25)`；包围盒中心是 `(50, 25)`。
    expect(controller.getSnapshot().rotationPreview?.center).toEqual({ x: 0, y: 25 })
  })

  it('只转角度时位置一动不动', () => {
    /*
     * `StageTransform` 的 `x`/`y` 是**未旋转盒**的左上角，而旋转绕基点进行、不移动基点，
     * 因此「基点是定点」等价于「x/y 不变」。
     *
     * 世界矩阵绕包围盒中心构造、却按 Entity 自己的基点分解时，两边基点不一致，差额会被写进
     * `LayoutItem.offset`——症状就是「想刻角度，位置也被刻了一帧」，位移量恰好是
     * `2·|基点偏移|·sin(θ/2)`。
     */
    const { controller } = hingedSetup()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 25 },
      hit: { kind: 'blank' },
      modifiers: MODIFIERS,
    } as never)
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 50, y: 75 },
      modifiers: MODIFIERS,
    } as never)

    const preview = controller.getSnapshot().previewTransforms.p!
    expect(preview.rotation).not.toBeCloseTo(0)
    expect(preview.x).toBeCloseTo(0)
    expect(preview.y).toBeCloseTo(0)
  })

  it('多选退回选区包围盒中心', () => {
    // 多选没有单一基点可言：各转各的不是一次旋转。
    const many = document([
      entity('p', { x: 0, y: 0, width: 100, height: 50, pivot: { x: 0, y: 0.5 } }),
      entity('q', { x: 200, y: 0, width: 100, height: 50 }),
    ])
    const controller = createStageInteractionController()
    controller.connectSurface({ resolveClientPoint: (point) => point, applyEffects: () => {} })
    controller.updateContext({
      document: many,
      layoutSnapshot: layoutSnapshot(many),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'rotate',
      selectedIds: ['p', 'q'],
      textEditing: null,
      drawnEntity: null,
      isTextEditable: () => false,
      idFactory: () => 'rotate-cmd',
    } as never)
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 400, y: 25 },
      hit: { kind: 'blank' },
      modifiers: MODIFIERS,
    } as never)

    expect(controller.getSnapshot().rotationPreview?.center).toEqual({ x: 150, y: 25 })
  })
})

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

  it('OpenSpec: stage-engine / 旋转工具插件 / 累加语义下点中即加入', () => {
    const { controller, effects, update } = rotateSetup(['a'])
    update({ selectionMode: 'accumulate' })

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 40, y: 20 },
      hit: { kind: 'entity', entityId: 'b' },
      modifiers: MODIFIERS,
    })

    // 旋转工具是点选的第三条路径，必须读同一张语义表。
    expect(effects).toContainEqual({ type: 'selection.change', selectedIds: ['a', 'b'] })
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
