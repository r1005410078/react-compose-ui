import type { StageFramePreset } from '@compose-ui/stage'
import { cloneStyle } from '../shared/default-values'
import type { BasicMaterialFrameOptions } from '../types'
import { DEFAULT_FRAME_SIZE, DEFAULT_FRAME_STYLE } from './defaults'

/** 根据实例配置创建 Frame preset。 @internal */
export function createFramePreset(
  options: BasicMaterialFrameOptions = {},
): StageFramePreset {
  const defaultSize = options.defaultSize ?? DEFAULT_FRAME_SIZE
  const style = cloneStyle(DEFAULT_FRAME_STYLE, options.defaultStyle)
  return {
    id: 'frame',
    label: options.label ?? 'Frame',
    name: options.name ?? 'Frame',
    icon: <span aria-hidden="true">▱</span>,
    defaultSize: { ...defaultSize },
    createDefaultStyle: () => cloneStyle(style),
  }
}

/** 默认 Frame preset；不会创建模块级 registry。 @public */
export const DEFAULT_FRAME_PRESET = createFramePreset()
