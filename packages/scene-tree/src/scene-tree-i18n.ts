import type { SceneTreeCommand } from './index'

import type { ComposeLocale } from '@compose-ui/ui-context'

export type SceneTreeLocale = ComposeLocale

type FormatMessage = (
  id: string,
  fallback: string,
  variables?: Readonly<Record<string, string | number>>,
) => string

const translations = {
  'zh-CN': {
    tree: '场景树',
    addNode: '新增节点',
    searchNodes: '搜索节点',
    searchPlaceholder: '搜索',
    caseSensitive: '大小写敏感',
    wholeWord: '全词匹配',
    regex: '正则表达式',
    invalidRegex: '正则表达式无效',
    expand: '展开节点',
    collapse: '折叠节点',
    rename: (label: string) => `重命名 ${label}`,
    hide: (label: string) => `隐藏 ${label}`,
    show: (label: string) => `显示 ${label}`,
    lock: (label: string) => `锁定 ${label}`,
    unlock: (label: string) => `解锁 ${label}`,
    commands: {
      'create-child': '新增子节点',
      'create-sibling': '新增兄弟节点',
      'create-root': '新增根节点',
      'create-suggested': '新增节点',
      copy: '复制',
      cut: '剪切',
      'paste-child': '粘贴为子节点',
      'paste-sibling': '粘贴为兄弟节点',
      'paste-root': '粘贴到根级',
      'paste-suggested': '粘贴',
      delete: '删除',
    } satisfies Record<SceneTreeCommand, string>,
  },
  'en-US': {
    tree: 'Scene tree',
    addNode: 'Add node',
    searchNodes: 'Search nodes',
    searchPlaceholder: 'Search',
    caseSensitive: 'Case sensitive',
    wholeWord: 'Match whole word',
    regex: 'Use regular expression',
    invalidRegex: 'Invalid regular expression',
    expand: 'Expand node',
    collapse: 'Collapse node',
    rename: (label: string) => `Rename ${label}`,
    hide: (label: string) => `Hide ${label}`,
    show: (label: string) => `Show ${label}`,
    lock: (label: string) => `Lock ${label}`,
    unlock: (label: string) => `Unlock ${label}`,
    commands: {
      'create-child': 'Add child',
      'create-sibling': 'Add sibling',
      'create-root': 'Add root node',
      'create-suggested': 'Add node',
      copy: 'Copy',
      cut: 'Cut',
      'paste-child': 'Paste as child',
      'paste-sibling': 'Paste as sibling',
      'paste-root': 'Paste at root',
      'paste-suggested': 'Paste',
      delete: 'Delete',
    } satisfies Record<SceneTreeCommand, string>,
  },
} as const

export type SceneTreeMessages = ReturnType<typeof getSceneTreeMessages>

export function getSceneTreeMessages(
  locale: SceneTreeLocale,
  formatMessage: FormatMessage = (_id, fallback) => fallback,
) {
  const messages = translations[locale]
  const labelMessage = (id: string, fallback: string, label: string) =>
    formatMessage(id, fallback, { label })
  return {
    tree: formatMessage('sceneTree.tree', messages.tree),
    addNode: formatMessage('sceneTree.addNode', messages.addNode),
    searchNodes: formatMessage('sceneTree.searchNodes', messages.searchNodes),
    searchPlaceholder: formatMessage(
      'sceneTree.searchPlaceholder',
      messages.searchPlaceholder,
    ),
    caseSensitive: formatMessage('sceneTree.caseSensitive', messages.caseSensitive),
    wholeWord: formatMessage('sceneTree.wholeWord', messages.wholeWord),
    regex: formatMessage('sceneTree.regex', messages.regex),
    invalidRegex: formatMessage('sceneTree.invalidRegex', messages.invalidRegex),
    expand: formatMessage('sceneTree.expand', messages.expand),
    collapse: formatMessage('sceneTree.collapse', messages.collapse),
    rename: (label: string) => labelMessage(
      'sceneTree.rename',
      messages.rename(label),
      label,
    ),
    hide: (label: string) => labelMessage('sceneTree.hide', messages.hide(label), label),
    show: (label: string) => labelMessage('sceneTree.show', messages.show(label), label),
    lock: (label: string) => labelMessage('sceneTree.lock', messages.lock(label), label),
    unlock: (label: string) => labelMessage(
      'sceneTree.unlock',
      messages.unlock(label),
      label,
    ),
    commands: Object.fromEntries(
      Object.entries(messages.commands).map(([command, fallback]) => [
        command,
        formatMessage(`sceneTree.command.${command}`, fallback),
      ]),
    ) as Record<SceneTreeCommand, string>,
  }
}
