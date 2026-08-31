import { isComposeSingleFieldKind as isSingleField } from '@compose-ui/core'
import type { ComposePointFieldKind } from '@compose-ui/core'
import type { StagePoint } from '@compose-ui/stage-engine'

/**
 * 数值框的**字体与每字前进宽度是一对常量**。
 *
 * @remarks
 * SVG 里量不到文本宽度而不做一次布局，因此框宽按字符数估算。改了字号而没改前进宽度，症状是
 * 标注断开的缺口与框对不齐——两个常量必须一起改，所以写在一起。
 */
export const DYNAMIC_INPUT_FONT_SIZE = 13
/** 13px IBM Plex Mono 的单字前进宽度。 */
export const DYNAMIC_INPUT_CHAR_WIDTH = 7.82

/** 数值框高度。 */
export const DYNAMIC_INPUT_BOX_HEIGHT = 24
/** 框内左右留白。 */
const BOX_PADDING = 11
/** 锁标记或光标条占的宽度，含它与数字之间的间隔。 */
const ADORNMENT_WIDTH = 18
/** 标注线与它所量的那条边之间的垂直距离。 */
const ANNOTATION_OFFSET = 44
/** 标注在框后断开时，缺口比框每侧多留的距离。 */
const BREAK_PADDING = 8

/**
 * 中日韩等**全角**字符：这一族的前进宽度约等于字号，而不是 {@link DYNAMIC_INPUT_CHAR_WIDTH}。
 *
 * @remarks
 * 框宽按字符数估算（SVG 里量不到文本宽度而不做一次布局），而那个常量是**拉丁字**的前进
 * 宽度。档位胶囊里印的是「内接」这样的词，一律按拉丁宽算下来短了近一半，症状是文字被框边
 * 压住。
 */
const WIDE_CHAR =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/

/** 一段文本的前进宽度；全角按字号算，其余按拉丁前进宽度算。 */
function textAdvance(text: string) {
  let advance = 0
  for (const char of text) {
    advance += WIDE_CHAR.test(char) ? DYNAMIC_INPUT_FONT_SIZE : DYNAMIC_INPUT_CHAR_WIDTH
  }
  return advance
}

/**
 * 一个数值框此刻的状态。
 *
 * @remarks
 * `ghost` 是「框里印的是默认值，用户还没有键入过」：它与 `active` 一样在等键入（因此同样
 * 出光标条、同样是强调色的边），只是文字要淡下去——「这个数是我给的」与「这个数是默认的」
 * 在屏幕上必须一眼可分，否则用户读不出直接确认会得到什么。
 */
export type StageDynamicInputBoxState = 'active' | 'idle' | 'locked' | 'ghost'

/**
 * 框尾的标记。
 *
 * @remarks
 * 由状态派生而不是各处自己判断：`locked` 挂锁、`active` 挂光标条、`idle` 什么都不挂。
 * 它同时决定框宽，因此**求宽与画标记读的必须是同一个值**——各判一次的症状是数字被标记压住。
 */
export type StageDynamicInputAdornment = 'lock' | 'caret' | 'swap' | null

/**
 * 状态到框尾标记的映射；唯一实现。
 *
 * @remarks
 * `swap` 不在这张表里：它属于**档位胶囊**，而胶囊没有状态可言——它永远在等 `Tab`。由
 * {@link resolveStageDynamicInputPrompt} 直接给出。
 */
export function dynamicInputAdornment(
  state: StageDynamicInputBoxState,
): StageDynamicInputAdornment {
  if (state === 'locked') return 'lock'
  return state === 'active' || state === 'ghost' ? 'caret' : null
}

/**
 * 一个框画成什么。
 *
 * @remarks
 * **方框是能打字的，胶囊不是。**档位是二选一、不是能键入的数，做成第三个方框会让 `Tab`
 * 把焦点带到一个打不了字的地方。形状先分开、颜色再分开——这是这块画布的既有规矩，两个
 * 控件长得一样而按下去做的事不同，是最难自己发现的一类缺陷。
 */
export type StageDynamicInputBoxVariant = 'value' | 'chip'

/** 一个已定位的数值框，屏幕坐标。 */
export interface StageDynamicInputBox {
  readonly index: 0 | 1
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** 框里的数字；活动字段正在被键入时是那段文本。 */
  readonly text: string
  /** `X` / `Y` 这类前缀；只有绝对坐标有。 */
  readonly prefix?: string
  readonly state: StageDynamicInputBoxState
  /** 框尾标记；数值框由 `state` 派生，胶囊恒为 `swap`。已计入 `width`。 */
  readonly adornment: StageDynamicInputAdornment
  /** 画成方框还是胶囊。 */
  readonly variant: StageDynamicInputBoxVariant
}

/** 一次动态输入的完整呈现，全部屏幕坐标。 */
export interface StageDynamicInputAnnotation {
  readonly boxes: readonly StageDynamicInputBox[]
  /** 标注线与弧，已在各自的框后断开。 */
  readonly guides: readonly string[]
  /** 标注末端的小点。 */
  readonly ticks: readonly StagePoint[]
  /** 锁定示意：锁死长度画一个圆、锁死宽或高画一条直线。 */
  readonly locks: readonly string[]
  /**
   * 候选落点到光标的连线；两者重合时为 `null`。
   *
   * @remarks
   * 正在键入时几何停在键入的值上，而光标还在动——屏幕上需要有一句话说明这件事。它比锁定
   * 示意更弱：锁定画的是**约束的形状**（落点还能在那个圆上滑动），这里落点已经完全确定，
   * 只需要把两个点接起来。
   */
  readonly connector: string | null
  /**
   * 被量的那一段；提示没有要求画时为 `null`。
   *
   * @remarks
   * 不画它，标注的两条延伸线就从空处伸出来——用户读不出这个数说的是什么。由**提示**声明而
   * 不由这里推导：只有命令知道自己的预览几何里含不含这一段。
   */
  readonly measured: string | null
}

/** 求解过程里还没接上连线的那一份；连线由 {@link resolveStageDynamicInput} 统一补。 */
type PositionedAnnotation = Omit<StageDynamicInputAnnotation, 'connector' | 'measured'>

/** 一个字段的呈现输入。 */
export interface StageDynamicInputField {
  readonly text: string
  readonly state: StageDynamicInputBoxState
}

/** 求解一次动态输入呈现所需的全部输入。 */
export interface StageDynamicInputRequest {
  readonly kind: ComposePointFieldKind
  /** 原点的屏幕坐标；`absolute` 时缺席。 */
  readonly origin: StagePoint | null
  /** 落点的屏幕坐标——解算之后的那个，不是裸指针。 */
  readonly point: StagePoint
  readonly first: StageDynamicInputField
  readonly second: StageDynamicInputField
  /**
   * 光标此刻的屏幕坐标；与 `point` 不等时画一条连线把两者接起来。
   *
   * @remarks
   * 只有正在键入时两者才会分开——锁定已经算进 `point` 里了。缺席即不画。
   */
  readonly cursor?: StagePoint | null
  /** 要不要画出被量的那一段；由提示的 `measured` 透传。 */
  readonly measured?: boolean
}

/** 按字符数估算框宽；框尾标记占的位置一并算进去。 */
export function dynamicInputBoxWidth(
  text: string,
  prefix?: string,
  adornment: StageDynamicInputAdornment = null,
) {
  // 前缀与数字之间留一个拉丁字的间隔，与既有画法一致（前缀画在左侧固定位置上）。
  const advance = textAdvance(text)
    + (prefix ? textAdvance(prefix) + DYNAMIC_INPUT_CHAR_WIDTH : 0)
  return Math.max(34, Math.round(advance) + BOX_PADDING * 2)
    + (adornment ? ADORNMENT_WIDTH : 0)
}

function box(
  index: 0 | 1,
  center: StagePoint,
  field: StageDynamicInputField,
  prefix?: string,
): StageDynamicInputBox {
  const adornment = dynamicInputAdornment(field.state)
  const width = dynamicInputBoxWidth(field.text, prefix, adornment)
  return {
    index,
    x: center.x - width / 2,
    y: center.y - DYNAMIC_INPUT_BOX_HEIGHT / 2,
    width,
    height: DYNAMIC_INPUT_BOX_HEIGHT,
    text: field.text,
    ...(prefix ? { prefix } : {}),
    state: field.state,
    adornment,
    variant: 'value',
  }
}

/**
 * 一条直线标注，在中点的框后断开。
 *
 * @remarks
 * 缺口本身就在说「这个数说的是这条标注」，因此框里只有数字，不放图标。
 *
 * **标注短于框宽时不断开**，框改到标注的外侧——否则框会把整条标注吃掉。
 */
function segmentGuides(
  from: StagePoint,
  to: StagePoint,
  boxWidth: number,
): { readonly guides: readonly string[]; readonly center: StagePoint } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const gap = boxWidth / 2 + BREAK_PADDING
  if (length < gap * 2) {
    // 退化：整条画满，框推到标注外侧的法线方向上。
    const nx = length === 0 ? 0 : -dy / length
    const ny = length === 0 ? -1 : dx / length
    const push = DYNAMIC_INPUT_BOX_HEIGHT / 2 + 10
    return {
      guides: [`M${from.x} ${from.y}L${to.x} ${to.y}`],
      center: { x: mid.x + nx * push, y: mid.y + ny * push },
    }
  }
  const ux = dx / length
  const uy = dy / length
  const a = { x: mid.x - ux * gap, y: mid.y - uy * gap }
  const b = { x: mid.x + ux * gap, y: mid.y + uy * gap }
  return {
    guides: [`M${from.x} ${from.y}L${a.x} ${a.y}`, `M${b.x} ${b.y}L${to.x} ${to.y}`],
    center: mid,
  }
}

/** 极坐标：一条平行标注线 + 一段半径等于当前长度的角度弧。 */
function polarAnnotation(
  request: StageDynamicInputRequest,
  origin: StagePoint,
): PositionedAnnotation {
  const { point } = request
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const length = Math.hypot(dx, dy)
  const guides: string[] = []
  const ticks: StagePoint[] = []

  // —— 长度：与预览线平行、垂直偏移；两端各一条延伸线。
  const ux = length === 0 ? 1 : dx / length
  const uy = length === 0 ? 0 : dy / length
  // 法线取「离原点更远的那一侧」的反向没有意义，固定取左法线：标注恒在同一侧，读起来稳定。
  const nx = -uy
  const ny = ux
  const offFrom = { x: origin.x + nx * ANNOTATION_OFFSET, y: origin.y + ny * ANNOTATION_OFFSET }
  const offTo = { x: point.x + nx * ANNOTATION_OFFSET, y: point.y + ny * ANNOTATION_OFFSET }
  guides.push(`M${origin.x} ${origin.y}L${offFrom.x} ${offFrom.y}`)
  guides.push(`M${point.x} ${point.y}L${offTo.x} ${offTo.y}`)
  ticks.push(offFrom, offTo)

  const firstWidth = dynamicInputBoxWidth(
    request.first.text, undefined, dynamicInputAdornment(request.first.state),
  )
  const lengthLine = segmentGuides(offFrom, offTo, firstWidth)
  guides.push(...lengthLine.guides)

  // —— 角度：0° 参考射线 + 半径等于当前长度的弧。
  //
  // 半径跟着长度走是关键：固定的小半径在小角度下退化成几个像素，等于没画。
  const rayEnd = { x: origin.x + length, y: origin.y }
  guides.push(`M${origin.x} ${origin.y}L${rayEnd.x} ${rayEnd.y}`)
  const secondWidth = dynamicInputBoxWidth(
    request.second.text, undefined, dynamicInputAdornment(request.second.state),
  )
  // 屏幕坐标里 y 向下，`atan2(dy, dx)` 因此就是屏幕上的转角；扫掠取它的一半定位数值框。
  const sweep = Math.atan2(dy, dx)
  const half = sweep / 2
  const arcMid = {
    x: origin.x + length * Math.cos(half),
    y: origin.y + length * Math.sin(half),
  }
  const arcLength = Math.abs(sweep) * length
  const gap = secondWidth / 2 + BREAK_PADDING
  if (length > 0 && arcLength >= gap * 2) {
    const delta = gap / length
    const a = half - Math.sign(sweep || 1) * delta
    const b = half + Math.sign(sweep || 1) * delta
    const at = (angle: number) => ({
      x: origin.x + length * Math.cos(angle),
      y: origin.y + length * Math.sin(angle),
    })
    const p0 = rayEnd
    const p1 = at(a)
    const p2 = at(b)
    const p3 = { x: point.x, y: point.y }
    const flag = sweep >= 0 ? 1 : 0
    guides.push(`M${p0.x} ${p0.y}A${length} ${length} 0 0 ${flag} ${p1.x} ${p1.y}`)
    guides.push(`M${p2.x} ${p2.y}A${length} ${length} 0 0 ${flag} ${p3.x} ${p3.y}`)
    return {
      boxes: [box(0, lengthLine.center, request.first), box(1, arcMid, request.second)],
      guides,
      ticks,
      locks: lockGuides(request, origin),
    }
  }
  // 短弧退化：整条画满，框推到弧的径向外侧。
  if (length > 0) {
    const flag = sweep >= 0 ? 1 : 0
    guides.push(
      `M${rayEnd.x} ${rayEnd.y}A${length} ${length} 0 0 ${flag} ${point.x} ${point.y}`,
    )
  }
  const push = length + DYNAMIC_INPUT_BOX_HEIGHT / 2 + 12
  const outside = {
    x: origin.x + push * Math.cos(half),
    y: origin.y + push * Math.sin(half),
  }
  return {
    boxes: [box(0, lengthLine.center, request.first), box(1, outside, request.second)],
    guides,
    ticks,
    locks: lockGuides(request, origin),
  }
}

/** 锁定示意：长度锁死画一个圆，宽或高锁死画一条直线。 */
function lockGuides(
  request: StageDynamicInputRequest,
  origin: StagePoint,
): readonly string[] {
  const locks: string[] = []
  if (request.kind === 'polar' && request.first.state === 'locked') {
    const r = Math.hypot(request.point.x - origin.x, request.point.y - origin.y)
    if (r > 0) {
      locks.push(
        `M${origin.x - r} ${origin.y}A${r} ${r} 0 1 0 ${origin.x + r} ${origin.y}`
        + `A${r} ${r} 0 1 0 ${origin.x - r} ${origin.y}`,
      )
    }
  }
  if (request.kind === 'cartesian') {
    const span = Math.max(
      Math.abs(request.point.x - origin.x),
      Math.abs(request.point.y - origin.y),
    ) + ANNOTATION_OFFSET + 20
    if (request.first.state === 'locked') {
      locks.push(`M${request.point.x} ${origin.y - span}V${origin.y + span}`)
    }
    if (request.second.state === 'locked') {
      locks.push(`M${origin.x - span} ${request.point.y}H${origin.x + span}`)
    }
  }
  return locks
}

/**
 * 直角坐标：宽与高两条边长标注，**摆在靠近光标的那两条边外侧**。
 *
 * @remarks
 * 永远摆在上边和右边实现最简单，但从右上往左下拖时标注会跑到图形另一头，视线要在光标与标注
 * 之间来回跳。跟着光标那两条边走，代价只是一次符号判断。
 *
 * 不画角度弧：矩形轴对齐，角度恒为 0，画一条永远指向 0° 的弧是噪音。
 */
function cartesianAnnotation(
  request: StageDynamicInputRequest,
  origin: StagePoint,
): PositionedAnnotation {
  const { point } = request
  const left = Math.min(origin.x, point.x)
  const right = Math.max(origin.x, point.x)
  const top = Math.min(origin.y, point.y)
  const bottom = Math.max(origin.y, point.y)
  // 光标所在的那条水平边与竖直边。
  const widthEdgeY = point.y <= origin.y ? top : bottom
  const heightEdgeX = point.x >= origin.x ? right : left
  const widthLineY = point.y <= origin.y ? top - ANNOTATION_OFFSET : bottom + ANNOTATION_OFFSET
  const heightLineX = point.x >= origin.x
    ? right + ANNOTATION_OFFSET
    : left - ANNOTATION_OFFSET

  const guides: string[] = [
    `M${left} ${widthEdgeY}V${widthLineY}`,
    `M${right} ${widthEdgeY}V${widthLineY}`,
    `M${heightEdgeX} ${top}H${heightLineX}`,
    `M${heightEdgeX} ${bottom}H${heightLineX}`,
  ]
  const ticks: StagePoint[] = [
    { x: left, y: widthLineY }, { x: right, y: widthLineY },
    { x: heightLineX, y: top }, { x: heightLineX, y: bottom },
  ]

  const widthLine = segmentGuides(
    { x: left, y: widthLineY }, { x: right, y: widthLineY },
    dynamicInputBoxWidth(
      request.first.text, undefined, dynamicInputAdornment(request.first.state),
    ),
  )
  const heightLine = segmentGuides(
    { x: heightLineX, y: top }, { x: heightLineX, y: bottom },
    // 竖直标注的缺口按框高留，不按框宽——框是横着的。
    DYNAMIC_INPUT_BOX_HEIGHT,
  )
  guides.push(...widthLine.guides, ...heightLine.guides)

  return {
    boxes: [box(0, widthLine.center, request.first), box(1, heightLine.center, request.second)],
    guides,
    ticks,
    locks: lockGuides(request, origin),
  }
}

/**
 * 被量的那一段从哪里出发。
 *
 * @remarks
 * `diameter` 从落点关于圆心的**对径点**出发——同一个框换一个量，标注线跟着换，用户一眼看出
 * 自己在打哪个数。标注几何与被量的那一段读同一个函数，因此不可能一个跨整条直径、另一个只画
 * 半条。
 */
function measuredFrom(
  kind: ComposePointFieldKind,
  origin: StagePoint,
  point: StagePoint,
): StagePoint {
  if (kind !== 'diameter') return origin
  return { x: origin.x * 2 - point.x, y: origin.y * 2 - point.y }
}

/**
 * 单字段（半径 / 直径）：一条平行偏移的标注线，不画角度弧。
 *
 * @remarks
 * 圆是旋转对称的，半径点的角度对结果没有任何影响——画一条永远读不出信息的弧是噪音。这与
 * 「`cartesian` 不画角度弧」是同一条判据的第三次应用：**这个数影响结果吗**。
 */
function singleFieldAnnotation(
  request: StageDynamicInputRequest,
  origin: StagePoint,
): PositionedAnnotation {
  const { point } = request
  const from = measuredFrom(request.kind, origin, point)
  const dx = point.x - from.x
  const dy = point.y - from.y
  const length = Math.hypot(dx, dy)
  const ux = length === 0 ? 1 : dx / length
  const uy = length === 0 ? 0 : dy / length
  // 与极坐标的长度标注取同一条左法线：标注恒在同一侧，读起来稳定。
  const offFrom = { x: from.x - uy * ANNOTATION_OFFSET, y: from.y + ux * ANNOTATION_OFFSET }
  const offTo = { x: point.x - uy * ANNOTATION_OFFSET, y: point.y + ux * ANNOTATION_OFFSET }
  const prefix = request.kind === 'diameter' ? '\u2300' : undefined
  const width = dynamicInputBoxWidth(
    request.first.text, prefix, dynamicInputAdornment(request.first.state),
  )
  const line = segmentGuides(offFrom, offTo, width)
  return {
    boxes: [box(0, line.center, request.first, prefix)],
    guides: [
      `M${from.x} ${from.y}L${offFrom.x} ${offFrom.y}`,
      `M${point.x} ${point.y}L${offTo.x} ${offTo.y}`,
      ...line.guides,
    ],
    ticks: [offFrom, offTo],
    // 单字段没有锁定这一档：锁定是 `Tab` 的产物，而 `Tab` 在只有一个字段时没有去处。
    locks: [],
  }
}

/** 光标右下角并排两个框；这一步没有上一个点，量不出任何标注。 */
function absoluteAnnotation(request: StageDynamicInputRequest): PositionedAnnotation {
  const { point } = request
  const gap = 6
  const firstWidth = dynamicInputBoxWidth(
    request.first.text, 'X', dynamicInputAdornment(request.first.state),
  )
  const secondWidth = dynamicInputBoxWidth(
    request.second.text, 'Y', dynamicInputAdornment(request.second.state),
  )
  const y = point.y + 18 + DYNAMIC_INPUT_BOX_HEIGHT / 2
  const firstCenter = { x: point.x + 18 + firstWidth / 2, y }
  const secondCenter = { x: firstCenter.x + firstWidth / 2 + gap + secondWidth / 2, y }
  return {
    boxes: [
      box(0, firstCenter, request.first, 'X'),
      box(1, secondCenter, request.second, 'Y'),
    ],
    guides: [],
    ticks: [],
    locks: [],
  }
}

/**
 * 这一步印在光标旁的东西：一个数值框，可选地跟一枚档位胶囊。
 *
 * @remarks
 * **`fields` 说的是「这一步的点怎么参数化」，而这一步要的不是点**（`POLYGON` 的第一步要的
 * 是一个数加一个二选一），因此走不了上面那条路。它仍然需要被看见——命令行在图面底部，用户
 * 的眼睛此刻在光标上，「敲一个数」这句话说在他没有在看的地方等于没说。
 *
 * 只渲染，不接输入：输入端只有命令行一个（把框做成真的 `<input>` 会撞上「启动之后焦点交给
 * 命令行」，而命令由工具栏按钮启动时指针位置还未知，那一刻根本没有框可以聚焦）。档位同理，
 * `Tab` 派发的是关键字，与在命令行敲它逐字等价。
 *
 * 摆位与 `absolute` 那一档相同——光标右下角，那里不压住任何将要落笔的地方；胶囊排在数值框
 * 之后，间隔也取同一个。
 *
 * @param point - 指针的屏幕位置。
 * @param field - 数值框里的文本与状态。
 * @param toggle - 档位胶囊里的文案；缺席即这一步没有档位。
 * @public
 */
export function resolveStageDynamicInputPrompt(
  point: StagePoint,
  field: StageDynamicInputField,
  toggle?: string | null,
): StageDynamicInputAnnotation {
  const gap = 6
  const width = dynamicInputBoxWidth(field.text, undefined, dynamicInputAdornment(field.state))
  const y = point.y + 18 + DYNAMIC_INPUT_BOX_HEIGHT / 2
  const valueCenter = { x: point.x + 18 + width / 2, y }
  const boxes: StageDynamicInputBox[] = [box(0, valueCenter, field)]
  if (toggle) {
    /*
     * 胶囊恒带 `swap` 标记，与状态无关：它永远在等 `Tab`，没有「正在键入」这一档可言。
     * 它也永远不出光标条——那会让用户以为可以往里打字。
     */
    const chipWidth = dynamicInputBoxWidth(toggle, undefined, 'swap')
    boxes.push({
      index: 1,
      x: valueCenter.x + width / 2 + gap,
      y: y - DYNAMIC_INPUT_BOX_HEIGHT / 2,
      width: chipWidth,
      height: DYNAMIC_INPUT_BOX_HEIGHT,
      text: toggle,
      state: 'idle',
      adornment: 'swap',
      variant: 'chip',
    })
  }
  return {
    boxes,
    guides: [],
    ticks: [],
    locks: [],
    connector: null,
    measured: null,
  }
}

/**
 * 求解一次动态输入的完整呈现。
 *
 * @remarks
 * 纯函数：输入是屏幕坐标与两个字段的文本/状态，输出是可以直接画的路径与框位置。它不认识
 * 文档、选择集或任何一条命令。
 *
 * **一条规则管住所有框：框落在自己那条标注的中点上，标注在框后面断开。**
 *
 * @public
 */
export function resolveStageDynamicInput(
  request: StageDynamicInputRequest,
): StageDynamicInputAnnotation {
  const { cursor, origin, point } = request
  const positioned = request.kind === 'absolute' || !origin
    ? absoluteAnnotation(request)
    : (request.kind === 'cartesian'
      ? cartesianAnnotation(request, origin)
      : (isSingleField(request.kind)
        ? singleFieldAnnotation(request, origin)
        : polarAnnotation(request, origin)))
  // 判据是两点不相等，不是「有没有在键入」：锁定已经算进 `point`，只有键入覆盖能让它们分开。
  const connector = cursor && (cursor.x !== point.x || cursor.y !== point.y)
    ? `M${point.x} ${point.y}L${cursor.x} ${cursor.y}`
    : null
  const from = origin && measuredFrom(request.kind, origin, point)
  const measured = request.measured && from
    ? `M${from.x} ${from.y}L${point.x} ${point.y}`
    : null
  return { ...positioned, connector, measured }
}
