/**
 * 网格布局的平面运算：格坐标的碰撞推挤与重力，以及格与像素之间的换算。
 *
 * @remarks
 * **整个模块放在一起而不按消费者拆**，判据与 `curve-geometry.ts` 逐字相同：它有两个消费者
 * ——`layout-engine` 求解，`stage-engine` 算「松手会落在哪一格」，而 `stage-engine` 不依赖
 * `layout-engine`。把其中几个函数挪到用得最多的那个包，会让碰撞数学横跨两个包，而那正是
 * 「一半改了另一半没改」的温床。
 *
 * 本模块是纯函数：不读文档、不读 Snapshot、不认识任何 React 或 DOM 对象。
 * @packageDocumentation
 */

/** 一个子级在网格上占据的矩形，单位是格。 @public */
export interface ComposeGridCell {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** 求解一次网格布局所需的参数。 @public */
export interface ComposeGridSolveOptions {
  readonly columns: number
  /** `true` 表示子级停在作者放的行上；`false`（默认语义）表示空洞被自动填上。 */
  readonly float: boolean
  /**
   * 本次手势的目标。
   *
   * @remarks
   * 它在**碰撞解算**里是权威的：先按它请求的位置落下，其余子级为它让路。没有它时「谁该让
   * 谁」没有答案——两个重叠的矩形本身并不说明是谁搬到了谁头上。
   *
   * 它**不豁免重力**，见 {@link solveComposeGrid} 的说明。
   */
  readonly anchorId?: string
}

/** 网格的像素度量。 @public */
export interface ComposeGridMetrics {
  readonly columns: number
  readonly rowHeight: number
  readonly rowGap: number
  readonly columnGap: number
  /** 容器内容盒宽度：已扣除边框与内边距。 */
  readonly contentWidth: number
}

/** 投影到容器内容盒之后的像素矩形。 @public */
export interface ComposeGridRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max)
}

function overlaps(a: ComposeGridCell, b: ComposeGridCell): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * 把跨度与起点钳制进列范围。
 *
 * @remarks
 * **钳制在读取时而不是写入时**，与多段线圆角是同一条判断：`w` 超出 `columns` 时这里按
 * `columns` 呈现，但文档里的原值保留——那个数是作者的意图，容器改回更多列时应当复原。
 */
function clampToColumns(cell: ComposeGridCell, columns: number): ComposeGridCell {
  const w = clampInteger(cell.w, 1, columns)
  const x = clampInteger(cell.x, 0, columns - w)
  const y = Math.max(0, Math.round(cell.y))
  const h = Math.max(1, Math.round(cell.h))
  return cell.w === w && cell.x === x && cell.y === y && cell.h === h
    ? cell
    : { ...cell, x, y, w, h }
}

/** 按行序、同行按列序排定处理顺序；顺序稳定，因此求解是确定的。 */
function byRowThenColumn(a: ComposeGridCell, b: ComposeGridCell): number {
  return a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * 求解一次网格布局。
 *
 * @remarks
 * 两步，次序是**先碰撞推挤、后重力**：
 *
 * 1. **推挤只向下**，不交换。交换（两张同尺寸的卡对调）手感更聪明，但它有一个说不清的
 *    边界——尺寸不同时换不了，于是同一个动作有时交换、有时推挤，而用户无法预测的规则比笨
 *    一点的规则更糟。
 * 2. **重力只向上**，不向左靠。列是作者的构图意图（这张在左、那张在右），行不是；向左靠
 *    会把用户摆好的分栏冲掉。`float` 为 `true` 时整步跳过。
 *
 * **`anchorId` 不豁免重力。** 它只在第一步是权威的。豁免会让求解**不再幂等**——把一张卡
 * 拖到空网格的第 5 行、它停在那里，而下一次任何编辑触发重新求解时它就不再是 anchor，
 * 于是自己跳到第 0 行去。一个在用户没动手的时候自己移动的对象，屏幕上没有任何东西解释
 * 它为什么动。因此 anchor 与其余子级一样落下，拖到空处即贴着上方——这也正是 GridStack
 * `float: false` 的行为。
 *
 * @param cells - 待求解的格矩形，顺序不影响结果
 * @returns 与输入等长的新数组，按行序排列；输入本身不被修改
 * @public
 */
export function solveComposeGrid(
  cells: readonly ComposeGridCell[],
  options: ComposeGridSolveOptions,
): readonly ComposeGridCell[] {
  const columns = Math.max(1, Math.round(options.columns))
  const clamped = cells.map((cell) => clampToColumns(cell, columns))

  // —— 第一步：碰撞推挤 ——
  // anchor 先落，其余按行序依次放；每一个向下推到不再与已落定的任何一个重叠为止。
  const anchor = options.anchorId === undefined
    ? undefined
    : clamped.find((cell) => cell.id === options.anchorId)
  const rest = clamped
    .filter((cell) => cell !== anchor)
    .sort(byRowThenColumn)
  const placed: ComposeGridCell[] = anchor ? [anchor] : []
  for (const cell of rest) {
    let candidate = cell
    // 每一轮至多把 candidate 推到某个已落定矩形的下边缘，而已落定的数量有限且推挤只向下，
    // 因此必然终止；重新扫描是因为下移之后可能撞上原先够不着的那一个。
    let collided = placed.find((other) => overlaps(candidate, other))
    while (collided) {
      candidate = { ...candidate, y: collided.y + collided.h }
      collided = placed.find((other) => overlaps(candidate, other))
    }
    placed.push(candidate)
  }

  if (options.float) return placed.sort(byRowThenColumn)

  // —— 第二步：重力 ——
  // 按行序逐个上浮到它上方第一个不重叠的行。已落定集合只含比它更靠上的，因此一趟即可。
  const settled: ComposeGridCell[] = []
  for (const cell of placed.sort(byRowThenColumn)) {
    let y = cell.y
    while (y > 0 && !settled.some((other) => overlaps({ ...cell, y: y - 1 }, other))) {
      y -= 1
    }
    settled.push(y === cell.y ? cell : { ...cell, y })
  }
  return settled.sort(byRowThenColumn)
}

/**
 * 找一块能放下指定跨度的空位。
 *
 * @remarks
 * 逐行从左往右扫，取第一个不与任何已有矩形重叠的位置；整行都放不下就换下一行。没有上界——
 * 网格向下是无限的，因此**必然**找得到，函数不会返回空。
 *
 * 用在「往网格里新建一个对象」这条路径上：它没有落点意图（点击添加、从面板点一下），而
 * GridStack 的 `addWidget` 不给位置时也是这个行为。**不是**「放到最下面一行」——那会在一块
 * 右边留着大片空白的板子上把新卡片甩到很远的地方。
 *
 * @public
 */
export function findComposeGridVacancy(
  cells: readonly ComposeGridCell[],
  options: { readonly columns: number; readonly w: number; readonly h: number },
): { readonly x: number; readonly y: number } {
  const columns = Math.max(1, Math.round(options.columns))
  const w = Math.min(Math.max(1, Math.round(options.w)), columns)
  const h = Math.max(1, Math.round(options.h))
  const maxRow = cells.reduce((max, cell) => Math.max(max, cell.y + cell.h), 0)
  for (let y = 0; y <= maxRow; y += 1) {
    for (let x = 0; x <= columns - w; x += 1) {
      const candidate = { id: '', x, y, w, h }
      if (!cells.some((cell) => overlaps(candidate, cell))) return { x, y }
    }
  }
  // 每一行都被占满时落到最下面一行之后；那一行必然是空的。
  return { x: 0, y: maxRow }
}

/**
 * 列宽。
 *
 * @remarks
 * 由内容宽、列数与列间距推出，**不进文档**：同一份事实存两处必然漂移，而容器宽度会随宿主变。
 *
 * @public
 */
export function composeGridColumnWidth(metrics: ComposeGridMetrics): number {
  const columns = Math.max(1, Math.round(metrics.columns))
  const gaps = metrics.columnGap * (columns - 1)
  return Math.max(0, (metrics.contentWidth - gaps) / columns)
}

/**
 * 把一个格矩形投影到容器内容盒的像素坐标。
 *
 * @remarks
 * **格与像素之间只有这一个换算入口**，判据与曲线的 `projectComposeCurveToBox` 逐字相同：
 * 求解、命中与覆盖层各算一遍的话，下一个改格子语义的人只会改到其中一处，而漏掉的那处的
 * 症状是「画出来的格线与卡片落的位置对不上」。
 *
 * @public
 */
export function projectComposeGridCell(
  cell: Pick<ComposeGridCell, 'x' | 'y' | 'w' | 'h'>,
  metrics: ComposeGridMetrics,
): ComposeGridRect {
  const columnWidth = composeGridColumnWidth(metrics)
  const columnStep = columnWidth + metrics.columnGap
  const rowStep = metrics.rowHeight + metrics.rowGap
  return {
    x: cell.x * columnStep,
    y: cell.y * rowStep,
    width: Math.max(0, cell.w * columnStep - metrics.columnGap),
    height: Math.max(0, cell.h * rowStep - metrics.rowGap),
  }
}

/**
 * 一组格矩形占用的内容高度。
 *
 * @remarks
 * 供 Hug 容器取自己的内容高度。空网格高度为 0——一块还没放东西的板子不该先占出一行。
 *
 * @public
 */
export function composeGridContentHeight(
  cells: readonly ComposeGridCell[],
  metrics: Pick<ComposeGridMetrics, 'rowHeight' | 'rowGap'>,
): number {
  const rows = cells.reduce((max, cell) => Math.max(max, cell.y + cell.h), 0)
  return rows === 0 ? 0 : rows * (metrics.rowHeight + metrics.rowGap) - metrics.rowGap
}

/**
 * 内容盒局部像素点落在哪一格。
 *
 * @remarks
 * 落点解算用：取该点所在的格，**不四舍五入到最近的格线**——拖动时用户瞄的是卡片左上角要压
 * 住哪一格，而不是它离哪条线更近。列钳制到 `[0, columns - 1]`，行不设上界（网格向下无限）。
 *
 * @public
 */
export function composeGridCellAtPoint(
  point: { readonly x: number; readonly y: number },
  metrics: ComposeGridMetrics,
): { readonly x: number; readonly y: number } {
  const columnStep = composeGridColumnWidth(metrics) + metrics.columnGap
  const rowStep = metrics.rowHeight + metrics.rowGap
  return {
    x: columnStep > 0
      ? clampInteger(Math.floor(point.x / columnStep), 0, Math.max(0, metrics.columns - 1))
      : 0,
    y: rowStep > 0 ? Math.max(0, Math.floor(point.y / rowStep)) : 0,
  }
}
