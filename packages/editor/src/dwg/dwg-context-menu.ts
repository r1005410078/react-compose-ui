import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { EditorMessages } from '../editor-i18n'

/** DWG 上下文菜单项 ID。 @public */
export const DWG_CONTEXT_MENU_ITEM_IDS = {
  howToImport: 'compose.dwg.how-to-import',
} as const

/** 这个条目是不是 `.dwg`。菜单项与双击读同一份判断。 @public */
export function isDwgAssetName(name: string | undefined) {
  return typeof name === 'string' && /\.dwg$/i.test(name)
}

/**
 * 创建 `.dwg` 的资源浏览器上下文菜单项。
 *
 * @remarks
 * DWG 眼下导不进来，而**一片空白让用户读到的是「这个工具不支持我的图」**——真实原因是
 * 「先转成 DXF 就能用」。这与「导入能导的，报告导不了的」是同一条判断，只是发生在导入
 * 开始之前。
 *
 * 因此这一项给的是**可执行的下一步**而不只是声明不支持：用户此刻需要的不是导入，是知道
 * 往哪走。说明走 `onNotice` 而不是塞进标签——菜单项放不下转换工具的名字与平台。
 *
 * 它 MUST NOT 依赖 Store、Registry 或 Provider：这一项在解码器缺席时**始终**是正确行为，
 * 因此不受任何能力缺失影响，也不受将来那条解码路径的任何决定阻塞。这正是 DXF 那条
 * 「缺少 Store 就不提供菜单项」的反面——那一项做的是导入，缺了 Store 就做不成。
 *
 * @public
 */
export function createDwgContextMenuItems({
  messages,
  onNotice,
}: {
  readonly messages: EditorMessages
  readonly onNotice: (message: string) => void
}): readonly ComposeAssetContextMenuItem[] {
  return [
    {
      id: DWG_CONTEXT_MENU_ITEM_IDS.howToImport,
      label: messages.dwg.howToImport,
      // 只在 `.dwg` 上出现：这一项对别的文件毫无意义，常驻只会让菜单更长。
      isVisible: (context) => isDwgAssetName(context.entry?.name),
      onSelect: () => {
        onNotice(messages.dwg.convertFirst)
      },
    },
  ]
}
