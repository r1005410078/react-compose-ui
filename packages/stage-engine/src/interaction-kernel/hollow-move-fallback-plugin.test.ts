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

/** 一条从盒左上角拉到右下角的**开放**对角线；它选中之后画的是几何轮廓，没有盒。 */
function openCurve(): ComposeEntity {
  const base = entity('hollow', { x: 100, y: 100, width: 200, height: 100 })
  return {
    ...base,
    components: {
      ...base.components,
      Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 200, y: 100 } },
    },
  }
}

function setup(
  entityValue: ComposeEntity,
  selectedIds: readonly string[],
  extra: readonly ComposeEntity[] = [],
  /** 画在它**下面**（绘制次序更靠前）的兄弟。 */
  under: readonly ComposeEntity[] = [],
) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const value = document([...under, entityValue, ...extra])
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

/**
 * 把空心矩形放进一个**普通容器**（不是场景）里。
 *
 * @remarks
 * `document()` 造的场景是 `rootIds` 唯一的直接成员，因此这里传进去的 `box` 是一个嵌套容器
 * ——`shouldConvergeToMarquee` 对它返回假，这正是要钉住的那一档。
 */
function setupInContainer(selectedIds: readonly string[]) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const container = entity('box', { x: 0, y: 0, width: 600, height: 400, childIds: ['hollow'] })
  const value = document([container, curve(false)], ['box'])
  controller.updateContext({
    document: value,
    layoutSnapshot: layoutSnapshot(value),
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds,
    idFactory: () => 'hollow-id',
  } as never)

  /** 盒的正中间；那里是空心的，指针一路放行到容器体上。 */
  const down = () => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 200, y: 150 },
    hit: { kind: 'entity', entityId: 'box', source: 'body' },
    modifiers: MODIFIERS,
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

  it('一步没动就是一次单击，不产生文档变更也不动选区', () => {
    const { controller, effects, down, up } = setup(curve(false), ['hollow'])

    down()
    up(200, 150)
    // 它已经是当前选区（守卫的前置条件就是如此），因此这一下什么都不该发出——
    // 「点一下自己的盒」等于「取消选中自己」没有任何解释得通的读法。
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(effects.filter((effect) => effect.type === 'selection.change')).toHaveLength(0)
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

  /*
   * 这条钉住的是这条能力在**容器里**同样成立。`surface` 与顶层容器体收敛两个分支都只覆盖
   * 「外框画在场景里」——而这个产品里的空心矩形是设备外框、柜体轮廓与分区框，几乎总是画在
   * 某个容器里。少了它，症状是「抓着矩形拖了一下，走的是整个容器」。
   */
  it('画在普通容器里时同样移动它，而不是选中并拖走容器', () => {
    const { controller, effects, down, move, up } = setupInContainer(['hollow'])

    down()
    move(260, 150)
    expect(controller.getSnapshot().phase).toBe('move')

    up(260, 150)
    // 容器既没有被选中，也不是被移动的那一个。
    expect(effects.filter((effect) => effect.type === 'selection.change')).toHaveLength(0)
    const dispatched = effects.filter((effect) => effect.type === 'command.dispatch')
    expect(dispatched).toHaveLength(1)
    expect(JSON.stringify(dispatched[0])).toContain('"entityId":"hollow"')
    expect(JSON.stringify(dispatched[0])).not.toContain('"entityId":"box"')
  })

  it('容器里原地单击同样不动选区', () => {
    const { effects, down, up } = setupInContainer(['hollow'])

    down()
    up(200, 150)
    expect(effects.filter((effect) => effect.type === 'selection.change')).toHaveLength(0)
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
  })

  /*
   * 这条钉住的是判据取**祖先**而不是「绘制次序排在它之前」。后者同样解释得通（指针之所以
   * 落到别人身上，正是因为空心图形放行了它），但它会把画在下面的兄弟一并收走——而点在一块
   * 看得见的墨上得到「选中那块墨」是解释得通的结果，不是这条能力要挡的症状。
   * 命中画在**上面**的兄弟对两种写法都绿，钉不住这个决定。
   */
  it('落在画于它下面的兄弟上时不接管', () => {
    const under = entity('under', { x: 150, y: 120, width: 100, height: 60 })
    const filled: ComposeEntity = {
      ...under,
      components: {
        ...under.components,
        Appearance: { backgroundPaint: { kind: 'solid', color: '#3687ff' } },
      },
    }
    const { controller, effects, move } = setup(curve(false), ['hollow'], [], [filled])

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 200, y: 150 },
      hit: { kind: 'entity', entityId: 'under' },
      modifiers: MODIFIERS,
    } as never)
    move(240, 190)

    expect(effects.filter((effect) => effect.type === 'selection.change'))
      .toEqual([{ type: 'selection.change', selectedIds: ['under'] }])
    expect(controller.getSnapshot().phase).toBe('move')
  })

  /*
   * 「一步没动保持选中」只在**画了盒**的那一档成立。开放几何选中之后画的是沿几何的轮廓、
   * 没有盒，它的包围盒里绝大部分是空的——落在空角上的那一下确实什么都没点到，屏幕上也没有
   * 任何盒在宣称那块面积归它，因此仍然清空选区。少了这条，一个只判「空心」不判「闭合」的
   * 实现会让一条画着轮廓的斜线在它的空角上点不掉。
   */
  it('没画盒的那一档，一步没动仍然清空选区', () => {
    const { effects, down, up } = setup(openCurve(), ['hollow'])

    down()
    up(200, 150)
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
    expect(effects.filter((effect) => effect.type === 'selection.change'))
      .toEqual([{ type: 'selection.change', selectedIds: [] }])
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
