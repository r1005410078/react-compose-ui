import { CanvasGuidesLayer } from './layers/canvas-guides-layer'
import { CurveCornersLayer } from './layers/curve-corners-layer'
import { DrawingLayer } from './layers/drawing-layer'
import { DropIndicatorLayer } from './layers/drop-indicator-layer'
import { EditablePathContribution } from './layers/editable-path-layer'
import { MarqueeLayer } from './layers/marquee-layer'
import { PaintHandlesLayer } from './layers/paint-handles-layer'
import { PaintSampleLayer } from './layers/paint-sample-layer'
import { ResizeHandlesLayer } from './layers/resize-handles-layer'
import { TransformGizmoLayer, TransformGizmoRingLayer } from './layers/transform-gizmo-layer'
import { SelectionLayer } from './layers/selection-layer'
import { SnapGuidesLayer } from './layers/snap-guides-layer'
import { WireEndsLayer } from './layers/wire-ends-layer'
import type { StageOverlayContribution } from './overlay-types'

/**
 * 第一方 Overlay 层的绘制顺序。
 *
 * @remarks
 * SVG 没有 z-index，**绘制顺序即命中顺序**。这张表把原先隐含在一段 JSX 里的先后关系变成
 * 显式数值，理由与手势的 `STAGE_GESTURE_PRIORITY` 完全一致：顺序错位会静默改变「重叠区域
 * 归谁」，而那是最难定位的一类问题。
 *
 * 两处顺序是硬约束，不是审美：
 * - 路径顶点（500）必须在缩放手柄（600 之下、即数值更大）之上——关键帧顶点常与对象角点
 *   重合，压在手柄之下将永远拖不动。
 * - 吸附参考线（100）必须在最上层——它是瞬时反馈，被任何东西盖住都等于没画。
 */
const CONTRIBUTIONS: readonly StageOverlayContribution[] = [
  { id: 'canvas-guides', order: 1000, Layer: CanvasGuidesLayer },
  { id: 'selection', order: 900, Layer: SelectionLayer },
  /*
   * 指示器的旋转环排在缩放手柄**之下**、轴排在其**上**，这两条是硬约束：
   * - 角正是用户预期抓到缩放手柄的地方，而环是一条必然穿过某些尺寸的四角的宽带。SVG 的绘制
   *   顺序**就是**命中顺序，因此重叠归谁由这里的层序回答，而不是靠常量之间的大小关系去躲。
   * - 轴的方块会落在盒的边缘命中区上（半宽 52 与盒的半宽相近时），排在手柄之下等于方块按不动。
   */
  { id: 'transform-gizmo-ring', order: 850, Layer: TransformGizmoRingLayer },
  { id: 'resize-handles', order: 800, Layer: ResizeHandlesLayer },
  { id: 'transform-gizmo', order: 750, Layer: TransformGizmoLayer },
  /*
   * 圆角手柄排在缩放手柄与指示器**之上**、路径顶点之下：它画在角内侧，而角正是缩放手柄与
   * 指示器轴方块所在的地方；路径顶点属于另一条编辑会话，不该被它偷走。
   */
  { id: 'curve-corners', order: 720, Layer: CurveCornersLayer },
  { id: 'editable-path', order: 700, Layer: EditablePathContribution },
  { id: 'paint-handles', order: 400, Layer: PaintHandlesLayer },
  { id: 'paint-sample', order: 350, Layer: PaintSampleLayer },
  { id: 'marquee', order: 300, Layer: MarqueeLayer },
  { id: 'drop-indicator', order: 250, Layer: DropIndicatorLayer },
  { id: 'drawing', order: 200, Layer: DrawingLayer },
  /*
   * 端点记号排在选中框之上、吸附参考线之下：它描述的是某一条线的一端，被选中框盖住等于没画；
   * 而参考线是瞬时反馈，任何东西都不该盖住它。
   */
  { id: 'wire-ends', order: 150, Layer: WireEndsLayer },
  { id: 'snap-guides', order: 100, Layer: SnapGuidesLayer },
]

/**
 * 按绘制顺序排好的 Overlay 层注册表。
 *
 * @remarks
 * 数值大的先绘制、位于下层；数值小的后绘制、压在上面并优先接收指针。
 *
 * @param extra - 宿主追加的层；与第一方层按同一套 order 排序。id 重复时抛错。
 * @returns 从下到上的绘制序列。
 * @public
 */
export function createStageOverlayRegistry(
  extra: readonly StageOverlayContribution[] = [],
): readonly StageOverlayContribution[] {
  const all = [...CONTRIBUTIONS, ...extra]
  const seen = new Set<string>()
  for (const { id } of all) {
    if (seen.has(id)) throw new Error(`Duplicate stage overlay contribution: ${id}`)
    seen.add(id)
  }
  // 数值大的先画（在下），因此按降序排列。
  return [...all].sort((left, right) => right.order - left.order)
}

/** 第一方层的默认注册表。 @public */
export const STAGE_OVERLAY_CONTRIBUTIONS = createStageOverlayRegistry()
