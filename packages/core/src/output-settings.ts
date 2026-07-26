import type { ComposeOutputSettings } from './document-types'

/**
 * 创建文档发布与默认 Preview 使用的独立输出设置。
 *
 * @returns 固定原点、1280×720 且使用浅色背景的新对象。
 * @public
 */
export function createDefaultOutputSettings(): ComposeOutputSettings {
  return {
    width: 1280,
    height: 720,
    backgroundColor: 'transparent',
  }
}
