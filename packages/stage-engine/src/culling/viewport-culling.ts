import { rectsIntersect, type StageRect, type StageViewport } from '../geometry'
import type { StageSceneIndex } from '../hit-testing'

/**
 * 裁剪窗口：决定「这一帧的 DOM 里该有哪些 Entity」的那个世界矩形。
 *
 * @remarks
 * 它**不是**视口矩形，见 {@link resolveStageCullingWindow}。`key` 是这个窗口的稳定身份，
 * 供调用方直接做记忆化依赖——窗口没换时逐帧相等，因此内容子树不会每帧重建。
 *
 * @public
 */
export interface StageCullingWindow extends StageRect {
  /** 量化窗口的稳定身份；同一个窗口在任意两帧上给出同一个字符串。 */
  readonly key: string
  /**
   * 求出这个窗口所用的缩放档位。
   *
   * @remarks
   * 调用方据此区分「平移换窗」与「缩放跨档换窗」：前者新进的节点按构造落在可视区之外，可以
   * 分几帧补；后者新进的节点可能就在可视区里，必须一帧到齐。
   */
  readonly zoomStep: number
}

/**
 * 窗口相对档定视口尺寸的外扩倍数。
 *
 * @remarks
 * 外扩的用途只有一个——让节点在**进入可视区之前**就已经建好。
 *
 * 取值是一次量出来的取舍而不是手感：窗口每一轴的宽度按「档定尺寸 × (1 + 2×外扩) + 最多一格」
 * 增长，面积按平方放大，而裁剪省下来的每一样（样式重算、布局、合成）都与**留在 DOM 里的
 * 节点数**成正比。外扩一屏时窗口是九倍视口面积——在一张整体只有三四倍视口大的图纸上等于一个
 * 都不裁，实测五千多个节点一个没少。
 *
 * @internal
 */
const WINDOW_EXPANSION = 0.25

/**
 * 量化步长相对档定视口尺寸的倍数。
 *
 * @remarks
 * 平移四分之一屏才换一次窗口。步长同时也是窗口的一部分余量（向外吸最多各让一格），因此它
 * 与外扩量取同一个量级：调大只换来更少的换窗次数，代价是常驻更多节点。
 *
 * 换窗的代价是一次内容子树重建，也就是 `stage-scene-layer` 那条既有注释里说的 fiber diff。
 * 它**不是**那条注释担心的每帧全量重建——四分之一屏一次，而且补进来的那一批元素与上一帧
 * 逐字相同，重的是元素创建而不是 DOM 变更。
 *
 * @internal
 */
const WINDOW_QUANTUM = 0.25

/**
 * 缩放量化的档位密度：每个八度分四档。
 *
 * @remarks
 * 缩放**必须**量化，否则窗口是缩放的连续函数，捏合时几乎每一帧都换一个窗口——实测一次
 * 四十帧的滚轮缩放产生了一万七千次 DOM 增删，比根本不裁剪还慢。
 *
 * 密度是一次取舍：档越粗，窗口在档内要预留的余量越大（它得覆盖档内**最宽**的那个可视区），
 * 常驻节点因此越多；档越细，一次缩放手势跨过的档位越多，重建次数越多。一个八度只分一档时
 * 余量是 √2，窗口面积要多留一倍；分成四档时余量降到 1.09，而跨整整一个八度的缩放也只重建
 * 四次。
 *
 * @internal
 */
const ZOOM_STEPS_PER_OCTAVE = 4

/**
 * 档内可视区相对该档标称尺寸的最大倍数。
 *
 * @remarks
 * 档内的真实缩放落在 `档 × 2^±(1/8)` 之间，可视区最宽时正好是标称尺寸的这个倍数。窗口按它
 * 取尺寸，「窗口恒包含可视区」这条不变量才在整个档内成立，而不是只在档中心成立。
 *
 * @internal
 */
const ZOOM_STEP_COVER = 2 ** (1 / (2 * ZOOM_STEPS_PER_OCTAVE))

/**
 * 「覆盖一切」的窗口半边长。
 *
 * @remarks
 * 刻意取一个有限的大数而**不是** `Infinity`：矩形相交判定要算 `x + width`，而
 * `-Infinity + Infinity` 是 `NaN`，与 `NaN` 的比较一律为假——一个本意覆盖一切的窗口会变成
 * 什么都不覆盖，而这个错误只在图面尚未量到尺寸的那一帧出现。
 *
 * @internal
 */
const UNBOUNDED_WINDOW_EXTENT = 1e15

function quantizeZoom(zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1
  return 2 ** (Math.round(Math.log2(zoom) * ZOOM_STEPS_PER_OCTAVE) / ZOOM_STEPS_PER_OCTAVE)
}

/**
 * 求当前视口对应的裁剪窗口。
 *
 * @remarks
 * 窗口是**以视口中心为心、按缩放档位取尺寸、再外扩、最后四条边各自向外吸到格子上**的矩形。
 * 四步各自解决一件事，缺一条就少一样性质：
 *
 * - **按档位取尺寸**（而不是按真实可视区）让窗口在一个缩放档位里与缩放无关。缩放是连续量，
 *   直接用它的那一版几乎每一帧都换窗口，一次四十帧的滚轮缩放做了一万七千次 DOM 增删。
 * - **以中心为心**：缩放同时改变两条边的世界坐标，而中心在以它为锚点缩放时是不动点。
 * - **外扩**让新节点在进入可视区之前建好。
 * - **向外**吸（而不是就近吸）让「窗口恒包含可视区」由构造成立，而不是靠外扩量与步长之间的
 *   一个数值关系去保证。就近吸时每条边最多向内让半格，于是要求外扩量严格大于半个步长，而
 *   那个不等式一旦被后来者调参调破，症状是「拖到某处边缘闪一下空白」——一个只在特定平移位置
 *   出现、极难复现的缺陷。向外吸把这条不变量变成读得出来的代码。
 *
 * 量化让窗口是一个**离散**值，这正是既有那条约束（内容子树刻意不依赖 viewport）在裁剪落地
 * 之后仍然成立的原因：内容的记忆化依赖换成了这个离散值，而不是每帧都变的视口。
 *
 * @param viewport - 当前视口。
 * @param surfaceSize - 图面的 CSS 像素尺寸。
 * @public
 */
export function resolveStageCullingWindow(
  viewport: StageViewport,
  surfaceSize: { readonly width: number; readonly height: number },
): StageCullingWindow {
  const zoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1
  const zoomStep = quantizeZoom(zoom)
  const nominalWidth = surfaceSize.width / zoomStep
  const nominalHeight = surfaceSize.height / zoomStep
  // 图面还没量到真实尺寸时没有可视区可言，此时给一个覆盖一切的窗口——裁剪的判据此刻不存在，
  // 按一个假的尺寸裁会在挂载后的第一帧少画一批东西，而那一帧用户是看得见的。
  if (!(nominalWidth > 0) || !(nominalHeight > 0)) {
    return {
      x: -UNBOUNDED_WINDOW_EXTENT,
      y: -UNBOUNDED_WINDOW_EXTENT,
      width: UNBOUNDED_WINDOW_EXTENT * 2,
      height: UNBOUNDED_WINDOW_EXTENT * 2,
      key: 'unbounded',
      zoomStep,
    }
  }
  // 可视区中心的世界坐标；窗口的位置只认它。
  const centerX = (surfaceSize.width / 2 - viewport.x) / zoom
  const centerY = (surfaceSize.height / 2 - viewport.y) / zoom
  const halfWidth = nominalWidth * ZOOM_STEP_COVER * (0.5 + WINDOW_EXPANSION)
  const halfHeight = nominalHeight * ZOOM_STEP_COVER * (0.5 + WINDOW_EXPANSION)
  const quantumX = nominalWidth * WINDOW_QUANTUM
  const quantumY = nominalHeight * WINDOW_QUANTUM
  /*
   * 格数由档位定死，只有左上角随平移走——**两条边各自吸各自的**那一版，格数会在 7 与 8 之间
   * 来回跳，于是平移每过一格换**两次**窗口而不是一次。多出来的那一次是一整趟内容重建，
   * 而它换来的只是窗口偶尔窄一格。
   *
   * 多留一格是向外吸的代价：左边最多向外让出一整格，右边因此也要多备一格才盖得住。
   */
  const cellsX = Math.ceil((halfWidth * 2) / quantumX) + 1
  const cellsY = Math.ceil((halfHeight * 2) / quantumY) + 1
  const left = Math.floor((centerX - halfWidth) / quantumX)
  const top = Math.floor((centerY - halfHeight) / quantumY)
  return {
    x: left * quantumX,
    y: top * quantumY,
    width: cellsX * quantumX,
    height: cellsY * quantumY,
    // 键含格子尺寸：缩放跨档时格线整体换了一套，左上角下标相同不代表是同一个窗口。
    key: `${quantumX}:${quantumY}:${left}:${top}:${cellsX}:${cellsY}`,
    zoomStep,
  }
}

/**
 * {@link resolveStageVisibleEntityIds} 的豁免声明。
 *
 * @remarks
 * 两类豁免的**作用范围不同，而范围由豁免的理由决定**，不是一条可以合并的规则：
 *
 * - `nodes` 的理由是「有一条路径会按这个 id 去 DOM 里找节点」，找的就是那**一个**节点，
 *   因此只豁免它自己（加上祖先链——祖先不在 DOM 里，它自己也挂不上去）。
 * - `subtrees` 的理由是「这棵子树此刻的几何由预览变换决定，而索引里的那份是过期的」，
 *   过期的是**整棵**子树，因此整棵豁免。只豁免根的话，把一个容器拖出一屏之外时它自己还在、
 *   里面的东西却按旧位置被判掉了，屏幕上是「抓着的盒子中途空了」。
 *
 * @public
 */
export interface StageCullingExemptions {
  /** 只豁免这些 Entity 自身。 */
  readonly nodes?: readonly string[]
  /** 豁免这些 Entity 及其全部后代。 */
  readonly subtrees?: readonly string[]
}

/**
 * 求这一帧应当进入 DOM 的 Entity 集合。
 *
 * @remarks
 * 判据是 {@link StageSceneIndex.getSubtreeWorldBounds} 与窗口相交，而不是 Entity 自身的盒
 * ——理由见那个查询自己的说明。父级不在集合里时后代一律不在：渲染是递归的，父级没建节点，
 * 后代也无处可挂；而父级的子树包围盒本就是全部后代的并集，因此这一条同时是剪枝。
 *
 * 返回值**只供渲染使用**。它 MUST NOT 参与命中、框选、吸附或任何回答「这个 Entity 在不在」
 * 的查询——那些必须按文档与布局快照求解。裁剪与 `hiddenEntityIds` 语义相反：后者是渲染与
 * 命中两边都没有，裁剪是只有渲染这一边没有，合并会让「看得见」与「点得到」分家。
 *
 * @param index - 已提交文档的场景索引。
 * @param cullingWindow - {@link resolveStageCullingWindow} 的结果。
 * @param exemptions - 无论落在哪里都必须渲染的 Entity。
 * @public
 */
export function resolveStageVisibleEntityIds(
  index: StageSceneIndex,
  cullingWindow: StageRect,
  exemptions?: StageCullingExemptions,
): ReadonlySet<string> {
  const exempt = resolveStageCullingExemptIds(index, exemptions)
  const visible = new Set<string>()
  // `order` 是前序遍历，父级恒在后代之前，因此一遍即可，O(n)。
  for (const entityId of index.order) {
    const parentId = index.getParentId(entityId)
    if (parentId !== null && !visible.has(parentId)) continue
    if (exempt.has(entityId)) {
      visible.add(entityId)
      continue
    }
    const bounds = index.getSubtreeWorldBounds(entityId)
    if (bounds && rectsIntersect(bounds, cullingWindow)) visible.add(entityId)
  }
  return visible
}

/**
 * 把豁免声明展开成 Entity 集合：节点级带上祖先链，子树级带上祖先链与全部后代。
 *
 * @remarks
 * 单独导出是因为渲染侧要拿它做第二件事——分批揭示时，豁免的 Entity **不得**排队等着，
 * 它们晚一帧就是看得见的错。
 *
 * @public
 */
export function resolveStageCullingExemptIds(
  index: StageSceneIndex,
  exemptions?: StageCullingExemptions,
): ReadonlySet<string> {
  const exempt = new Set<string>()
  const addAncestors = (entityId: string) => {
    let current = index.getParentId(entityId)
    while (current !== null && !exempt.has(current)) {
      exempt.add(current)
      current = index.getParentId(current)
    }
  }
  const subtreeRoots = new Set(exemptions?.subtrees ?? [])
  for (const entityId of [...(exemptions?.nodes ?? []), ...subtreeRoots]) {
    exempt.add(entityId)
    addAncestors(entityId)
  }
  if (subtreeRoots.size === 0) return exempt
  // 子树豁免沿后代向下生长：`order` 是前序遍历，父级恒在后代之前，一遍即可。
  const inSubtree = new Set(subtreeRoots)
  for (const entityId of index.order) {
    const parentId = index.getParentId(entityId)
    if (parentId !== null && inSubtree.has(parentId)) inSubtree.add(entityId)
    if (inSubtree.has(entityId)) exempt.add(entityId)
  }
  return exempt
}
