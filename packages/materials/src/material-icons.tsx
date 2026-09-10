/**
 * 物料 Palette / 场景树共用的单色线稿图标。
 *
 * @remarks
 * 24 网格、1.5 描边、圆头圆角，一律 `currentColor`：颜色由所在的行给出（静息用次要文字色、
 * 悬停与选中随行提亮），图标自己不带色相——面板与场景树上颜色已经被选中、拖放与运行状态占着，
 * 十几个各带一种色相的立体图标只会把那几层信号淹掉。形状承担全部区分：容器是井号、组是虚线框
 * 套两块、切换器是叠放的卡片、曲线是带两个端点方块的斜线。
 *
 * @internal
 */

const svgProps = {
  'aria-hidden': true as const,
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  className: 'compose-material-icon',
}

/** Container：井号字形，与 Figma Frame / Rive Artboard 的通行标识一致；两竖略斜，免得与网格线读成一回事。 */
export function ComposeContainerMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-container">
      <path d="M9.2 4.5 7.6 19.5" />
      <path d="M16.6 4.5 15 19.5" />
      <path d="M4.5 9.2h15" />
      <path d="M4 15h15" />
    </svg>
  )
}

/**
 * Rectangle（盒物料，已从面板退役）：带淡填充的矩形。
 *
 * @remarks
 * 与 Rect 的空心轮廓刻意不同——一个是有背景与边框的面积，一个是可改形状的几何轮廓；既有文档
 * 的场景树里两者都会出现，长得一样会让用户按名字去猜。
 */
export function ComposeRectangleMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-rectangle">
      <rect x="4.5" y="6.5" width="15" height="11" fill="currentColor" fillOpacity="0.18" />
    </svg>
  )
}

/** Rect：空心矩形轮廓，两个对角的实心小方块表示可拖的顶点。 */
export function ComposeRectMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-rect">
      <rect x="4.5" y="6.5" width="15" height="11" />
      <rect x="3" y="5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="18" y="16" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Group：虚线外框套两块成员。 */
export function ComposeGroupMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-group">
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="2.5 2" />
      <rect x="7" y="7" width="4.5" height="4.5" />
      <rect x="12.5" y="12.5" width="4.5" height="4.5" />
    </svg>
  )
}

/** WidgetSwitcher：叠放的卡片，只画出最前一张的完整轮廓。 */
export function ComposeWidgetSwitcherMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-widget-switcher">
      <rect x="4.5" y="8.5" width="12" height="10" rx="1.5" />
      <path d="M8 5.5h11.5V16" />
    </svg>
  )
}

/** Text：衬线 T。 */
export function ComposeTextMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-text">
      <path d="M6 6h12" />
      <path d="M12 6v13" />
      <path d="M9.5 19h5" />
    </svg>
  )
}

/** Image：相框、山景与太阳。 */
export function ComposeImageMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-image">
      <rect x="4.5" y="5.5" width="15" height="13" rx="1" />
      <path d="m5 17 4.5-5 3.5 3.5 2.5-2.5 3.5 4" />
      <circle cx="15.5" cy="9.5" r="1.5" />
    </svg>
  )
}

/** SVG：一段贝塞尔加两根切线手柄。 */
export function ComposeSvgMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-svg">
      <path d="M5 18c2-11 9 11 14-6" />
      <circle cx="5" cy="18" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <path d="M5 18 8 10" />
      <path d="m19 12-3 7" />
    </svg>
  )
}

/** Line / Curve：斜线，两端各一个端点方块。 */
export function ComposeLineMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-line">
      <path d="M6 18 18 6" />
      <rect x="4.5" y="16.5" width="3" height="3" />
      <rect x="16.5" y="4.5" width="3" height="3" />
    </svg>
  )
}

/** Arrow */
export function ComposeArrowMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-arrow">
      <path d="M4.5 12h13" />
      <path d="m13.5 8 4 4-4 4" />
    </svg>
  )
}

/** Circle */
export function ComposeCircleMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-circle">
      <circle cx="12" cy="12" r="7" />
    </svg>
  )
}

/**
 * 柱状图示意图标（示例 ECharts 等图表物料可复用）。
 *
 * @public
 */
export function ComposeEchartsMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-echarts">
      <path d="M3.5 20h17" />
      <path d="M6.5 20v-6" />
      <path d="M11 20V6" />
      <path d="M15.5 20v-9" />
      <path d="M20 20v-4" />
    </svg>
  )
}
