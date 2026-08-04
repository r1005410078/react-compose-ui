import { describe, expect, it } from 'vitest'
import { filterComposeCommandActions } from './command-filter'
import type { ComposeCommandAction } from '../types'

const action = (
  id: string,
  title: string,
  extra: Partial<ComposeCommandAction> = {},
): ComposeCommandAction => ({
  id,
  title,
  run: () => {},
  ...extra,
})

const actions: readonly ComposeCommandAction[] = [
  action('stage.zoomIn', '放大', { category: '舞台', keywords: ['zoom in'] }),
  action('stage.zoomOut', '缩小', { category: '舞台', keywords: ['zoom out'] }),
  action('edit.group', '编组', { category: '编辑', disabledReason: '至少选中两个对象' }),
  action('history.undo', '撤销', { category: '历史' }),
  action('misc.noCategory', '未分组动作'),
]

describe('filterComposeCommandActions', () => {
  it('OpenSpec: command-panel / 命令动作检索与执行 / 空查询保持调试台形态', () => {
    expect(filterComposeCommandActions(actions, '')).toEqual([])
    // 仅空白与空查询等价，否则用户误触空格就会看到整张列表弹出。
    expect(filterComposeCommandActions(actions, '   ')).toEqual([])
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 斜杠列出全部动作', () => {
    const groups = filterComposeCommandActions(actions, '/')

    expect(groups.map((group) => group.category)).toEqual(['舞台', '编辑', '历史', null])
    expect(groups.flatMap((group) => group.actions.map((item) => item.id))).toEqual([
      'stage.zoomIn',
      'stage.zoomOut',
      'edit.group',
      'history.undo',
      'misc.noCategory',
    ])
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 按关键词过滤', () => {
    const byTitle = filterComposeCommandActions(actions, '编组')
    expect(byTitle.flatMap((group) => group.actions.map((item) => item.id))).toEqual(['edit.group'])

    const byId = filterComposeCommandActions(actions, 'stage.zoomOut')
    expect(byId.flatMap((group) => group.actions.map((item) => item.id))).toEqual(['stage.zoomOut'])

    const byKeyword = filterComposeCommandActions(actions, 'zoom')
    expect(byKeyword.flatMap((group) => group.actions.map((item) => item.id))).toEqual([
      'stage.zoomIn',
      'stage.zoomOut',
    ])

    const byCategory = filterComposeCommandActions(actions, '历史')
    expect(byCategory.flatMap((group) => group.actions.map((item) => item.id))).toEqual([
      'history.undo',
    ])
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 斜杠前缀可选', () => {
    // `/编组` 与 `编组` 必须等价，斜杠只是习惯性前缀而非模式选择器。
    expect(filterComposeCommandActions(actions, '/编组')).toEqual(
      filterComposeCommandActions(actions, '编组'),
    )
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 检索大小写不敏感', () => {
    const upper = filterComposeCommandActions(actions, 'ZOOM')
    expect(upper.flatMap((group) => group.actions.map((item) => item.id))).toEqual([
      'stage.zoomIn',
      'stage.zoomOut',
    ])
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 无匹配返回空结果', () => {
    expect(filterComposeCommandActions(actions, '不存在的动作')).toEqual([])
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 不可用动作仍参与检索', () => {
    // 不可用动作必须能被搜到并展示原因，否则用户无从得知为什么做不了。
    const groups = filterComposeCommandActions(actions, '编组')
    expect(groups[0]?.actions[0]?.disabledReason).toBe('至少选中两个对象')
  })
})
