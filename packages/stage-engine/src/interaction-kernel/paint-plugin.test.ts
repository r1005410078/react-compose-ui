import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStagePaintPlugin, STAGE_PAINT_PLUGIN_ID } from './paint-plugin'
import type { StageInteractionEffect } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }

function gradientDocument(locked = false) {
  const base = entity('a')
  return document([{
    ...base,
    components: {
      ...base.components,
      ...(locked ? { Lock: { locked: true } } : {}),
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
  }])
}

function paintSetup(value = gradientDocument()) {
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
      tool: 'select',
      selectedIds: ['a'],
      paintEditing: { entityId: 'a' },
      idFactory: () => 'paint-id',
      ...patch,
    } as never)
  }
  update()
  const grabEnd = () => {
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 25 },
      hit: { kind: 'paint-handle', handle: 'linear-end' },
      modifiers: MODIFIERS,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 50, y: 25 }, modifiers: MODIFIERS })
  }
  const commands = () => effects.filter((effect) => effect.type === 'command.dispatch')
  return { controller, effects, update, grabEnd, commands }
}

describe('OpenSpec: stage-engine / 无 DOM Paint 编辑与图层采样会话 / 独立插件承担', () => {
  it('paint 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_PAINT_PLUGIN_ID)

    expect(createStagePaintPlugin().priority).toBe(fromTable?.priority)
  })

  it('并发文档变化中止渐变拖拽且不提交命令', () => {
    const { controller, update, grabEnd, commands } = paintSetup()
    grabEnd()
    expect(controller.getSnapshot().phase).toBe('paint-edit')

    // 基准 Paint 是按下当刻取的副本；别处改了文档就不能再用它覆盖 Appearance。
    const next = gradientDocument()
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('idle')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 50, y: 25 }, modifiers: MODIFIERS })
    expect(commands()).toHaveLength(0)
  })

  it('Inspector 关闭 Paint 编辑即结束会话', () => {
    const { controller, update, grabEnd, commands } = paintSetup()
    grabEnd()

    update({ paintEditing: null })

    expect(controller.getSnapshot().phase).toBe('idle')
    expect(commands()).toHaveLength(0)
  })

  it('选区不再是编辑目标即结束会话', () => {
    const { controller, update, grabEnd } = paintSetup()
    grabEnd()

    update({ selectedIds: ['a', 'b'] })

    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('目标被锁定时消费按下而不退化成移动手势', () => {
    const { controller, effects } = paintSetup(gradientDocument(true))

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 25 },
      hit: { kind: 'paint-handle', handle: 'linear-end' },
      modifiers: MODIFIERS,
    })

    // 控制柄压在 Entity 自己身上：放行会让这次按下变成一次移动。
    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('取消丢弃预览并释放捕获', () => {
    const { controller, effects, grabEnd, commands } = paintSetup()
    grabEnd()
    expect(controller.getSnapshot().paintPreview).toMatchObject({ paint: { end: { x: 0.5, y: 0.5 } } })

    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    // 预览只活在快照里；清掉之后控制柄重新由 Appearance 中的原始 Paint 派生。
    expect(controller.getSnapshot().paintPreview).toBeNull()
    expect(controller.getSnapshot().paintHandles).toHaveLength(4)
    expect(effects).toContainEqual({ type: 'pointer.release', pointerId: 1 })
    expect(commands()).toHaveLength(0)
  })
})
