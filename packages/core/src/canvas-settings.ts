import type { ComposeCanvasSettings } from './document-types'

/**
 * 创建默认的编辑器视口配置。
 *
 * @returns 每次调用均返回可独立修改的新对象；默认使用 4×4 网格、每 4 格一条主线，
 * 并启用网格、节点和辅助线吸附。v7 起结果不含 guides——辅助线归属 Frame。
 *
 * @remarks
 * 步长取 4：它是界面设计通行的基础模数（Material、iOS HIG 与主流设计系统的间距、字号
 * 与控件高度都按 4 的倍数取值），8 的那一档因此仍然落在格点上，而 4 还够得着图标与描边
 * 这一级的微调。绘图工作区另有自己的种子（`SNAPUNIT` 的 10），那一边画的不是界面。
 * @public
 */
export function createDefaultCanvasSettings(): ComposeCanvasSettings {
  return {
    grid: {
      stepX: 4,
      stepY: 4,
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
