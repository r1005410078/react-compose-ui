import type { ComposeAppearance, ComposeSize } from '@compose-ui/core'

/** Page Slot 默认尺寸；读不到被引用页面的输出尺寸时使用。 @internal */
export const DEFAULT_PAGE_SLOT_SIZE: ComposeSize = { width: 320, height: 200 }

/** Page Slot 默认外观：仅一条虚线边框标示槽位范围。 @internal */
export const DEFAULT_PAGE_SLOT_APPEARANCE: ComposeAppearance = {
  borderColor: '#3687ff',
  borderWidth: 1,
}
