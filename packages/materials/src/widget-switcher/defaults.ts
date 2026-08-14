import type { ComposeAppearance, ComposeWidgetSwitcher } from '@compose-ui/core'

/** WidgetSwitcher 内置尺寸。 @internal */
export const DEFAULT_WIDGET_SWITCHER_SIZE = Object.freeze({ width: 640, height: 400 })

/** WidgetSwitcher 内置切换状态。 @internal */
export const DEFAULT_WIDGET_SWITCHER: ComposeWidgetSwitcher = Object.freeze({
  activeIndex: 0,
} satisfies ComposeWidgetSwitcher)

/** WidgetSwitcher 内置外观。 @internal */
export const DEFAULT_WIDGET_SWITCHER_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { kind: 'solid', color: '#f8fafc' },
  borderColor: '#94a3b8',
  borderWidth: 1,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
} satisfies ComposeAppearance)
