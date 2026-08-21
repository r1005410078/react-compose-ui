import {
  constrainedDrawingPoints,
  isDrawingTool,
  type StageDrawingTool,
} from '../drawing-tools'
import { rectFromPoints, screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type { StageInteractionContext } from '../interaction-controller'
import type {
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** 图形绘制的注册 id。 @public */
export const STAGE_DRAW_PLUGIN_ID = 'draw'

const DRAW_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_DRAW_PLUGIN_ID)!.priority

interface DrawSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly tool: StageDrawingTool
  readonly startWorld: StagePoint
}

/** 小于一个世界像素的框来自没有真正移动的按下，不足以创建一个图形。 */
const MIN_DRAWN_SIZE = 1

function createDrawSession(options: DrawSessionOptions): StageSession {
  const { pointerId, viewport, tool, startWorld } = options
  let drawingStart = startWorld
  let drawingEnd = startWorld

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 绘制使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变同一次
      // Pointer 手势的坐标基线。
      const world = screenToWorld(event.point, viewport)
      const drawing = constrainedDrawingPoints(tool, startWorld, world, event.modifiers)
      drawingStart = drawing.start
      drawingEnd = drawing.end
      ctx.publish({
        ...ctx.snapshot,
        phase: 'draw',
        drawing: {
          tool,
          bounds: rectFromPoints(drawing.start, drawing.end),
          start: drawing.start,
          end: drawing.end,
        },
      })
    },
    commit(ctx) {
      const bounds = rectFromPoints(drawingStart, drawingEnd)
      // 文字只按点创建，因此没有尺寸门槛；其余工具要求至少一个世界像素，避免一次没有移动的
      // 按下凭空创建出零尺寸图形。
      const canCreate = tool === 'draw-text'
        || bounds.width >= MIN_DRAWN_SIZE
        || bounds.height >= MIN_DRAWN_SIZE
      if (canCreate) {
        const center = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        }
        // Controller 不创建实体也不铸 ID：真正创建的是宿主，落点父级由中心点求解。
        ctx.apply([{
          type: 'drawing.commit',
          tool,
          bounds,
          start: drawingStart,
          end: drawingEnd,
          parentId: ctx.index.containerAtPoint(center),
        }])
      }
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 预览只活在快照里，回到空闲即丢弃；没有任何东西被创建。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next: StageInteractionContext) {
      // **刻意**不接空间基线（见 spatial-baseline.ts）：绘制只由世界坐标定义，不引用任何
      // Entity。退出文字编辑时删除空文字会在同一次指针按下里改动文档，若并发文档变化也中止
      // 会话，紧接着开始的这次绘制会当场消失。工具切换仍然中止——那是用户已经改了主意。
      return next.tool === tool
    },
  }
}

/**
 * 图形绘制插件。
 *
 * @remarks
 * 绘制工具下在空白或节点上按下都起笔：画布上已有内容不该挡住继续作图。它排在框选与实体选择
 * 之前，因为那些分支在工具非 select 时才提前退出，顺序反过来会让绘制起笔落到框选。
 *
 * @public
 */
export function createStageDrawPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_DRAW_PLUGIN_ID,
    priority: DRAW_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext) {
      const { context } = ctx
      if (!isDrawingTool(context.tool)) return null
      if (event.hit.kind !== 'surface' && event.hit.kind !== 'entity') return null

      const startWorld = screenToWorld(event.point, context.viewport)
      ctx.publish({
        ...ctx.idleSnapshot(),
        phase: 'draw',
        drawing: {
          tool: context.tool,
          bounds: rectFromPoints(startWorld, startWorld),
          start: startWorld,
          end: startWorld,
        },
      })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createDrawSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        tool: context.tool,
        startWorld,
      })
    },
  }
}
