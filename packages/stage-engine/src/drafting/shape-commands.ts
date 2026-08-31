import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPointFields,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import {
  composeArcThroughPoints,
  composeRegularPolygonVertices,
  createComposeLineCurve,
  isDegenerateComposePolyline,
} from '@compose-ui/core'
import type { ComposeCurve, ComposeRegularPolygonFit } from '@compose-ui/core'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

/**
 * 一步取点的提示。
 *
 * @remarks
 * `fields` 默认 `absolute`：没有上一个点时唯一能读出来的量就是世界坐标。取过点之后的步骤
 * 各自传自己的参数化——`RECTANGLE` 的对角点是 `cartesian`（两条边长才是矩形的自然量纲），
 * 其余是 `polar`。
 */
function pointPrompt(
  message: string,
  keywords?: readonly { readonly key: string; readonly label: string }[],
  fields: ComposeCommandPointFields = 'absolute',
  measured = false,
): ComposeCommandPrompt {
  return {
    message,
    accepts: ['point'],
    fields,
    ...(measured ? { measured: true } : {}),
    ...(keywords ? { keywords } : {}),
  }
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

/**
 * 两个对角点确定的闭合四顶点多段线；提交与预览共用。
 *
 * @remarks
 * 顶点从左上角起顺时针。两个角点谁在左上由用户往哪个方向拖决定，而矩形的表示只有一种——
 * 归一化成同一个绕向之后，往哪个方向拖出来的矩形，顶点顺序都一样。
 */
function rectangleCurve(
  corner: ComposeCommandPoint,
  opposite: ComposeCommandPoint,
): ComposeCurve {
  const left = Math.min(corner.x, opposite.x)
  const right = Math.max(corner.x, opposite.x)
  const top = Math.min(corner.y, opposite.y)
  const bottom = Math.max(corner.y, opposite.y)
  return {
    kind: 'polyline',
    vertices: [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
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
        prompt = pointPrompt(messages.specifyThroughPoint, undefined, 'polar')
        return { status: 'prompt', prompt, preview: { reference: input.point } }
      }
      if (picked.length === 2) {
        /*
         * 端点步打开 `measured`：这一步的预览换成了弧，而被量的那一段（途经点 → 落点）
         * 不在弧上。途经点步不打开——那一步的预览**就是**那条直线。
         */
        prompt = pointPrompt(messages.specifyEndPoint, undefined, 'polar', true)
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
 * 半径步是**单字段**（`radius`）：圆是旋转对称的，半径点的角度对结果没有任何影响，而一个
 * 永远不影响结果的只读字段比没有更差。它同时打开 `measured`——预览是整圆，半径线不在里面。
 *
 * `D` / `R` 在半径与直径之间切换。**切换只作用于本次会话**：AutoCAD 记住上一次的选择，代价
 * 是这条命令有了一份看不见的状态——用户过两天回来，同一条命令问的问题变了，而屏幕上没有
 * 任何东西解释为什么。
 *
 * @public
 */
export function createStageCircleSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let center: ComposeCommandPoint | null = null
  /** 这一档在问半径还是直径；提示、参数化与关键字三样一起跟着它换。 */
  let diameter = false
  let prompt = pointPrompt(messages.specifyCenter)

  /*
   * 只列出**能切过去的**那一个：列一个按下去只会把当前状态再确认一遍的关键字，等于给用户
   * 一个没有效果的选项。
   */
  const radiusPrompt = () => (diameter
    ? pointPrompt(
      messages.specifyDiameter,
      [{ key: 'R', label: messages.radiusKeyword }],
      'diameter',
      true,
    )
    : pointPrompt(
      messages.specifyRadius,
      [{ key: 'D', label: messages.diameterKeyword }],
      'radius',
      true,
    ))

  const circleAt = (point: ComposeCommandPoint, radius: number): StageDraftingEffect => ({
    curves: [{
      kind: 'arc',
      center: { x: point.x, y: point.y },
      radius,
      startAngle: 0,
      sweep: 360,
    }],
  })

  return {
    get prompt() {
      return prompt
    },
    preview(point) {
      if (center === null) return null
      const radius = Math.hypot(point.x - center.x, point.y - center.y)
      // 半径为零画不出东西；那一帧不画，与它被 `rejected` 拦下是同一个判断。
      if (!(radius > 0)) return null
      return circleAt(center, radius)
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel' || input.kind === 'accept') return { status: 'cancelled' }

      if (input.kind === 'keyword') {
        const key = input.key.toUpperCase()
        // 圆心还没取时无档可切：那一步问的是位置，直径与半径都还无从谈起。
        if (center === null || (key !== 'D' && key !== 'R')) {
          return { status: 'rejected', message: messages.expectedPoint }
        }
        diameter = key === 'D'
        prompt = radiusPrompt()
        return { status: 'prompt', prompt, preview: { reference: center } }
      }

      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (center === null) {
        center = input.point
        prompt = radiusPrompt()
        return { status: 'prompt', prompt, preview: { reference: center } }
      }
      const radius = Math.hypot(input.point.x - center.x, input.point.y - center.y)
      // 半径为零的圆是点不中也删不掉的幽灵；命令层拦一次，用户当场得到答案。两档共用这一条。
      if (!(radius > 0)) return { status: 'rejected', message: messages.degenerateShape }
      return { status: 'commit', effect: circleAt(center, radius) }
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
 * 它曾经产出**矩形物料**（一个带完整 `Appearance` 的盒），判据是「用户画完之后想对它做什么」
 * ——答案取的是填色、调圆角、往里塞东西。那个答案对大屏底板成立，对接线图不成立：这里画的是
 * 设备外框与分区框，画完之后想做的是**改形状**（把某个角对到导线端点上、把某条边整体挪一格），
 * 而这三件事只有 `Curve` 做得到。代价还不对称——盒填了色，盖在符号上就把它遮住了。
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
      return corner === null
        ? null
        : { curves: [rectangleCurve(corner, point)], rectangle: true }
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel' || input.kind === 'accept') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (corner === null) {
        corner = input.point
        prompt = pointPrompt(messages.specifyOppositeCorner, undefined, 'cartesian')
        return { status: 'prompt', prompt, preview: { reference: corner } }
      }
      const { x, y } = input.point
      if (x === corner.x || y === corner.y) {
        // 退化成一条线或一个点：矩形的两个对角点必须在两个轴上都分开。
        return { status: 'rejected', message: messages.degenerateShape }
      }
      return {
        status: 'commit',
        effect: { curves: [rectangleCurve(corner, input.point)], rectangle: true },
      }
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
  const closeKeyword = { key: 'C', label: messages.closeKeyword }
  let prompt = pointPrompt(messages.specifyFirstPoint)

  /** 够得着闭合：三个顶点才围得出一块面积，两个顶点闭合等于把那一段画两遍。 */
  const closable = () => vertices.length > 2

  const nextPrompt = () => pointPrompt(
    messages.specifyNextPoint,
    vertices.length > 1
      ? (closable() ? [closeKeyword, undoKeyword] : [undoKeyword])
      : undefined,
    'polar',
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
        const key = input.key.toUpperCase()
        /*
         * 闭合置位并提交，之后不再等下一个点——闭合本身就是结束信号。
         *
         * 退化判定不因为走了 `C` 而绕过：顶点全部重合时闭合出来的仍是屏幕上看不见的幽灵。
         */
        if (key === 'C' && closable()) {
          if (isDegenerateComposePolyline(vertices)) return { status: 'cancelled' }
          return {
            status: 'commit',
            effect: {
              curves: [{
                kind: 'polyline',
                vertices: vertices.map(({ x, y }) => ({ x, y })),
                closed: true,
              }],
            },
          }
        }
        if (key !== 'U') {
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

/** `POLYGON` 边数的下界，照抄 AutoCAD。 @public */
export const COMPOSE_POLYGON_MIN_SIDES = 3

/**
 * `POLYGON` 边数的上界，照抄 AutoCAD。
 *
 * @remarks
 * 不因为「1024 个顶点在几何编辑里是 2048 个夹点」另设一个更小的值：`PLINE` 今天就画得出同样
 * 多的顶点，多边形不是这个问题的来源。用户键入 2000 时看到的界限也应当与他在别处学到的一致。
 *
 * @public
 */
export const COMPOSE_POLYGON_MAX_SIDES = 1024

/**
 * `POLYGON` 的起始边数。
 *
 * @remarks
 * AutoCAD 取 4，这里取 6：四边形有 `RECTANGLE` 这个更快的入口，走这条命令的多半是六边、三边。
 * 第一次之后默认就跟着用户走了。
 *
 * @public
 */
export const COMPOSE_POLYGON_DEFAULT_SIDES = 6

/**
 * 边数、中心与内接/外切圆的半径点画正多边形。
 *
 * @remarks
 * 产出闭合多段线——正多边形不另立 kind，它唯一多出来的「各边等长」在用户拖动任一顶点之后就
 * 不再成立，与「矩形是四顶点的闭合多段线」是同一条判断。
 *
 * **内接与外切不单独占一步**，而是**边数步上的一个档位**：它和边数一起问、一起印在光标旁
 * （`cursorInput.toggle`，宿主画成胶囊、`Tab` 换它），然后这条命令就不再提这件事——中心步
 * 与半径步既不显示也不受理 `I` / `C`。
 *
 * 代价说在明处：**拿主意的时候屏幕上还没有形状**，这正是 AutoCAD 那个做法被诟病的地方。
 * 补偿有两条——它不是一道拦路的问题（已经有值，直接确认就走），而且档位**跨命令记住**，
 * 选错重来一次只需按一下 `Tab`。
 *
 * **后两步 MUST 收干净**：没有胶囊、命令行不列 `I` / `C`、按下去也不受理。半个残留比全留或
 * 全删都糟——一个还印着却按不动的读数，用户按一下没反应，会以为这条能力根本不存在；而列不
 * 出来却仍然受理，等于留一条只有读过源码的人才知道的暗门。
 *
 * **边数步同时收点**：点一下即取用当前边数与当前档位，**并且那一下就是中心点**。十字光标
 * 在这一步是画着的，而「点下去什么都不会发生」是屏幕上不该出现的状态。键盘走另一条路——
 * 这一步没有参考点，直接距离输入无从谈起，因此裸数字一律是边数，两条通道不会撞车。
 *
 * **`+` / `-` 在每一步都可用**，各增减一条边。它们是滚轮的落点：滚轮增减 MUST NOT 推进状态机
 * （那正是 `preview` 被做成查询而不是输入的理由），而关键字本来就是「改变后续流程但不取点」
 * 的那一档。列进 `keywords` 是因为滚轮是个不可发现的手势，而命令行是这条能力唯一的说明书。
 * 每一步都可用则让规则没有例外——只在其中一步生效的话，用户在别的步上试一下没反应，会以为
 * 这条能力不存在。
 *
 * @public
 */
export function createStagePolygonSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  /** 三步各自要什么，`accept` 与点输入的含义都跟着它分派。 */
  let step: 'sides' | 'center' | 'radius' = 'sides'
  let sides = clampPolygonSides(context.polygonSides ?? COMPOSE_POLYGON_DEFAULT_SIDES)
  let center: ComposeCommandPoint | null = null
  /** 这一档以内接圆还是外切圆为准；只在边数步可换，此后一路跟到提交。 */
  let fit: ComposeRegularPolygonFit = context.polygonFit ?? 'inscribed'

  const sidesKeywords = [
    { key: '+', label: messages.moreSidesKeyword },
    { key: '-', label: messages.fewerSidesKeyword },
  ]

  /*
   * 只列出**能切过去的**那一个：列一个按下去只会把当前状态再确认一遍的关键字，等于给用户
   * 一个没有效果的选项。胶囊上的文案与它分开——那个说的是**此刻**是哪一档。
   */
  const fitKeyword = () => (fit === 'inscribed'
    ? { key: 'C', label: messages.circumscribedKeyword }
    : { key: 'I', label: messages.inscribedKeyword })

  const sidesPrompt = (): ComposeCommandPrompt => ({
    message: messages.specifySides(sides),
    accepts: ['text', 'keyword', 'point'],
    keywords: [fitKeyword(), ...sidesKeywords],
    cursorInput: {
      value: String(sides),
      toggle: {
        value: fit === 'inscribed' ? messages.inscribedChip : messages.circumscribedChip,
        keyword: fitKeyword().key,
      },
    },
  })

  const centerPrompt = (): ComposeCommandPrompt => ({
    message: messages.specifyPolygonCenter(sides),
    accepts: ['point', 'keyword'],
    keywords: sidesKeywords,
    fields: 'absolute',
  })

  /* 两档的 `fields` 都是 `radius`——换的是量哪个圆，不是量什么，而这一步已经不能换了。 */
  const radiusPrompt = (): ComposeCommandPrompt => ({
    message: fit === 'inscribed'
      ? messages.specifyInscribedRadius(sides)
      : messages.specifyCircumscribedRadius(sides),
    accepts: ['point', 'keyword'],
    keywords: sidesKeywords,
    fields: 'radius',
    measured: true,
  })

  const promptForStep = () => {
    if (step === 'sides') return sidesPrompt()
    return step === 'center' ? centerPrompt() : radiusPrompt()
  }

  let prompt = sidesPrompt()

  const polygonAt = (point: ComposeCommandPoint): StageDraftingEffect | null => {
    if (center === null) return null
    const vertices = composeRegularPolygonVertices(center, point, sides, fit)
    if (!vertices) return null
    return {
      curves: [{
        kind: 'polyline',
        vertices: vertices.map(({ x, y }) => ({ x, y })),
        closed: true,
      }],
    }
  }

  return {
    get prompt() {
      return prompt
    },
    /*
     * 只有半径步画得出形状：在那之前连中心都还没有，没有「落在这里会是什么样」可言。
     * 半径为零的那一帧不画，与它被 `rejected` 拦下是同一个判断。
     */
    preview(point) {
      return step === 'radius' ? polygonAt(point) : null
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (input.kind === 'accept') {
        // 边数步的确认取用尖括号里的默认值——那正是把它印出来的理由。其余两步没有可省的输入。
        if (step !== 'sides') return { status: 'cancelled' }
        step = 'center'
        prompt = centerPrompt()
        return { status: 'prompt', prompt }
      }

      if (input.kind === 'keyword') {
        const key = input.key.toUpperCase()
        if (key === '+' || key === '-') {
          const next = clampPolygonSides(sides + (key === '+' ? 1 : -1))
          // 到边界停住：没有真的变化时不回调，宿主那份默认值也就不会被写一遍。
          if (next !== sides) {
            sides = next
            context.onPolygonSidesChange?.(sides)
          }
          prompt = promptForStep()
          return {
            status: 'prompt',
            prompt,
            ...(center ? { preview: { reference: center } } : {}),
          }
        }
        /*
         * 档位只在边数步可换。后两步 MUST 一并**不受理**——列不出来却仍然接受，等于留一条
         * 只有读过源码的人才知道的暗门，而它与「命令行是这条能力唯一的说明书」直接冲突。
         */
        if (step === 'sides' && (key === 'I' || key === 'C')) {
          const next: ComposeRegularPolygonFit = key === 'I' ? 'inscribed' : 'circumscribed'
          if (next !== fit) {
            fit = next
            context.onPolygonFitChange?.(fit)
          }
          prompt = sidesPrompt()
          return { status: 'prompt', prompt }
        }
        return { status: 'rejected', message: messages.expectedPoint }
      }

      if (input.kind === 'text') {
        if (step !== 'sides') return { status: 'rejected', message: messages.expectedPoint }
        const typed = Number(input.text.trim())
        if (
          !Number.isInteger(typed)
          || typed < COMPOSE_POLYGON_MIN_SIDES
          || typed > COMPOSE_POLYGON_MAX_SIDES
        ) {
          return {
            status: 'rejected',
            message: messages.invalidSides(COMPOSE_POLYGON_MIN_SIDES, COMPOSE_POLYGON_MAX_SIDES),
          }
        }
        if (typed !== sides) {
          sides = typed
          context.onPolygonSidesChange?.(sides)
        }
        step = 'center'
        prompt = centerPrompt()
        return { status: 'prompt', prompt }
      }

      if (input.kind !== 'point') {
        return { status: 'rejected', message: messages.expectedPoint }
      }

      /*
       * 边数步也收点：取用当前边数与当前档位，**并且这一下就是中心点**。十字光标在这一步是
       * 画着的，让它真的能落点比把它画成装饰要好——「鼠标动了也没反应」是屏幕上不该出现的
       * 状态。因此两步汇到同一支。
       */
      if (step === 'sides' || step === 'center') {
        center = input.point
        step = 'radius'
        prompt = radiusPrompt()
        return { status: 'prompt', prompt, preview: { reference: center } }
      }

      const effect = polygonAt(input.point)
      // 落点与中心重合时画不出东西；两档共用这一条退化判定，与 `CIRCLE` 一致。
      if (!effect) return { status: 'rejected', message: messages.degenerateShape }
      return { status: 'commit', effect }
    },
  }
}

/** 把边数夹回合法区间；到边界停住而不回绕——回绕会让一次连续滚动从 3 跳到 1024。 */
function clampPolygonSides(sides: number) {
  if (!Number.isFinite(sides)) return COMPOSE_POLYGON_DEFAULT_SIDES
  return Math.min(COMPOSE_POLYGON_MAX_SIDES, Math.max(COMPOSE_POLYGON_MIN_SIDES, Math.round(sides)))
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
    aliases: ['REC', 'R'],
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
    aliases: ['PL', 'P'],
    title: messages.polylineTitle,
    category: messages.drawCategory,
    start: createStagePolylineSession,
  }
}

/** POLYGON 命令定义。 @public */
export function createStagePolygonCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'POLYGON',
    aliases: ['POL'],
    title: messages.polygonTitle,
    category: messages.drawCategory,
    start: createStagePolygonSession,
  }
}
