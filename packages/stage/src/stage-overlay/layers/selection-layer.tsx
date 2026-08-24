import type { StageOverlayContext } from '../overlay-types'

/**
 * 选中边框层。
 *
 * @remarks
 * 两种互斥呈现按优先级降级：已下钻的实例内部实体画只读边框，其余情况画通用矩形。
 * 绘制工具激活时一律不画——那时用户看的是笔尖，不是选区。
 *
 * 几何编辑态同样不画，与盒手柄、旋转手柄一并让位，三条各自独立的理由：**盒不是曲线的
 * 轮廓**（一条对角线的包围盒里绝大部分是空的，这正是命中不按包围盒判的那条理由的视觉版本）；
 * **拖夹点时它是过期的**（选区盒由手势的预览变换推出，而夹点拖动走本地几何预览、不产生预览
 * 变换，因此整个拖动过程里它停在拖动之前的位置）；**要说的话已经有人说了**（可编辑路径覆盖层
 * 沿真实几何画轮廓，夹点也落在对象上）。
 *
 * 文字编辑态只去掉填充、留下边框，是同一条判断的另一个结论而不是不一致：文字占满自己的盒，
 * 那个矩形就是对象的轮廓。
 *
 * 曾经还有第三种：两点 Shape 的端点选区。它随 `shape` 物料一起删除——曲线的两个端点就在紧
 * 包围盒的对角，「曲线按 viewBox 跟随盒伸缩」交付之后拖盒角手柄与拖端点落点逐像素相同。
 * 通用的顶点编辑是路线图步骤 10。
 */
export function SelectionLayer({
  geometryEditing,
  instanceSelectionBounds,
  screenBounds,
  textEditing,
  tool,
}: StageOverlayContext) {
  const drawingToolActive = tool.startsWith('draw-')
  return (
    <>
      {instanceSelectionBounds ? (
        <rect
          className="compose-stage__selection compose-stage__selection--instance-inner"
          data-testid="stage-instance-selection-bounds"
          height={instanceSelectionBounds.height}
          width={instanceSelectionBounds.width}
          x={instanceSelectionBounds.x}
          y={instanceSelectionBounds.y}
        />
      ) : screenBounds && !drawingToolActive && !geometryEditing ? (
        <rect
          className={`compose-stage__selection${textEditing ? ' is-text-editing' : ''}`}
          data-testid={textEditing ? 'stage-text-editing-bounds' : 'stage-selection-bounds'}
          height={screenBounds.height}
          width={screenBounds.width}
          x={screenBounds.x}
          y={screenBounds.y}
        />
      ) : null}
    </>
  )
}
