import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStageGizmoPlugin, STAGE_GIZMO_PLUGIN_ID } from './gizmo-plugin'
import type { StageInteractionEffect } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: true }

/** 铰点在左边中点的刀身。 */
const value = document([
  entity('p', { x: 0, y: 0, width: 100, height: 50, pivot: { x: 0, y: 0.5 } }),
])

function setup(selectedIds: readonly string[] = ['p']) {
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
    selectedIds,
    textEditing: null,
    drawnEntity: null,
    isTextEditable: () => false,
    idFactory: () => 'gizmo-cmd',
  } as never)
  const down = (
    handle: 'move-x' | 'move-y' | 'scale-x' | 'scale-y' | 'rotate',
    point = { x: 60, y: 25 },
  ) => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point,
    hit: { kind: 'gizmo-handle', handle },
    modifiers: MODIFIERS,
  } as never)
  const move = (point: { x: number; y: number }) => controller.send({
    type: 'pointer.move', pointerId: 1, point, modifiers: MODIFIERS,
  } as never)
  return { controller, effects, down, move }
}

describe('OpenSpec: stage-engine / 变换指示器把手的命中与仲裁', () => {
  it('优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_GIZMO_PLUGIN_ID)

    expect(createStageGizmoPlugin().priority).toBe(fromTable?.priority)
  })

  it('排在 entity-select-move 与 resize 之上、path 与 paint 之下', () => {
    /*
     * 圆环横穿盒手柄与圆角把手，排在它们之下等于环在四个角上按不动，而那正是环最容易被抓到的
     * 地方；同时 path / paint 是**别的编辑会话**的把手，指示器不该把它们偷走。
     */
    const at = (id: string) => STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority
    expect(at('gizmo')).toBeGreaterThan(at('entity-select-move'))
    expect(at('gizmo')).toBeGreaterThan(at('resize'))
    expect(at('gizmo')).toBeLessThan(at('path'))
    expect(at('gizmo')).toBeLessThan(at('paint'))
  })

  it('拖箭头只平移，不改角度', () => {
    const { controller, down, move } = setup()
    down('move-x')
    move({ x: 160, y: 95 })

    const preview = controller.getSnapshot().previewTransforms.p!
    expect(preview.rotation).toBe(0)
    // 轴对齐的 X 轴：垂直方向的位移被投影掉。
    expect(preview.x).toBeCloseTo(100)
    expect(preview.y).toBeCloseTo(0)
  })

  it('拖方块只沿这条轴缩放，不平移', () => {
    /*
     * 判别点是**位置不变**：X 方块归一到 `e` 手柄，对边冻结，因此左上角一动不动而宽度变大。
     * 断「宽度变了」对「方块其实开的是平移」永远绿——平移同样让盒动起来。
     */
    const { controller, down, move } = setup()
    // 方块画在环外，离右边（x=100）还有一段：判别点是**按位移解算**，拖 20 就长 20。绝对落点
    // 解算会让这里一下变成 200 宽——用户只拖了一点，对象却猛地长到把手那么大。
    down('scale-x', { x: 180, y: 25 })
    move({ x: 200, y: 95 })

    const preview = controller.getSnapshot().previewTransforms.p!
    expect(preview.x).toBeCloseTo(0)
    expect(preview.y).toBeCloseTo(0)
    expect(preview.width).toBeCloseTo(120)
    expect(preview.height).toBeCloseTo(50)
  })

  it('拖环不改位置', () => {
    const { controller, down, move } = setup()
    down('rotate', { x: 100, y: 25 })
    move({ x: 25, y: 100 })

    const preview = controller.getSnapshot().previewTransforms.p!
    expect(preview.rotation).not.toBeCloseTo(0)
    // 绕基点转，因此未旋转盒的左上角一动不动。
    expect(preview.x).toBeCloseTo(0)
    expect(preview.y).toBeCloseTo(0)
  })

  it('环绕基点转而不是包围盒中心', () => {
    const { controller, down } = setup()
    down('rotate', { x: 100, y: 25 })

    // 铰点 (0, 25)；包围盒中心是 (50, 25)。
    expect(controller.getSnapshot().rotationPreview?.center).toEqual({ x: 0, y: 25 })
  })

  it('选区空时消费本次按下，不落到框选', () => {
    const { controller, down, effects } = setup([])
    down('move-x')

    expect(controller.getSnapshot().phase).toBe('idle')
    expect(effects).toEqual([])
  })
})
