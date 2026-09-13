import { createComposeGroupEntitySeed } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import type { ComposeDocument } from '@compose-ui/core'
import type { StageInteractionEffect } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }

/*
 * 根 Frame › group › [ inner(Group) › [ leaf ], sibling ]。
 * 两层嵌套是判别性夹具：一层分不出「最外层」与「穿过一层」。
 */
const value: ComposeDocument = document(
  [
    createComposeGroupEntitySeed({ id: 'group', childIds: ['inner', 'sibling'], size: { width: 200, height: 60 } }),
    createComposeGroupEntitySeed({ id: 'inner', childIds: ['leaf'], size: { width: 40, height: 40 } }),
    entity('leaf', { x: 0, y: 0, width: 40, height: 40 }),
    entity('sibling', { x: 100, y: 0, width: 40, height: 40 }),
  ],
  ['group'],
)

function lockGroup(source: ComposeDocument, id: string): ComposeDocument {
  const target = source.entities[id]!
  return {
    ...source,
    entities: {
      ...source.entities,
      [id]: { ...target, components: { ...target.components, Lock: { locked: true } } },
    },
  }
}

function setup(patch: Record<string, unknown> = {}, doc: ComposeDocument = value) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  controller.updateContext({
    document: doc,
    layoutSnapshot: layoutSnapshot(doc),
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds: [],
    idFactory: () => 'group-hit-id',
    ...patch,
  } as never)
  const down = (entityId: string, over: Record<string, unknown> = {}) => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 10, y: 10 },
    hit: { kind: 'entity', entityId },
    modifiers: MODIFIERS,
    ...over,
  } as never)
  const selections = () => effects
    .filter((effect) => effect.type === 'selection.change')
    .map((effect) => (effect as { selectedIds: readonly string[] }).selectedIds)
  return { controller, effects, down, selections }
}

describe('OpenSpec: stage-engine / Group 命中先选组，双击穿过一层', () => {
  it('单击 Group 深处的叶子：选中最外层 Group 并开始移动它', () => {
    const { controller, down, selections } = setup()

    down('leaf')

    expect(selections()).toEqual([['group']])
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('双击穿过一层：选中门槛的直接子级，不开始移动', () => {
    const { controller, down, selections } = setup({ selectedIds: ['group'] })

    down('leaf', { clickCount: 2 })

    expect(selections()).toEqual([['inner']])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('已进入的 Group 不再是门槛：单击兄弟直接选中兄弟', () => {
    const { down, selections } = setup({ selectedIds: ['inner'] })

    down('sibling')

    expect(selections()).toEqual([['sibling']])
  })

  it('双击穿过门槛落到可编辑对象上时不进入编辑：那一下只是「进到这一层」', () => {
    const { down, effects, selections } = setup({
      selectedIds: ['leaf'],
      isTextEditable: (id: string) => id === 'leaf',
    })

    down('leaf', { clickCount: 2 })

    // 选中了 leaf，它上面的每一层 Group 都已进入，这一下是普通双击 → 进入文字编辑。
    expect(selections()).toEqual([['leaf']])
    expect(effects.some((effect) => effect.type === 'text-editing.enter')).toBe(true)

    // 对照：inner 还没进入时，同一下双击穿过 inner 落到 leaf，但不进入编辑。
    const gated = setup({
      selectedIds: ['group'],
      isTextEditable: (id: string) => id === 'leaf',
    })
    gated.down('leaf', { clickCount: 2 })
    expect(gated.selections()).toEqual([['inner']])
    expect(gated.effects.some((effect) => effect.type === 'text-editing.enter')).toBe(false)
  })

  it('command 深选无视门槛，直接选中并拖动命中项', () => {
    const { controller, down, selections } = setup()

    down('leaf', { modifiers: { ...MODIFIERS, command: true } })

    expect(selections()).toEqual([['leaf']])
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('Shift 点击没进入的 Group 的子级，加进选区的是那个 Group', () => {
    const { down, selections } = setup({ selectedIds: ['sibling'] })

    // sibling 在 group 里，group 已进入；inner 还没进入，因此加进来的是 inner。
    down('leaf', { modifiers: { ...MODIFIERS, shift: true } })

    expect(selections()).toEqual([['sibling', 'inner']])
  })

  it('锁定 Group 的子级：与命中锁定 Group 自己一样收敛成框选', () => {
    const { controller, down, selections } = setup({}, lockGroup(value, 'group'))

    down('leaf')

    expect(selections()).toEqual([])
    expect(controller.getSnapshot().phase).toBe('marquee')
  })

  it('锁定 Group 不下钻：双击它的子级仍然收敛成框选', () => {
    const { controller, down, selections } = setup({}, lockGroup(value, 'group'))

    down('leaf', { clickCount: 2 })

    expect(selections()).toEqual([])
    expect(controller.getSnapshot().phase).toBe('marquee')
  })
})
