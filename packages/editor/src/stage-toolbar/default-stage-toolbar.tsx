import type { ComposeDocument } from '@compose-ui/core'
import type { ComposeAngleConstraint } from '@compose-ui/core'
import type {
  ComposeStageDispatch,
  ComposeStageTool,
} from '@compose-ui/stage'
import { useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, SetStateAction } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getEditorMessages } from '../editor-i18n'
import {
  formatComposeEditorKeybinding,
  type ComposeEditorPreferences,
  type ComposeEditorShortcutAction,
} from '../editor-preferences'
import { CanvasSettingsPopover } from './canvas-settings-popover'
import { StageToolbarIcon } from './stage-toolbar-icons'
import { useComposeToolbarTooltip } from './toolbar-tooltip'

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
  readonly shortcuts?: ComposeEditorPreferences['shortcuts']
  /** 启动一条命令会话；与在命令行里键入这个名字等价。 */
  readonly startCommand: (commandId: string) => void
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
  ['CIRCLE', 'drawCircle', 'circle'],
  ['ARC', 'drawArc', 'arc'],
  ['ARROW', 'drawArrow', 'arrow'],
  ['WIRE', 'drawWire', 'wire'],
] as const

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
  shortcuts,
  startCommand,
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
  /**
   * 按钮的名称与提示。
   *
   * @remarks
   * 不再写原生 `title`：两套提示会同时弹出来，而工具栏自己那套才是能立刻出现、键盘聚焦也
   * 出现的那一套。可访问名仍然只是名称，快捷键落在 `aria-describedby` 指向的提示里。
   */
  const titled = (key: string, label: string, hint?: string) => tooltip.trigger(key, label, hint)
  const snapEnabled = document.canvas.grid.snapEnabled
    || document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  return (
    <div aria-label={messages.label} className="compose-editor__stage-toolbar" role="toolbar">
      <div aria-label={messages.interactionTools} className="compose-editor__toolbar-group" role="group">
        {/*
          * 选择是一个普通按钮，没有判定模式菜单：框选判定恒由拖拽方向决定，而**方向本身
          * 就是切换器**——一次拖拽即可选定，比开一个菜单快，也不残留状态。再给一个开关等于
          * 给同一件事造第二个、更慢的入口。形状工具的菜单不受此约束：它的菜单项各自是独立
          * 动作（矩形 / 箭头 / 圆），不是同一个动作的参数。
          */}
        <button
          {...titled('select', messages.select, shortcut('stage.selectTool'))}
          aria-pressed={tool === 'select'}
          type="button"
          onClick={() => setTool('select')}
        >
          <StageToolbarIcon name="select" />
        </button>
        <button {...titled('scale', messages.scale, shortcut('stage.scaleTool'))} aria-pressed={tool === 'scale'} type="button" onClick={() => setTool('scale')}>
          <StageToolbarIcon name="scale" />
        </button>
        <button {...titled('rotate', messages.rotate, shortcut('stage.rotateTool'))} aria-pressed={tool === 'rotate'} type="button" onClick={() => setTool('rotate')}>
          <StageToolbarIcon name="rotate" />
        </button>
      </div>
      <div aria-label={messages.snapTools} className="compose-editor__toolbar-group" role="group">
        <button {...titled('snap', messages.snap)} aria-pressed={snapEnabled} type="button" onClick={toggleSnap}>
          <StageToolbarIcon name="smart-snap" />
        </button>
        {/*
          * 正交与极轴是**同一个单选组的两个成员**：它们回答同一个问题——这一步的方向怎么被
          * 约束。因此按下已经按下的那一个就是关掉，而不是各自独立开关（那会造出一个「都开」
          * 的第四态，而那一态没有正确答案）。
          *
          * 这两个按钮不是键位的第二个入口：角度约束此前藏在 `F8` 后面，宿主读不到也就画不出
          * 按下态——用户不按那个键就不知道有这回事。按下态是必需的，不是装饰。
          */}
        <button
          {...titled('ortho', messages.ortho, 'F8')}
          aria-pressed={angleConstraint === 'ortho'}
          type="button"
          onClick={() => setAngleConstraint(angleConstraint === 'ortho' ? 'off' : 'ortho')}
        >
          <StageToolbarIcon name="ortho" />
        </button>
        <div className="compose-editor__toolbar-menu-anchor">
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
                  {`${degrees}\u00B0`}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="compose-editor__toolbar-menu-anchor">
          <button {...titled('grid', messages.grid)} aria-pressed={gridVisible} type="button" onClick={() => setGridVisible((visible) => !visible)}>
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
      </div>
      <span aria-hidden="true" className="compose-editor__toolbar-divider" />
      <div aria-label={messages.containerTools} className="compose-editor__toolbar-group" role="group">
        <button
          {...titled('draw-container', messages.createContainer, shortcut('stage.drawContainerTool'))}
          aria-pressed={tool === 'draw-container'}
          type="button"
          onClick={() => setTool('draw-container')}
        >
          <StageToolbarIcon name="container" />
        </button>
        <button {...titled('draw-text', messages.text, shortcut('stage.drawTextTool'))} aria-pressed={tool === 'draw-text'} type="button" onClick={() => setTool('draw-text')}>
          <StageToolbarIcon name="text" />
        </button>
      </div>
      <span aria-hidden="true" className="compose-editor__toolbar-divider" />
      <div aria-label={messages.drawingCommands} className="compose-editor__toolbar-group" role="group">
        {DRAWING_COMMANDS.map(([commandId, label, icon]) => (
          <button
            key={commandId}
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
            type="button"
            onClick={() => startCommand(commandId)}
          >
            <StageToolbarIcon name={icon} />
          </button>
        ))}
      </div>
      {tooltip.element}
    </div>
  )
}
