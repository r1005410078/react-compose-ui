import { describe, expect, it } from 'vitest'
import type {
  ComposeCommandInput,
  ComposeCommandPrompt,
  ComposeCommandSession,
} from './command-types'

/*
 * 一条只接受 `pick` 的伪命令。本包不认识任何文档协议，因此这里的标识就是普通字符串——用例
 * 锁定的是协议本身：一次取用同时说得出「指着哪儿」与「指着的是哪些对象」，而两者可以各读各的。
 */

const pickPrompt: ComposeCommandPrompt = {
  message: '指一下',
  accepts: ['pick'],
  badge: 'bucket',
}

interface FakeEffect {
  readonly at: { readonly x: number; readonly y: number }
  readonly ids: readonly string[]
}

function fakeSession(): ComposeCommandSession<FakeEffect> {
  return {
    get prompt() {
      return pickPrompt
    },
    advance(input: ComposeCommandInput) {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'pick') return { status: 'rejected', message: '需要指一下' }
      return {
        status: 'commit',
        effect: { at: input.point, ids: input.targets.map((target) => target.id) },
      }
    },
  }
}

describe('OpenSpec: commands / 落在对象上的点是第四种输入', () => {
  it('声明 pick 的一步收到 pick', () => {
    const step = fakeSession().advance({
      kind: 'pick',
      point: { x: 3, y: 4 },
      targets: [{ id: 'a', point: { x: 3, y: 4 } }],
    })
    expect(step).toEqual({ status: 'commit', effect: { at: { x: 3, y: 4 }, ids: ['a'] } })
  })

  it('落在空白处的 pick 仍带落点', () => {
    // 只给 targets 的话，这一次取用在协议里根本表达不出来——而填充的落点本来就在空处。
    const step = fakeSession().advance({ kind: 'pick', point: { x: 8, y: 9 }, targets: [] })
    expect(step).toEqual({ status: 'commit', effect: { at: { x: 8, y: 9 }, ids: [] } })
  })

  it('声明 pick 的一步收到点仍拒绝', () => {
    const step = fakeSession().advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(step).toEqual({ status: 'rejected', message: '需要指一下' })
  })
})

describe('OpenSpec: commands / 提示可声明光标徽标', () => {
  it('两枚徽标各自声明得出来，缺席即不画', () => {
    const scissors: ComposeCommandPrompt = { message: '剪', accepts: ['pick'], badge: 'scissors' }
    const plain: ComposeCommandPrompt = { message: '指', accepts: ['pick'] }
    expect(pickPrompt.badge).toBe('bucket')
    expect(scissors.badge).toBe('scissors')
    expect(plain.badge).toBeUndefined()
  })
})
