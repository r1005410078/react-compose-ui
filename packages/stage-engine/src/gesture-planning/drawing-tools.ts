import type { StagePoint } from '../geometry'
// 类型级回指：`StageInteractionTool` 是 controller 的公开协议类型，`import type` 在编译后
// 被完全擦除，因此 controller 反过来引用本模块的值不会构成运行时循环。
import type { StageInteractionTool } from '../interaction-controller'

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
 * 按工具约束一次绘制的起止点。
 *
 * @remarks
 * 预览与提交 MUST 都走这里，否则会出现拖动时长出一个框、松手又缩回去的跳变。
 *
 * 不再读修饰键：Shift 等长宽只服务过矩形与圆，而制图几何已经全部由命令产出——`RECTANGLE`
 * 的正方形是取一个精确的对角点，比按住 Shift 拖更准。剩下的容器与文字都没有这条约束。
 *
 * @public
 */
export function constrainedDrawingPoints(
  tool: StageDrawingTool,
  start: StagePoint,
  end: StagePoint,
): StageDrawingPoints {
  // 文字只按点创建：拖拽不承载「拖出一个尺寸」的语义，终点始终锁在按下点。
  if (tool === 'draw-text') return { start, end: start }
  return { start, end }
}
