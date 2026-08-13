import type { ComposeEntityPreset } from '@compose-ui/component-registry'
import type { ComposeBasicContainerOptions } from '../types'
import { ComposeWidgetSwitcherMaterialIcon } from '../material-icons'
import { mergeAppearance } from '../material-preset'
import {
  DEFAULT_WIDGET_SWITCHER,
  DEFAULT_WIDGET_SWITCHER_APPEARANCE,
  DEFAULT_WIDGET_SWITCHER_SIZE,
} from './defaults'

/**
 * 创建 WidgetSwitcher Entity Preset。
 *
 * @remarks
 * 组合与 Container 完全一致，只多一个 `WidgetSwitcher`——切换语义是正交能力，移除它就退回
 * 普通容器且不丢任何子项。子项沿用 LayoutItem，不引入 switcher 专属 slot。
 *
 * @internal
 */
export function createWidgetSwitcherPreset(
  options: ComposeBasicContainerOptions = {},
): ComposeEntityPreset {
  const size = options.defaultSize ?? DEFAULT_WIDGET_SWITCHER_SIZE
  const appearance = mergeAppearance(
    DEFAULT_WIDGET_SWITCHER_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    id: 'widget-switcher',
    label: options.label ?? 'Widget Switcher',
    defaultName: options.name ?? 'Widget Switcher',
    icon: <ComposeWidgetSwitcherMaterialIcon />,
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: size.width, min: 1, max: null },
        height: { mode: 'fixed', value: size.height, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
      Clip: options.defaultClip === false
        ? { enabled: false, horizontal: 'visible', vertical: 'visible' }
        : { enabled: true, horizontal: 'clip', vertical: 'clip' },
      Appearance: structuredClone(appearance),
      WidgetSwitcher: { ...DEFAULT_WIDGET_SWITCHER },
    }),
  }
}

/** 默认 WidgetSwitcher Entity Preset。 @public */
export const DEFAULT_COMPOSE_WIDGET_SWITCHER_PRESET = createWidgetSwitcherPreset()
