import { describe, expect, it } from 'vitest'
import { createComposeCommandRegistry } from '@compose-ui/commands'
import { createStageDraftingCommands } from './line-command'
import { createStageCopySession, createStageMoveSession } from './move-copy-command'
import { createStageEraseSession } from './erase-command'
import type { StageDraftingContext, StageDraftingMessages } from './drafting-types'

const messages: StageDraftingMessages = {
  drawCategory: '绘图',
  editCategory: '编辑',
  specifyFirstPoint: '指定第一点',
  specifyNextPoint: '指定下一点（回车结束）',
  specifyEndPoint: '指定端点',
  expectedPoint: '需要一个点',
  lineTitle: '直线',
  arrowTitle: '箭头',
  wireTitle: '导线',
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
  polygonTitle: '多边形',
  specifySides: (sides: number) => `输入边数 <${sides}>`,
  specifyPolygonCenter: (sides: number) => `指定中心点 [${sides} 边]`,
  specifyInscribedRadius: (sides: number) => `指定内接圆半径 [${sides} 边]`,
  specifyCircumscribedRadius: (sides: number) => `指定外切圆半径 [${sides} 边]`,
  inscribedKeyword: '内接',
  circumscribedKeyword: '外切',
  inscribedChip: '内接',
  circumscribedChip: '外切',
  moreSidesKeyword: '加一边',
  fewerSidesKeyword: '减一边',
  invalidSides: (min: number, max: number) => `边数必须是 ${min} 到 ${max} 之间的整数`,
}

const empty: StageDraftingContext = { messages }
const preselected: StageDraftingContext = { messages, selection: ['a', 'b'] }

describe('MOVE 命令', () => {
  it('取对象、取基点、取位移点之后产出位移并结束', () => {
    const session = createStageMoveSession(empty)
    expect(session.prompt?.message).toBe('选择对象')

    session.advance({ kind: 'selection', ids: ['a', 'b'] })
    expect(session.prompt?.message).toBe('选择对象')

    const afterAccept = session.advance({ kind: 'accept' })
    expect(afterAccept.status).toBe('prompt')
    expect(session.prompt?.message).toBe('指定基点')

    session.advance({ kind: 'point', point: { x: 10, y: 10 } })
    expect(session.prompt?.message).toBe('指定第二点')

    const step = session.advance({ kind: 'point', point: { x: 40, y: 30 } })
    if (step.status !== 'commit') throw new Error('位移点之后应当提交')
    expect(step.effect.translate).toEqual({
      entityIds: ['a', 'b'],
      delta: { x: 30, y: 20 },
    })
  })

  it('启动上下文已有选择集时跳过选择步骤', () => {
    const session = createStageMoveSession(preselected)
    expect(session.prompt?.message).toBe('指定基点')
  })

  it('取到基点后预览带上基点作为参照', () => {
    const session = createStageMoveSession(preselected)
    const step = session.advance({ kind: 'point', point: { x: 5, y: 5 } })
    if (step.status !== 'prompt') throw new Error('基点之后应当继续等待')
    expect(step.preview?.reference).toEqual({ x: 5, y: 5 })
    expect(step.preview?.translate?.entityIds).toEqual(['a', 'b'])
  })

  it('选择集输入是替换而不是并入', () => {
    const session = createStageMoveSession(empty)
    session.advance({ kind: 'selection', ids: ['a', 'b'] })
    // 宿主拥有选择集：用户 Shift 移出一个之后喂进来的是剩下那份完整选择集。
    session.advance({ kind: 'selection', ids: ['a'] })
    session.advance({ kind: 'accept' })
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const step = session.advance({ kind: 'point', point: { x: 1, y: 2 } })
    if (step.status !== 'commit') throw new Error('位移点之后应当提交')
    expect(step.effect.translate?.entityIds).toEqual(['a'])
  })

  it('一个对象都没有时确认即取消', () => {
    const session = createStageMoveSession(empty)
    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('取消结束会话', () => {
    const session = createStageMoveSession(preselected)
    expect(session.advance({ kind: 'cancel' }).status).toBe('cancelled')
  })

  it('取点步骤拒绝非点输入且不结束会话', () => {
    const session = createStageMoveSession(preselected)
    const step = session.advance({ kind: 'text', text: 'WAT' })
    expect(step.status).toBe('rejected')
    expect(session.prompt?.message).toBe('指定基点')
  })
})

describe('COPY 命令', () => {
  it('连续放置，位移始终相对最初的基点', () => {
    const session = createStageCopySession(preselected)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })

    const first = session.advance({ kind: 'point', point: { x: 10, y: 0 } })
    if (first.status !== 'prompt') throw new Error('COPY 应当继续等待下一个落点')
    expect(first.commit?.duplicate).toEqual({
      entityIds: ['a', 'b'],
      delta: { x: 10, y: 0 },
    })

    const second = session.advance({ kind: 'point', point: { x: 25, y: 0 } })
    if (second.status !== 'prompt') throw new Error('COPY 应当继续等待下一个落点')
    // 相对最初的基点 (0,0) 而不是上一个副本的落点 (10,0)。
    expect(second.commit?.duplicate?.delta).toEqual({ x: 25, y: 0 })
  })

  it('放置之后确认结束会话', () => {
    const session = createStageCopySession(preselected)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 10, y: 0 } })
    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })
})

describe('ERASE 命令', () => {
  it('先选后执行时没有要等的输入', () => {
    const session = createStageEraseSession(preselected)
    expect(session.prompt).toBeNull()
    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit') throw new Error('已有选择集时确认应当提交')
    expect(step.effect.removed).toEqual(['a', 'b'])
  })

  it('先执行后选时提示选择对象', () => {
    const session = createStageEraseSession(empty)
    expect(session.prompt?.message).toBe('选择对象')
    session.advance({ kind: 'selection', ids: ['c'] })
    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit') throw new Error('选完之后确认应当提交')
    expect(step.effect.removed).toEqual(['c'])
  })

  it('待删对象作为预览返回', () => {
    const session = createStageEraseSession(empty)
    const step = session.advance({ kind: 'selection', ids: ['c', 'd'] })
    if (step.status !== 'prompt') throw new Error('选择之后应当继续等待确认')
    expect(step.preview?.removed).toEqual(['c', 'd'])
  })

  it('选择集输入是替换而不是并入', () => {
    const session = createStageEraseSession(empty)
    session.advance({ kind: 'selection', ids: ['c', 'd'] })
    session.advance({ kind: 'selection', ids: ['c'] })
    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit') throw new Error('确认应当提交')
    expect(step.effect.removed).toEqual(['c'])
  })

  it('空选择集确认即取消', () => {
    const session = createStageEraseSession(empty)
    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })
})

describe('绘图命令集', () => {
  it('三条编辑命令按名称与别名解析', () => {
    const registry = createComposeCommandRegistry(createStageDraftingCommands(messages))
    expect(registry.resolve('MOVE')?.id).toBe('MOVE')
    expect(registry.resolve('m')?.id).toBe('MOVE')
    expect(registry.resolve('co')?.id).toBe('COPY')
    expect(registry.resolve('e')?.id).toBe('ERASE')
  })
})
