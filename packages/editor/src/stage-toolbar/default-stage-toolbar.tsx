import type { ComposeDocument } from '@compose-ui/core'
import type {
  ComposeStageDispatch,
  ComposeStageMarqueeMode,
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

type DefaultStageToolbarProps = {
  readonly canvasSettingsOpen: boolean
  readonly dispatch: ComposeStageDispatch
  readonly document: ComposeDocument
  readonly gridVisible: boolean
  /** 最近一次选择的形状；主按钮在自动回到选择工具后仍用它表达下一次绘制内容。 */
  readonly lastShapeTool: ShapeTool
  /** 当前框选判定模式；主按钮图标与菜单选中态都跟随它。 */
  readonly marqueeMode: ComposeStageMarqueeMode
  readonly nextId: () => string
  readonly setMarqueeMode: (mode: ComposeStageMarqueeMode) => void
  readonly setCanvasSettingsOpen: Dispatch<SetStateAction<boolean>>
  readonly setGridSize: (size: number) => void
  readonly setGridVisible: Dispatch<SetStateAction<boolean>>
  readonly setTool: (tool: ComposeStageTool) => void
  readonly shortcuts?: ComposeEditorPreferences['shortcuts']
  readonly toggleSnap: () => void
  readonly tool: ComposeStageTool
}

const MARQUEE_MODES = [
  ['intersect', 'marqueeIntersect', 'marquee-intersect'],
  ['contain', 'marqueeContain', 'marquee-contain'],
  ['directional', 'marqueeDirectional', 'marquee-directional'],
] as const

function marqueeMode(mode: ComposeStageMarqueeMode) {
  return MARQUEE_MODES.find(([candidate]) => candidate === mode) ?? MARQUEE_MODES[0]
}

const SHAPE_TOOLS = [
  ['draw-rectangle', 'rectangle', 'rectangle', 'stage.drawRectangleTool'],
  ['draw-line', 'line', 'line', 'stage.drawLineTool'],
  ['draw-arrow', 'arrow', 'arrow', 'stage.drawArrowTool'],
  ['draw-circle', 'circle', 'circle', 'stage.drawCircleTool'],
] as const

type ShapeTool = (typeof SHAPE_TOOLS)[number][0]

function shapeTool(tool: ComposeStageTool) {
  return SHAPE_TOOLS.find(([candidate]) => candidate === tool)
}

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
  canvasSettingsOpen,
  dispatch,
  document,
  gridVisible,
  lastShapeTool,
  marqueeMode: currentMarqueeMode,
  nextId,
  setMarqueeMode,
  setCanvasSettingsOpen,
  setGridSize,
  setGridVisible,
  setTool,
  shortcuts,
  toggleSnap,
  tool,
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
    close: closeShapeMenu,
    focusFirstItem: focusFirstShapeItem,
    id: shapeMenuId,
    menuRef: shapeMenuRef,
    onMenuKeyDown: onShapeMenuKeyDown,
    onTriggerKeyDown: onShapeTriggerKeyDown,
    open: shapeMenuOpen,
    setOpen: setShapeMenuOpen,
    triggerRef: shapeMenuTriggerRef,
  } = useToolbarMenu('compose-editor-shape-menu')
  const {
    close: closeMarqueeMenu,
    focusFirstItem: focusFirstMarqueeItem,
    id: marqueeMenuId,
    menuRef: marqueeMenuRef,
    onMenuKeyDown: onMarqueeMenuKeyDown,
    onTriggerKeyDown: onMarqueeTriggerKeyDown,
    open: marqueeMenuOpen,
    setOpen: setMarqueeMenuOpen,
    triggerRef: marqueeMenuTriggerRef,
  } = useToolbarMenu('compose-editor-marquee-menu')
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
  const titled = (label: string, keybinding?: string) => ({
    'aria-label': label,
    title: keybinding ? `${label} (${keybinding})` : label,
  })
  const snapEnabled = document.canvas.grid.snapEnabled
    || document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  const selectedShape = shapeTool(tool)
  const currentShape = Boolean(selectedShape)
  const activeShape = selectedShape ?? shapeTool(lastShapeTool)!
  const activeMarquee = marqueeMode(currentMarqueeMode)

  return (
    <div aria-label={messages.label} className="compose-editor__stage-toolbar" role="toolbar">
      <div aria-label={messages.interactionTools} className="compose-editor__toolbar-group" role="group">
        <button {...titled(messages.select, shortcut('stage.selectTool'))} aria-pressed={tool === 'select'} type="button" onClick={() => setTool('select')}>
          <StageToolbarIcon name="select" />
        </button>
        <div className="compose-editor__toolbar-menu-anchor">
          <button
            {...titled(messages.marquee, shortcut('stage.marqueeTool'))}
            aria-pressed={tool === 'marquee'}
            data-active-marquee-mode={activeMarquee[0]}
            type="button"
            onClick={() => setTool('marquee')}
          >
            <StageToolbarIcon name={activeMarquee[2]} />
          </button>
          <button
            {...titled(messages.marqueeMode)}
            aria-controls={marqueeMenuId}
            aria-expanded={marqueeMenuOpen}
            aria-haspopup="menu"
            className="compose-editor__toolbar-menu-trigger"
            ref={marqueeMenuTriggerRef}
            type="button"
            onClick={() => {
              setMarqueeMenuOpen((open) => !open)
              focusFirstMarqueeItem()
            }}
            onKeyDown={onMarqueeTriggerKeyDown}
          >
            <StageToolbarIcon name="chevron-down" />
          </button>
          {marqueeMenuOpen ? (
            <div
              aria-label={messages.marqueeMode}
              className="compose-editor__toolbar-menu"
              id={marqueeMenuId}
              ref={marqueeMenuRef}
              role="menu"
              onKeyDown={onMarqueeMenuKeyDown}
            >
              {MARQUEE_MODES.map(([mode, label, icon]) => (
                <button
                  key={mode}
                  aria-pressed={currentMarqueeMode === mode}
                  role="menuitemradio"
                  type="button"
                  onClick={() => {
                    // 只改判定模式：用户可能正拿 select 工具做框选，切模式不该把工具抢走。
                    setMarqueeMode(mode)
                    closeMarqueeMenu()
                  }}
                >
                  <StageToolbarIcon name={icon} />
                  {messages[label]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button {...titled(messages.move, shortcut('stage.moveTool'))} aria-pressed={tool === 'move'} type="button" onClick={() => setTool('move')}>
          <StageToolbarIcon name="move" />
        </button>
        <button {...titled(messages.scale, shortcut('stage.scaleTool'))} aria-pressed={tool === 'scale'} type="button" onClick={() => setTool('scale')}>
          <StageToolbarIcon name="scale" />
        </button>
        <button {...titled(messages.rotate, shortcut('stage.rotateTool'))} aria-pressed={tool === 'rotate'} type="button" onClick={() => setTool('rotate')}>
          <StageToolbarIcon name="rotate" />
        </button>
        <button {...titled(messages.pan, shortcut('stage.panTool'))} aria-pressed={tool === 'pan'} type="button" onClick={() => setTool('pan')}>
          <StageToolbarIcon name="pan" />
        </button>
      </div>
      <div aria-label={messages.snapTools} className="compose-editor__toolbar-group" role="group">
        <button {...titled(messages.snap)} aria-pressed={snapEnabled} type="button" onClick={toggleSnap}>
          <StageToolbarIcon name="smart-snap" />
        </button>
        <div className="compose-editor__toolbar-menu-anchor">
          <button {...titled(messages.grid)} aria-pressed={gridVisible} type="button" onClick={() => setGridVisible((visible) => !visible)}>
            <StageToolbarIcon name="grid" />
          </button>
          <button
            {...titled(messages.gridSize)}
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
          {...titled(messages.createContainer, shortcut('stage.drawContainerTool'))}
          aria-pressed={tool === 'draw-container'}
          type="button"
          onClick={() => setTool('draw-container')}
        >
          <StageToolbarIcon name="container" />
        </button>
        <div className="compose-editor__toolbar-menu-anchor">
          <button
            {...titled(messages.shape, shortcut('stage.drawRectangleTool'))}
            aria-pressed={currentShape}
            data-active-shape={activeShape[0]}
            type="button"
            onClick={() => setTool(activeShape[0])}
          >
            <StageToolbarIcon name={activeShape[2]} />
          </button>
          <button
            {...titled(messages.shape)}
            aria-controls={shapeMenuId}
            aria-expanded={shapeMenuOpen}
            aria-haspopup="menu"
            className="compose-editor__toolbar-menu-trigger"
            ref={shapeMenuTriggerRef}
            type="button"
            onClick={() => {
              setShapeMenuOpen((open) => !open)
              focusFirstShapeItem()
            }}
            onKeyDown={onShapeTriggerKeyDown}
          >
            <StageToolbarIcon name="chevron-down" />
          </button>
          {shapeMenuOpen ? (
            <div
              aria-label={messages.shape}
              className="compose-editor__toolbar-menu"
              id={shapeMenuId}
              ref={shapeMenuRef}
              role="menu"
              onKeyDown={onShapeMenuKeyDown}
            >
              {SHAPE_TOOLS.map(([shapeTool, label, icon, action]) => (
                <button
                  key={shapeTool}
                  aria-pressed={tool === shapeTool}
                  role="menuitemradio"
                  type="button"
                  onClick={() => {
                    setTool(shapeTool)
                    closeShapeMenu()
                  }}
                >
                  <StageToolbarIcon name={icon} />
                  {messages[label]}
                  {shortcut(action) ? <kbd>{shortcut(action)}</kbd> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button {...titled(messages.text, shortcut('stage.drawTextTool'))} aria-pressed={tool === 'draw-text'} type="button" onClick={() => setTool('draw-text')}>
          <StageToolbarIcon name="text" />
        </button>
      </div>
    </div>
  )
}
