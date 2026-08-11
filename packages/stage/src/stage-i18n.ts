import type { ComposeLocale } from '@compose-ui/ui-context'

type FormatMessage = (
  id: string,
  fallback: string,
  variables?: Readonly<Record<string, string | number>>,
) => string

const translations = {
  'zh-CN': {
    rulerOrigin: '标尺交叉原点',
    horizontalRuler: '水平标尺',
    verticalRuler: '垂直标尺',
    editingOverlay: 'Stage 编辑覆盖层',
    horizontalScrollbar: '水平画布滚动条',
    verticalScrollbar: '垂直画布滚动条',
    createGuide: '创建辅助线',
    createGuides: '创建双轴辅助线',
    moveGuide: '移动辅助线',
    deleteGuide: '删除辅助线',
    toggleGridSnap: '切换网格吸附',
    toggleSmartSnap: '切换智能吸附',
    layerOrder: '层级',
    layerOrderUnavailable: '选中对象已位于目标层级或不可移动',
    bringForward: '前移一层',
    sendBackward: '后移一层',
    bringToFront: '置于顶层',
    sendToBack: '置于底层',
    library: '基础组件',
    libraryContent: '基础组件内容',
    basicCategory: (count: number) => `基础 (${count})`,
    basicCategoryItems: '基础组件',
    add: (label: string) => `添加 ${label}`,
  },
  'en-US': {
    rulerOrigin: 'Ruler origin',
    horizontalRuler: 'Horizontal ruler',
    verticalRuler: 'Vertical ruler',
    editingOverlay: 'Stage editing overlay',
    horizontalScrollbar: 'Horizontal canvas scrollbar',
    verticalScrollbar: 'Vertical canvas scrollbar',
    createGuide: 'Create guide',
    createGuides: 'Create axis guides',
    moveGuide: 'Move guide',
    deleteGuide: 'Delete guide',
    toggleGridSnap: 'Toggle grid snap',
    toggleSmartSnap: 'Toggle smart snap',
    layerOrder: 'Layer order',
    layerOrderUnavailable:
      'Selected objects are already at the requested layer boundary or cannot be reordered',
    bringForward: 'Bring forward',
    sendBackward: 'Send backward',
    bringToFront: 'Bring to front',
    sendToBack: 'Send to back',
    library: 'Components',
    libraryContent: 'Component content',
    basicCategory: (count: number) => `Basic (${count})`,
    basicCategoryItems: 'Basic components',
    add: (label: string) => `Add ${label}`,
  },
} as const

export function getStageMessages(
  locale: ComposeLocale,
  formatMessage: FormatMessage = (_id, fallback) => fallback,
) {
  const messages = translations[locale]
  return {
    rulerOrigin: formatMessage('stage.rulerOrigin', messages.rulerOrigin),
    horizontalRuler: formatMessage('stage.horizontalRuler', messages.horizontalRuler),
    verticalRuler: formatMessage('stage.verticalRuler', messages.verticalRuler),
    editingOverlay: formatMessage('stage.editingOverlay', messages.editingOverlay),
    horizontalScrollbar: formatMessage(
      'stage.horizontalScrollbar',
      messages.horizontalScrollbar,
    ),
    verticalScrollbar: formatMessage(
      'stage.verticalScrollbar',
      messages.verticalScrollbar,
    ),
    createGuide: formatMessage('stage.createGuide', messages.createGuide),
    createGuides: formatMessage('stage.createGuides', messages.createGuides),
    moveGuide: formatMessage('stage.moveGuide', messages.moveGuide),
    deleteGuide: formatMessage('stage.deleteGuide', messages.deleteGuide),
    toggleGridSnap: formatMessage('stage.toggleGridSnap', messages.toggleGridSnap),
    toggleSmartSnap: formatMessage('stage.toggleSmartSnap', messages.toggleSmartSnap),
    layerOrder: formatMessage('stage.layerOrder', messages.layerOrder),
    layerOrderUnavailable: formatMessage(
      'stage.layerOrderUnavailable',
      messages.layerOrderUnavailable,
    ),
    bringForward: formatMessage('stage.bringForward', messages.bringForward),
    sendBackward: formatMessage('stage.sendBackward', messages.sendBackward),
    bringToFront: formatMessage('stage.bringToFront', messages.bringToFront),
    sendToBack: formatMessage('stage.sendToBack', messages.sendToBack),
    library: formatMessage('stage.library', messages.library),
    libraryContent: formatMessage('stage.libraryContent', messages.libraryContent),
    basicCategory: (count: number) => formatMessage(
      'stage.basicCategory',
      messages.basicCategory(count),
      { count },
    ),
    basicCategoryItems: formatMessage(
      'stage.basicCategoryItems',
      messages.basicCategoryItems,
    ),
    add: (label: string) => formatMessage(
      'stage.add',
      messages.add(label),
      { label },
    ),
  }
}
