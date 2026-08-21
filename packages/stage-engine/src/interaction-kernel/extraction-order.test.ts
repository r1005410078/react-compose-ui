import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_EXTRACTED_PLUGIN_FACTORIES } from './extracted-plugins'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type { StageInteractionEffect } from '../interaction-controller'

/*
 * 这组测试锁定的是绞杀式重构的**抽取顺序不变量**，不是某个手势的行为。
 *
 * legacy 单体插件的 claim 在 begin() 未产生手势时一律返回 'consumed'，因此它必须始终排在
 * 最后。由此推出：一个分支只有在**优先级高于它的分支全部抽取完毕**之后才能安全抽取，
 * 否则那些仍留在 legacy(0) 里的高优先级分支会被挤到新插件之后询问，顺序发生反转。
 *
 * 下面两个用例复刻的正是这类反转真实发生过的一次：pan(1700) 先于 text-edit-guard(1800)
 * 抽取，导致编辑态下按中键绕过守卫——不仅会开始平移，编辑会话还再也退不出去。
 */

const value = document([entity('a'), entity('b', { x: 300 })])
const MODIFIERS = { shift: false, alt: false, command: false }

function editingSetup() {
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
    textEditing: { entityId: 'a' },
    drawnEntity: null,
    isTextEditable: () => true,
    idFactory: () => 'guard-test-id',
  } as never)
  return { controller, effects }
}

describe('OpenSpec: stage-engine / 无 DOM 文字编辑会话 / 编辑期间屏蔽空间手势', () => {
  it('编辑态下在编辑目标上按中键不开始平移', () => {
    const { controller, effects } = editingSetup()

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 1,
      point: { x: 30, y: 40 },
      hit: { kind: 'entity', entityId: 'a' },
      modifiers: MODIFIERS,
    })

    // 守卫命中编辑目标 → 整条手势打住：既不平移，也不退出编辑。
    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('编辑态下在别处按中键先退出编辑再平移', () => {
    const { controller, effects } = editingSetup()

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 1,
      point: { x: 600, y: 500 },
      hit: { kind: 'surface' },
      modifiers: MODIFIERS,
    })

    // 顺序是硬约束：漏掉 text-editing.exit 会让编辑会话永远留在打开状态。
    expect(effects.map((item) => item.type)).toEqual(['text-editing.exit', 'pointer.capture'])
    expect(controller.getSnapshot().phase).toBe('pan')
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 注册表覆盖优先级表', () => {
  /*
   * 绞杀式重构期间，这里守的是「已抽取集合必须是优先级表的前缀」——因为 legacy 单体永远排在
   * 最后兜底，插到它前面的插件一旦跳号，仍留在 legacy 里的高优先级分支就会被挤到后面询问。
   *
   * legacy 删除之后不变量随之升级：**没有兜底了**，注册表必须逐项覆盖整张表，漏掉一项就是
   * 一类命中彻底无人接管——那不再是顺序反转，而是功能消失。
   */
  it('注册表逐项覆盖优先级表，没有兜底可以掩盖遗漏', () => {
    const registered = new Set(STAGE_EXTRACTED_PLUGIN_FACTORIES.map((create) => create().id))

    expect([...STAGE_GESTURE_PRIORITY].map(({ id }) => id).filter((id) => !registered.has(id)))
      .toEqual([])
  })

  it('每个注册插件都在优先级表里登记，且优先级与表一致', () => {
    const table = new Map(STAGE_GESTURE_PRIORITY.map(({ id, priority }) => [id, priority]))

    for (const create of STAGE_EXTRACTED_PLUGIN_FACTORIES) {
      const plugin = create()
      expect(table.get(plugin.id)).toBe(plugin.priority)
    }
  })

  it('优先级两两不同，询问顺序完全确定', () => {
    const priorities = STAGE_EXTRACTED_PLUGIN_FACTORIES.map((create) => create().priority)

    expect(new Set(priorities).size).toBe(priorities.length)
  })
})
