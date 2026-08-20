import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_EXTRACTED_PLUGIN_FACTORIES } from './extracted-plugins'
import { STAGE_GESTURE_PRIORITY, STAGE_LEGACY_MONOLITH_PRIORITY } from './gesture-priority'
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

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 抽取顺序不变量', () => {
  it('已抽取的插件在优先级表中构成一个自顶向下的前缀', () => {
    // legacy 永远排最后，因此已抽取集合必须是表的前缀；出现空洞就意味着某个更高优先级的
    // 分支仍在 legacy 里，会被挤到已抽取插件之后询问。
    //
    // 集合从 controller 实际注册的那份清单推导，不再手抄：手抄的版本在 rotate 与
    // paint-sample 落地时没人更新，守卫看着还在、其实早已不检查新插件。
    const extracted = new Set(
      STAGE_EXTRACTED_PLUGIN_FACTORIES.map((create) => create().id),
    )
    const ids = STAGE_GESTURE_PRIORITY.map(({ id }) => id)
    const lastExtracted = ids.reduce(
      (acc, id, i) => (extracted.has(id) ? i : acc),
      -1,
    )

    expect(ids.slice(0, lastExtracted + 1).every((id) => extracted.has(id))).toBe(true)
  })

  it('每个已抽取插件都在优先级表里登记，且优先级与表一致', () => {
    // 少了这条，一个表外的 id 会让前缀断言在空前缀上空转通过。
    const table = new Map(STAGE_GESTURE_PRIORITY.map(({ id, priority }) => [id, priority]))

    for (const create of STAGE_EXTRACTED_PLUGIN_FACTORIES) {
      const plugin = create()
      expect(table.get(plugin.id)).toBe(plugin.priority)
    }
  })

  it('legacy 优先级低于表中任何一项，保证它始终最后被询问', () => {
    const lowest = Math.min(...STAGE_GESTURE_PRIORITY.map(({ priority }) => priority))

    expect(STAGE_LEGACY_MONOLITH_PRIORITY).toBeLessThan(lowest)
  })
})
