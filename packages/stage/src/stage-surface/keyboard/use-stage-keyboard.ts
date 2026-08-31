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
  createStageDeleteEntitiesCommand,
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
} from '../../types'
import type { getStageMessages } from '../../stage-i18n'
import { isStageJunctionEntity } from '../../drafting/wire-tap'
import { planStageNudge } from './nudge-planning'
import { fitViewportTo, zoomViewportByIntent } from '../stage-viewport-actions'
import {
  COMMAND_SHORTCUTS,
  DELEGATABLE_STAGE_ACTIONS,
  isEditableTarget,
  isStageShortcutMatch,
  keyboardEventCode,
  LAYER_ORDER_SHORTCUTS,
  STAGE_SHORTCUT_ACTIONS,
} from './stage-shortcuts'

/**
 * 能起一个坐标的字符。
 *
 * @remarks
 * 三种写法各自的首字符与后续字符：`x,y` / `@dx,dy` / `距离<角度`，以及裸数字。字母不在其中——
 * 它们是关键字与命令名，转交过去会把每一次误触都变成命令行里的垃圾。
 */
const POINT_INPUT_CHARS = /[0-9@,.<-]/

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
  ['stage.drawContainerTool', 'draw-container'],
  ['stage.drawTextTool', 'draw-text'],
]

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
  /**
   * 启动一条命令会话。
   *
   * @remarks
   * 与命令行、`ComposeStageHandle.startCommand` 是**同一个**函数：另走一条路必然只实现
   * 三种拒绝里的一两种，同一条命令会在不同入口给出不同结果。
   */
  readonly startCommand: (commandId: string) => void
  /**
   * 此刻有没有命令会话在跑。
   *
   * @remarks
   * 有的话图面上的单键不启动新命令——SDD 2.2 的最终形态是把这些字符转交给动态输入框，
   * 而动态输入尚未落地；在它到来之前启动新命令会**静默丢弃**正在进行的那一条，用户已取
   * 的点就没了。什么都不做是这条规则的安全子集。
   */
  readonly isCommandActive: () => boolean
  /**
   * 命令此刻正在等一个点。
   *
   * @remarks
   * 这一档里图面上的数字、`@`、`,`、`<`、`-`、`.` 全部**转交命令行**——命令行是坐标与动态
   * 输入唯一的输入端，而用户点完第一个点之后焦点就在图面上了。不转交的话，他必须把手移回
   * 命令行才打得出第二个点的坐标，而屏幕上没有任何东西在说这件事。
   */
  readonly isAwaitingPoint: () => boolean
  /** 把焦点交回命令行输入框。 */
  readonly focusCommandLine: () => void
  /** `Tab`：锁定当前数值字段并切到另一个；这一步没有字段时为 `null`。 */
  readonly advanceField: (() => void) | null
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
    advanceField,
    focusCommandLine,
    isAwaitingPoint,
    isCommandActive,
    messages,
    normalizedSelection,
    onKeyDown,
    onSelectedIdsChange,
    onShortcutAction,
    onToolChange,
    onViewportChange,
    selectionBounds,
    shortcuts,
    startCommand,
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
    /*
     * 命令正在取点时，图面上的键盘输入转交命令行。
     *
     * **必须排在快捷键之前**：`Shift+2` 在 US 布局上打出的正是 `@`，而它同时是「适配选择」
     * 的默认键——不抢在前面，用户想打 `@dx,dy` 会得到一次视口适配。
     *
     * 带 primary/alt 的组合一律放行：那些是剪贴板与缩放，不是坐标。
     */
    if (isAwaitingPoint() && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === 'Tab' && advanceField) {
        event.preventDefault()
        focusCommandLine()
        advanceField()
        return
      }
      if (event.key.length === 1 && POINT_INPUT_CHARS.test(event.key)) {
        // **不** `preventDefault`：聚焦之后这个字符要落进输入框里，拦下来就白转交了。
        focusCommandLine()
        return
      }
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
    /*
     * 绘图命令：按下即启动，与在命令行敲这个名字完全相同的会话。
     *
     * **命令进行中一律不接管**：不是「换一条命令」，而是连 `preventDefault` 都不做，让
     * 这个字符落回图面。启动新命令会静默丢弃正在进行的那一条，而动态输入落地之后这一档
     * 要把字符转交给光标旁的输入框——现在什么都不做正是那条语义的安全子集。
     *
     * **同一个事件上还有别的动作时让路。** 绘图键是七个**裸字母**，是本表里最容易被撞上的
     * 一类绑定；宿主把某个动作重绑到 `P` 是一次显式选择，而 `P` 画多段线只是默认值。不让路
     * 的话，新增这七个默认键会静默夺走宿主已经绑好的键，症状是「我绑的键失灵了」。
     */
    const commandAction = COMMAND_SHORTCUTS.find(([action]) => actionMatches(action))
    if (commandAction && !isCommandActive()) {
      const yieldsTo = STAGE_SHORTCUT_ACTIONS.some(
        (action) => !action.startsWith('drafting.') && actionMatches(action),
      )
      if (!yieldsTo) {
        startCommand(commandAction[1])
        event.preventDefault()
        return
      }
    }
    const fitViewport = (target: StageRect | null) => {
      const next = fitViewportTo(target, surfaceSize)
      if (next) onViewportChange(next)
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
    const zoomIntent = ([
      ['stage.zoomReset', 'reset'],
      ['stage.zoomIn', 'in'],
      ['stage.zoomOut', 'out'],
    ] as const).find(([action]) => actionMatches(action))
    if (zoomIntent) {
      onViewportChange(zoomViewportByIntent(viewport, surfaceSize, zoomIntent[1]))
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
      // 删除与「因此失去支路的节点」收进同一条命令；四个删除入口共用这一份清理。
      const removal = createStageDeleteEntitiesCommand(document, editableIds, {
        idFactory,
        isJunction: isStageJunctionEntity,
        label: `Delete ${describeEntityTargets(document, editableIds)}`,
      })
      if (removal) dispatch(removal)
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
