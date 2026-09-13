import type { ComposeDocument } from '@compose-ui/core'
import type { ComposeAngleConstraint } from '@compose-ui/core'
import type {
  ComposeStageDispatch,
  ComposeStageTool,
} from '@compose-ui/stage'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, ReactNode, RefObject, SetStateAction } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import {
  ComposeColorPicker,
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
  useComposeContextMenu,
} from '@compose-ui/components'
import { getEditorMessages } from '../editor-i18n'
import {
  formatComposeEditorKeybinding,
  type ComposeEditorPreferences,
  type ComposeEditorShortcutAction,
} from '../editor-preferences'
import type { ComposeEditorActionId } from '../editor-controller/action-catalog'
import { CanvasSettingsPopover } from './canvas-settings-popover'
import { StageToolbarIcon } from './stage-toolbar-icons'
import { useComposeToolbarTooltip } from './toolbar-tooltip'
import {
  COMPOSE_TOOLBAR_SELECT_ID,
  COMPOSE_TOOLBAR_SEPARATOR,
  insertToolbarSeparator,
  normalizeToolbarShelf,
  removeToolbarShelfItem,
  splitToolbarShelf,
  useComposeToolbarShelf,
} from './toolbar-shelf'
import type { ComposeToolbarItem, ComposeToolbarShelf } from './toolbar-shelf'
import { composeHatchSwatches } from './hatch-swatches'

type DefaultStageToolbarProps = {
  /** 正在跑的那条命令的 id；绘图命令按钮的按下态读它。 */
  readonly activeCommandId: string | null
  readonly canvasSettingsOpen: boolean
  readonly dispatch: ComposeStageDispatch
  readonly document: ComposeDocument
  readonly gridVisible: boolean
  readonly nextId: () => string
  readonly setCanvasSettingsOpen: Dispatch<SetStateAction<boolean>>
  readonly setGridSize: (size: number) => void
  readonly setGridVisible: Dispatch<SetStateAction<boolean>>
  readonly setTool: (tool: ComposeStageTool) => void
  readonly setTransformGizmo: (visible: boolean) => void
  readonly transformGizmo: boolean
  readonly shortcuts?: ComposeEditorPreferences['shortcuts']
  /** 启动一条命令会话；与在命令行里键入这个名字等价。 */
  readonly startCommand: (commandId: string) => void
  /** `HATCH` 这一次的填充色；桶身印它。 */
  readonly hatchColor: string
  /** 从色板换色；命令里的 `C` 关键字是这条能力的第二个入口。 */
  readonly setHatchColor: (color: string) => void
  /**
   * 打开「自定义工具栏」对话框；缺席时右键菜单里那一项不出现。
   *
   * @remarks
   * 对话框住在工作区那一层（它要读写偏好），工具栏只负责把入口摆在**用户的手边**——嫌某颗
   * 按钮碍事的那一刻，指针正停在它上面。
   */
  readonly onCustomize?: () => void
  /** 改当前工作区的货架；右键的「移除」与「插入分隔」走它。缺席时那两项不出现。 */
  readonly onShelfChange?: (shelf: ComposeToolbarShelf) => void
  /**
   * 当前工作区的货架：按顺序排的目录 id。
   *
   * @remarks
   * 缺席时铺目录里的全部项（按内建顺序），因此不认识工作区的宿主一个像素都不变。
   */
  readonly shelf?: ComposeToolbarShelf
  /** 宿主往目录里补的项；每一项指向一个已有动作或命令。 */
  readonly toolbarItems?: readonly ComposeToolbarItem[]
  /** 跑一个编辑器动作；宿主注入项的 `action` 目标走它。 */
  readonly runAction?: (actionId: ComposeEditorActionId) => void
  readonly toggleSnap: () => void
  readonly tool: ComposeStageTool
  /** 角度约束的三态；正交与极轴两个按钮是同一个单选组的两个成员。 */
  readonly angleConstraint: ComposeAngleConstraint
  readonly setAngleConstraint: (next: ComposeAngleConstraint) => void
  readonly polarIncrement: number
  readonly setPolarIncrement: (degrees: number) => void
}

/**
 * 增量角的取值：AutoCAD 的八个 360 约数。
 *
 * @remarks
 * 只有整除 360 的角才能成族铺满一圈——37° 那样的角在 AutoCAD 里属于**附加角**（一条，不是
 * 一族），是另一张表。那张表这里不做：它需要一整套增删行的编辑面，而眼下没有消费者。
 */
const POLAR_INCREMENTS = [90, 45, 30, 22.5, 18, 15, 10, 5] as const

/**
 * 工具栏上的绘图命令：命令 id、文案键与图标名。
 *
 * @remarks
 * 按钮与命令行是**同一条命令的两个入口**（拖一下是快，敲名字是精确），因此这里只有 id：
 * 提示文本、取点、捕捉与预览全部由 Stage 那一侧的会话负责。
 *
 * 导线在这里占一个按钮：一次接线图上它是**独立的活儿**（红色粗实线、只走横平竖直、可以有
 * 拐点），不是「一条恰好接上的线」。而「用不绑定的命令画出来的接线像素级正确却从未接上」这个
 * 屏幕上看不见的错误由另一条判断挡住——`LINE` 顺手吸上端口时同样绑定，两条路都通。
 *
 * 曾经这里是一个形状 split button（矩形 / 箭头 / 圆），走的是 `draw-*` 工具那套拖拽绘制。
 * 三个工具随本组一起删除：制图几何一律由命令产出，而留着它们会让一处已知的仲裁器冲突
 * 变得用鼠标就能触发——取点插件（1650）高于绘制（1000），两者同时武装时 `pointerdown`
 * 被前者吃掉、拖动永远起不来。
 */
const DRAWING_COMMANDS = [
  ['LINE', 'drawLine', 'line'],
  ['PLINE', 'drawPolyline', 'polyline'],
  ['RECTANGLE', 'drawRectangle', 'rectangle'],
  ['POLYGON', 'drawPolygon', 'polygon'],
  ['CIRCLE', 'drawCircle', 'circle'],
  ['ARC', 'drawArc', 'arc'],
  ['ARROW', 'drawArrow', 'arrow'],
  ['WIRE', 'drawWire', 'wire'],
  ['TRIM', 'trim', 'trim'],
] as const

/**
 * 「更多」按钮连同它前面的间距要占的宽度：与按钮同为 30px，加一格工具栏间距 4px。
 *
 * @remarks
 * 量宽时它还没渲染出来（有没有溢出正是量出来的结果），只能按已知尺寸预留。按钮尺寸与间距
 * 写在 `.compose-editor__toolbar-group > button` 与 `.compose-editor__stage-toolbar` 上，
 * 两个数与样式表是一对，改一边就要改另一边。
 */
const MORE_BUTTON_WIDTH = 30 + 4

function useToolbarMenu(id: string) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const focusFirstItem = () => window.requestAnimationFrame(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  })
  const close = () => {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setOpen(true)
    window.requestAnimationFrame(() => {
      const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      buttons[event.key === 'ArrowUp' ? buttons.length - 1 : 0]?.focus()
    })
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const current = event.target instanceof HTMLButtonElement
      ? buttons.indexOf(event.target)
      : -1
    const next = event.key === 'ArrowDown'
      ? (current + 1 + buttons.length) % buttons.length
      : (current - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
  return { close, focusFirstItem, id, menuRef, onMenuKeyDown, onTriggerKeyDown, open, setOpen, triggerRef }
}

/**
 * 工具栏目录里的一格：在栏上怎么画、收进「更多」时叫什么、按下去做什么。
 *
 * @remarks
 * `icon` 是节点而不是内建图标名：宿主注入的项自带图标，而「更多」菜单要和栏上那颗按钮画同一个
 * 东西——两处各画一份的症状是同一格在栏上和菜单里长得不一样。
 */
/**
 * 按下态是**开关**（多选）的那几格；其余都是**工具**（单选）。
 *
 * @remarks
 * 两者按下去做的事不同，因此 MUST NOT 长得一样——工具全栏恒有且只有一个按下，说的是「我此刻
 * 在什么工具里」；开关可以同时按下五个，说的是「什么开着」。共用一套底色的结果是屏幕上常年
 * 三到五个同样的蓝块，而其中只有一个在回答前一个问题；相邻两个开关按下时还会连成一整块。
 *
 * 这里列**开关**而不是列工具：开关是闭合且稳定的五个，而工具那一侧每加一条绘图命令就多一格，
 * 列它必然漏。
 */
const TOOLBAR_SWITCH_KEYS: ReadonlySet<string> = new Set([
  'transform-gizmo',
  'snap',
  'ortho',
  'polar',
  'grid',
])

interface ToolbarItem {
  readonly key: string
  readonly label: string
  readonly icon: ReactNode
  readonly pressed: boolean
  readonly activate: () => void
  readonly render: () => ReactNode
}

/**
 * 目录里的一组。
 *
 * @remarks
 * 分组在**货架落地之后只剩两个作用**：给出目录的默认顺序，以及默认货架里分隔线插在哪。
 * 它不再是渲染结构——用户重排过的货架里，「哪几格算一组」由分隔线决定，与这里的分组无关。
 */
interface ToolbarGroup {
  readonly key: string
  readonly items: readonly ToolbarItem[]
  /** 默认货架里与前一组之间插一条分隔线。 */
  readonly dividerBefore?: boolean
}

/**
 * 宽度不足时从尾部把放不下的格收进「更多」。
 *
 * @remarks
 * 返回第一个溢出的格的下标（按整条工具栏的格序），全放得下时为 null。量法：把所有格临时全部
 * 显示出来，读每一格的右边缘，与工具栏的可用宽度比——放不下时再为「更多」按钮预留一格。
 * 在 layout effect 里做：量完就 `setState`，React 在绘制前同步重渲染，屏幕上不会闪出一帧
 * 「全部显示」；量完还要把 `hidden` 按结果写回去，因为结果没变时 React 不会重渲染。
 *
 * 工具栏自己是行里被压缩的那一个（`min-width: 0; flex: 1`），因此 `clientWidth` 就是可用宽度。
 */
function useToolbarOverflow(toolbarRef: RefObject<HTMLDivElement | null>, itemCount: number) {
  const [overflowFrom, setOverflowFrom] = useState<number | null>(null)
  const measure = useCallback(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const items = [...toolbar.querySelectorAll<HTMLElement>('[data-toolbar-item]')]
    const groups = [...toolbar.querySelectorAll<HTMLElement>('[data-toolbar-group]')]
    const dividers = [...toolbar.querySelectorAll<HTMLElement>('[data-toolbar-divider]')]
    for (const element of [...items, ...groups, ...dividers]) element.hidden = false
    const style = getComputedStyle(toolbar)
    const available = toolbar.clientWidth - Number.parseFloat(style.paddingRight)
    const origin = toolbar.getBoundingClientRect().left
    const rights = items.map((element) => element.getBoundingClientRect().right - origin)
    let count = items.length
    if (items.length > 0 && rights[items.length - 1]! > available) {
      const limit = available - MORE_BUTTON_WIDTH
      const first = rights.findIndex((right) => right > limit)
      count = first < 0 ? items.length : first
    }
    items.forEach((element, index) => { element.hidden = index >= count })
    groups.forEach((group) => {
      group.hidden = ![...group.querySelectorAll<HTMLElement>('[data-toolbar-item]')]
        .some((element) => !element.hidden)
    })
    dividers.forEach((divider) => {
      const next = divider.nextElementSibling
      divider.hidden = !(next instanceof HTMLElement) || next.hidden
    })
    setOverflowFrom(count >= items.length ? null : count)
  }, [toolbarRef])

  useLayoutEffect(() => {
    measure()
    const toolbar = toolbarRef.current
    if (!toolbar || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { measure() })
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [itemCount, measure, toolbarRef])

  return overflowFrom
}

/** 默认舞台工具栏：扁平 Godot 风格工具分组与绘图工具入口。 @internal */
export function DefaultStageToolbar({
  activeCommandId,
  canvasSettingsOpen,
  dispatch,
  document,
  gridVisible,
  nextId,
  setCanvasSettingsOpen,
  setGridSize,
  setGridVisible,
  setTool,
  setTransformGizmo,
  transformGizmo,
  shortcuts,
  startCommand,
  hatchColor,
  setHatchColor,
  onCustomize,
  onShelfChange,
  shelf,
  toolbarItems,
  runAction,
  toggleSnap,
  tool,
  angleConstraint,
  setAngleConstraint,
  polarIncrement,
  setPolarIncrement,
}: DefaultStageToolbarProps) {
  const {
    close: closeGridMenu,
    focusFirstItem: focusFirstGridItem,
    id: gridMenuId,
    menuRef: gridMenuRef,
    onMenuKeyDown: onGridMenuKeyDown,
    onTriggerKeyDown: onGridTriggerKeyDown,
    open: gridMenuOpen,
    setOpen: setGridMenuOpen,
    triggerRef: gridMenuTriggerRef,
  } = useToolbarMenu('compose-editor-grid-menu')
  const {
    close: closePolarMenu,
    focusFirstItem: focusFirstPolarItem,
    id: polarMenuId,
    menuRef: polarMenuRef,
    onMenuKeyDown: onPolarMenuKeyDown,
    onTriggerKeyDown: onPolarTriggerKeyDown,
    open: polarMenuOpen,
    setOpen: setPolarMenuOpen,
    triggerRef: polarMenuTriggerRef,
  } = useToolbarMenu('compose-editor-polar-menu')
  const {
    close: closeHatchMenu,
    focusFirstItem: focusFirstHatchItem,
    id: hatchMenuId,
    menuRef: hatchMenuRef,
    onTriggerKeyDown: onHatchTriggerKeyDown,
    open: hatchMenuOpen,
    setOpen: setHatchMenuOpen,
    triggerRef: hatchMenuTriggerRef,
  } = useToolbarMenu('compose-editor-hatch-menu')
  /**
   * 填充色面板的键盘：只接 `Escape`。
   *
   * @remarks
   * 菜单那一份的方向键在做**焦点漫游**，而这块面板里有滑杆——同一个按键在两处的含义不同，
   * 共用会让色相滑杆一按方向键就跳走焦点而不是改值。面板是 dialog，焦点导航本来就归 `Tab`。
   */
  const onHatchPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    closeHatchMenu()
  }
  /*
   * 点面板外面即关闭。菜单那几条靠「选了一项就关」收尾，而这块面板挑完颜色**不关**
   * （用户多半要再调几下），没有这一条就只剩 `Escape` 一条出路。
   */
  useEffect(() => {
    if (!hatchMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (hatchMenuRef.current?.contains(target) || hatchMenuTriggerRef.current?.contains(target)) {
        return
      }
      setHatchMenuOpen(false)
    }
    // 本组件的 `document` prop 是 ComposeDocument，因此 DOM 的那个要显式取。
    const dom = globalThis.document
    dom.addEventListener('pointerdown', onPointerDown, true)
    return () => dom.removeEventListener('pointerdown', onPointerDown, true)
  }, [hatchMenuOpen, hatchMenuRef, hatchMenuTriggerRef, setHatchMenuOpen])
  const {
    close: closeMoreMenu,
    focusFirstItem: focusFirstMoreItem,
    id: moreMenuId,
    menuRef: moreMenuRef,
    onMenuKeyDown: onMoreMenuKeyDown,
    onTriggerKeyDown: onMoreTriggerKeyDown,
    open: moreMenuOpen,
    setOpen: setMoreMenuOpen,
    triggerRef: moreMenuTriggerRef,
  } = useToolbarMenu('compose-editor-more-menu')
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).stageToolbar
  const shortcut = (action: ComposeEditorShortcutAction) => {
    const binding = shortcuts?.[action]?.[0]
    if (!binding) return undefined
    return formatComposeEditorKeybinding(
      binding,
      typeof navigator === 'undefined' ? '' : navigator.platform,
    )
  }
  const tooltip = useComposeToolbarTooltip()
  const injected = useComposeToolbarShelf()
  /*
   * 右键菜单的 payload 是那一格在**当前货架里的下标**，不是它的 id：分隔线可以有多条，
   * id 认不出用户右键的是哪一条。
   */
  const contextMenu = useComposeContextMenu<number>()
  /**
   * 按钮的名称与提示。
   *
   * @remarks
   * 不再写原生 `title`：两套提示会同时弹出来，而工具栏自己那套才是能立刻出现、键盘聚焦也
   * 出现的那一套。可访问名仍然只是名称，快捷键落在 `aria-describedby` 指向的提示里。
   */
  const titled = (key: string, label: string, hint?: string, role?: 'switch' | 'tool') => ({
    ...tooltip.trigger(key, label, hint),
    'data-toolbar-role': role ?? (TOOLBAR_SWITCH_KEYS.has(key) ? 'switch' : 'tool'),
  })
  const snapEnabled = document.canvas.grid.snapEnabled
    || document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  const toolbarRef = useRef<HTMLDivElement>(null)

  const groups: readonly ToolbarGroup[] = [
    {
      key: 'interaction',
      items: [
        {
          /*
           * 选择是一个普通按钮，没有判定模式菜单：框选判定恒由拖拽方向决定，而**方向本身
           * 就是切换器**——一次拖拽即可选定，比开一个菜单快，也不残留状态。再给一个开关等于
           * 给同一件事造第二个、更慢的入口。
           */
          key: 'select',
          label: messages.select,
          icon: <StageToolbarIcon name="select" />,
          pressed: tool === 'select',
          activate: () => setTool('select'),
          render: () => (
            <button
              {...titled('select', messages.select, shortcut('stage.selectTool'))}
              aria-pressed={tool === 'select'}
              data-toolbar-item="select"
              type="button"
              onClick={() => setTool('select')}
            >
              <StageToolbarIcon name="select" />
            </button>
          ),
        },
        {
          /*
           * 指示器开关**取代**了原来的 rotate 按钮，不是并排多一个：并排等于旋转有两个入口。
           *
           * 它按下的不是一个工具：`rotate` 与 `scale` 都是模式（切过去之后每一次拖动的含义都
           * 变了），而这个开关只决定把手渲不渲染，别处一个字节不变——按下态因此读
           * `transformGizmo` 而不是 `tool`。
           *
           * 缩放也并进来了：`scale` 工具唯一独占的事是「让曲线拿回盒与手柄」，那与「打开一层
           * chrome」是同一件事的两种说法。
           */
          key: 'transform-gizmo',
          label: messages.transformGizmo,
          icon: <StageToolbarIcon name="transform-gizmo" />,
          pressed: transformGizmo,
          activate: () => setTransformGizmo(!transformGizmo),
          render: () => (
            <button
              {...titled('transform-gizmo', messages.transformGizmo)}
              aria-pressed={transformGizmo}
              data-toolbar-item="transform-gizmo"
              type="button"
              onClick={() => setTransformGizmo(!transformGizmo)}
            >
              <StageToolbarIcon name="transform-gizmo" />
            </button>
          ),
        },
      ],
    },
    {
      key: 'snap',
      items: [
        {
          key: 'snap',
          label: messages.snap,
          icon: <StageToolbarIcon name="smart-snap" />,
          pressed: snapEnabled,
          activate: toggleSnap,
          render: () => (
            <button
              {...titled('snap', messages.snap)}
              aria-pressed={snapEnabled}
              data-toolbar-item="snap"
              type="button"
              onClick={toggleSnap}
            >
              <StageToolbarIcon name="smart-snap" />
            </button>
          ),
        },
        {
          /*
           * 正交与极轴是**同一个单选组的两个成员**：它们回答同一个问题——这一步的方向怎么被
           * 约束。因此按下已经按下的那一个就是关掉，而不是各自独立开关（那会造出一个「都开」
           * 的第四态，而那一态没有正确答案）。
           *
           * 这两个按钮不是键位的第二个入口：角度约束此前藏在 `F8` 后面，宿主读不到也就画不出
           * 按下态——用户不按那个键就不知道有这回事。按下态是必需的，不是装饰。
           */
          key: 'ortho',
          label: messages.ortho,
          icon: <StageToolbarIcon name="ortho" />,
          pressed: angleConstraint === 'ortho',
          activate: () => setAngleConstraint(angleConstraint === 'ortho' ? 'off' : 'ortho'),
          render: () => (
            <button
              {...titled('ortho', messages.ortho, 'F8')}
              aria-pressed={angleConstraint === 'ortho'}
              data-toolbar-item="ortho"
              type="button"
              onClick={() => setAngleConstraint(angleConstraint === 'ortho' ? 'off' : 'ortho')}
            >
              <StageToolbarIcon name="ortho" />
            </button>
          ),
        },
        {
          // 极轴及其增量角菜单是一个复合项：整格一起上栏或一起收进「更多」，拆开会得到一个
          // 没有开关的菜单。收进「更多」时只剩开关，增量角回到工具栏再改。
          key: 'polar',
          label: messages.polar,
          icon: <StageToolbarIcon name="polar" />,
          pressed: angleConstraint === 'polar',
          activate: () => setAngleConstraint(angleConstraint === 'polar' ? 'off' : 'polar'),
          render: () => (
            <div className="compose-editor__toolbar-menu-anchor" data-toolbar-item="polar">
              <button
                {...titled('polar', messages.polar, 'F10')}
                aria-pressed={angleConstraint === 'polar'}
                type="button"
                onClick={() => setAngleConstraint(angleConstraint === 'polar' ? 'off' : 'polar')}
              >
                <StageToolbarIcon name="polar" />
              </button>
              <button
                {...titled('polar-increment', messages.polarIncrement)}
                aria-controls={polarMenuId}
                aria-expanded={polarMenuOpen}
                aria-haspopup="menu"
                className="compose-editor__toolbar-menu-trigger"
                ref={polarMenuTriggerRef}
                type="button"
                onClick={() => {
                  setPolarMenuOpen((open) => !open)
                  focusFirstPolarItem()
                }}
                onKeyDown={onPolarTriggerKeyDown}
              >
                <StageToolbarIcon name="chevron-down" />
              </button>
              {polarMenuOpen ? (
                <div
                  aria-label={messages.polarIncrement}
                  className="compose-editor__toolbar-menu"
                  id={polarMenuId}
                  ref={polarMenuRef}
                  role="menu"
                  onKeyDown={onPolarMenuKeyDown}
                >
                  {POLAR_INCREMENTS.map((degrees) => (
                    <button
                      key={degrees}
                      aria-pressed={polarIncrement === degrees}
                      role="menuitemradio"
                      type="button"
                      onClick={() => {
                        setPolarIncrement(degrees)
                        closePolarMenu()
                      }}
                    >
                      {`${degrees}°`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ),
        },
        {
          key: 'grid',
          label: messages.grid,
          icon: <StageToolbarIcon name="grid" />,
          pressed: gridVisible,
          activate: () => setGridVisible((visible) => !visible),
          render: () => (
            <div className="compose-editor__toolbar-menu-anchor" data-toolbar-item="grid">
              <button
                {...titled('grid', messages.grid)}
                aria-pressed={gridVisible}
                type="button"
                onClick={() => setGridVisible((visible) => !visible)}
              >
                <StageToolbarIcon name="grid" />
              </button>
              <button
                {...titled('grid-size', messages.gridSize)}
                aria-controls={gridMenuId}
                aria-expanded={gridMenuOpen}
                aria-haspopup="menu"
                className="compose-editor__toolbar-menu-trigger"
                ref={gridMenuTriggerRef}
                type="button"
                onClick={() => {
                  setGridMenuOpen((open) => !open)
                  focusFirstGridItem()
                }}
                onKeyDown={onGridTriggerKeyDown}
              >
                <StageToolbarIcon name="chevron-down" />
              </button>
              {gridMenuOpen ? (
                <div
                  aria-label={messages.gridSize}
                  className="compose-editor__toolbar-menu"
                  id={gridMenuId}
                  ref={gridMenuRef}
                  role="menu"
                  onKeyDown={onGridMenuKeyDown}
                >
                  {([4, 8, 16, 32] as const).map((size) => (
                    <button
                      key={size}
                      aria-pressed={document.canvas.grid.stepX === size && document.canvas.grid.stepY === size}
                      role="menuitemradio"
                      type="button"
                      onClick={() => {
                        setGridSize(size)
                        closeGridMenu()
                      }}
                    >
                      {messages[`gridSize${size}` as const]}
                    </button>
                  ))}
                  <button
                    aria-expanded={canvasSettingsOpen}
                    aria-haspopup="dialog"
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setCanvasSettingsOpen(true)
                      closeGridMenu()
                    }}
                  >
                    {messages.canvasSettings}
                  </button>
                </div>
              ) : null}
              {canvasSettingsOpen ? (
                <CanvasSettingsPopover
                  dispatch={dispatch}
                  document={document}
                  idFactory={nextId}
                  onClose={() => setCanvasSettingsOpen(false)}
                />
              ) : null}
            </div>
          ),
        },
      ],
    },
    {
      key: 'container',
      dividerBefore: true,
      items: [
        {
          key: 'draw-container',
          label: messages.createContainer,
          icon: <StageToolbarIcon name="container" />,
          pressed: tool === 'draw-container',
          activate: () => setTool('draw-container'),
          render: () => (
            <button
              {...titled('draw-container', messages.createContainer, shortcut('stage.drawContainerTool'))}
              aria-pressed={tool === 'draw-container'}
              data-toolbar-item="draw-container"
              type="button"
              onClick={() => setTool('draw-container')}
            >
              <StageToolbarIcon name="container" />
            </button>
          ),
        },
        {
          key: 'draw-text',
          label: messages.text,
          icon: <StageToolbarIcon name="text" />,
          pressed: tool === 'draw-text',
          activate: () => setTool('draw-text'),
          render: () => (
            <button
              {...titled('draw-text', messages.text, shortcut('stage.drawTextTool'))}
              aria-pressed={tool === 'draw-text'}
              data-toolbar-item="draw-text"
              type="button"
              onClick={() => setTool('draw-text')}
            >
              <StageToolbarIcon name="text" />
            </button>
          ),
        },
      ],
    },
    {
      key: 'drawing',
      dividerBefore: true,
      items: DRAWING_COMMANDS.map(([commandId, label, icon]) => ({
        key: commandId,
        label: messages[label],
        icon: <StageToolbarIcon name={icon} />,
        pressed: activeCommandId === commandId,
        activate: () => startCommand(commandId),
        render: () => (
          <button
            /*
             * 提示里的「快捷键」是**命令名本身**：这几条命令没有键位，启动它们的办法就是在
             * 命令行里敲这个词。id 就在 `DRAWING_COMMANDS` 里、也正是 `startCommand` 派发的
             * 那一个，因此提示与按钮读的是同一份事实。别名（`L`、`REC`…）住在 stage-engine
             * 的命令定义上，这里够不着，抄一份就会漂。
             */
            {...titled(commandId, messages[label], commandId)}
            /*
             * 按下态读 Stage 上报的**当前命令 id**，而不是工具栏自己记「我刚点了哪个」：
             * 命令会被 `Escape`、被并发文档变化、被另一条命令取代而结束，自己记的那一份
             * 只会停在过去。
             */
            aria-pressed={activeCommandId === commandId}
            data-command-id={commandId}
            data-toolbar-item={commandId}
            type="button"
            onClick={() => startCommand(commandId)}
          >
            <StageToolbarIcon name={icon} />
          </button>
        ),
      })),
    },
    {
      key: 'hatch',
      items: [
        {
          key: 'HATCH',
          label: messages.hatch,
          icon: <StageToolbarIcon name="hatch" paint={hatchColor} />,
          pressed: activeCommandId === 'HATCH',
          activate: () => startCommand('HATCH'),
          render: () => (
            /*
             * Split button：主键启动命令，▾ 开色板。这不与「框选判定不给开关」那条冲突——
             * 那一条禁止的是给同一个动作的**参数**再造一个更慢的入口，而颜色不是 `HATCH`
             * 的一个参数档位，它是跨命令留着的一份状态，与极轴的增量角同类。
             */
            <div className="compose-editor__toolbar-menu-anchor" data-toolbar-item="HATCH">
              <button
                {...titled('HATCH', messages.hatch, 'HATCH')}
                aria-pressed={activeCommandId === 'HATCH'}
                data-command-id="HATCH"
                type="button"
                onClick={() => startCommand('HATCH')}
              >
                <StageToolbarIcon name="hatch" paint={hatchColor} />
              </button>
              <button
                {...titled('hatch-color', messages.hatchColor)}
                aria-controls={hatchMenuId}
                aria-expanded={hatchMenuOpen}
                aria-haspopup="menu"
                className="compose-editor__toolbar-menu-trigger"
                ref={hatchMenuTriggerRef}
                type="button"
                onClick={() => {
                  setHatchMenuOpen((open) => !open)
                  focusFirstHatchItem()
                }}
                onKeyDown={onHatchTriggerKeyDown}
              >
                <StageToolbarIcon name="chevron-down" />
              </button>
              {hatchMenuOpen ? (
                /*
                 * 这是一块**面板**而不是一条菜单：里面有滑杆、十六进制输入框与吸管按钮，
                 * 那些不是 menuitem，`role="menu"` 里放它们在 ARIA 上说不通；方向键在菜单里
                 * 要移焦点，而在滑杆上要改值，两种含义在同一个容器里没法同时成立。
                 * 因此容器是 `role="dialog"`，焦点走 Tab，`Escape` 关闭并把焦点还给触发器。
                 */
                <div
                  aria-label={messages.hatchColor}
                  className="compose-editor__toolbar-menu compose-editor__toolbar-hatch-panel"
                  id={hatchMenuId}
                  ref={hatchMenuRef}
                  role="dialog"
                  onKeyDown={onHatchPanelKeyDown}
                >
                  {/*
                    * 色板不删。它回答的是「把这块面填成跟图上那块一样」，而取色器回答
                    * 「我要一个新颜色」——两个问题，两处答；删掉它等于把最常用的那条路换成三步。
                    */}
                  <section
                    aria-label={messages.hatchColorUsed}
                    className="compose-editor__toolbar-hatch-used"
                    role="radiogroup"
                  >
                    {/* 标题写出来，与取色器里「最近」「常用」两行同形——三行都是色块，不写就分不出哪行是哪行。 */}
                    <span>{messages.hatchColorUsed}</span>
                    <div className="compose-editor__toolbar-swatches">
                    {composeHatchSwatches(document).map((color) => (
                      <button
                        key={color}
                        aria-checked={hatchColor === color}
                        aria-label={color}
                        className="compose-editor__toolbar-swatch"
                        data-swatch={color}
                        role="radio"
                        style={{ background: color }}
                        type="button"
                        onClick={() => {
                          setHatchColor(color)
                          closeHatchMenu()
                        }}
                      />
                    ))}
                    </div>
                  </section>
                  <div className="compose-editor__toolbar-hatch-picker">
                    {/*
                      * 内嵌形态：面板已经打开着，再嵌一层带 Trigger 的 Picker 会得到
                      * 「面板里再点一下才出色盘」和一层套一层的弹出层。
                      *
                      * 挑完**不关面板**——用户多半要在色盘上再调几下；关闭交给 `Escape`、
                      * 点面板外面，或者直接去画布上落点。
                      */}
                    <ComposeColorPicker
                      embedded
                      allowTransparent={false}
                      label={messages.hatchColorCustom}
                      value={hatchColor}
                      onValueChange={setHatchColor}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ),
        },
      ],
    },
  ]
  /**
   * 宿主补进目录的那几格。
   *
   * @remarks
   * 它们**指向**一个已有动作或命令，因此这里只负责画按钮与派发，不持有任何行为——按钮是入口，
   * 能力住在动作目录与命令词汇表里。
   */
  const hostCatalog: readonly ToolbarItem[] = (toolbarItems ?? injected.items ?? []).map((item) => {
    const activate = () => {
      if (item.target.kind === 'command') startCommand(item.target.id)
      else runAction?.(item.target.id)
    }
    // 命令目标读 Stage 上报的当前命令 id，与内建绘图命令按钮同一份事实；动作目标没有「正在
    // 跑」这回事，除非注入方把它声明成开关并给出按下态（编辑器注入的「动画编辑」就是）。
    const pressed = item.pressed ?? (item.target.kind === 'command' && activeCommandId === item.target.id)
    return {
      key: item.id,
      label: item.label,
      icon: item.icon,
      pressed,
      activate,
      render: () => (
        <button
          {...titled(item.id, item.label, undefined, item.pressed !== undefined ? 'switch' : undefined)}
          aria-pressed={pressed}
          data-toolbar-item={item.id}
          type="button"
          onClick={activate}
        >
          {item.icon}
        </button>
      ),
    }
  })

  const catalog = [...groups.flatMap((group) => group.items), ...hostCatalog]
  const byId = new Map(catalog.map((item) => [item.key, item] as const))
  /**
   * 缺省货架：目录的全部项，分隔线插在分组之间。
   *
   * @remarks
   * 不认识工作区的宿主因此一个像素都不变——它拿到的正是分组落地之前那条顺序。
   */
  const defaultShelf: ComposeToolbarShelf = groups.flatMap((group) => {
    const ids = group.items.map((item) => item.key)
    return group.dividerBefore ? [COMPOSE_TOOLBAR_SEPARATOR, ...ids] : ids
  })
  // prop 压过 Context：宿主自己渲染这颗工具栏时，prop 是它唯一的入口。
  const activeShelf = shelf ?? injected.shelf ?? defaultShelf
  const sections = splitToolbarShelf(normalizeToolbarShelf(activeShelf), (id) => byId.has(id))
  const flatItems = sections.flat().map((id) => byId.get(id)!)
  const overflowFrom = useToolbarOverflow(toolbarRef, flatItems.length)
  const overflowed = overflowFrom === null ? [] : flatItems.slice(overflowFrom)
  const isHidden = (item: ToolbarItem) => overflowFrom !== null && flatItems.indexOf(item) >= overflowFrom
  /*
   * 上报**第一个被收走那一格的 id** 而不是下标：自定义对话框拿到之后要在自己的草稿里定位，
   * 而草稿一旦被重排，下标指向的就是另一格了。
   */
  const firstOverflowId = overflowFrom === null ? null : flatItems[overflowFrom]?.key ?? null
  const reportOverflow = injected.onOverflowChange
  useEffect(() => {
    reportOverflow?.(firstOverflowId)
  }, [firstOverflowId, reportOverflow])

  // prop 压过 Context，与 `shelf` 同一条规则：宿主自己渲染这颗工具栏时 prop 是唯一入口。
  const customize = onCustomize ?? injected.onCustomize
  const changeShelf = onShelfChange ?? injected.onShelfChange
  const canEditShelf = changeShelf !== undefined
  const menuIndex = contextMenu.payload
  const menuId = menuIndex === null ? null : activeShelf[menuIndex] ?? null
  const applyShelf = (next: ComposeToolbarShelf) => {
    changeShelf?.(next)
    contextMenu.close()
  }

  return (
    <div
      aria-label={messages.label}
      className="compose-editor__stage-toolbar"
      ref={toolbarRef}
      role="toolbar"
      onContextMenu={(event) => {
        if (!canEditShelf && customize === undefined) return
        /*
         * 右键落在某一格上就把那一格交给菜单，落在空白处只给「自定义工具栏…」——空白处没有
         * 可移除的目标，列一个按下去什么都不做的项比不列更糟。
         */
        const cell = (event.target as HTMLElement | null)?.closest?.('[data-toolbar-item]')
        const id = cell?.getAttribute('data-toolbar-item') ?? null
        contextMenu.openAt(event, id === null ? -1 : activeShelf.indexOf(id))
      }}
    >
      {/*
        * 段是**布局**而不是语义分组：货架可以被重排，「哪几格算一组」由用户插的分隔线决定，
        * 那条分界线没有名字可给。因此这里不再挂 `role="group"` 与组名——一个没有名称的 group
        * 对读屏只是噪音；分隔线反过来升格成 `role="separator"`，因为它现在是货架里真实的一项。
        */}
      {sections.map((ids, index) => {
        const items = ids.map((id) => byId.get(id)!)
        const allHidden = items.every(isHidden)
        return (
          <Fragment key={ids.join('|')}>
            {index > 0 ? (
              <span
                className="compose-editor__toolbar-divider"
                data-toolbar-divider=""
                hidden={allHidden}
                role="separator"
              />
            ) : null}
            <div
              className="compose-editor__toolbar-group"
              data-toolbar-group={ids[0]}
              hidden={allHidden}
            >
              {items.map((item) => <Fragment key={item.key}>{item.render()}</Fragment>)}
            </div>
          </Fragment>
        )
      })}
      {overflowed.length > 0 ? (
        <div className="compose-editor__toolbar-menu-anchor" data-toolbar-more="">
          <button
            {...titled('more', messages.more)}
            aria-controls={moreMenuId}
            aria-expanded={moreMenuOpen}
            aria-haspopup="menu"
            ref={moreMenuTriggerRef}
            type="button"
            onClick={() => {
              setMoreMenuOpen((open) => !open)
              focusFirstMoreItem()
            }}
            onKeyDown={onMoreTriggerKeyDown}
          >
            <StageToolbarIcon name="chevron-down" />
          </button>
          {moreMenuOpen ? (
            <div
              aria-label={messages.moreTools}
              className="compose-editor__toolbar-menu compose-editor__toolbar-menu--end"
              id={moreMenuId}
              ref={moreMenuRef}
              role="menu"
              onKeyDown={onMoreMenuKeyDown}
            >
              {/* 每一项与原按钮同名同图标：它就是那颗按钮，只是换了个地方站。 */}
              {overflowed.map((item) => (
                <button
                  key={item.key}
                  aria-pressed={item.pressed}
                  data-toolbar-more-item={item.key}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    item.activate()
                    closeMoreMenu()
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {tooltip.element}
      {canEditShelf || customize ? (
        <ComposeContextMenu {...contextMenu.rootProps}>
          <ComposeContextMenuContent>
            {canEditShelf && menuIndex !== null && menuIndex >= 0 ? (
              <>
                <ComposeContextMenuItem
                  // 「选择」拿不掉：取点命令结束之后用户回到的就是它。
                  disabled={menuId === COMPOSE_TOOLBAR_SELECT_ID}
                  onClick={() => applyShelf(removeToolbarShelfItem(activeShelf, menuIndex))}
                >
                  {messages.removeFromToolbar}
                </ComposeContextMenuItem>
                <ComposeContextMenuItem
                  onClick={() => applyShelf(insertToolbarSeparator(activeShelf, menuIndex))}
                >
                  {messages.insertSeparatorHere}
                </ComposeContextMenuItem>
                <ComposeContextMenuSeparator />
              </>
            ) : null}
            {customize ? (
              <ComposeContextMenuItem onClick={() => { contextMenu.close(); customize() }}>
                {messages.customizeToolbar}
              </ComposeContextMenuItem>
            ) : null}
          </ComposeContextMenuContent>
        </ComposeContextMenu>
      ) : null}
    </div>
  )
}
