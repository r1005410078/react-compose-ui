type StageToolbarIconName =
  | 'arc'
  | 'arrow'
  | 'center-view'
  | 'chevron-down'
  | 'circle'
  | 'container'
  | 'create-frame'
  | 'fit-frame'
  | 'fit-selection'
  | 'grid'
  | 'grid-snap'
  | 'line'
  | 'move'
  | 'pan'
  | 'polyline'
  | 'rectangle'
  | 'rotate'
  | 'save'
  | 'scale'
  | 'select'
  | 'settings'
  | 'smart-snap'
  | 'text'
  | 'wire'
  | 'zoom-in'
  | 'zoom-out'

interface StageToolbarIconProps {
  name: StageToolbarIconName
}

/**
 * Stage 工具栏使用内联描边图标，避免把图标库变成 editor 的运行时依赖。
 *
 * @internal
 */
export function StageToolbarIcon({ name }: StageToolbarIconProps) {
  const content = {
    'create-frame': (
      <>
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    'fit-frame': (
      <>
        <rect height="12" rx="1" width="14" x="5" y="6" />
        <path d="M2.5 8V3.5H7M17 3.5h4.5V8M21.5 16v4.5H17M7 20.5H2.5V16" />
      </>
    ),
    'fit-selection': (
      <>
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </>
    ),
    // 弧：一段扫掠不足半圆的圆弧，两端各一个端点标记——与 `ARC` 的三点取法呼应。
    arc: (
      <>
        <path d="M4 18a10 10 0 0 1 16 0" />
        <circle cx="4" cy="18" fill="currentColor" r="1.3" stroke="none" />
        <circle cx="20" cy="18" fill="currentColor" r="1.3" stroke="none" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 19 19 4" />
        <path d="M12 4h7v7" />
      </>
    ),
    'center-view': (
      <>
        <path d="M8.5 3.5v4h-4M15.5 3.5v4h4M15.5 20.5v-4h4M8.5 20.5v-4h-4" />
        <path d="M12 8.5v7M8.5 12h7" />
      </>
    ),
    'chevron-down': <path d="m7 10 5 5 5-5" />,
    circle: <circle cx="12" cy="12" r="7.25" />,
    // 井号字形：与 Figma Frame / Rive Artboard 的通行标识一致，避免与 rectangle 工具混淆。
    container: <path d="M9.5 4 7.5 20M16.5 4l-2 16M4 9h16M3 15h16" />,
    'grid-snap': (
      <g stroke="#58a6ff">
        <path d="M4 4h16M4 10h16M4 16h16M4 4v12M10 4v12M16 4v12M20 4v12" />
        <path d="M8 14v2.5a4 4 0 0 0 8 0V14M8 14h3M13 14h3" />
      </g>
    ),
    grid: (
      <g stroke="#58a6ff">
        <path d="M4 4h16M4 10h16M4 16h16M4 4v12M10 4v12M16 4v12M20 4v12" />
        <path d="M8 14v2.5a4 4 0 0 0 8 0V14M8 14h3M13 14h3" />
      </g>
    ),
    line: <path d="M4 19 20 5" />,
    move: (
      <>
        <path d="M12 3v18M3 12h18" />
        <path d="m12 3-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
      </>
    ),
    pan: (
      <>
        <path d="M8.5 11V5.5a1.5 1.5 0 0 1 3 0V10" />
        <path d="M11.5 9V4.5a1.5 1.5 0 0 1 3 0V10" />
        <path d="M14.5 9V6a1.5 1.5 0 0 1 3 0v5" />
        <path d="M17.5 9.5a1.5 1.5 0 0 1 3 0v4.25C20.5 18.3 17.8 21 13.25 21H12c-2.35 0-4.1-1.1-5.5-3L3.8 14.2a1.65 1.65 0 0 1 2.55-2.05L8.5 14.5" />
      </>
    ),
    // 多段线：三段折线加各顶点标记，与只有两个端点的 `line` 一眼可分。
    polyline: (
      <>
        <path d="M3 18l5-8 5 5 8-11" />
        <circle cx="3" cy="18" fill="currentColor" r="1.3" stroke="none" />
        <circle cx="8" cy="10" fill="currentColor" r="1.3" stroke="none" />
        <circle cx="13" cy="15" fill="currentColor" r="1.3" stroke="none" />
        <circle cx="21" cy="4" fill="currentColor" r="1.3" stroke="none" />
      </>
    ),
    rectangle: <rect height="13" rx="1" width="17" x="3.5" y="5.5" />,
    rotate: (
      <>
        <path d="M18.5 8.5A7.2 7.2 0 1 0 19 16" />
        <path d="M18.5 3.5v5h-5" />
      </>
    ),
    // 软盘轮廓：右上角切角表示写入介质，内部上下两块分别是滑片与标签。
    save: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M9 4v5h6V4" />
        <path d="M8 20v-6h8v6" />
      </>
    ),
    scale: (
      <>
        <rect height="8" width="8" x="8" y="8" />
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </>
    ),
    select: (
      <>
        <path d="m5 3 13 9-6.2 1.35L9 19Z" />
        <path d="m12 13.35 4.5 6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2.1-.7-.5-1.2 1-2-2.1-2.1-2 1-1.2-.5L10.5 3h-3l-.7 2.1-1.2.5-2-1-2.1 2.1 1 2-.5 1.2-2 .7v3l2 .7.5 1.2-1 2 2.1 2.1 2-1 1.2.5.7 2.1h3l.7-2.1 1.2-.5 2 1 2.1-2.1-1-2 .5-1.2z" transform="translate(2.5 0) scale(.79 1)" />
      </>
    ),
    'smart-snap': (
      <>
        <path d="M8 5v7a4 4 0 0 0 8 0V5M6 5h4M14 5h4M8 9h3M13 9h3" />
        <circle cx="4" cy="9" fill="currentColor" r="0.8" stroke="none" />
        <circle cx="4" cy="15" fill="currentColor" r="0.8" stroke="none" />
        <circle cx="20" cy="15" fill="currentColor" r="0.8" stroke="none" />
      </>
    ),
    text: (
      <>
        <path d="M5 5h14M12 5v14M8 19h8" />
      </>
    ),
    // 导线：一段水平线，两端各接一个方块端子——它与普通直线的差别正是「接到什么上」。
    wire: (
      <>
        <path d="M7 12h10" />
        <rect height="6" width="4" x="3" y="9" />
        <rect height="6" width="4" x="17" y="9" />
      </>
    ),
    'zoom-in': (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" />
      </>
    ),
    'zoom-out': (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5M7.5 10.5h6" />
      </>
    ),
  } satisfies Record<StageToolbarIconName, React.ReactNode>

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {content[name]}
    </svg>
  )
}
