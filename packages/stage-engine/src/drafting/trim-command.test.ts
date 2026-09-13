import { describe, expect, it } from 'vitest'
import { createStageTrimCommand, createStageTrimSession } from './trim-command'
import type { StageDraftingMessages } from './drafting-types'

const messages = {
  trimTitle: '修剪',
  selectTrimTarget: '选择要修剪的一截，或按住拖过多条（回车结束）:',
  expectedPick: '需要点一下要修剪的一截',
  editCategory: '编辑',
} as unknown as StageDraftingMessages

describe('OpenSpec: stage-engine / TRIM 命令去掉光标底下的一截', () => {
  it('只接受 pick，并声明剪刀徽标', () => {
    const session = createStageTrimSession({ messages })
    expect(session.prompt?.accepts).toEqual(['pick'])
    expect(session.prompt?.badge).toBe('scissors')
    expect(session.prompt?.message).toBe(messages.selectTrimTarget)
  })

  it('每次 pick 交出一个 commit 且提示不变、继续等下一截', () => {
    const session = createStageTrimSession({ messages })
    const targets = [{ id: 'h', point: { x: 1, y: 2 } }, { id: 'v', point: { x: 3, y: 4 } }]
    const step = session.advance({ kind: 'pick', point: { x: 1, y: 2 }, targets })
    expect(step.status).toBe('prompt')
    if (step.status !== 'prompt') return
    expect(step.commit).toEqual({ trim: targets })
    expect(step.prompt.accepts).toEqual(['pick'])
  })

  it('OpenSpec: commands / 落在对象上的点是第四种输入 / 声明 pick 的一步收到点', () => {
    const session = createStageTrimSession({ messages })
    const step = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(step).toEqual({ status: 'rejected', message: messages.expectedPick })
    expect(session.prompt?.accepts).toEqual(['pick'])
  })

  it('回车与取消结束会话', () => {
    expect(createStageTrimSession({ messages }).advance({ kind: 'accept' })).toEqual({ status: 'cancelled' })
    expect(createStageTrimSession({ messages }).advance({ kind: 'cancel' })).toEqual({ status: 'cancelled' })
  })

  it('OpenSpec: stage-engine / 绘图模式提供对象编辑命令 / TRIM 不消费选择集', () => {
    const session = createStageTrimSession({ messages, selection: ['a', 'b'] })
    expect(session.prompt?.accepts).toEqual(['pick'])
    expect(session.advance({ kind: 'selection', ids: ['a'] }).status).toBe('rejected')
  })

  it('定义：TRIM / TR，编辑分组，没有单键', () => {
    const definition = createStageTrimCommand(messages)
    expect(definition.id).toBe('TRIM')
    expect(definition.aliases).toEqual(['TR'])
    expect(definition.category).toBe('编辑')
    expect(definition.shortcut).toBeUndefined()
  })
})
