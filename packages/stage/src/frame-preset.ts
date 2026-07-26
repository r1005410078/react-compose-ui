import type { ReactNode } from 'react'
import type { NodeStyle } from '@compose-ui/core'

/**
 * ComponentPalette 可创建的根级 Frame 预设。
 *
 * @public
 */
export interface StageFramePreset {
  /** 一个 Palette 实例内唯一且稳定的预设 ID。 */
  readonly id: string
  /** Palette 显示名称。 */
  readonly label: string
  /** 新建文档节点使用的默认名称。 */
  readonly name: string
  /** 可选宿主图标。 */
  readonly icon?: ReactNode
  /** 新建 Frame 的世界尺寸。 */
  readonly defaultSize: {
    readonly width: number
    readonly height: number
  }
  /** 新建 Frame 是否默认裁剪后代内容。 */
  readonly defaultClipContent: boolean
  /** 为每个新 Frame 创建独立的通用 style。 */
  readonly createDefaultStyle: () => NodeStyle
}
