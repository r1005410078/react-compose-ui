import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import {
  composeArcThroughPoints,
  createComposeLineCurve,
  isDegenerateComposePolyline,
} from '@compose-ui/core'
import type { ComposeCurve } from '@compose-ui/core'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

function pointPrompt(
  message: string,
  keywords?: readonly { readonly key: string; readonly label: string }[],
): ComposeCommandPrompt {
  return { message, accepts: ['point'], ...(keywords ? { keywords } : {}) }
}

/**
 * 三点定弧的效果；三点共线时返回 `null`。
 *
 * @remarks
 * 提交与预览共用它：预览与最终结果如果各算一遍，用户松手那一刻形状会跳一下，而那种偏差
 * 只在特定的三点排布上现形。
 */
function arcCurve(
  a: ComposeCommandPoint,
  b: ComposeCommandPoint,
  c: ComposeCommandPoint,
): StageDraftingEffect | null {
  const arc = composeArcThroughPoints(a, b, c)
  if (!arc) return null
  return {
    curves: [{
      kind: 'arc',
      center: { x: arc.center.x, y: arc.center.y },
      radius: arc.radius,
      startAngle: arc.startAngle,
      sweep: arc.sweep,
    }],
  }
}

/** 两个对角点的闭合四顶点多段线；提交与预览共用。 */
function rectangleCurve(
  corner: ComposeCommandPoint,
  opposite: ComposeCommandPoint,
): ComposeCurve {
  return {
    kind: 'polyline',
    vertices: [
      { x: corner.x, y: corner.y },
      { x: opposite.x, y: corner.y },
      { x: opposite.x, y: opposite.y },
      { x: corner.x, y: opposite.y },
    ],
    closed: true,
  }
}

/**
 * 三点定弧。
 *
 * @remarks
 * 只做三点式。AutoCAD 有十一种起算方式，而三点式覆盖鼠标绘制的绝大多数——加一种起算方式
 * 是加一条会话分支，等有人真的需要再加。
 *
 * **三点共线时以 `rejected` 表达且不结束会话**：沿一条既有直线连点三下在实际操作里很常见，
 * 外接圆退化成直线、无解。结束命令会让用户从头再来，而他只是最后一点点歪了。
 *
 * @public
 */
export function createStageArcSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  const picked: ComposeCommandPoint[] = []
  let prompt = pointPrompt(messages.specifyFirstPoint)

  return {
    get prompt() {
      return prompt
    },
    /*
     * 只取过一个点时画一条到光标的线：两点定不出弧，而弦本身就是用户此刻在瞄的东西。
     * 取过两点之后画真弧——三点共线时求不出外接圆，那一帧退回不画，与 `rejected` 一致。
     */
    preview(point) {
      if (picked.length === 0) return null
      if (picked.length === 1) return { curves: [createComposeLineCurve(picked[0]!, point)] }
      return arcCurve(picked[0]!, picked[1]!, point)
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel' || input.kind === 'accept') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      picked.push(input.point)
      if (picked.length === 1) {
        prompt = pointPrompt(messages.specifyThroughPoint)
        return { status: 'prompt', prompt, preview: { reference: input.point } }
      }
      if (picked.length === 2) {
        prompt = pointPrompt(messages.specifyEndPoint)
        return { status: 'prompt', prompt, preview: { reference: input.point } }
      }

      const effect = arcCurve(picked[0]!, picked[1]!, picked[2]!)
      if (!effect) {
        // 收回第三点，让用户直接重取而不是从第一点再来。
        picked.pop()
        return { status: 'rejected', message: messages.collinearArc }
      }
      return { status: 'commit', effect }
    },
  }
}

/**
 * 圆心加半径点画整圆。
 *
 * @remarks
 * 产出的是 `sweep` 为 360 的**弧**——整圆不另立类型，因此归一化、平移、距离、特征点与校验
 * 五条路径不需要为它多写一份。
 *
 * @public
 */
export function createStageCircleSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let center: ComposeCommandPoint | null = null
  let prompt = pointPrompt(messages.specifyCenter)

  return {
    get prompt() {
      return prompt
    },
    preview(point) {
      if (center === null) return null
      const radius = Math.hypot(point.x - center.x, point.y - center.y)
      // 半径为零画不出东西；那一帧不画，与它被 `rejected` 拦下是同一个判断。
      if (!(radius > 0)) return null
      return {
        curves: [{ kind: 'arc', center: { x: center.x, y: center.y }, radius, startAngle: 0, sweep: 360 }],
      }
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel' || input.kind === 'accept') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (center === null) {
        center = input.point
        prompt = pointPrompt(messages.specifyRadius)
        return { status: 'prompt', prompt, preview: { reference: center } }
      }
      const radius = Math.hypot(input.point.x - center.x, input.point.y - center.y)
      // 半径为零的圆是点不中也删不掉的幽灵；命令层拦一次，用户当场得到答案。
      if (!(radius > 0)) return { status: 'rejected', message: messages.degenerateShape }
      return {
        status: 'commit',
        effect: {
          curves: [{ kind: 'arc', center: { x: center.x, y: center.y }, radius, startAngle: 0, sweep: 360 }],
        },
      }
    },
  }
}

/**
 * 两个对角点画矩形。
 *
 * @remarks
 * 产出四顶点的**闭合多段线**——矩形不另立类型，它唯一多出来的「四角是直角」在用户拖动某个
 * 顶点之后就不再成立。
 *
 * @public
 */
export function createStageRectangleSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let corner: ComposeCommandPoint | null = null
  let prompt = pointPrompt(messages.specifyCorner)

  return {
    get prompt() {
      return prompt
    },
    preview(point) {
      // 退化成一条线或一个点的那一帧照画：用户正拖着找对角点，此刻不画会让矩形一闪一闪。
      return corner === null ? null : { curves: [rectangleCurve(corner, point)] }
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel' || input.kind === 'accept') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (corner === null) {
        corner = input.point
        prompt = pointPrompt(messages.specifyOppositeCorner)
        return { status: 'prompt', prompt, preview: { reference: corner } }
      }
      const { x, y } = input.point
      if (x === corner.x || y === corner.y) {
        // 退化成一条线或一个点：矩形的两个对角点必须在两个轴上都分开。
        return { status: 'rejected', message: messages.degenerateShape }
      }
      return { status: 'commit', effect: { curves: [rectangleCurve(corner, input.point)] } }
    },
  }
}

/**
 * 连续取点画一条多段线。
 *
 * @remarks
 * 与 `LINE` 的差别是这条命令存在的**理由**：`LINE` 逐段落地（每段一个 Entity），`PLINE`
 * 攒到结束才提交**一个** Entity。AutoCAD 同样如此。
 *
 * 推论是 `PLINE` 需要「放弃上一点」关键字而 `LINE` 不需要：`LINE` 的放弃等于一次文档撤销，
 * 而 `PLINE` 的还在会话里——此刻文档上什么都还没有。
 *
 * @public
 */
export function createStagePolylineSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  const vertices: ComposeCommandPoint[] = []
  const undoKeyword = { key: 'U', label: messages.undoKeyword }
  let prompt = pointPrompt(messages.specifyFirstPoint)

  const nextPrompt = () => pointPrompt(
    messages.specifyNextPoint,
    vertices.length > 1 ? [undoKeyword] : undefined,
  )

  const preview = (): StageDraftingEffect => {
    const last = vertices[vertices.length - 1]
    return last ? { reference: last } : {}
  }

  return {
    get prompt() {
      return prompt
    },
    /*
     * 已取的**全部**顶点加上光标那个候选点。只画最后一段是不够的：`PLINE` 攒到结束才提交，
     * 在那之前文档里什么都没有，因此屏幕上没画出来的部分对用户就是不存在的。
     */
    preview(point) {
      if (vertices.length === 0) return null
      return {
        curves: [{
          kind: 'polyline',
          vertices: [...vertices.map(({ x, y }) => ({ x, y })), { x: point.x, y: point.y }],
          closed: false,
        }],
      }
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (input.kind === 'keyword') {
        if (input.key.toUpperCase() !== 'U') {
          return { status: 'rejected', message: messages.expectedPoint }
        }
        vertices.pop()
        prompt = vertices.length === 0 ? pointPrompt(messages.specifyFirstPoint) : nextPrompt()
        return { status: 'prompt', prompt, preview: preview() }
      }

      if (input.kind === 'accept') {
        // 不足两个顶点或全部重合时什么也不提交——不留下屏幕上看不见的幽灵。
        if (isDegenerateComposePolyline(vertices)) return { status: 'cancelled' }
        const curve: ComposeCurve = {
          kind: 'polyline',
          vertices: vertices.map(({ x, y }) => ({ x, y })),
          closed: false,
        }
        return { status: 'commit', effect: { curves: [curve] } }
      }

      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      vertices.push(input.point)
      prompt = nextPrompt()
      return { status: 'prompt', prompt, preview: preview() }
    },
  }
}

/** ARC 命令定义。 @public */
export function createStageArcCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'ARC',
    aliases: ['A'],
    title: messages.arcTitle,
    category: messages.drawCategory,
    start: createStageArcSession,
  }
}

/** CIRCLE 命令定义。 @public */
export function createStageCircleCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'CIRCLE',
    aliases: ['C'],
    title: messages.circleTitle,
    category: messages.drawCategory,
    start: createStageCircleSession,
  }
}

/** RECTANGLE 命令定义。 @public */
export function createStageRectangleCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'RECTANGLE',
    aliases: ['REC'],
    title: messages.rectangleTitle,
    category: messages.drawCategory,
    start: createStageRectangleSession,
  }
}

/** PLINE 命令定义。 @public */
export function createStagePolylineCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'PLINE',
    aliases: ['PL'],
    title: messages.polylineTitle,
    category: messages.drawCategory,
    start: createStagePolylineSession,
  }
}
