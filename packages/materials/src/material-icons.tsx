/**
 * 物料 Palette / 场景树用的彩色等轴测或立体图标。
 *
 * @remarks
 * 避免单色 `currentColor` 扁平字：顶/面/阴影用不同明度形成体积感；色相按物料语义区分。
 *
 * @internal
 */

const svgProps = {
  'aria-hidden': true as const,
  fill: 'none' as const,
  viewBox: '0 0 24 24',
  className: 'compose-material-icon',
}

/**
 * Container：井号字形，与 Figma Frame / Rive Artboard 的通行标识一致。
 *
 * @remarks
 * 与 Rectangle 一样采用平面处理：容器的语义是“框住一片区域”，立体块反而会读成实心物体。
 */
export function ComposeContainerMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-container">
      {/* 两竖略带倾斜，避免与网格线读成同一个东西 */}
      <path d="M9.1 3.5h2.4L9.9 20.5H7.5Z" fill="#2f7df6" />
      <path d="M15.6 3.5H18l-1.6 17H14Z" fill="#2f7df6" />
      {/* 两横压在竖线之上，颜色更亮以形成交叠层次 */}
      <path d="M4.2 8.3h15.6v2.5H4.2Z" fill="#6eb0ff" />
      <path d="M3.6 13.2h15.6v2.5H3.6Z" fill="#6eb0ff" />
    </svg>
  )
}

/**
 * Rectangle：平面直角矩形（与默认无圆角语义一致），非 3D。
 */
export function ComposeRectangleMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-rectangle">
      <rect x="4.5" y="6.5" width="15" height="11" fill="#2f7df6" />
      <rect
        x="4.5"
        y="6.5"
        width="15"
        height="11"
        fill="none"
        stroke="#9fd0ff"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
    </svg>
  )
}

/** Group：两层叠框，青绿。 */
export function ComposeGroupMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-group">
      <rect x="3" y="4" width="12" height="10" rx="1.6" fill="#1a6b5a" opacity="0.9" />
      <rect x="3" y="4" width="12" height="10" rx="1.6" fill="#34d399" opacity="0.35" />
      <rect x="3" y="4" width="12" height="3.2" rx="1.2" fill="#6ee7b7" />
      <rect
        x="7"
        y="9"
        width="12"
        height="10"
        rx="1.6"
        fill="#0f766e"
        stroke="#5eead4"
        strokeOpacity="0.5"
        strokeWidth="0.8"
      />
      <rect x="7" y="9" width="12" height="3.2" rx="1.2" fill="#2dd4bf" />
      <path d="M10 14.5h6M10 17h4" stroke="#ccfbf1" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/** WidgetSwitcher：叠放的卡片只亮起最前一张，紫色。 */
export function ComposeWidgetSwitcherMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-widget-switcher">
      {/* 后两张是未激活分支，压暗表示只构造不显示 */}
      <rect x="7.5" y="3.5" width="12" height="9" rx="1.6" fill="#4c1d95" opacity="0.35" />
      <rect x="6" y="6" width="12" height="9" rx="1.6" fill="#5b21b6" opacity="0.55" />
      <rect x="4.5" y="8.5" width="12" height="9" rx="1.6" fill="#7c3aed" />
      <rect x="4.5" y="8.5" width="12" height="2.6" rx="1.2" fill="#c4b5fd" />
      <path
        d="M7.5 13.5h6M7.5 15.6h3.6"
        stroke="#ede9fe"
        strokeOpacity="0.6"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Text：立体 T，琥珀。 */
export function ComposeTextMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-text">
      <path d="M6 5.5h12v3.2H14.2V18.5h-4.4V8.7H6Z" fill="#92400e" transform="translate(1 1.2)" opacity="0.45" />
      <path d="M5.5 5h12v3.2H13.7V18h-3.4V8.2H5.5Z" fill="#f59e0b" />
      <path d="M5.5 5h12v1.4H5.5Z" fill="#fcd34d" />
      <path d="M5.5 5h12v3.2H13.7V18h-3.4V8.2H5.5Z" fill="none" stroke="#fde68a" strokeOpacity="0.55" strokeWidth="0.7" />
    </svg>
  )
}

/** Image：相框 + 山景，玫瑰/青。 */
export function ComposeImageMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-image">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="#3f3f46" />
      <rect x="4.5" y="5.5" width="15" height="13" rx="1.4" fill="#18181b" />
      <path d="M4.5 15.5 9 11l3.2 3.2 2.3-2.8 4.5 4.1v1.5c0 .8-.6 1.4-1.4 1.4H5.9c-.8 0-1.4-.6-1.4-1.4Z" fill="#0d9488" />
      <path d="M4.5 15.5 9 11l3.2 3.2 2.3-2.8 4.5 4.1" fill="#2dd4bf" opacity="0.35" />
      <circle cx="9.2" cy="9" r="1.7" fill="#fbbf24" />
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="15"
        rx="2"
        fill="none"
        stroke="#a1a1aa"
        strokeOpacity="0.45"
        strokeWidth="0.7"
      />
    </svg>
  )
}

/** SVG：菱形矢量标，品红系。 */
export function ComposeSvgMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-svg">
      <path d="M12 3.5 20 12l-8 8.5L4 12Z" fill="#831843" opacity="0.5" transform="translate(0 1)" />
      <path d="M12 3 20 11.5 12 20 4 11.5Z" fill="#db2777" />
      <path d="M12 3 20 11.5 12 12.8Z" fill="#f9a8d4" opacity="0.85" />
      <path d="M12 3 4 11.5 12 12.8Z" fill="#f472b6" opacity="0.7" />
      <path d="M12 12.8 20 11.5 12 20Z" fill="#9d174d" />
      <path d="M12 12.8 4 11.5 12 20Z" fill="#be185d" />
      <path d="M12 3 20 11.5 12 20 4 11.5Z" fill="none" stroke="#fbcfe8" strokeOpacity="0.5" strokeWidth="0.7" />
    </svg>
  )
}


/** Line */
export function ComposeLineMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-line">
      <path d="M5 17 19 7" stroke="#64748b" strokeWidth="3.2" strokeLinecap="round" opacity="0.45" />
      <path d="M5 17 19 7" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 17 19 7" stroke="#e2e8f0" strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

/** Arrow */
export function ComposeArrowMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-arrow">
      <path d="M5 16.5 16 7" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      <path d="M5 16.5 16 7" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 6.2 18.2 5.4 16.2 10.8" fill="#60a5fa" />
      <path d="M12.5 6.2 18.2 5.4 16.2 10.8Z" fill="#93c5fd" opacity="0.5" />
    </svg>
  )
}

/** Circle */
export function ComposeCircleMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-circle">
      <circle cx="12.5" cy="13" r="7" fill="#0e7490" opacity="0.4" />
      <circle cx="12" cy="12" r="7" fill="#06b6d4" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#a5f3fc" strokeOpacity="0.5" strokeWidth="0.8" />
      <ellipse cx="10" cy="9.5" rx="3.2" ry="2" fill="#fff" opacity="0.28" />
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
      <rect x="4" y="13" width="3.5" height="6.5" rx="0.6" fill="#1d4ed8" />
      <rect x="4" y="13" width="3.5" height="1.4" rx="0.4" fill="#60a5fa" />
      <rect x="10" y="8.5" width="3.5" height="11" rx="0.6" fill="#7c3aed" />
      <rect x="10" y="8.5" width="3.5" height="1.4" rx="0.4" fill="#c4b5fd" />
      <rect x="16" y="5.5" width="3.5" height="14" rx="0.6" fill="#db2777" />
      <rect x="16" y="5.5" width="3.5" height="1.4" rx="0.4" fill="#f9a8d4" />
      <path d="M3.5 19.5h17" stroke="#64748b" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}
