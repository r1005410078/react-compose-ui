import { describe, expect, it, vi } from 'vitest'
import { createStageHatchCommand, createStageHatchSession } from './hatch-command'
import type { StageDraftingMessages } from './drafting-types'

const messages = {
  hatchTitle: '填充',
  pickHatchPoint: '点一下要填充的区域内部（回车结束）:',
  expectedHatchPoint: '需要点一下要填充的区域内部',
  hatchColorKeyword: '颜色',
  specifyHatchColor: '输入填充色（如 #3f5068）:',
  invalidHatchColor: '读不出这个颜色，试试 #3f5068',
  editCategory: '编辑',
} as unknown as StageDraftingMessages

describe('OpenSpec: stage-engine / HATCH 命令填满光标底下那块面', () => {
  it('等 pick 与关键字，并声明油漆桶徽标', () => {
    const session = createStageHatchSession({ messages })
    expect(session.prompt?.accepts).toEqual(['pick', 'keyword'])
    expect(session.prompt?.badge).toBe('bucket')
    expect(session.prompt?.message).toBe(messages.pickHatchPoint)
    expect(session.prompt?.keywords).toEqual([{ key: 'C', label: '颜色' }])
  })

  it('每次 pick 交出一个 commit 且提示不变、继续等下一块', () => {
    const session = createStageHatchSession({ messages })
    const step = session.advance({ kind: 'pick', point: { x: 12, y: 34 }, targets: [] })
    expect(step.status).toBe('prompt')
    if (step.status !== 'prompt') return
    // 读顶层的落点而不是 targets：填充的落点在空处。
    expect(step.commit).toEqual({ hatch: { point: { x: 12, y: 34 } } })
    expect(step.prompt.accepts).toEqual(['pick', 'keyword'])
  })

  it('落在对象上的那一下同样只读落点', () => {
    const session = createStageHatchSession({ messages })
    const step = session.advance({
      kind: 'pick',
      point: { x: 5, y: 6 },
      targets: [{ id: 'box', point: { x: 5, y: 6 } }],
    })
    if (step.status !== 'prompt') throw new Error('expected prompt')
    expect(step.commit).toEqual({ hatch: { point: { x: 5, y: 6 } } })
  })

  it('收到点仍拒绝并停在原提示', () => {
    const session = createStageHatchSession({ messages })
    const step = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(step).toEqual({ status: 'rejected', message: messages.expectedHatchPoint })
    expect(session.prompt?.accepts).toEqual(['pick', 'keyword'])
  })

  it('C 切到换色那一步，读得出来就回调并回到取点步', () => {
    const onHatchColorChange = vi.fn()
    const session = createStageHatchSession({ messages, onHatchColorChange })
    expect(session.advance({ kind: 'keyword', key: 'C' }).status).toBe('prompt')
    expect(session.prompt?.accepts).toEqual(['text'])
    expect(session.prompt?.message).toBe(messages.specifyHatchColor)

    const step = session.advance({ kind: 'text', text: '#3f5068' })
    expect(step.status).toBe('prompt')
    expect(onHatchColorChange).toHaveBeenCalledWith('#3f5068')
    expect(session.prompt?.accepts).toEqual(['pick', 'keyword'])
  })

  it('读不出来的颜色停在换色那一步', () => {
    const onHatchColorChange = vi.fn()
    const session = createStageHatchSession({ messages, onHatchColorChange })
    session.advance({ kind: 'keyword', key: 'C' })
    const step = session.advance({ kind: 'text', text: '深蓝' })
    expect(step).toEqual({ status: 'rejected', message: messages.invalidHatchColor })
    // 停在这一步：直接回去的话用户会以为色换上了。
    expect(session.prompt?.accepts).toEqual(['text'])
    expect(onHatchColorChange).not.toHaveBeenCalled()
  })

  it('换色那一步按回车是放弃换色，不结束命令', () => {
    const session = createStageHatchSession({ messages })
    session.advance({ kind: 'keyword', key: 'C' })
    expect(session.advance({ kind: 'accept' }).status).toBe('prompt')
    expect(session.prompt?.accepts).toEqual(['pick', 'keyword'])
  })

  it('取点步的回车与取消结束会话', () => {
    expect(createStageHatchSession({ messages }).advance({ kind: 'accept' })).toEqual({ status: 'cancelled' })
    expect(createStageHatchSession({ messages }).advance({ kind: 'cancel' })).toEqual({ status: 'cancelled' })
  })

  it('不消费选择集：图上所有可见曲线都是边界', () => {
    const session = createStageHatchSession({ messages, selection: ['a', 'b'] })
    expect(session.prompt?.accepts).toEqual(['pick', 'keyword'])
    expect(session.advance({ kind: 'selection', ids: ['a'] }).status).toBe('rejected')
  })

  it('定义：HATCH / H，编辑分组，没有单键', () => {
    const definition = createStageHatchCommand(messages)
    expect(definition.id).toBe('HATCH')
    expect(definition.aliases).toEqual(['H'])
    expect(definition.category).toBe('编辑')
    expect(definition.shortcut).toBeUndefined()
  })
})
