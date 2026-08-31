import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import {
  createStageHollowMoveFallbackPlugin,
  STAGE_HOLLOW_MOVE_FALLBACK_PLUGIN_ID,
} from './hollow-move-fallback-plugin'
import type { ComposeEntity } from '@compose-ui/core'
import type { StageInteractionEffect, StageInteractionHit } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }

/** 200×100 的闭合矩形曲线；`filled` 为真时给它一个不透明背景。 */
function curve(filled: boolean): ComposeEntity {
  const base = entity('hollow', { x: 100, y: 100, width: 200, height: 100 })
  return {
    ...base,
    components: {
      ...base.components,
      Curve: {
        kind: 'polyline',
        vertices: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
        closed: true,
      },
      ...(filled
        ? {
            Appearance: {
              backgroundPaint: { kind: 'solid', color: '#3687ff' },
            },
          }
        : {}),
    },
  }
}

function setup(
  entityValue: ComposeEntity,
  selectedIds: readonly string[],
  extra: readonly ComposeEntity[] = [],
) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const value = document([entityValue, ...extra])
  controller.updateContext({
    document: value,
    layoutSnapshot: layoutSnapshot(value),
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds,
    idFactory: () => 'hollow-id',
  } as never)

  /** 在盒的正中间按下；那里是空心的，因此命中的是 surface。 */
  const down = (
    modifiers = MODIFIERS,
    hit: StageInteractionHit = { kind: 'surface' },
  ) => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 200, y: 150 },
    hit,
    modifiers,
  } as never)
  const move = (x: number, y: number) => controller.send({
    type: 'pointer.move', pointerId: 1, point: { x, y }, modifiers: MODIFIERS,
  } as never)
  const up = (x: number, y: number) => controller.send({
    type: 'pointer.up', pointerId: 1, point: { x, y }, modifiers: MODIFIERS,
  } as never)
  return { controller, effects, down, move, up }
}

/*
 * 判别性用例都从「同一次按下，动了与没动分别做什么」反推。只断「拖动能移动它」不够——
 * 那对「盒内部一律拦截指针」这种过宽的实现同样绿，而那正是被否掉的做法。
 */
describe('OpenSpec: stage / 选中的空心图形盒内部起手即移动', () => {
  it('优先级与表一致，且排在双击进几何编辑之下', () => {
    const fromTable = STAGE_GESTURE_PRIORITY
      .find(({ id }) => id === STAGE_HOLLOW_MOVE_FALLBACK_PLUGIN_ID)
    expect(createStageHollowMoveFallbackPlugin().priority).toBe(fromTable?.priority)

    const geometryEdit = STAGE_GESTURE_PRIORITY.find(({ id }) => id === 'geometry-edit-fallback')!
    const marquee = STAGE_GESTURE_PRIORITY.find(({ id }) => id === 'marquee-converge')!
    // 双击属于几何编辑；比框选高才接管得到本来会变成框选的那一下。
    expect(fromTable!.priority).toBeLessThan(geometryEdit.priority)
    expect(fromTable!.priority).toBeGreaterThan(marquee.priority)
  })

  it('选中之后盒内部起手拖动即移动它，而不是拉框选', () => {
    const { controller, effects, down, move, up } = setup(curve(false), ['hollow'])

    down()
    move(240, 190)
    // 判别点：这一档是移动而不是框选——症状正是「拖了一下东西跑了」。
    expect(controller.getSnapshot().phase).toBe('move')
    expect(controller.getSnapshot().marquee).toBeNull()

    up(240, 190)
    expect(effects.some((effect) => effect.type === 'command.dispatch')).toBe(true)
    // 没有把自己取消选中。
    expect(effects.filter((effect) => effect.type === 'selection.change')).toHaveLength(0)
  })

  it('一步没动就是一次单击，含义不变', () => {
    const { controller, effects, down, up } = setup(curve(false), ['hollow'])

    down()
    up(200, 150)
    // 还原成框选兜底的结果：一个零面积的框什么都框不到，于是清空选区。
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(effects.filter((effect) => effect.type === 'selection.change'))
      .toEqual([{ type: 'selection.change', selectedIds: [] }])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('没选中它时不接管——那一档盒不该拦截指针', () => {
    const { controller, down, move } = setup(curve(false), [])

    down()
    move(240, 190)
    // 外框套在符号外面时让盒可点会抢走里面每一个符号的点击，这条规则不动。
    expect(controller.getSnapshot().phase).toBe('marquee')
  })

  it('按住 Shift 时不接管', () => {
    const { controller, down, move } = setup(curve(false), ['hollow'])

    down({ ...MODIFIERS, shift: true })
    move(240, 190)
    // Shift 的含义是「加进选区」，从框内起手做一次加选式框选是正当用法。
    expect(controller.getSnapshot().phase).toBe('marquee')
  })

  it('填过色的不走这条路——它的盒本来就拦得住指针', () => {
    const { controller, down, move } = setup(curve(true), ['hollow'])

    down()
    move(240, 190)
    // 填过色时命中会是 `entity`，走的是 `entity-select-move`；这里的 `surface` 命中说明
    // 指针落在了它之外，那一下就该是框选。
    expect(controller.getSnapshot().phase).toBe('marquee')
  })

  /*
   * 这条钉住的是「盒内任意地方都能拖」**不成立**：框里那些符号仍然属于它们自己。少了它，
   * 一个把整块面积都接管掉的实现同样能让别的用例全绿，而那正是「外框会抢走里面每一个符号的
   * 点击」这条被否掉的做法。
   */
  it('落在框内某个符号上的按下属于那个符号，不是外框', () => {
    const inner = entity('inner', { x: 160, y: 130, width: 40, height: 40 })
    const { controller, effects, down } = setup(curve(false), ['hollow'], [inner])

    down(MODIFIERS, { kind: 'entity', entityId: 'inner' })

    // 选区换成了那个符号，被移动的因此也是它。
    expect(effects.filter((effect) => effect.type === 'selection.change'))
      .toEqual([{ type: 'selection.change', selectedIds: ['inner'] }])
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('盒外面起手照旧是框选', () => {
    const { controller, effects, down: _down, move } = setup(curve(false), ['hollow'])
    void _down
    void effects
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 500, y: 400 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    } as never)
    move(540, 440)

    expect(controller.getSnapshot().phase).toBe('marquee')
  })
})
