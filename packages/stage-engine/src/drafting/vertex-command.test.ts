import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_TYPES, COMPOSE_BUILTIN_COMPONENT_KEYS } from '@compose-ui/core'
import { createStageGripSession, createStageVertexSession } from './vertex-command'
import { planStageDraftingEdits } from './drafting-edits'
import { applyStageCurveGrip, stageCurveBoxGeometry, stageCurveLocalPoint } from '../geometry-editing'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import type { ComposeCurve, ComposeEntity } from '@compose-ui/core'
import type { StageDraftingContext, StageDraftingMessages } from './drafting-types'

const messages = {
  drawCategory: '绘图',
  editCategory: '编辑',
  specifyFirstPoint: '指定第一点',
  specifyNextPoint: '指定下一点（回车结束）',
  specifyEndPoint: '指定端点',
  expectedPoint: '需要一个点',
  lineTitle: '直线',
  wireTitle: '导线',
  arrowTitle: '箭头',
  selectObjects: '选择对象',
  expectedSelection: '需要选择对象',
  basePoint: '指定基点',
  displacementPoint: '指定第二点',
  moveTitle: '移动',
  copyTitle: '复制',
  eraseTitle: '删除',
  vertexTitle: '编辑顶点',
  specifyNewLocation: '指定新位置',
  expectedSingleObject: '只能选择一个对象',
  arcTitle: '圆弧',
  circleTitle: '圆',
  rectangleTitle: '矩形',
  polylineTitle: '多段线',
  specifyThroughPoint: '指定圆弧上的一点',
  specifyCenter: '指定圆心',
  specifyRadius: '指定半径',
  specifyDiameter: '指定直径',
  diameterKeyword: '直径',
  radiusKeyword: '半径',
  specifyCorner: '指定第一个角点',
  specifyOppositeCorner: '指定对角点',
  closeKeyword: '闭合',
  undoKeyword: '放弃',
  collinearArc: '三点共线，无法定弧',
  degenerateShape: '这个形状是退化的',
} satisfies StageDraftingMessages

/** 几何是 100×50 的斜线，盒同尺寸——投影因此是恒等，断言读得出来。 */
function curveEntity(id: string): ComposeEntity {
  const base = entity(id, { x: 0, y: 0, width: 100, height: 50 })
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
    },
  }
}

const target = { entityId: 'curve-a', gripId: 'end', origin: { x: 100, y: 50 } }

describe('夹点取点会话', () => {
  it('取到一个点即提交，效果只带落点', () => {
    const session = createStageGripSession(messages, target)
    expect(session.prompt?.message).toBe('指定新位置')
    expect(session.prompt?.accepts).toContain('point')

    const step = session.advance({ kind: 'point', point: { x: 140, y: 20 } })
    if (step.status !== 'commit') throw new Error('取到点之后应当提交')
    // 会话不碰几何：把落点应用到夹点上是规划那一步的事，三条路径因此汇到同一处求解。
    expect(step.effect.curveGrip).toEqual({ ...target, point: { x: 140, y: 20 } })
  })

  it('取消不产出任何效果', () => {
    const session = createStageGripSession(messages, target)

    expect(session.advance({ kind: 'cancel' })).toEqual({ status: 'cancelled' })
  })

  it('非点输入被拒绝而不是结束会话', () => {
    const session = createStageGripSession(messages, target)

    const step = session.advance({ kind: 'keyword', key: '随便' })
    expect(step.status).toBe('rejected')
    expect(session.prompt?.message).toBe('指定新位置')
  })
})

describe('夹点几何规划', () => {
  const value = document([curveEntity('curve-a')])
  const snapshot = layoutSnapshot(value)
  const index = createStageSceneIndex(value, snapshot)
  const point = { x: 140, y: 20 }

  it('产出一条 entity.curve.set', () => {
    const commands = planStageDraftingEdits({
      document: value,
      layoutSnapshot: snapshot,
      index,
      effect: { curveGrip: { ...target, point } },
      idFactory: () => 'cmd-1',
      curveLabel: (name) => `编辑 ${name} 的几何`,
    })

    expect(commands).toHaveLength(1)
    expect(commands[0]?.type).toBe(BUILTIN_COMMAND_TYPES.setCurve)
    expect(commands[0]?.meta?.targetIds).toEqual(['curve-a'])
  })

  it('与拖动共用同一条几何求解', () => {
    // 拖动那条路径自己算一遍预览；两条对同一个落点必须算出逐字相同的几何，否则松手会跳。
    const geometry = stageCurveBoxGeometry(value, index, 'curve-a')!
    const local = stageCurveLocalPoint(index, 'curve-a', point)!
    const dragged = applyStageCurveGrip(geometry, 'end', local)

    const commands = planStageDraftingEdits({
      document: value,
      layoutSnapshot: snapshot,
      index,
      effect: { curveGrip: { ...target, point } },
      idFactory: () => 'cmd-1',
    })
    const planned = (commands[0]?.payload as { curve: ComposeCurve }).curve

    expect(planned).toEqual(dragged)
  })
})

describe('VERTEX 命令', () => {
  it('已选好一个可编辑对象时当场提交', () => {
    const session = createStageVertexSession({ messages, selection: ['curve-a'] })

    // `prompt` 为 null 正是「一次性动作是命令会话的退化情形」那一档。
    expect(session.prompt).toBeNull()
    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit') throw new Error('已选好目标时应当提交')
    expect(step.effect.enterGeometryEditing).toBe('curve-a')
  })

  it('没选对象时提示选择，喂进选择集之后可以确认', () => {
    const session = createStageVertexSession({ messages })
    expect(session.prompt?.message).toBe('选择对象')

    session.advance({ kind: 'selection', ids: ['curve-a'] })
    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit') throw new Error('选好之后应当提交')
    expect(step.effect.enterGeometryEditing).toBe('curve-a')
  })

  it('选中多个时提示就换成说明，确认后被拒绝而不是静默', () => {
    const session = createStageVertexSession({ messages, selection: ['a', 'b'] })

    // 泛泛地说「选择对象」会让用户以为自己还没选，而他手上正好有一份不能用的选择集。
    expect(session.prompt?.message).toBe('只能选择一个对象')
    const step = session.advance({ kind: 'accept' })
    expect(step.status).toBe('rejected')
    expect(session.prompt?.message).toBe('只能选择一个对象')
  })

  it('不可几何编辑的对象被谓词挡掉', () => {
    const context: StageDraftingContext = {
      messages,
      selection: ['rect'],
      isGeometryEditable: (id) => id === 'curve-a',
    }
    const session = createStageVertexSession(context)

    expect(session.prompt?.message).toBe('选择对象')
    expect(session.advance({ kind: 'accept' }).status).toBe('rejected')
  })
})
