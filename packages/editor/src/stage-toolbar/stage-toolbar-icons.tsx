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
  | 'zoom-in'
  | 'zoom-out'

interface StageToolbarIconProps {
  name: StageToolbarIconName
}

/**
 * 取点方块：画在图标上的落点标记。
 *
 * @remarks
 * 每个方块是**这条命令要你点的一个点**——直线两点、矩形两个对角、整圆圆心加半径点、
 * 三点弧三个点。因此图标说的是「按下去之后会发生什么」，而不是画完之后长什么样。
 *
 * 形状取方块**与画布上的顶点夹点同形**：用户点进命令、画完之后看到的就是一串方块，图标上
 * 画圆点等于用两套词汇说同一件事。这也与 AutoCAD 的夹点一致。
 *
 * 填充而不描边：图标渲染在 20px 上，空心方块会糊成一个点，方与圆的差别正好全部丢在描边里。
 *
 * 边长 4.5 是量出来的而不是估的：描边 1.7，3 单位的方块只有描边的 1.8 倍宽，加上 round
 * 端帽之后与「线画粗了一点」在 20px 上分不出来。约 2.6 倍才读得出是一个方块。
 *
 * 颜色走 accent 而不是跟着描边的 `currentColor`：夹点与几何是两类东西，同色时它们读成
 * 一条粗细不匀的线，分色之后「这是可抓的点」才说得出来——AutoCAD 的夹点同样是唯一一处
 * 与几何不同色的标记。填充**由样式表给**（`.compose-editor__icon-grip`）而不是写成
 * presentation attribute：`var()` 在 presentation attribute 里不是所有浏览器都替换，
 * 而颜色必须跟着主题走。
 */
function gripMark(x: number, y: number) {
  const size = 4.5
  return (
    <rect
      className="compose-editor__icon-grip"
      height={size}
      width={size}
      x={x - size / 2}
      y={y - size / 2}
    />
  )
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
    // 弧：两个端点加弧上一点，正是 `ARC` 的三步取点；中间那个点画在弧的顶上，因为它就落
    // 在弧身上而不是弦上。弧画成半圆而不是浅浅一段：浅弧的三个方块挤在同一条横线上，读起来
    // 是「三个点」而不是「一段弧上的三个点」，弧身反倒被方块盖住了。
    arc: (
      <>
        <path d="M4 17a8 8 0 0 1 16 0" />
        {gripMark(4, 17)}
        {gripMark(12, 9)}
        {gripMark(20, 17)}
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
    // 整圆：圆心加一个半径点，正是 `CIRCLE` 的两步取点，也正好等于画布上仅有的两个夹点
    // （起点与终点落在同一个像素上，因此那里没有第三个）。圆心画出来是有意的：它不在任何
    // 线段上，却是画同心圆、把符号钉在轴上时用户真正要对齐的点。
    //
    // 半径点摆在 45 度而不是正右方：正右方的方块贴着画框边缘、只露出与圆重叠的那一半，
    // 读起来像圆上长了个瘤；斜着摆时它与圆心连成一条看得见的半径。圆也要画得足够大，
    // 否则圆心方块占掉直径的三分之一，整个图形读成一个录制键。
    circle: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        {gripMark(12, 12)}
        {gripMark(18, 6)}
      </>
    ),
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
    // 直线：两端各一个夹点方块。裸一条对角线与「斜的分隔线」没有区别，而夹点既说清了这是
    // 一条可编辑的几何，也让它与同组的多段线读成同一套词汇。
    line: (
      <>
        <path d="M5 18 19 6" />
        {gripMark(5, 18)}
        {gripMark(19, 6)}
      </>
    ),
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
    // 多段线：三段折线加各顶点夹点，与只有两个端点的 `line` 一眼可分。顶点铺开到画框两角，
    // 让四个方块彼此不粘连也不被边缘切掉——夹点占的地方比线本身大得多。
    //
    // 有意**不画弧段**：AutoCAD 的 PLINE 图标带一段弧，而我们的多段线顶点没有 bulge 字段，
    // 弧段在当前 `Curve` 协议里根本表达不出来——图标不宣称做不到的事。
    polyline: (
      <>
        <path d="M4 19l5.5-10 5.5 6 5-10" />
        {gripMark(4, 19)}
        {gripMark(9.5, 9)}
        {gripMark(15, 15)}
        {gripMark(20, 5)}
      </>
    ),
    // 矩形：两个**对角**落点，正是 `RECTANGLE` 的两步取点。四个角都画过一版：方块占的地方
    // 比边本身大得多，四个一摆图形就退化成「用细线连起来的四个蓝块」，在 20px 上读不出是
    // 一个矩形。图形本身画成闭合 path 而不是 `<rect>`，是因为矩形在我们这里**就是**四顶点
    // 的闭合多段线——圆角会替它宣称一件顶点表达不出来的事。
    rectangle: (
      <>
        <path d="M4 6h16v12H4z" />
        {gripMark(4, 6)}
        {gripMark(20, 18)}
      </>
    ),
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
