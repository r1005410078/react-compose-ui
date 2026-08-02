import type { ComposePropertyPanelRenderer } from '@compose-ui/property-panel'
import {
  FlexFieldLabel,
  FlexGapEditor,
  FlexOptionEditor,
  FlexPaddingEditor,
} from './flex-field-editors'

/** Layout Inspector 注册到 Property Panel 的实例级 renderer。 @internal */
export const FLEX_RENDERERS: readonly ComposePropertyPanelRenderer[] = [
  ...([
    'flex-direction',
    'flex-wrap',
    'align-content',
    'justify-content',
    'align-items',
  ] as const).map((id) => ({
    id,
    component: FlexOptionEditor,
    labelComponent: FlexFieldLabel,
    layout: 'full-width' as const,
  })),
  {
    id: 'gap',
    component: FlexGapEditor,
    labelComponent: FlexFieldLabel,
    layout: 'full-width' as const,
  },
  {
    id: 'padding',
    component: FlexPaddingEditor,
    labelComponent: FlexFieldLabel,
    layout: 'full-width' as const,
  },
]
