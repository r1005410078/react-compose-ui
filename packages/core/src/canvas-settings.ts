import type { ComposeCanvasSettings } from './document-types'

/**
 * 创建默认的编辑器视口配置。
 *
 * @returns 每次调用均返回可独立修改的新对象；默认使用 8×8 网格、每 8 格一条主线，
 * 并启用网格、节点和辅助线吸附。v7 起结果不含 guides——辅助线归属 Frame。
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
  }
}
