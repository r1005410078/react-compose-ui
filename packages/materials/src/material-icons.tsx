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

/** Container：开口框 + 内层，蓝灰立体。 */
export function ComposeContainerMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-container">
      {/* 底面阴影 */}
      <path
        d="M4.5 8.2 12 4.5l7.5 3.7v8.6L12 20.5 4.5 16.8Z"
        fill="#1a3558"
        opacity="0.35"
        transform="translate(0 1.2)"
      />
      {/* 外框体 */}
      <path d="M4.5 7.2 12 3.5l7.5 3.7v8.6L12 19.5 4.5 15.8Z" fill="#2d6cb5" />
      <path d="M4.5 7.2 12 10.9 19.5 7.2" fill="#6eb0ff" />
      <path d="M12 10.9 19.5 7.2v8.6L12 19.5Z" fill="#245a9a" />
      <path d="M4.5 7.2 12 10.9 12 19.5 4.5 15.8Z" fill="#3d86d4" />
      {/* 内腔：更深，表现“可容纳” */}
      <path d="M8 9.8 12 7.9l4 1.9v4.4L12 16.1 8 14.2Z" fill="#0f243d" opacity="0.55" />
      <path d="M8 9.8 12 11.7 16 9.8" fill="#8ec4ff" opacity="0.45" />
      <path
        d="M4.5 7.2 12 3.5l7.5 3.7v8.6L12 19.5 4.5 15.8Z"
        stroke="#9fd0ff"
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />
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

/** Page Slot：嵌套文档，靛蓝。 */
export function ComposePageSlotMaterialIcon() {
  return (
    <svg {...svgProps} data-testid="material-icon-page-slot">
      <rect x="4" y="3.5" width="13" height="16" rx="1.5" fill="#312e81" />
      <rect x="4" y="3.5" width="13" height="3" rx="1.2" fill="#6366f1" />
      <path d="M6.5 9h8M6.5 11.5h8M6.5 14h5.5" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <rect x="9" y="7" width="11" height="13.5" rx="1.5" fill="#1e1b4b" stroke="#818cf8" strokeWidth="0.8" />
      <rect x="9" y="7" width="11" height="2.6" rx="1" fill="#4f46e5" />
      <path d="M11.5 12.5h6M11.5 15h4.5" stroke="#c7d2fe" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
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
