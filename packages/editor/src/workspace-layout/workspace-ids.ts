/**
 * 面板、组与尺寸的常量：没有任何导入的叶子模块。
 *
 * @remarks
 * 工作区定义、快照、宿主元素与布局建造都读它们，而定义与建造又互相引用——常量若住在其中
 * 任何一边，另一边在模块求值时读到的就是 `undefined`。
 */

/**
 * 单一 Dockview 实例里的组。
 *
 * @remarks
 * 左右两侧的组按**位置**编号（`compose-left-0` 在最上），底部是原生边缘组，画布组在中央。左右两侧
 * **不是**边缘组：Dockview 7 的边缘组住在外层 splitview 里、包着中间那一列，而底部边缘组又住在
 * 中间那一列里——左右一旦是边缘组，底部就被夹在它们之间，横跨不了全宽。反过来把左右做成普通组、
 * 只留底部做边缘组，底部就天然横跨整个编辑器。
 *
 * `scene` / `tools` / `inspector` 是默认布局下三个位置的别名；面板可拖之后组只按位置前缀识别
 * （见 {@link WORKSPACE_SIDE_GROUP_PREFIX}），用户拖出来的新组不属于任何一侧。
 */
export const WORKSPACE_SIDE_GROUP_PREFIX = {
  left: 'compose-left-',
  right: 'compose-right-',
} as const

export const WORKSPACE_GROUP_IDS = {
  scene: `${WORKSPACE_SIDE_GROUP_PREFIX.left}0`,
  tools: `${WORKSPACE_SIDE_GROUP_PREFIX.left}1`,
  canvas: 'compose-canvas-group',
  inspector: `${WORKSPACE_SIDE_GROUP_PREFIX.right}0`,
  bottom: 'compose-bottom-edge',
} as const

export const WORKSPACE_PANEL_IDS = {
  scene: 'compose-scene-content-panel',
  componentLibrary: 'compose-component-library-panel',
  history: 'compose-history-panel',
  canvas: 'compose-canvas',
  inspector: 'compose-inspector',
  transactionLog: 'compose-transaction-log',
  command: 'compose-command',
  assetBrowser: 'compose-assets',
  animation: 'compose-animation',
} as const

export const WORKSPACE_COMPONENT_IDS = {
  scene: 'sceneGraph',
  componentLibrary: 'componentLibrary',
  history: 'history',
  canvas: 'canvas',
  inspector: 'inspector',
  transactionLog: 'transactionLog',
  command: 'command',
  assetBrowser: 'assetBrowser',
  animation: 'animation',
} as const

/**
 * 卡与卡之间的沟槽（px）。
 *
 * @remarks
 * 它同时是**边界**与**拖拽命中带**：交给 Dockview 的 `theme.gap`，间距因此进了布局算术
 * （`view.layout(size - marginReducedSize)`），sash 也被摆到间距正中。用 CSS 给视图内缩做不到
 * 这一点——Dockview 把内容尺寸用 JS 算好再写进去，内缩只会让内容比可见卡宽 6px 并在右侧被裁掉。
 * 编辑器四边的留白取同一个值，由 `.compose-editor__body` 的内边距给出。
 */
export const WORKSPACE_CARD_GAP = 6

/**
 * 四区的初值与最小尺寸。
 *
 * @remarks
 * 场景组与工具组的最小高度分别是 160 / 120：场景树至少要露出几行，工具组的瓦片至少要露出一排。
 * 工具组初始高度取可用高度的 40%，见 {@link computeToolsHeight}。
 */
export const WORKSPACE_SIZES = {
  scene: { initialWidth: 280, minimumWidth: 180, minimumHeight: 160 },
  tools: { minimumHeight: 120 },
  /*
   * Inspector 288 / 270：轨道按比例分之后（见 property-panel 的 `--pp-label-width`），400 里
   * 那 122px 富余全落在一个最多填四位数的输入框上。可读下限是 **264**——再窄一档，
   * 「1280 × 720 (HD)」这条最长的下拉就被箭头压住了。
   *
   * 配置值比它多一条沟槽：`theme.gap` 把间距摊进各视图（`gap × sash 数 / 视图数`，上界是
   * 一整条沟槽），因此**画出来的**盒总比配置的窄几个像素。少给这一份的症状是面板按自己的
   * `min-width` 撑到比容器宽，溢出去被卡片裁掉。
   */
  inspector: { initialWidth: 288, minimumWidth: 264 + WORKSPACE_CARD_GAP },
  bottom: { initialSize: 280, minimumSize: 160 },
} as const

/** 面板头高度（px）；`--dv-tabs-and-actions-container-height` 与折叠后的底部条高度都读它。 */
export const WORKSPACE_HEADER_HEIGHT = 30

