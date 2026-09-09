import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ComposeEditorActionId } from '../editor-controller/action-catalog'

/**
 * 货架里表示一条分隔线的保留 id。
 *
 * @remarks
 * 它是**货架的一项**而不是渲染时按分组补出来的装饰：用户可以在任意两格之间插入分隔，也可以
 * 插多条。因此它必须能被存进偏好里的那列 id，而不是从「这两格属于不同分组」反推——货架被
 * 重排之后，那种反推没有任何可靠的依据。
 *
 * @public
 */
export const COMPOSE_TOOLBAR_SEPARATOR = 'separator'

/**
 * 一条工具栏货架：按顺序排列的目录 id，其中 {@link COMPOSE_TOOLBAR_SEPARATOR} 表示分隔线。
 *
 * @remarks
 * 货架**永远是目录的子集**：不在目录里的 id 渲染时跳过而不报错——宿主关掉某条命令时，货架上
 * 那一格自然消失，与物料货架「文件夹找不到」是同一条处理。
 *
 * 它只表达**顺序与有无**，表达不了含义：一个 id 对应哪个图标、哪句提示、按下去做什么，全部
 * 由目录决定。这是「工作区不是模式」在类型上的保证——宿主与用户想定制也定制不出一个模式来。
 *
 * @public
 */
export type ComposeToolbarShelf = readonly string[]

/**
 * 宿主往工具栏目录里补的一项。
 *
 * @remarks
 * 它**指向**一个已有的动作或命令，而不是自带一段行为：按钮是入口，能力住在动作目录与命令
 * 词汇表里。与 `commands` 是同一条注入边界——宿主先把 `MIRROR` 注册成命令，再用这里的一项
 * 给它一个按钮。
 *
 * @public
 */
export interface ComposeToolbarItem {
  /** 稳定 id；货架按它寻址，MUST NOT 与内建目录项重名。 */
  readonly id: string
  /** 已本地化的标题；同时是按钮的可访问名与「更多」菜单里的那一行。 */
  readonly label: string
  readonly icon: ReactNode
  /** 按下去启动什么：一个编辑器动作，或一条命令会话。 */
  readonly target:
    | { readonly kind: 'action'; readonly id: ComposeEditorActionId }
    | { readonly kind: 'command'; readonly id: string }
  /**
   * 这一格是**开关**时的按下态；给了就按开关画（`aria-pressed`），不给就是工具或一次性动作。
   *
   * @remarks
   * 动作目标本来没有「正在跑」这回事，因此按下态只能由注入方给：编辑器把「动画编辑」注入成一格，
   * 读的就是那个开关本身。
   */
  readonly pressed?: boolean
}

/**
 * 「选择」的目录 id。
 *
 * @remarks
 * 它固定在货架第一位且不可移除：取点命令结束之后用户回到的就是它，拿掉之后无处可回。
 *
 * @public
 */
export const COMPOSE_TOOLBAR_SELECT_ID = 'select'

/**
 * 页面工作区的默认货架。
 *
 * @remarks
 * 大屏页面真会画的几何只有分区框与指示，因此绘图命令这一段只留 `RECTANGLE` 与 `ARROW`；
 * 正交与极轴约束的是**取点方向**，而留下的这两条一条轴对齐、一条只取两点，都用不上它们。
 *
 * 收走的是**入口**不是能力：`CIRCLE` 在这里照样能敲、能按 `C`、能在命令面板里搜到。作为
 * 补偿，圆的物料瓦片会在这个工作区里**出现**——`paletteHidden` 的判据是「工具栏是否已提供
 * 入口」，而这里没有提供。
 */
export const PAGE_TOOLBAR_SHELF: ComposeToolbarShelf = [
  'select',
  'transform-gizmo',
  COMPOSE_TOOLBAR_SEPARATOR,
  'snap',
  'grid',
  COMPOSE_TOOLBAR_SEPARATOR,
  'draw-container',
  'draw-text',
  COMPOSE_TOOLBAR_SEPARATOR,
  'RECTANGLE',
  'ARROW',
]

/** 编辑器注入的「动画编辑」那一格的目录 id；它指向 `document.toggleAnimationMode` 动作。 @public */
export const COMPOSE_TOOLBAR_ANIMATION_ID = 'animation'

/**
 * 动画工作区的默认货架：页面那条加一格「动画编辑」。
 *
 * @remarks
 * 那一格有动作目录与快捷键做第二条入口，进货架合规；它同时也在时间线面板的 chrome 上——
 * 工具栏上的这一格是给「眼睛在画布上」的那一刻用的。
 */
export const ANIMATION_TOOLBAR_SHELF: ComposeToolbarShelf = [
  ...PAGE_TOOLBAR_SHELF,
  COMPOSE_TOOLBAR_SEPARATOR,
  COMPOSE_TOOLBAR_ANIMATION_ID,
]

/**
 * 绘图工作区的默认货架。
 *
 * @remarks
 * 八条绘图命令全部在栏上，并且排在容器 / 文字**之前**——溢出是从**尾部**收进「更多」的，
 * 而这一档正是绘图存在的全部理由。共用一条顺序时它们排在最后，窗口稍窄就被收走，而页面那两个
 * 反而活下来。
 *
 * 不留容器：接线图里的盒是矩形曲线（能双击改形状、能拖圆角），容器仍在基础组件段与快捷键上。
 * 文字留着——端子号与回路编号是接线图上真实存在的活儿。
 */
export const DRAWING_TOOLBAR_SHELF: ComposeToolbarShelf = [
  'select',
  'transform-gizmo',
  COMPOSE_TOOLBAR_SEPARATOR,
  'snap',
  'ortho',
  'polar',
  'grid',
  COMPOSE_TOOLBAR_SEPARATOR,
  'LINE',
  'PLINE',
  'RECTANGLE',
  'POLYGON',
  'CIRCLE',
  'ARC',
  'ARROW',
  'WIRE',
  COMPOSE_TOOLBAR_SEPARATOR,
  'draw-text',
]

/**
 * 把一条货架切成若干段：分隔线是段与段的边界。
 *
 * @remarks
 * 空段会被丢掉——货架首尾的分隔线、连着的两条分隔线，以及一整段的 id 全都不在目录里时，都
 * 不该在屏幕上留下一条没有内容的竖线。
 *
 * `known` 判断的是「这个 id 在目录里吗」，由调用方给出：本模块不认识动作目录、命令注册表或
 * 宿主注入的那一份。
 *
 * @internal
 */
export function splitToolbarShelf(
  shelf: ComposeToolbarShelf,
  known: (id: string) => boolean,
): readonly (readonly string[])[] {
  const sections: string[][] = []
  let current: string[] = []
  for (const id of shelf) {
    if (id === COMPOSE_TOOLBAR_SEPARATOR) {
      if (current.length > 0) sections.push(current)
      current = []
      continue
    }
    if (known(id)) current.push(id)
  }
  if (current.length > 0) sections.push(current)
  return sections
}

/**
 * 把「选择」钉回第一位。
 *
 * @remarks
 * 用户与宿主都可能给出一条没有它、或把它排在中间的货架（手写偏好、导入别人的配置、目录项
 * 改过名）。在**读取时**归一化而不是在写入时拒绝：拒绝要求每一个写入方都先做这件事，而漏掉
 * 的那一处的症状是「工具栏上没有选择工具了」，用户在画布上会彻底卡住。
 *
 * @internal
 */
export function normalizeToolbarShelf(shelf: ComposeToolbarShelf): ComposeToolbarShelf {
  const rest = shelf.filter((id) => id !== COMPOSE_TOOLBAR_SELECT_ID)
  return [COMPOSE_TOOLBAR_SELECT_ID, ...rest]
}

/**
 * 当前工作区的工具栏货架。
 *
 * @remarks
 * 这里用 Context 而不是 prop，是因为中间那一层**属于宿主**：货架住在 `ComposeEditor` 的工作区
 * 会话上，而工具栏元素由 controller 造、再经 `slots.stageToolbar` 交回宿主——宿主可以把它包进
 * 自己的 Fragment 里（示例应用就在旁边加了一颗预览按钮）。一旦它这么做，`cloneElement` 补 prop
 * 那条路就断了，症状是「换了工作区工具栏纹丝不动」，而宿主完全看不出自己做错了什么。
 *
 * 它满足「跨越多个层级且语义稳定」这条准入：货架是配置不是状态，一次切换只写一次。
 * 直接给 `DefaultStageToolbar` 传 `shelf` 仍然生效并**压过** Context——宿主自己渲染工具栏时
 * 那是唯一的入口。
 *
 * @internal
 */
export const ComposeToolbarShelfContext = createContext<ComposeToolbarShelfContextValue>({})

/**
 * Context 里的四样东西：铺哪几格、目录里除内建之外还有哪几项，以及改它们的两个入口。
 *
 * @remarks
 * 两个回调同样走 Context 而不是 prop，理由与 `shelf` 逐字相同——中间那一层属于宿主。
 *
 * @internal
 */
export interface ComposeToolbarShelfContextValue {
  readonly shelf?: ComposeToolbarShelf
  readonly items?: readonly ComposeToolbarItem[]
  /** 打开自定义对话框。 */
  readonly onCustomize?: () => void
  /** 改当前工作区的货架。 */
  readonly onShelfChange?: (shelf: ComposeToolbarShelf) => void
}

/** 读当前工作区的货架与宿主注入的目录项；不在 Provider 里时两样都缺席。 @internal */
export function useComposeToolbarShelf() {
  return useContext(ComposeToolbarShelfContext)
}

/**
 * 把第 `index` 格往前或往后挪一格。
 *
 * @remarks
 * 越界与「挪到「选择」之前」都原样返回：编辑面上那两颗按钮此时是禁用的，这里再挡一次是因为
 * 键盘用户可以连按，而连按到头之后静默不动比抛错好。
 *
 * @internal
 */
export function moveToolbarShelfItem(
  shelf: ComposeToolbarShelf,
  index: number,
  delta: -1 | 1,
): ComposeToolbarShelf {
  const target = index + delta
  if (index < 0 || index >= shelf.length) return shelf
  // 「选择」钉在第一位，因此谁都不能挪到它前面去。
  if (target < 1 || target >= shelf.length) return shelf
  const next = [...shelf]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  return next
}

/** 从货架上拿掉第 `index` 格；「选择」拿不掉。 @internal */
export function removeToolbarShelfItem(
  shelf: ComposeToolbarShelf,
  index: number,
): ComposeToolbarShelf {
  if (shelf[index] === COMPOSE_TOOLBAR_SELECT_ID) return shelf
  return shelf.filter((_, at) => at !== index)
}

/**
 * 在第 `index` 格**之前**插一条分隔线。
 *
 * @remarks
 * 可以插多条——用户想留一段空隙是正当用法，而渲染时空段本来就会被丢掉，因此这里不去重。
 *
 * @internal
 */
export function insertToolbarSeparator(
  shelf: ComposeToolbarShelf,
  index: number,
): ComposeToolbarShelf {
  const at = Math.max(1, Math.min(index, shelf.length))
  return [...shelf.slice(0, at), COMPOSE_TOOLBAR_SEPARATOR, ...shelf.slice(at)]
}

/** 把一格加到货架末尾；已经在货架上的原样返回。 @internal */
export function addToolbarShelfItem(
  shelf: ComposeToolbarShelf,
  id: string,
): ComposeToolbarShelf {
  if (id !== COMPOSE_TOOLBAR_SEPARATOR && shelf.includes(id)) return shelf
  return [...shelf, id]
}

/**
 * 内建目录里每一格的文案键，按默认顺序。
 *
 * @remarks
 * 它与 `DefaultStageToolbar` 里那份分组构造是**同一份事实的两个消费者**：一个用来渲染按钮，
 * 一个用来在自定义对话框里列出「未放入」的那些。合并成一份的代价是把整套 render 闭包搬进
 * 这个无 React 的模块，那比这处重复更糟；因此这里只留 id 与文案键，多出一格时两处都要加，
 * 而漏掉的症状是「对话框里少了一项」——由端到端用例挡住。
 *
 * @internal
 */
export const COMPOSE_TOOLBAR_CATALOG: readonly (readonly [id: string, messageKey: string])[] = [
  ['select', 'select'],
  ['transform-gizmo', 'transformGizmo'],
  ['snap', 'snap'],
  ['ortho', 'ortho'],
  ['polar', 'polar'],
  ['grid', 'grid'],
  ['draw-container', 'createContainer'],
  ['draw-text', 'text'],
  ['LINE', 'drawLine'],
  ['PLINE', 'drawPolyline'],
  ['RECTANGLE', 'drawRectangle'],
  ['POLYGON', 'drawPolygon'],
  ['CIRCLE', 'drawCircle'],
  ['ARC', 'drawArc'],
  ['ARROW', 'drawArrow'],
  ['WIRE', 'drawWire'],
]
