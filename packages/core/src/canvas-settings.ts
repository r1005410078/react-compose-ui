import type { ComposeCanvasSettings } from './document-types'

/**
 * 创建 v2 文档的默认画布配置。
 *
 * @returns 每次调用均返回可独立修改的新对象；默认使用 8×8 网格、每 8 格一条主线，
 * 并启用网格、节点和辅助线吸附。
 * @public
 */
export function createDefaultCanvasSettings(): ComposeCanvasSettings {
  return {
    grid: {
      stepX: 8,
      stepY: 8,
      offsetX: 0,
      offsetY: 0,
      primaryLineEvery: 8,
      snapEnabled: true,
    },
    smartSnap: {
      nodes: true,
      guides: true,
    },
    guides: [],
  }
}
