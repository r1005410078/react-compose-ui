import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeHierarchy,
  getComposeLock,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import {
  createDuplicateCommand,
  createGroupCommand,
  createLayerOrderCommand,
  createStageSceneIndex,
  createUngroupCommand,
  describeEntityTargets,
  describeTransform,
  getEntityWorldBounds,
  getGroupCommandAvailability,
  getUngroupCommandAvailability,
  zoomViewportAt,
  type StageInteractionController,
  type StageRect,
  type StageViewport,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageDelegatableAction,
  ComposeStageDispatch,
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
  ComposeStageTool,
} from '../types'
import type { getStageMessages } from '../stage-i18n'
import { planStageNudge } from './nudge-planning'
import {
  DELEGATABLE_STAGE_ACTIONS,
  isEditableTarget,
  isStageShortcutMatch,
  keyboardEventCode,
  LAYER_ORDER_SHORTCUTS,
} from './stage-shortcuts'

/** 方向键到单位世界位移的映射；步长由 Shift 决定，不在此表内。 */
const NUDGE_DIRECTIONS: Readonly<Record<string, { x: number; y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

/** 快捷键动作到工具的映射；按表内顺序匹配，先命中者生效。 */
const TOOL_SHORTCUTS: readonly (readonly [ComposeStageShortcutAction, ComposeStageTool])[] = [
  ['stage.selectTool', 'select'],
  ['stage.moveTool', 'move'],
  ['stage.scaleTool', 'scale'],
  ['stage.rotateTool', 'rotate'],
  ['stage.panTool', 'pan'],
  ['stage.drawContainerTool', 'draw-container'],
  ['stage.drawRectangleTool', 'draw-rectangle'],
  ['stage.drawLineTool', 'draw-line'],
  ['stage.drawArrowTool', 'draw-arrow'],
  ['stage.drawCircleTool', 'draw-circle'],
  ['stage.drawTextTool', 'draw-text'],
]

const FIT_VIEWPORT_MARGIN = 0.85
const MIN_FIT_ZOOM = 0.1
const MAX_FIT_ZOOM = 8
const ZOOM_STEP = 1.2

/**
 * 键盘能力的完整依赖清单。
 *
 * @remarks
 * 这里刻意逐项列出而不是接收一个「最新值」聚合 ref：聚合引用只会把作用域捕获换个位置继续
 * 隐藏，读签名仍然看不出这条能力究竟触达了什么。
 */
export interface StageKeyboardCommandsParams {
  readonly controller: StageInteractionController
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly hiddenEntityIds: ReadonlySet<string>
  /** 已按文档顺序归一化的选区；不含实例内部复合地址。 */
  readonly normalizedSelection: readonly string[]
  /** 选区的世界包围盒，`stage.fitSelection` 的目标；无选区时为 null。 */
  readonly selectionBounds: StageRect | null
  readonly viewport: StageViewport
  readonly surfaceSize: { readonly width: number; readonly height: number }
  readonly shortcuts: Readonly<
    Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>
  >
  /** 吸附开关事务的标签文案。 */
  readonly messages: Pick<
    ReturnType<typeof getStageMessages>,
    'toggleGridSnap' | 'toggleSmartSnap'
  >
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  readonly onToolChange?: (tool: ComposeStageTool) => void
  readonly onShortcutAction?: (action: ComposeStageDelegatableAction) => boolean
  readonly onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  /** 是否处于原地文字编辑；Esc 分支要据此抢在编辑目标守卫之前放行。 */
  readonly isTextEditing: () => boolean
  /** 中止进行中的手势（有指针会话则取消会话，否则直接通知内核）。 */
  readonly cancelGesture: () => void
  readonly executeClipboard: (action: 'edit.copy' | 'edit.cut' | 'edit.paste') => void
}

/** 键盘能力的出口。 */
export interface StageKeyboardCommands {
  /** 挂在 surface 上的 `onKeyDown`。 */
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  /**
   * 挂在 surface 上的 `onKeyUp`。
   *
   * @remarks
   * 与本 Hook 内部的 window keyup 监听重复是刻意的：焦点在 Stage 上时 React 事件先到，
   * 焦点在别处时只有 window 监听会到。先到的一方清掉记录的 code，后到的一方自然是 noop。
   */
  readonly onKeyUp: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  /**
   * 结束临时平移。
   *
   * @remarks
   * 松开按键由本 Hook 自己监听；但窗口失焦时宿主还要同时取消指针会话，那是一个必须保持
   * 单一监听器的复合动作，因此把这一半暴露出去由宿主在同一个 blur 处理里调用。
   */
  readonly stopTemporaryPan: () => void
}

/**
 * 「用户用键盘操作舞台」这条能力的全部实现。
 *
 * @remarks
 * 判定是一条**有序级联**，次序本身就是行为：
 *
 * 1. `Escape` 的编辑态分支必须排在可编辑目标守卫之前——编辑目标本身是 contentEditable，
 *    守卫会把 Esc 一并吞掉，编辑会话就再也退不出去。
 * 2. 宿主委派（`onShortcutAction`）必须排在内建动作之前，且只在宿主确认接管时短路，
 *    未接管时行为与不传该属性完全一致。
 * 3. `editableIds` 为空时提前返回，因此其后的层级顺序、编组、删除与微调都以「至少有一个
 *    未锁定的选中项」为前提。
 *
 * 不要为了可读性重排这些分支。
 */
export function useStageKeyboardCommands(
  params: StageKeyboardCommandsParams,
): StageKeyboardCommands {
  const {
    cancelGesture,
    controller,
    dispatch,
    document,
    executeClipboard,
    hiddenEntityIds,
    idFactory,
    isTextEditing,
    layoutSnapshot,
    messages,
    normalizedSelection,
    onKeyDown,
    onSelectedIdsChange,
    onShortcutAction,
    onToolChange,
    onViewportChange,
    selectionBounds,
    shortcuts,
    surfaceSize,
    viewport,
  } = params
  // 临时平移横跨 keydown 与 keyup 两个事件，必须记住是哪一个物理键触发的：用户可能在按住
  // Space 期间再按别的键，只有同一个 code 的 keyup 才算松开。
  const activeTemporaryPanCodeRef = useRef<string | null>(null)

  const stopTemporaryPan = useCallback(() => {
    activeTemporaryPanCodeRef.current = null
    controller.send({ type: 'temporary-pan.end' })
  }, [controller])

  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (activeTemporaryPanCodeRef.current === keyboardEventCode(event)) {
        stopTemporaryPan()
      }
    }
    window.addEventListener('keyup', handleKeyUp)
    return () => window.removeEventListener('keyup', handleKeyUp)
  }, [stopTemporaryPan])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.nativeEvent.isComposing) return
    // 必须排在 isEditableTarget 之前：编辑目标本身就是 contentEditable，焦点在它上面时
    // 该守卫会把 Esc 一并吞掉，会话就再也退不出去。Enter 不在此列——编辑中它属于换行。
    if (isTextEditing() && event.key === 'Escape') {
      controller.send({ type: 'key.down', key: 'Escape' })
      event.preventDefault()
      return
    }
    if (isEditableTarget(event.target)) return
    const actionMatches = (action: ComposeStageShortcutAction) =>
      shortcuts[action].some((binding) => isStageShortcutMatch(event.nativeEvent, binding))
    if (actionMatches('stage.temporaryPan')) {
      activeTemporaryPanCodeRef.current = keyboardEventCode(event.nativeEvent)
      controller.send({ type: 'temporary-pan.start' })
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      cancelGesture()
      return
    }
    if (event.key === 'Enter') {
      controller.send({ type: 'key.down', key: 'Enter' })
      return
    }
    // 宿主可以用统一的动作实现接管可配置动作，避免键盘、工具栏与命令面板各有一套行为。
    // 必须排在内建分支之前，且只在宿主确认接管时才短路，未接管时行为与不传该属性一致。
    if (onShortcutAction) {
      const delegated = DELEGATABLE_STAGE_ACTIONS.find(actionMatches)
      if (delegated !== undefined && onShortcutAction(delegated)) {
        event.preventDefault()
        return
      }
    }
    if (actionMatches('edit.copy') || actionMatches('edit.cut') || actionMatches('edit.paste')) {
      executeClipboard(
        actionMatches('edit.copy')
          ? 'edit.copy'
          : actionMatches('edit.cut') ? 'edit.cut' : 'edit.paste',
      )
      event.preventDefault()
      return
    }
    const toolAction = TOOL_SHORTCUTS.find(([action]) => actionMatches(action))
    if (toolAction) {
      onToolChange?.(toolAction[1])
      event.preventDefault()
      return
    }
    const fitViewport = (target: StageRect | null) => {
      if (!target || target.width <= 0 || target.height <= 0) return
      const zoom = Math.min(
        MAX_FIT_ZOOM,
        Math.max(
          MIN_FIT_ZOOM,
          Math.min(surfaceSize.width / target.width, surfaceSize.height / target.height)
          * FIT_VIEWPORT_MARGIN,
        ),
      )
      onViewportChange({
        zoom,
        x: (surfaceSize.width - target.width * zoom) / 2 - target.x * zoom,
        y: (surfaceSize.height - target.height * zoom) / 2 - target.y * zoom,
      })
    }
    if (actionMatches('stage.fitSelection')) {
      fitViewport(selectionBounds)
      event.preventDefault()
      return
    }
    if (actionMatches('stage.fitContainer')) {
      const index = createStageSceneIndex(document, layoutSnapshot, hiddenEntityIds)
      const selectedContainerId = normalizedSelection.length === 1
        && getComposeHierarchy(document.entities[normalizedSelection[0]!]!)
        ? normalizedSelection[0]!
        : index.commonContainerForSelection(normalizedSelection)
      const container = selectedContainerId
        ? document.entities[selectedContainerId]
        : undefined
      fitViewport(
        container && getComposeHierarchy(container)
          ? getEntityWorldBounds(document, layoutSnapshot, container.id)
          : null,
      )
      event.preventDefault()
      return
    }
    const viewportCenter = {
      x: surfaceSize.width / 2,
      y: surfaceSize.height / 2,
    }
    if (actionMatches('stage.zoomReset')) {
      onViewportChange(zoomViewportAt(viewport, viewportCenter, 1))
      event.preventDefault()
      return
    }
    if (actionMatches('stage.zoomIn')) {
      onViewportChange(zoomViewportAt(viewport, viewportCenter, viewport.zoom * ZOOM_STEP))
      event.preventDefault()
      return
    }
    if (actionMatches('stage.zoomOut')) {
      onViewportChange(zoomViewportAt(viewport, viewportCenter, viewport.zoom / ZOOM_STEP))
      event.preventDefault()
      return
    }
    if (
      actionMatches('stage.toggleGridSnap')
      || actionMatches('stage.toggleSmartSnap')
    ) {
      const gridAction = actionMatches('stage.toggleGridSnap')
      dispatch({
        id: idFactory(),
        type: 'canvas.configure',
        payload: gridAction
          ? {
              grid: {
                ...document.canvas.grid,
                snapEnabled: !document.canvas.grid.snapEnabled,
              },
              smartSnap: document.canvas.smartSnap,
            }
          : {
              grid: document.canvas.grid,
              smartSnap: {
                nodes: !(
                  document.canvas.smartSnap.nodes
                  || document.canvas.smartSnap.guides
                ),
                guides: !(
                  document.canvas.smartSnap.nodes
                  || document.canvas.smartSnap.guides
                ),
              },
            },
        meta: {
          label: gridAction ? messages.toggleGridSnap : messages.toggleSmartSnap,
          source: 'stage',
        },
      })
      event.preventDefault()
      return
    }
    const editableIds = normalizedSelection.filter((id) => {
      const entity = document.entities[id]
      return entity && !getComposeLock(entity).locked
    })
    if (editableIds.length === 0) return
    const layerOrderAction = LAYER_ORDER_SHORTCUTS.find(([action]) =>
      actionMatches(action))
    if (layerOrderAction) {
      const command = createLayerOrderCommand(
        document,
        editableIds,
        layerOrderAction[1],
        idFactory(),
      )
      if (command) dispatch(command)
      event.preventDefault()
      return
    }
    if (actionMatches('edit.duplicate')) {
      const duplicate = createDuplicateCommand(
        document,
        editableIds[0]!,
        idFactory,
        idFactory(),
      )
      if (duplicate) {
        const result = dispatch(duplicate.command)
        if (result.status === 'committed') onSelectedIdsChange([duplicate.rootId])
      }
      event.preventDefault()
      return
    }
    if (actionMatches('edit.group') || actionMatches('edit.ungroup')) {
      const wantsUngroup = actionMatches('edit.ungroup')
      const groupAllowed = getGroupCommandAvailability(document, editableIds).available
      const ungroupAllowed = editableIds.length === 1
        && getUngroupCommandAvailability(document, editableIds[0]!).available
      if (wantsUngroup && editableIds.length === 1 && ungroupAllowed) {
        const container = document.entities[editableIds[0]!]
        const hierarchy = container && getComposeHierarchy(container)
        const result = dispatch(createUngroupCommand(
          document,
          layoutSnapshot,
          editableIds[0]!,
          idFactory(),
        ))
        if (result.status === 'committed' && hierarchy) {
          onSelectedIdsChange(hierarchy.childIds)
        }
      }
      else if (!wantsUngroup && editableIds.length >= 2 && groupAllowed) {
        const groupId = idFactory()
        const result = dispatch(createGroupCommand(
          document,
          layoutSnapshot,
          editableIds,
          groupId,
          idFactory(),
        ))
        if (result.status === 'committed') onSelectedIdsChange([groupId])
      }
      event.preventDefault()
      return
    }
    if (actionMatches('edit.delete')) {
      dispatch({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds: editableIds },
        meta: {
          label: `Delete ${describeEntityTargets(document, editableIds)}`,
          source: 'stage',
          targetIds: editableIds,
        },
      })
      event.preventDefault()
      return
    }
    const direction = NUDGE_DIRECTIONS[event.key]
    if (direction) {
      const plan = planStageNudge(
        document,
        layoutSnapshot,
        editableIds,
        direction,
        event.shiftKey ? 10 : 1,
      )
      if (plan.movableIds.length === 0) return
      dispatch({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.setTransform,
        payload: { operation: 'move', updates: plan.updates },
        meta: {
          label: describeTransform(document, plan.stageUpdates, 'move'),
          source: 'stage',
          targetIds: plan.movableIds,
          mergeKey: `stage:nudge:${plan.movableIds.join(',')}`,
        },
      })
      event.preventDefault()
    }
  }

  const handleKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (activeTemporaryPanCodeRef.current === keyboardEventCode(event.nativeEvent)) {
      stopTemporaryPan()
    }
  }

  return { onKeyDown: handleKeyDown, onKeyUp: handleKeyUp, stopTemporaryPan }
}
