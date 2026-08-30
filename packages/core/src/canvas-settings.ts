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
      // 主网格按 primaryLineEvery 的幂分级（细 / 中 / 粗 = ×1 / ×4 / ×16），因此这个数同时
      // 决定两级的层间比。调研里同行的层间比集中在 4–5（Photoshop 4、AutoCAD 5、Inkscape 5、
      // Excalidraw 5、tldraw 每级 4），没有任何产品超过 10——一个大格里 16 个小格数不过来。
      primaryLineEvery: 4,
      snapEnabled: true,
    },
    smartSnap: {
      nodes: true,
      guides: true,
    },
  }
}
