import type { StageOverlayContext } from '../overlay-types'

/**
 * 选中边框层。
 *
 * @remarks
 * 两种互斥呈现按优先级降级：已下钻的实例内部实体画只读边框，其余情况画通用矩形。
 * 绘制工具激活时一律不画——那时用户看的是笔尖，不是选区。
 *
 * 曾经还有第三种：两点 Shape 的端点选区。它随 `shape` 物料一起删除——曲线的两个端点就在紧
 * 包围盒的对角，「曲线按 viewBox 跟随盒伸缩」交付之后拖盒角手柄与拖端点落点逐像素相同。
 * 通用的顶点编辑是路线图步骤 10。
 */
export function SelectionLayer({
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
      ) : screenBounds && !drawingToolActive ? (
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
