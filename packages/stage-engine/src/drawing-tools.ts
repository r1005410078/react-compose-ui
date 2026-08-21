import type { StagePoint } from './geometry'
// 类型级回指：`StageInteractionTool` 是 controller 的公开协议类型，`import type` 在编译后
// 被完全擦除，因此 controller 反过来引用本模块的值不会构成运行时循环。
import type { StageInteractionModifiers, StageInteractionTool } from './interaction-controller'

/** 绘制工具，即工具名以 `draw-` 开头的那一族。 @public */
export type StageDrawingTool = Extract<StageInteractionTool, `draw-${string}`>

/**
 * 判断一个工具是否为绘制工具。
 *
 * @remarks
 * 光标派生与绘制接管两处都要问同一个问题，因此判定只有这一处实现。
 * @public
 */
export function isDrawingTool(tool: StageInteractionTool): tool is StageDrawingTool {
  return tool.startsWith('draw-')
}

/** 一次绘制预览的起止点。 @public */
export interface StageDrawingPoints {
  readonly start: StagePoint
  readonly end: StagePoint
}

/**
 * Shift 约束时，鼠标必须始终落在正在绘制图形的角点上。若只调整 end，视觉上的角点会偏离
 * 指针；这里保持 end 为真实指针位置，并把较短轴的起点外扩为等长边。
 */
function constrainSquareDrawingPoints(
  start: StagePoint,
  end: StagePoint,
): StageDrawingPoints {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const side = Math.max(Math.abs(deltaX), Math.abs(deltaY))
  const directionX = deltaX === 0 ? (deltaY < 0 ? -1 : 1) : Math.sign(deltaX)
  const directionY = deltaY === 0 ? (deltaX < 0 ? -1 : 1) : Math.sign(deltaY)

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      start: { x: start.x, y: end.y - directionY * side },
      end,
    }
  }
  return {
    start: { x: end.x - directionX * side, y: start.y },
    end,
  }
}

/**
 * 按工具与修饰键约束一次绘制的起止点。
 *
 * @remarks
 * 预览与提交 MUST 都走这里，否则会出现拖动时长出一个框、松手又缩回去的跳变。
 *
 * @public
 */
export function constrainedDrawingPoints(
  tool: StageDrawingTool,
  start: StagePoint,
  end: StagePoint,
  modifiers: StageInteractionModifiers,
): StageDrawingPoints {
  // 文字只按点创建：拖拽不承载「拖出一个尺寸」的语义，终点始终锁在按下点。
  if (tool === 'draw-text') return { start, end: start }
  return modifiers.shift && (tool === 'draw-rectangle' || tool === 'draw-circle')
    ? constrainSquareDrawingPoints(start, end)
    : { start, end }
}
