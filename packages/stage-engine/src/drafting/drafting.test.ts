import { createComposeLineCurve, normalizeComposeCurveGeometry } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createStageDraftingCommands, createStageLineSession } from './line-command'
import type { StageDraftingContext } from './drafting-types'
import { createStageSceneIndex, findStageFeaturePoint } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'

const messages = {
  specifyFirstPoint: '指定第一点',
  specifyNextPoint: '指定下一点',
  expectedPoint: '需要一个点',
  lineTitle: '直线',
  selectObjects: '选择对象',
  expectedSelection: '需要选择对象',
  basePoint: '指定基点',
  displacementPoint: '指定第二点',
  moveTitle: '移动',
  copyTitle: '复制',
  eraseTitle: '删除',
}

const context: StageDraftingContext = { messages }

describe('LINE 命令', () => {
  it('逐段落地：第一点只是起点，之后每一点提交一段', () => {
    const session = createStageLineSession(context)
    expect(session.prompt?.message).toBe('指定第一点')

    const first = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(first.status).toBe('prompt')
    // 一个点还构不成一段，因此没有 commit。
    if (first.status === 'prompt') expect(first.commit).toBeUndefined()
    expect(session.prompt?.message).toBe('指定下一点')

    const second = session.advance({ kind: 'point', point: { x: 100, y: 0 } })
    if (second.status !== 'prompt') throw new Error('第二点应当继续等待下一点')
    expect(second.commit?.segments).toEqual([{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])

    const third = session.advance({ kind: 'point', point: { x: 100, y: 50 } })
    if (third.status !== 'prompt') throw new Error('第三点应当继续等待下一点')
    // 每一段只提交自己，不重复提交上一段。
    expect(third.commit?.segments).toEqual([{ start: { x: 100, y: 0 }, end: { x: 100, y: 50 } }])
  })

  it('参照点始终是上一个已确定的点', () => {
    const session = createStageLineSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })
    const step = session.advance({ kind: 'point', point: { x: 30, y: 40 } })
    if (step.status !== 'prompt') throw new Error('应当继续等待下一点')
    expect(step.preview?.reference).toEqual({ x: 30, y: 40 })
  })

  it('Esc 与 Enter 都结束会话', () => {
    const escaped = createStageLineSession(context)
    escaped.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(escaped.advance({ kind: 'cancel' }).status).toBe('cancelled')

    const accepted = createStageLineSession(context)
    accepted.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(accepted.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('非点输入被拒绝且不结束会话', () => {
    const session = createStageLineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const step = session.advance({ kind: 'text', text: 'WAT' })
    expect(step.status).toBe('rejected')
    // 拒绝之后提示不变，用户可以接着取点——点错、打错在这类工具里是常态。
    expect(session.prompt?.message).toBe('指定下一点')
    expect(session.advance({ kind: 'point', point: { x: 5, y: 5 } }).status).toBe('prompt')
  })

  it('命令按名称与别名解析', () => {
    const commands = createStageDraftingCommands(messages)
    expect(commands.map(({ id }) => id)).toEqual(['LINE', 'MOVE', 'COPY', 'ERASE'])
    expect(commands[0]?.aliases).toEqual(['L'])
  })
})

function curveEntity(
  id: string,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
) {
  const next = normalizeComposeCurveGeometry(createComposeLineCurve(start, end))
  const base = entity(id, {
    x: next.offset.x,
    y: next.offset.y,
    width: next.size.width,
    height: next.size.height,
  })
  return {
    ...base,
    components: { ...base.components, Renderer: { type: 'curve', props: {} }, Curve: next.curve },
  }
}

function indexFor(value: ReturnType<typeof document>) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('特征点捕捉', () => {
  const line = curveEntity('line', { x: 100, y: 100 }, { x: 300, y: 100 })
  const doc = document([line], ['line'])

  it('命中端点', () => {
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 303, y: 102 }, 8)
    expect(hit).toMatchObject({ mode: 'endpoint', entityId: 'line' })
    expect(hit?.point).toEqual({ x: 300, y: 100 })
  })

  it('命中中点', () => {
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 201, y: 101 }, 8)
    expect(hit).toMatchObject({ mode: 'midpoint' })
    expect(hit?.point).toEqual({ x: 200, y: 100 })
  })

  it('容差内端点压过中点，即使中点更近', () => {
    // 光标 (210,100)：中点 (200,100) 距离 10，端点 (300,100) 距离 90，两者都在容差内。
    // 优先级严格先于距离——与 CAD 侧 `findCadSnap` 同一条判定，两块画布的捕捉手感必须一致。
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 210, y: 100 }, 100)
    expect(hit?.mode).toBe('endpoint')
  })

  it('同一优先级内取最近的一个', () => {
    // 两个端点都在容差内时按距离分胜负。
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 280, y: 100 }, 250)
    expect(hit?.point).toEqual({ x: 300, y: 100 })
  })

  it('容差之外不命中', () => {
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 320, y: 100 }, 8)).toBeNull()
  })

  it('容差随缩放换算后结果一致', () => {
    const screenTolerance = 8
    // world = 屏幕 / zoom：漏乘 zoom 时 zoom 恒为 1 的用例仍然会绿。
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 312, y: 100 }, screenTolerance / 0.5))
      .not.toBeNull()
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 312, y: 100 }, screenTolerance / 2))
      .toBeNull()
  })

  it('不返回盒的角点', () => {
    const box = entity('rect', { x: 500, y: 500, width: 100, height: 100 })
    const withBox = document([box], ['rect'])
    // 盒角点属于「对齐」语义，由既有的 guide 吸附覆盖；两套同时生效会互相拉扯。
    expect(findStageFeaturePoint(withBox, indexFor(withBox), { x: 500, y: 500 }, 8)).toBeNull()
  })

  it('排除的 Entity 不参与捕捉', () => {
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 300, y: 100 }, 8, ['line'])).toBeNull()
  })
})
