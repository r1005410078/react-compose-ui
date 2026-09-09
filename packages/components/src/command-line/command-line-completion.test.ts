import { describe, expect, it } from 'vitest'
import { matchComposeCommandCompletions } from './command-line-completion'

const commands = [
  { id: 'LINE', aliases: ['L'], title: '直线' },
  { id: 'CIRCLE', aliases: ['C'], title: '圆' },
  { id: 'COPY', aliases: ['CO'], title: '复制' },
  { id: 'ERASE', aliases: ['E'], title: '删除', keywords: ['delete'] },
] as const

describe('OpenSpec: components / 命令行提示可键入的命令', () => {
  it('空缓冲不提示：Enter 与方向键在那时另有含义', () => {
    expect(matchComposeCommandCompletions(commands, '')).toBeNull()
    expect(matchComposeCommandCompletions(commands, '   ')).toBeNull()
  })

  it('单独一个 / 列出整份词汇表', () => {
    expect(matchComposeCommandCompletions(commands, '/')?.items.map((c) => c.id))
      .toEqual(['LINE', 'CIRCLE', 'COPY', 'ERASE'])
  })

  it('/ 后面的文本只用来过滤，没命中时列表为空而不是收起', () => {
    expect(matchComposeCommandCompletions(commands, '/co')?.items.map((c) => c.id))
      .toEqual(['COPY'])
    expect(matchComposeCommandCompletions(commands, '/zzz')).toEqual({ query: 'ZZZ', items: [] })
  })

  it('整词命中的别名排在同前缀的其他命令之前：C 仍然是 CIRCLE', () => {
    expect(matchComposeCommandCompletions(commands, 'c')?.items.map((c) => c.id))
      .toEqual(['CIRCLE', 'COPY'])
    expect(matchComposeCommandCompletions(commands, 'co')?.items.map((c) => c.id))
      .toEqual(['COPY'])
  })

  it('显示名与检索词按包含匹配，排在名称匹配之后', () => {
    expect(matchComposeCommandCompletions(commands, '直线')?.items.map((c) => c.id)).toEqual(['LINE'])
    expect(matchComposeCommandCompletions(commands, 'DEL')?.items.map((c) => c.id)).toEqual(['ERASE'])
  })

  it('没有 / 且没有命中时不提示', () => {
    expect(matchComposeCommandCompletions(commands, '100,50')).toBeNull()
  })
})
