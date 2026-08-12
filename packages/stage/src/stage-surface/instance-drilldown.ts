/**
 * 组件实例内部实体在 DOM 上的标记属性。
 *
 * @remarks
 * 实例内容由独立的嵌套 Runtime 渲染，其几何不进入 stage-engine 的场景索引，因此内部命中
 * 只能读 DOM。materials 的实例 Renderer 负责写入该属性。
 */
const INSTANCE_ENTITY_SELECTOR = '[data-component-instance-entity-id]'

/** 视口坐标点。 */
interface ClientPoint {
  readonly x: number
  readonly y: number
}

function containsPoint(element: Element, point: ClientPoint): boolean {
  const rect = element.getBoundingClientRect()
  return point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom
}

/**
 * 求出实例内部命中该点的实体路径，由浅到深。
 *
 * @remarks
 * 编辑态下实例内容是 `pointer-events: none`，`elementsFromPoint` 会跳过它，因此改为遍历
 * 标记元素并比较矩形。同层重叠时取 DOM 顺序靠后的节点，与视觉层叠一致。
 *
 * 返回整条路径而不是最深项，是为了支持逐层下钻：一次双击只前进一层，与 Figma 的下钻手感
 * 一致；直接跳到最深项会让用户失去中间层级的选择能力。
 *
 * 路径不含组件根：实例内最外层的标记元素就是组件根 Group，它在语义上等同于实例节点本身，
 * 既不会被投影成 Scene Tree 行，选中它也只是重复选中实例。
 *
 * @param host - 实例在 Stage Scene 中的节点元素
 * @param point - 视口坐标（`clientX`/`clientY`）
 * @returns 由浅到深、不含组件根的内部实体 ID 路径；点未命中任何内部实体时为空数组
 *
 * @public
 */
export function resolveInstanceDrillDownPath(
  host: Element,
  point: ClientPoint,
): readonly string[] {
  const candidates = host.querySelectorAll<HTMLElement>(INSTANCE_ENTITY_SELECTOR)
  let deepest: { element: HTMLElement; depth: number } | null = null
  candidates.forEach((element) => {
    if (!containsPoint(element, point)) return
    if (!element.dataset.componentInstanceEntityId) return
    let depth = 0
    for (let node = element.parentElement; node && node !== host; node = node.parentElement) {
      depth += 1
    }
    // 深度相同时后出现的元素覆盖先前结果，等价于取 DOM 顺序靠后的兄弟。
    if (!deepest || depth >= deepest.depth) deepest = { element, depth }
  })
  if (deepest === null) return []
  const path: string[] = []
  for (
    let node: HTMLElement | null = (deepest as { element: HTMLElement }).element;
    node && node !== host;
    node = node.parentElement
  ) {
    const id = node.dataset.componentInstanceEntityId
    if (id) path.unshift(id)
  }
  // 去掉组件根：它是实例内最外层的标记元素，与实例节点同义。
  return path.slice(1)
}

/**
 * 按当前已下钻到的内部实体，选出下一次双击应落到的内部实体。
 *
 * @remarks
 * 未进入实例时落在路径最浅一层；已在路径上时前进一层；已在最深层则保持不动，避免双击
 * 在末端产生无意义的选区抖动。当前选区不在本次命中路径上时同样从最浅层重新开始。
 *
 * @param path - {@link resolveInstanceDrillDownPath} 的结果
 * @param currentInnerId - 当前选区所处的内部实体 ID；不在该实例内部时传 `null`
 * @returns 下一个应选中的内部实体 ID；路径为空时为 `null`
 *
 * @public
 */
export function nextInstanceDrillDownTarget(
  path: readonly string[],
  currentInnerId: string | null,
): string | null {
  if (path.length === 0) return null
  if (currentInnerId === null) return path[0]!
  const index = path.indexOf(currentInnerId)
  if (index === -1) return path[0]!
  return path[Math.min(index + 1, path.length - 1)]!
}
