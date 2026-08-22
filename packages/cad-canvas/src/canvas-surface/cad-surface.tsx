import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  collectCadVisibleSegments,
  getCadPlacement,
  type CadDocument,
  type CadInteractionSnapshot,
  type CadPointerModifiers,
  type CadSnapCandidate,
} from '@compose-ui/cad'
import { CAD_GRID, createCadGridStyle } from '../grid'
import {
  cadPanViewport,
  cadScreenToWorld,
  cadWorldToScreen,
  cadZoomViewport,
  type CadCanvasPoint,
  type CadViewport,
} from '../viewport'

/** 命令进行中的未提交线段。 @internal */
export interface CadPreviewSegment {
  readonly start: CadCanvasPoint
  readonly end: CadCanvasPoint
  /**
   * 这一段是跟随指针的橡皮筋而不是已放置的顶点连成的段。
   *
   * @remarks
   * 两者都还没进文档，但含义不同：已放置的段再按一次也不会变，橡皮筋每次移动都在变。用同一种
   * 画法会让用户分不清「哪一段已经定下来了」。
   */
  readonly pending?: boolean
}

/**
 * 十字光标的一次绘制。
 *
 * @remarks
 * 形态由宿主按「当前等待的输入类型」给出，图面只负责画：没有活动命令时线与框都画，等待取点
 * 时只画线，等待选择对象时只画框。
 *
 * @internal
 */
export interface CadCrosshair {
  /** 光标中心的屏幕位置。 */
  readonly screen: CadCanvasPoint
  /** 画十字线。 */
  readonly lines: boolean
  /** 画拾取框。 */
  readonly box: boolean
  /** 拾取框的半边长（CSS 像素），等于点选命中容差。 */
  readonly boxRadius: number
  /** 十字线单侧长度占视口较短边的百分比（1–100）。 */
  readonly size: number
}

/** 归一化后的图面指针事件；点已换算为世界坐标。 @internal */
export interface CadSurfacePointerEvent {
  readonly pointerId: number
  readonly button: number
  readonly point: CadCanvasPoint
  readonly modifiers: CadPointerModifiers
}

/** CAD SVG 图面的属性。 @internal */
export interface CadSurfaceProps {
  readonly document: CadDocument
  /** 网格步长（世界单位）；`null` 表示不画网格。 */
  readonly gridStep: number | null
  readonly viewport: CadViewport
  readonly onViewportChange: (viewport: CadViewport) => void
  /**
   * 图面上的一次按下。
   *
   * @returns 是否被宿主接管；接管时图面捕获指针，并且**不再**走自己的中键平移兜底。
   */
  readonly onPointerDown: (event: CadSurfacePointerEvent) => boolean
  readonly onPointerMove: (event: CadSurfacePointerEvent) => void
  readonly onPointerUp: (event: CadSurfacePointerEvent) => void
  /** 指针捕获被浏览器收走或手势被中止。 */
  readonly onPointerAbort: (pointerId: number) => void
  /**
   * 指针在图面上移动，给出相对图面的**屏幕**位置；离开图面时为 `null`。
   *
   * @remarks
   * 报屏幕而不是世界坐标：世界坐标会在不以光标为锚点的视口变化后失效，宿主存下来就会与真实
   * 光标分离。换算由宿主在读取时完成。
   *
   * `pointerType` 一并给出：触摸没有光标，十字光标对它毫无意义，而这个判断只有事件本身
   * 知道。
   */
  readonly onHoverPoint: (point: CadCanvasPoint | null, pointerType: string) => void
  /** 当前捕捉命中的特征点；没有命中时为 `null`。 */
  readonly snap: CadSnapCandidate | null
  /** 选择集与框选；由宿主的交互仲裁发布。 */
  readonly interaction: CadInteractionSnapshot
  readonly previewSegments: readonly CadPreviewSegment[]
  /** 指针悬停命中的图元；没有命中或当前按下不会产生选择时为 `null`。 */
  readonly hovered: string | null
  /** 十字光标的形态与位置；不绘制时为 `null`。 */
  readonly crosshair: CadCrosshair | null
  readonly label: string
}

/** 每一格滚轮的缩放倍率；与 Stage 保持同一个手感。 */
const WHEEL_ZOOM_STEP = 1.1

/** 网格线的最小屏幕间距；低于它就不画，否则缩小视图时网格糊成一片。 */

/**
 * 求解当前视口内要画的网格线。
 *
 * @remarks
 * 按**屏幕间距**而不是缩放比例决定画不画：同一个 zoom 下，步长 1 与步长 100 的疏密差两个
 * 数量级，用 zoom 做门槛会在其中一边失效。
 */
/**
 * 渲染 CAD 图面并把指针输入归一化为世界坐标。
 *
 * @remarks
 * 图元颜色来自**所属图层**而不是图元自身（DXF 的 ByLayer）；找不到图层的图元不渲染——它已被
 * 文档校验拦下，能出现在这里只可能是外部写入，静默跳过好过画出一条无归属的线。
 *
 * 滚轮监听手动挂在原生元素上：React 的合成 wheel 是 passive 委托，`preventDefault` 拦不住
 * 页面滚动。
 *
 * @internal
 */
export function CadSurface({
  document,
  gridStep,
  viewport,
  onViewportChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerAbort,
  onHoverPoint,
  snap,
  interaction,
  previewSegments,
  hovered,
  crosshair,
  label,
}: CadSurfaceProps) {
  const surfaceRef = useRef<SVGSVGElement | null>(null)
  // 尺寸进 state 而不是渲染期读 ref：首帧还没有元素，且窗口或面板改变大小时网格必须重画。
  const [size, setSize] = useState({ width: 0, height: 0 })
  const panRef = useRef<{ pointerId: number; last: CadCanvasPoint } | null>(null)
  // 事件处理器从 ref 读取最新值：滚轮监听只注册一次，把 viewport 放进依赖会让它每帧重挂；
  // 宿主回调同样从这里读，宿主传内联箭头也不会让处理器每帧换身份。
  const latest = useRef({
    viewport,
    onViewportChange,
    onHoverPoint,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerAbort,
  })
  useLayoutEffect(() => {
    latest.current = {
      viewport,
      onViewportChange,
      onHoverPoint,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerAbort,
    }
  })

  const localPoint = useCallback((event: { clientX: number; clientY: number }): CadCanvasPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }, [])

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) setSize({ width: box.width, height: box.height })
    })
    observer.observe(surface)
    return () => { observer.disconnect() }
  }, [])

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = surface.getBoundingClientRect()
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP
      latest.current.onViewportChange(cadZoomViewport(latest.current.viewport, factor, anchor))
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => { surface.removeEventListener('wheel', onWheel) }
  }, [])

  /** 归一化一次指针事件：屏幕坐标换成世界坐标，修饰键收成一个平坦结构。 */
  const normalize = useCallback((event: ReactPointerEvent<SVGSVGElement>): CadSurfacePointerEvent => ({
    pointerId: event.pointerId,
    button: event.button,
    point: cadScreenToWorld(latest.current.viewport, localPoint(event)),
    modifiers: { shift: event.shiftKey, alt: event.altKey, command: event.metaKey || event.ctrlKey },
  }), [localPoint])

  const releaseCapture = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  /**
   * 图面上的指针拥有者只有一个。
   *
   * @remarks
   * **所有按下先问宿主**（宿主内部走仲裁器），只有被拒绝才轮到图面自己的中键平移。两个独立
   * 的指针拥有者才是真正会出问题的写法——平移与框选各自捕获指针时，谁先谁后取决于事件顺序。
   */
  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (latest.current.onPointerDown(normalize(event))) {
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    // 右键留给后续的上下文菜单，这里不接管。
    if (event.button !== 1) return
    event.preventDefault()
    panRef.current = { pointerId: event.pointerId, last: localPoint(event) }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [localPoint, normalize])

  /**
   * 图面永远不接管键盘焦点。
   *
   * @remarks
   * 焦点移动是 `mousedown` 的默认动作，而对 `pointertype` 为 mouse 的指针，`pointerdown` 上的
   * `preventDefault` 并不抑制随后的兼容鼠标事件——所以宿主在 `pointerdown` 里把焦点收回命令行
   * 之后，浏览器仍会在 `mousedown` 上把它甩掉。必须在这里拦住。
   *
   * 顺带也拦掉了图面上的文字拖选与中键自动滚动，两者在无限图纸上都只是干扰。
   */
  const handleMouseDown = useCallback((event: ReactMouseEvent<SVGSVGElement>) => {
    event.preventDefault()
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) {
      // 不在平移中才上报悬停：平移时光标位置代表的是视图位移，拿它求捕捉毫无意义。
      latest.current.onHoverPoint(localPoint(event), event.pointerType)
      latest.current.onPointerMove(normalize(event))
      return
    }
    const point = localPoint(event)
    latest.current.onViewportChange(cadPanViewport(latest.current.viewport, {
      x: point.x - pan.last.x,
      y: point.y - pan.last.y,
    }))
    panRef.current = { pointerId: pan.pointerId, last: point }
  }, [localPoint, normalize])

  const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      releaseCapture(event)
      return
    }
    latest.current.onPointerUp(normalize(event))
    releaseCapture(event)
  }, [normalize, releaseCapture])

  /**
   * 指针捕获被收走或手势被中止。
   *
   * @remarks
   * `lostpointercapture` 在正常松手后也会触发，因此这里只处理**还没结束**的手势：平移由自己
   * 的 ref 判定，其余交给宿主决定要不要取消。宿主那边的取消是幂等的。
   */
  const handlePointerAbort = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      return
    }
    latest.current.onPointerAbort(event.pointerId)
  }, [])

  const layerColors = new Map(document.layers.map((layer) => [layer.id, layer]))
  // 与命中、框选、捕捉共用同一条可见性遍历：渲染跟它们分叉时，会出现「看得见却点不中」。
  const segments = collectCadVisibleSegments(document)
  const selected = new Set(interaction.selection)

  return (
    <svg
      ref={surfaceRef}
      aria-label={label}
      className="compose-cad-canvas__surface"
      style={createCadGridStyle(gridStep, CAD_GRID, viewport, globalThis.devicePixelRatio || 1)}
      data-crosshair={crosshair ? '' : undefined}
      data-testid="cad-surface"
      role="img"
      onPointerCancel={handlePointerAbort}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
      onPointerLeave={(event) => { latest.current.onHoverPoint(null, event.pointerType) }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {segments.map(({ ownerId, segment }, index) => {
        const owner = document.entities[ownerId]
        const layer = owner ? layerColors.get(getCadPlacement(owner)?.layerId ?? '') : undefined
        if (!layer) return null
        const start = cadWorldToScreen(viewport, segment.start)
        const end = cadWorldToScreen(viewport, segment.end)
        const isSelected = selected.has(ownerId)
        const isHovered = !isSelected && ownerId === hovered
        return (
          <line
            // 块实例展开成多段，各段共用 ownerId，因此 key 要带上序号。
            key={`${ownerId}-${index}`}
            className="compose-cad-canvas__entity"
            data-cad-entity={ownerId}
            data-hovered={isHovered ? '' : undefined}
            data-selected={isSelected ? '' : undefined}
            // 选中态不改 stroke 属性而是交给 CSS：图元颜色来自图层（ByLayer），把高亮写死在
            // 属性上会让「这条线是什么颜色」有两个答案。
            stroke={isSelected || isHovered ? undefined : layer.color}
            strokeWidth={1}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        )
      })}
      {interaction.marquee ? (
        <MarqueeRect marquee={interaction.marquee} viewport={viewport} />
      ) : null}
      {snap ? <SnapMarker snap={snap} viewport={viewport} /> : null}
      {previewSegments.map((segment, index) => {
        const start = cadWorldToScreen(viewport, segment.start)
        const end = cadWorldToScreen(viewport, segment.end)
        return (
          <line
            key={`preview-${index}`}
            className={segment.pending
              ? 'compose-cad-canvas__preview compose-cad-canvas__preview--pending'
              : 'compose-cad-canvas__preview'}
            data-cad-preview={segment.pending ? 'pending' : ''}
            strokeWidth={1}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        )
      })}
      {crosshair ? <Crosshair crosshair={crosshair} size={size} /> : null}
    </svg>
  )
}

/**
 * 绘制十字光标。
 *
 * @remarks
 * **十字线在拾取框处断开。**容差 8px 意味着框约 16px 见方，而那正是用户要看清的靶区；两条
 * 1px 的线直穿过去，等于用光标盖住自己正对准的东西。
 *
 * 线按一对轴向量绘制而不是写死 `x1=0/x2=width`：AutoCAD 的十字线对齐的是 UCS 轴，转了 UCS
 * 就跟着转。我们现在没有 UCS，屏幕轴对齐是对的，但以后加进来时改的是向量来源而不是这里。
 */
function Crosshair({ crosshair, size }: {
  readonly crosshair: CadCrosshair
  readonly size: { readonly width: number; readonly height: number }
}) {
  const { screen, lines, box, boxRadius, size: percent } = crosshair
  // 长度按视口较短边取百分比，与 AutoCAD 的 CURSORSIZE 同义；100 时贯穿整个图面。
  const reach = (Math.min(size.width, size.height) * percent) / 100
  const gap = box ? boxRadius : 0
  const AXES = [{ x: 1, y: 0 }, { x: 0, y: 1 }] as const
  return (
    <g className="compose-cad-canvas__crosshair" data-testid="cad-crosshair">
      {lines ? AXES.flatMap((axis, index) => [-1, 1].map((direction) => (
        <line
          key={`axis-${index}-${direction}`}
          data-cad-crosshair-line=""
          x1={screen.x + axis.x * gap * direction}
          x2={screen.x + axis.x * reach * direction}
          y1={screen.y + axis.y * gap * direction}
          y2={screen.y + axis.y * reach * direction}
        />
      ))) : null}
      {box ? (
        <rect
          data-cad-crosshair-box=""
          data-testid="cad-pickbox"
          height={boxRadius * 2}
          width={boxRadius * 2}
          x={screen.x - boxRadius}
          y={screen.y - boxRadius}
        />
      ) : null}
    </g>
  )
}


/** 捕捉标记的屏幕半径（CSS 像素）。 */
const SNAP_MARKER_RADIUS = 5

/**
 * 按模式渲染捕捉标记。
 *
 * @remarks
 * 形状沿用 AutoCAD 的约定：端点方框、中点三角、交点叉号。用形状而不是颜色区分，是因为用户
 * 要在扫视中判断「捕到的是不是我想要的那个特征」，形状在余光里也分得清。
 */
function SnapMarker({ snap, viewport }: {
  readonly snap: CadSnapCandidate
  readonly viewport: CadViewport
}) {
  const { x, y } = cadWorldToScreen(viewport, snap.point)
  const r = SNAP_MARKER_RADIUS
  const shared = {
    className: 'compose-cad-canvas__snap-marker',
    'data-snap-mode': snap.mode,
    'data-testid': 'cad-snap-marker',
  }
  if (snap.mode === 'endpoint') {
    return <rect {...shared} height={r * 2} width={r * 2} x={x - r} y={y - r} />
  }
  if (snap.mode === 'midpoint') {
    return <polygon {...shared} points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`} />
  }
  return (
    <path
      {...shared}
      d={`M ${x - r} ${y - r} L ${x + r} ${y + r} M ${x + r} ${y - r} L ${x - r} ${y + r}`}
    />
  )
}


/**
 * 渲染框选的选框。
 *
 * @remarks
 * **实线是窗口、虚线是交叉**，沿用 AutoCAD 的约定。这条视觉区分不是装饰：两种模式选中的东西
 * 差别很大，用户要在拉框的过程中就知道自己拉的是哪一种。
 */
function MarqueeRect({ marquee, viewport }: {
  readonly marquee: NonNullable<CadInteractionSnapshot['marquee']>
  readonly viewport: CadViewport
}) {
  const topLeft = cadWorldToScreen(viewport, { x: marquee.bounds.minX, y: marquee.bounds.minY })
  const bottomRight = cadWorldToScreen(viewport, { x: marquee.bounds.maxX, y: marquee.bounds.maxY })
  return (
    <rect
      className="compose-cad-canvas__marquee"
      data-marquee-mode={marquee.mode}
      data-testid="cad-marquee"
      height={bottomRight.y - topLeft.y}
      width={bottomRight.x - topLeft.x}
      x={topLeft.x}
      y={topLeft.y}
    />
  )
}
