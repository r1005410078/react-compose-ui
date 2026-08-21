import type { ComposeLocale } from '@compose-ui/ui-context'

/** CAD 画布与命令行的内建文案。 @internal */
const messages = {
  'zh-CN': {
    canvasLabel: 'CAD 图面',
    commandLineLabel: '命令行',
    commandPlaceholder: '键入命令',
    unknownCommand: '未知命令',
    ready: '命令：',
    specifyFirstPoint: '指定第一点',
    specifyNextPoint: '指定下一点',
    keywordUndo: '放弃',
    keywordFinish: '结束',
    expectedPoint: '需要一个点',
    lineTitle: '直线',
    cancelled: '已取消',
  },
  'en-US': {
    canvasLabel: 'CAD drawing',
    commandLineLabel: 'Command line',
    commandPlaceholder: 'Type a command',
    unknownCommand: 'Unknown command',
    ready: 'Command:',
    specifyFirstPoint: 'Specify first point',
    specifyNextPoint: 'Specify next point',
    keywordUndo: 'Undo',
    keywordFinish: 'Finish',
    expectedPoint: 'A point is required',
    lineTitle: 'Line',
    cancelled: 'Cancelled',
  },
} as const

/** 读取当前语言的 CAD 画布文案。 @internal */
export function getCadCanvasMessages(locale: ComposeLocale) {
  return messages[locale === 'en-US' ? 'en-US' : 'zh-CN']
}

/** CAD 画布文案。 @internal */
export type CadCanvasMessages = ReturnType<typeof getCadCanvasMessages>
