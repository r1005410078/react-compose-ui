import { COMPOSE_GROUP_PRESET_ID } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot, ROOT_FRAME_ID } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import {
  createStageMarqueeConvergePlugin,
  shouldConvergeToMarquee,
  STAGE_MARQUEE_CONVERGE_PLUGIN_ID,
} from './marquee-plugin'
import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
import type { StageInteractionEffect, StageInteractionHit } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }

/*
 * v7 的「顶层」= `rootIds` 的直接成员，而 rootIds 只接受 Frame——因此画布上会收敛的容器
 * 就是各块场景本身。夹具里那个包住一切的根 Frame 正是这样的容器。
 */
const value = document([
  entity('leaf', { x: 10, y: 10, width: 40, height: 40 }),
  entity('far', { x: 600, y: 400, width: 40, height: 40 }),
])

function convergeSetup(patch: Record<string, unknown> = {}) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const update = (next: Record<string, unknown> = {}) => {
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: [],
      idFactory: () => 'converge-id',
      ...patch,
      ...next,
    } as never)
  }
  update()
  const down = (hit: StageInteractionHit, modifiers = MODIFIERS) => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 5, y: 5 },
    hit,
    modifiers,
  })
  const selections = () => effects.filter((effect) => effect.type === 'selection.change')
  return { controller, effects, update, down, selections }
}

describe('OpenSpec: stage-engine / 容器标题标签与命中收敛 / 收敛入口独立插件', () => {
  it('marquee-converge 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY
      .find(({ id }) => id === STAGE_MARQUEE_CONVERGE_PLUGIN_ID)

    expect(createStageMarqueeConvergePlugin().priority).toBe(fromTable?.priority)
  })

  it('非空场景的 body 命中收敛为框选', () => {
    const { controller, down, selections } = convergeSetup()

    down({ kind: 'entity', entityId: ROOT_FRAME_ID })

    // 场景一旦装了内容，它的空白区域在用户眼里就是「场景内的画布」。
    expect(controller.getSnapshot().phase).toBe('marquee')
    expect(selections()).toHaveLength(0)
  })

  it('标题标签命中直接选中场景，不收敛', () => {
    const { controller, down } = convergeSetup()

    down({ kind: 'entity', entityId: ROOT_FRAME_ID, source: 'label' })

    // 标签是收敛之后唯一的选中入口。
    expect(controller.getSnapshot().phase).not.toBe('marquee')
  })

  it('已在选区里的场景同样收敛', () => {
    const { controller, down, selections } = convergeSetup({ selectedIds: [ROOT_FRAME_ID] })

    down({ kind: 'entity', entityId: ROOT_FRAME_ID })

    // 用户几乎总是先选中场景（看属性、改尺寸）再去框选它的内容，此时保护恰好失效——而子级
    // 是相对坐标，场景被搬走时画面内部没有任何变化。标签仍是不受影响的拖动入口。
    expect(controller.getSnapshot().phase).toBe('marquee')
    expect(selections()).toHaveLength(0)
  })

  it('command 点体直选并拖动场景', () => {
    const { controller, down } = convergeSetup()

    down({ kind: 'entity', entityId: ROOT_FRAME_ID }, { ...MODIFIERS, command: true })

    // 标签之外的第二个入口（抄 Sketch 的 ⌘ 点击）。
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('单击收敛目标清空选区', () => {
    const { controller, down, selections } = convergeSetup({ selectedIds: ['leaf'] })
    down({ kind: 'entity', entityId: ROOT_FRAME_ID })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 5, y: 5 }, modifiers: MODIFIERS })

    // 框退化为零面积，与在工作区空白处单击一致。
    const committed = selections()
    expect(committed[committed.length - 1]).toMatchObject({ selectedIds: [] })
  })

  it('提交时排除起框场景与它的祖先', () => {
    const { controller, down, selections } = convergeSetup()
    down({ kind: 'entity', entityId: ROOT_FRAME_ID })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 300, y: 300 }, modifiers: MODIFIERS })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 300, y: 300 }, modifiers: MODIFIERS })

    // 起框容器与祖先被框住只是几何巧合：用户是在这个容器「里面」框内容。
    const selected = selections()[0]
    expect(selected).toMatchObject({
      type: 'selection.change',
      selectedIds: ['leaf'],
    })
  })
})

describe('OpenSpec: stage-engine / 容器标题标签与命中收敛 / 收敛判定', () => {
  const hit = (entityId: string, source?: 'body' | 'label') =>
    ({ kind: 'entity' as const, entityId, ...(source ? { source } : {}) })

  const converge = (
    tool: Parameters<typeof shouldConvergeToMarquee>[0],
    doc: ComposeDocument,
    target: Extract<StageInteractionHit, { kind: 'entity' }>,
    modifiers = MODIFIERS,
  ) => shouldConvergeToMarquee(tool, doc, target, modifiers)

  const withEntity = (id: string, replace: (base: ComposeEntity) => ComposeEntity): ComposeDocument => ({
    ...value,
    entities: { ...value.entities, [id]: replace(value.entities[id]!) },
  })

  it('绘制工具下不收敛', () => {
    // 收敛只服务于选择意图；绘制工具压在场景上是起笔。
    expect(converge('draw-container', value, hit(ROOT_FRAME_ID))).toBe(false)
  })

  it('嵌套容器不收敛', () => {
    // 标题标签只画给顶层容器；嵌套容器收敛后在画布上就没有任何选中入口了。
    const nested = document([entity('box', { x: 0, y: 0, width: 300, height: 300, childIds: ['leaf'] })])

    expect(converge('select', nested, hit('box'))).toBe(false)
  })

  it('空场景同样收敛', () => {
    // 空场景整块 1920×1080 都是拖动把手，而里面什么都没有可点——这正是最容易手滑的时刻。
    const empty = document([])

    expect(converge('select', empty, hit(ROOT_FRAME_ID))).toBe(true)
  })

  it('command 旁路不作用于锁定容器', () => {
    // 锁定容器的选中入口只剩场景树，command 不是它的后门。
    const locked = withEntity(ROOT_FRAME_ID, (base) => ({
      ...base,
      components: { ...base.components, Lock: { locked: true } },
    } as ComposeEntity))

    expect(converge('select', locked, hit(ROOT_FRAME_ID), { ...MODIFIERS, command: true }))
      .toBe(true)
  })

  it('Group 不收敛', () => {
    // Group 没有画布标签，收敛之后就再也选不中了。
    const grouped = withEntity(ROOT_FRAME_ID, (base) => ({
      ...base,
      components: {
        ...base.components,
        Composition: { ...base.components.Composition, presetId: COMPOSE_GROUP_PRESET_ID },
      },
    } as ComposeEntity))

    expect(converge('select', grouped, hit(ROOT_FRAME_ID))).toBe(false)
  })

  it('锁定的容器收敛，标签也不再是入口', () => {
    // 锁定容器本来就是用来「挡住不要动的东西」的，还能被点中只会让用户反复误选。
    const locked = withEntity(ROOT_FRAME_ID, (base) => ({
      ...base,
      components: { ...base.components, Lock: { locked: true } },
    } as ComposeEntity))

    expect(converge('select', locked, hit(ROOT_FRAME_ID, 'label'))).toBe(true)
  })

  it('不存在的 Entity 不收敛', () => {
    expect(converge('select', value, hit('gone'))).toBe(false)
  })
})
