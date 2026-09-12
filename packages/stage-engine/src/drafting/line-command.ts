import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import { createComposeLineCurve, isDegenerateComposePolyline } from '@compose-ui/core'
import type { ComposeCurve } from '@compose-ui/core'
import { createStageCopyCommand, createStageMoveCommand } from './move-copy-command'
import { createStageEraseCommand } from './erase-command'
import { createStageVertexCommand } from './vertex-command'
import { createStageAlignmentCommand, createStageMirrorCommand } from './mirror-command'
import type { StageAlignmentMode } from '../gesture-planning'
import {
  createStageArcCommand,
  createStageCircleCommand,
  createStagePolylineCommand,
  createStagePolygonCommand,
  createStageRectangleCommand,
} from './shape-commands'
import type { StageDraftingContext, StageDraftingEffect, StageDraftingMessages } from './drafting-types'

function firstPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // 第一个点没有「上一点」，量不出长度与角度，因此这一档是绝对坐标。
  return { message: messages.specifyFirstPoint, accepts: ['point'], fields: 'absolute' }
}

function nextPrompt(
  messages: StageDraftingMessages,
  closable = false,
): ComposeCommandPrompt {
  // Enter 结束命令，与 AutoCAD 一致；没有 `defaultKeyword` 时 `accept` 会被拒绝，因此这里
  // 由 session 直接把 `accept` 解释成结束。
  //
  // 两个关键字都只在**够得着**时列出（至少取过两个点，也就是至少有一段）：一个点时列出
  // 它们，等于让用户看见按下去只会被拒绝的选项。
  return closable
    ? {
        message: messages.specifyNextPoint,
        accepts: ['point', 'keyword'],
        keywords: [
          { key: 'C', label: messages.closeKeyword },
          { key: 'U', label: messages.undoKeyword },
        ],
        fields: 'polar',
      }
    : { message: messages.specifyNextPoint, accepts: ['point'], fields: 'polar' }
}

/**
 * 取够两点自己就提交的那一步的提示。
 *
 * @remarks
 * **不共用 `nextPrompt`**：`specifyNextPoint` 写着「回车结束」，而这里没有「怎么结束」这个
 * 问题——取到第二个点当场提交，回车确实什么也不结束。`repeat` 落地之后更刺眼：回车此刻连
 * 命令都不结束。这条由既有规范明写（取够点自己就提交的命令 MUST NOT 带这句提示）。
 *
 * 复用 `specifyEndPoint`（「指定端点」）而不是新造一句：三点弧的第三点问的是同一件事——
 * 这条几何的另一端在哪儿。
 */
function endPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.specifyEndPoint, accepts: ['point'], fields: 'polar' }
}

/**
 * 建立一次 LINE 执行的状态机。
 *
 * @remarks
 * 纯状态机：不碰 React、不碰 DOM，输入是归一化的 `ComposeCommandInput`，输出是提示、预览与
 * 本步要创建的几何。因此喂一串输入即可完整测试。
 *
 * **逐段落地**（`prompt` 携带 `commit`）而不是攒到最后一次性提交：曲线是普通页面 Entity，
 * 画一段就该在场景树里出现一行——那正是这条统一路线要让用户看见的事实。代价是撤销粒度变成
 * 一段一步，这与 AutoCAD 的 `U` 关键字粒度一致。
 *
 * @public
 */
export function createStageLineSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  /*
   * 已取的点序列。
   *
   * @remarks
   * 只留 `previous` 一个点是不够的：`U` 要回到**上上个**点。序列同时给出「够不着闭合/放弃」
   * 的判据——不足两个点就一段都没有。
   */
  const points: ComposeCommandPoint[] = []
  let prompt = firstPrompt(messages)

  const first = () => points[0] ?? null
  const previousPoint = () => points[points.length - 1] ?? null
  /** 够得着闭合与放弃：至少取过两个点，才存在「一段」。 */
  const closable = () => points.length > 1

  return {
    get prompt() {
      return prompt
    },
    // 待定段：还没落地的那一条。已画完的段都已经是真的 Entity，不必也不该在预览里重画。
    preview(point) {
      const previous = previousPoint()
      return previous ? { curves: [createComposeLineCurve(previous, point)] } : null
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      /*
       * 闭合：再产出**一段**从当前点回到第一个点的线，然后结束。
       *
       * `LINE` 逐段落地，因此这一段与前面每一段一样是独立 Entity——闭合在这里是「补最后
       * 一段」，而 `PLINE` 的闭合是「把 `closed` 置位」。两条命令的关键字同名而机制不同，
       * 与 `U` 是同一种情形。
       */
      if (input.kind === 'keyword') {
        const key = input.key.toUpperCase()
        if (!closable() || (key !== 'C' && key !== 'U')) {
          return { status: 'rejected', message: messages.expectedPoint }
        }
        if (key === 'C') {
          return {
            status: 'commit',
            effect: { curves: [createComposeLineCurve(previousPoint()!, first()!)] },
          }
        }
        /*
         * 放弃上一段：会话**只回退自己的点序列**，那一段的 Entity 由宿主删——引擎建不了
         * Entity 也记不住 id。
         *
         * 与 `PLINE` 的 `U` 同名而机制不同：`PLINE` 逐点攒着，此刻文档上什么都还没有，
         * 因此它的 `U` 只动会话。两处的注释各写一遍，免得下一个人试图合并它们。
         */
        points.pop()
        prompt = nextPrompt(messages, closable())
        return {
          status: 'prompt',
          prompt,
          preview: { reference: previousPoint()! },
          commit: { undoLastCreated: true },
        }
      }
      // 没有 `defaultKeyword`，因此 Enter 的含义由命令自己给：已经取过点就是**正常结束**，
      // 一点都没取才是什么也没发生。
      //
      // 结束必须是 `commit` 而不是 `cancelled`：逐段落地意味着此刻文档上已经没有待提交的
      // 东西，`effect` 因此是空的——但宿主是按 status 决定提示文案的，回 `cancelled` 会让
      // 用户画完一条线看到「已取消」。空 effect 是合法的：字段全部可选，它表达的正是
      // 「命令正常结束，本步没有新产出」。
      if (input.kind === 'accept') {
        return previousPoint() ? { status: 'commit', effect: {} } : { status: 'cancelled' }
      }

      if (input.kind !== 'point') {
        return { status: 'rejected', message: messages.expectedPoint }
      }

      const point = input.point
      const reference = previousPoint()
      points.push(point)
      prompt = nextPrompt(messages, closable())
      return {
        status: 'prompt',
        prompt,
        preview: { reference: point },
        // 第一点只是起点，还构不成一段。
        ...(reference
          ? { commit: { curves: [createComposeLineCurve(reference, point)], reference: point } }
          : {}),
      }
    },
  }
}

/**
 * 建立一次**两点曲线**执行的状态机。
 *
 * @remarks
 * 与 LINE 的差别只有两处：取两个点就结束，以及提交时带上调用方给的那个标记。
 *
 * `extras` 是提交效果上的附加标记（`wire` 或 `arrow`），**不是几何**：两条命令的取点逻辑
 * 逐字相同，复制一份只会让下一个改取点的人改到其中一处。
 */
function createTwoPointCurveSession(
  context: StageDraftingContext,
  extras: Pick<StageDraftingEffect, 'arrow' | 'wire'>,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let start: ComposeCommandPoint | null = null
  let prompt = firstPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    preview(point) {
      return start ? { curves: [createComposeLineCurve(start, point)], ...extras } : null
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'point') {
        return { status: 'rejected', message: messages.expectedPoint }
      }
      if (!start) {
        start = input.point
        prompt = endPrompt(messages)
        return { status: 'prompt', prompt, preview: { reference: input.point } }
      }
      return {
        status: 'commit',
        effect: {
          curves: [createComposeLineCurve(start, input.point)],
          ...extras,
          reference: input.point,
        },
      }
    },
  }
}

/**
 * 建立一次 WIRE 执行的状态机。
 *
 * @remarks
 * **连续取点**：一条导线是**一个**连接，因此几何攒成一个 Entity 在结束时提交，而不像 `LINE`
 * 那样逐段落地——逐段会得到 N 个 Entity，中间的接头退化成「两个自由端刚好重合」，符号一移动
 * 接头就裂开（求解保证的是**绑定端**跟着走，假接头不是绑定）。
 *
 * 推论（与 `PLINE` 同一条判断）：攒到结束才提交的命令需要「放弃上一点」关键字，因为此刻文档上
 * 什么都还没有、撤销够不着它。
 *
 * **不做自动路由**：横平竖直由既有的角度约束给（极轴默认开、增量角 45°，正好覆盖 H/V/45），
 * 用户点到哪儿就是哪儿。替用户补拐角要回答「拐点该拐在哪儿」，而真答案要考虑障碍物。
 *
 * **只有首尾两个顶点参与绑定**，中间的拐点是纯几何——绑定由宿主按几何的首尾取。
 *
 * 与 `ARROW` **不再共用两点会话工厂**：那个共用的前提是取点逻辑逐字相同，现在不是了。
 *
 * **`LINE` 不绑定，即使端点吸附到了端口上**：绑定改变对象此后的行为，意图必须显式。
 *
 * @public
 */
export function createStageWireSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  const vertices: ComposeCommandPoint[] = []
  const undoKeyword = { key: 'U', label: messages.undoKeyword }

  const wireCurve = (points: readonly ComposeCommandPoint[]): ComposeCurve => (
    points.length === 2
      ? createComposeLineCurve(points[0]!, points[1]!)
      : {
          kind: 'polyline',
          vertices: points.map(({ x, y }) => ({ x, y })),
          closed: false,
        }
  )

  /*
   * 连续取点，因此这一步的提示**要说出怎么结束**——与 `LINE`、`PLINE` 同一档。`ARROW` 相反：
   * 它取够两点自己就提交，那句话在那里说的是一件做不到的事。
   *
   * 闭合关键字不列：一条导线连接的是两个端口，闭合没有意义。
   */
  const nextPrompt = () => ({
    message: messages.specifyNextPoint,
    accepts: vertices.length > 1 ? ['point' as const, 'keyword' as const] : ['point' as const],
    ...(vertices.length > 1 ? { keywords: [undoKeyword] } : {}),
    fields: 'polar' as const,
    /*
     * 导线**只走横平竖直**，因此从第二个点起把角度约束钉死成正交——这不是辅助而是规范：
     * 斜着走的导线在一次接线图上不是「用户的选择」，是一张画错的图。会话级的三态设置管不到
     * 这一步。
     *
     * 第一个点没有上一点、量不出方向，因此不钉（`firstPrompt` 不带这个字段）。
     */
    constrain: 'ortho' as const,
  })

  let prompt: ComposeCommandPrompt = firstPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    // 已取的**全部**顶点加上光标那个候选点：攒到结束才提交，没画出来的部分对用户就是不存在的。
    preview(point) {
      if (vertices.length === 0) return null
      return { curves: [wireCurve([...vertices, point])], wire: true }
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (input.kind === 'keyword') {
        if (input.key.toUpperCase() !== 'U' || vertices.length === 0) {
          return { status: 'rejected', message: messages.expectedPoint }
        }
        vertices.pop()
        prompt = vertices.length === 0 ? firstPrompt(messages) : nextPrompt()
        const last = vertices[vertices.length - 1]
        return { status: 'prompt', prompt, preview: last ? { reference: last } : {} }
      }

      if (input.kind === 'accept') {
        /*
         * 取够两个点之前**拒绝**而不是提交：一个点的导线画不出来，也没有第二端可言。这里与
         * `PLINE` 的 `cancelled` 刻意不同——`PLINE` 的 `Enter` 在退化时放弃整条命令，而导线
         * 的 `Enter` 只是「这一条画完了」，此刻拒绝并停在原提示才说得通。
         */
        if (isDegenerateComposePolyline(vertices)) {
          return { status: 'rejected', message: messages.expectedPoint }
        }
        return {
          status: 'commit',
          effect: {
            curves: [wireCurve(vertices)],
            wire: true,
            reference: vertices[vertices.length - 1]!,
          },
        }
      }

      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      vertices.push(input.point)
      prompt = nextPrompt()
      return { status: 'prompt', prompt, preview: { reference: input.point } }
    },
  }
}

/**
 * 建立一次 ARROW 执行的状态机。
 *
 * @remarks
 * 取两个点而不是像 `LINE` 那样连着画：**一支箭头只有一个头**。走 LINE 那条逐段落地的路，
 * 画三个点会得到两支各自带头的箭头——那不是任何人点这个按钮时想要的东西。
 *
 * @public
 */
export function createStageArrowSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  return createTwoPointCurveSession(context, { arrow: true })
}

/** WIRE 命令定义。 @public */
export function createStageWireCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'WIRE',
    aliases: ['WI', 'W'],
    title: messages.wireTitle,
    category: messages.drawCategory,
    /*
     * 接线是**成批**的活儿——一张图上连二三十条，画完一条接着画下一条。判据是既有那条：
     * 用户画完之后想对它做什么。矩形画完九成是填色调圆角，因此那边不声明。
     */
    repeat: true,
    start: createStageWireSession,
  }
}

/** ARROW 命令定义。 @public */
export function createStageArrowCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'ARROW',
    aliases: ['AR', 'X'],
    title: messages.arrowTitle,
    category: messages.drawCategory,
    // 与 `WIRE` 同一条判据：箭头也是成批标注出来的。
    repeat: true,
    start: createStageArrowSession,
  }
}

/** LINE 命令定义。 @public */
export function createStageLineCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'LINE',
    aliases: ['L'],
    title: messages.lineTitle,
    category: messages.drawCategory,
    start: createStageLineSession,
  }
}

/** 创建绘图模式的命令集合。 @public */
export function createStageDraftingCommands(
  messages: StageDraftingMessages,
): readonly ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>[] {
  return [
    createStageLineCommand(messages),
    createStageWireCommand(messages),
    createStageArrowCommand(messages),
    createStageArcCommand(messages),
    createStageCircleCommand(messages),
    createStageRectangleCommand(messages),
    createStagePolygonCommand(messages),
    createStagePolylineCommand(messages),
    createStageMoveCommand(messages),
    createStageCopyCommand(messages),
    createStageEraseCommand(messages),
    createStageVertexCommand(messages),
    createStageMirrorCommand(messages),
    /*
     * 八项对齐/分布是**词**而不是面板动作：它们进词汇表，命令行因此敲得出来，也就不存在
     * 「面板里有、命令行敲不出来」的动作。
     *
     * 别名只给用户真会去敲的那几个，其余仍可用 id 键入；`AL`/`AR` 这种一眼看不出方向的
     * 两字母缩写比不给更差。
     */
    ...ALIGNMENT_COMMANDS.map(({ id, aliases, mode, title }) => createStageAlignmentCommand({
      id,
      ...(aliases ? { aliases } : {}),
      title: title(messages),
      mode,
      messages,
    })),
  ]
}

/** 八项对齐/分布的 id、别名与文案来源。 */
const ALIGNMENT_COMMANDS: readonly {
  readonly id: string
  readonly aliases?: readonly string[]
  readonly mode: StageAlignmentMode
  readonly title: (messages: StageDraftingMessages) => string
}[] = [
  { id: 'ALIGNLEFT', mode: 'left', title: (m) => m.alignLeftTitle },
  { id: 'ALIGNCENTERX', mode: 'center-x', title: (m) => m.alignCenterXTitle },
  { id: 'ALIGNRIGHT', mode: 'right', title: (m) => m.alignRightTitle },
  { id: 'ALIGNTOP', mode: 'top', title: (m) => m.alignTopTitle },
  { id: 'ALIGNCENTERY', mode: 'center-y', title: (m) => m.alignCenterYTitle },
  { id: 'ALIGNBOTTOM', mode: 'bottom', title: (m) => m.alignBottomTitle },
  { id: 'DISTRIBUTEX', aliases: ['DX'], mode: 'distribute-x', title: (m) => m.distributeXTitle },
  { id: 'DISTRIBUTEY', aliases: ['DY'], mode: 'distribute-y', title: (m) => m.distributeYTitle },
]
