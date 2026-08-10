import { BUILTIN_COMMAND_TYPES } from '@compose-ui/core'
import {
  createDuplicateCommand,
  createGroupCommand,
  createUngroupCommand,
  getGroupCommandAvailability,
  getUngroupCommandAvailability,
} from '@compose-ui/stage-engine'
import { getComposeHierarchy, getComposeLock } from '@compose-ui/core'
import type { ComposeCommandAction } from '@compose-ui/command-panel'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
} from '@compose-ui/core'
import type { ComposeStageTool } from '@compose-ui/stage'
import type { ComposeLocale } from '@compose-ui/ui-context'
import {
  getEditorActionCategory,
  getEditorActionReasons,
  getEditorShortcutActionLabel,
} from '../editor-i18n'
import type { EditorActionReasons } from '../editor-i18n'
import {
  COMPOSE_EDITOR_SHORTCUT_SCOPES,
  type ComposeEditorKeybinding,
  type ComposeEditorShortcutAction,
} from '../editor-preferences'

type FormatMessage = (
  id: string,
  fallback: string,
  variables?: Readonly<Record<string, string | number>>,
) => string

/**
 * 目录覆盖的动作。
 *
 * @remarks
 * 临时平移是按住不放的手势，做成一次性调用没有意义，因此不在目录中，也不参与 Stage 接管。
 *
 * @public
 */
export type ComposeEditorActionId = Exclude<
  ComposeEditorShortcutAction,
  'stage.temporaryPan'
>

/** 动作不可用的稳定标识；呈现层据此查本地化文案。 @public */
export type ComposeEditorActionDisabledKey = keyof EditorActionReasons

/** 与界面语言无关的单个动作执行入口。 @public */
export interface ComposeEditorActionHandler {
  /** 有值表示当前不可用；`run` 在此情况下不产生任何副作用。 */
  readonly disabled?: ComposeEditorActionDisabledKey
  run(): void
}

/**
 * 构建命令目录所需的编辑器状态与执行入口。
 *
 * @remarks
 * 视口与工具入口由控制器绑定后传入，因此本模块不持有视口数学，只负责动作身份、
 * 可用性判断与派发装配。
 *
 * @public
 */
export interface ComposeEditorActionContext {
  /** 当前文档，用于判断选区可用性并构建命令载荷。 */
  readonly document: ComposeDocument
  /** 界面语言。 */
  readonly locale: ComposeLocale
  /** 宿主覆盖内建文案的可选钩子。 */
  readonly formatMessage?: FormatMessage
  /** 当前生效的键位，仅用于在面板中展示。 */
  readonly shortcuts: Readonly<
    Record<ComposeEditorShortcutAction, readonly ComposeEditorKeybinding[]>
  >
  /** 当前选中的 Entity ID。 */
  readonly selectedIds: readonly string[]
  /** 已就绪的布局快照；为 null 时依赖几何的结构动作不可用。 */
  readonly layoutSnapshot: ComposeLayoutSnapshot | null
  /** 是否存在可撤销的事务。 */
  readonly canUndo: boolean
  /** 是否存在可重做的事务。 */
  readonly canRedo: boolean
  /** 生成稳定命令与 Entity ID。 */
  readonly idFactory: () => string
  /** 派发结构化命令；仅文档动作使用。 */
  readonly dispatch: (command: EditorCommand) => CommandDispatchResult
  /** 提交后修正选区。 */
  readonly setSelectedIds: (ids: readonly string[]) => void
  /** 切换当前舞台工具。 */
  readonly setTool: (tool: ComposeStageTool) => void
  /** 以视口中心按倍率缩放。 */
  readonly zoomBy: (factor: number) => void
  /** 缩放回 100%。 */
  readonly zoomReset: () => void
  /** 适配当前选区。 */
  readonly fitSelection: () => void
  /** 适配选区所在容器。 */
  readonly fitContainer: () => void
  /** 切换网格吸附。 */
  readonly toggleGridSnap: () => void
  /** 切换智能吸附。 */
  readonly toggleSmartSnap: () => void
  /** 撤销一步。 */
  readonly undo?: () => void
  /** 重做一步。 */
  readonly redo?: () => void
  /** 打开设置；宿主未提供时目录整条省略该动作。 */
  readonly openSettings?: () => void
}

/**
 * 执行层所需的上下文：不含界面语言与键位展示信息。
 *
 * @public
 */
export type ComposeEditorActionHandlerContext = Omit<
  ComposeEditorActionContext,
  'locale' | 'formatMessage' | 'shortcuts'
>

/** 只有未锁定的选中项能参与结构编辑，与 Stage 键盘处理的口径保持一致。 */
function editableSelection(context: ComposeEditorActionHandlerContext): readonly string[] {
  return context.selectedIds.filter((id) => {
    const entity = context.document.entities[id]
    return entity !== undefined && !getComposeLock(entity).locked
  })
}

/**
 * 构建与界面语言无关的动作执行层。
 *
 * @remarks
 * 命令面板与 Stage 快捷键共用同一份结果，因此同一个动作无论从哪个入口触发都得到一致行为。
 * 不可用状态以稳定标识返回，由呈现层翻译成用户可读原因。
 *
 * @param context - 当前文档、选区与已绑定的执行入口。
 * @returns 目录覆盖的每个动作的可用性与执行函数。
 * @public
 */
export function createComposeEditorActionHandlers(
  context: ComposeEditorActionHandlerContext,
): Readonly<Record<ComposeEditorActionId, ComposeEditorActionHandler>> {
  const { document, layoutSnapshot } = context
  const editable = editableSelection(context)

  const groupAvailability = getGroupCommandAvailability(document, editable)
  const groupDisabled: ComposeEditorActionDisabledKey | undefined = editable.length < 2
    ? 'needsTwoEntities'
    : groupAvailability.available
      ? undefined
      : 'flowGroup'

  const ungroupTarget = editable.length === 1 ? editable[0] : undefined
  const ungroupContainer = ungroupTarget === undefined
    ? undefined
    : document.entities[ungroupTarget]
  const ungroupUsable = ungroupTarget !== undefined
    && ungroupContainer !== undefined
    && getComposeHierarchy(ungroupContainer) !== undefined
  const ungroupDisabled: ComposeEditorActionDisabledKey | undefined = !ungroupUsable
    ? 'needsOneContainer'
    : getUngroupCommandAvailability(document, ungroupTarget).available
      ? undefined
      : 'flowUngroup'

  // 依赖世界包围盒的结构动作在布局快照就绪前无法规划，必须给出等待原因而不是静默失败。
  const geometryPending: ComposeEditorActionDisabledKey | undefined = layoutSnapshot === null
    ? 'layoutPending'
    : undefined
  const selectionMissing: ComposeEditorActionDisabledKey | undefined = editable.length === 0
    ? 'noSelection'
    : undefined

  /** 包装 run：不可用时直接返回，保证目录被直接调用也不产生副作用。 */
  const handler = (
    disabled: ComposeEditorActionDisabledKey | undefined,
    run: () => void,
  ): ComposeEditorActionHandler => ({
    disabled,
    run: () => {
      if (disabled !== undefined) return
      run()
    },
  })

  return {
    'stage.selectTool': handler(undefined, () => { context.setTool('select') }),
    'stage.moveTool': handler(undefined, () => { context.setTool('move') }),
    'stage.scaleTool': handler(undefined, () => { context.setTool('scale') }),
    'stage.rotateTool': handler(undefined, () => { context.setTool('rotate') }),
    'stage.panTool': handler(undefined, () => { context.setTool('pan') }),
    'stage.drawContainerTool': handler(undefined, () => { context.setTool('draw-container') }),
    'stage.drawRectangleTool': handler(undefined, () => { context.setTool('draw-rectangle') }),
    'stage.drawLineTool': handler(undefined, () => { context.setTool('draw-line') }),
    'stage.drawArrowTool': handler(undefined, () => { context.setTool('draw-arrow') }),
    'stage.drawCircleTool': handler(undefined, () => { context.setTool('draw-circle') }),
    'stage.drawTextTool': handler(undefined, () => { context.setTool('draw-text') }),
    'stage.zoomIn': handler(undefined, () => { context.zoomBy(1.2) }),
    'stage.zoomOut': handler(undefined, () => { context.zoomBy(1 / 1.2) }),
    'stage.zoomReset': handler(undefined, () => { context.zoomReset() }),
    'stage.fitSelection': handler(
      selectionMissing ?? geometryPending,
      () => { context.fitSelection() },
    ),
    'stage.fitContainer': handler(
      (context.selectedIds.length === 0 ? 'noSelection' : undefined) ?? geometryPending,
      () => { context.fitContainer() },
    ),
    'stage.toggleGridSnap': handler(undefined, () => { context.toggleGridSnap() }),
    'stage.toggleSmartSnap': handler(undefined, () => { context.toggleSmartSnap() }),
    'edit.duplicate': handler(selectionMissing ?? geometryPending, () => {
      const sourceId = editable[0]
      if (sourceId === undefined) return
      const duplicate = createDuplicateCommand(
        document,
        sourceId,
        context.idFactory,
        context.idFactory(),
      )
      if (!duplicate) return
      if (context.dispatch(duplicate.command).status === 'committed') {
        context.setSelectedIds([duplicate.rootId])
      }
    }),
    'edit.group': handler(groupDisabled ?? geometryPending, () => {
      if (layoutSnapshot === null) return
      const containerId = context.idFactory()
      const command = createGroupCommand(
        document,
        layoutSnapshot,
        editable,
        containerId,
        context.idFactory(),
      )
      if (context.dispatch(command).status === 'committed') {
        context.setSelectedIds([containerId])
      }
    }),
    'edit.ungroup': handler(ungroupDisabled ?? geometryPending, () => {
      if (layoutSnapshot === null || ungroupTarget === undefined) return
      if (ungroupContainer === undefined) return
      const childIds = getComposeHierarchy(ungroupContainer)?.childIds ?? []
      const command = createUngroupCommand(
        document,
        layoutSnapshot,
        ungroupTarget,
        context.idFactory(),
      )
      if (context.dispatch(command).status === 'committed') {
        context.setSelectedIds(childIds)
      }
    }),
    'edit.delete': handler(selectionMissing, () => {
      context.dispatch({
        id: context.idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds: [...editable] },
        meta: {
          // 与 Stage 键盘删除保持同一措辞：英文动词加 Entity 名称，便于历史面板辨认。
          label: `Delete ${editable
            .map((id) => document.entities[id]?.name ?? id)
            .join(', ')}`,
          source: 'command-panel',
          targetIds: [...editable],
        },
      })
    }),
    'history.undo': handler(
      context.canUndo ? undefined : 'nothingToUndo',
      () => { context.undo?.() },
    ),
    'history.redo': handler(
      context.canRedo ? undefined : 'nothingToRedo',
      () => { context.redo?.() },
    ),
    'editor.settings': handler(undefined, () => { context.openSettings?.() }),
  }
}

/** 目录呈现顺序；与执行层解耦，改动顺序不影响行为。 */
const CATALOG_ORDER: readonly ComposeEditorActionId[] = [
  'stage.selectTool',
  'stage.moveTool',
  'stage.scaleTool',
  'stage.rotateTool',
  'stage.panTool',
  'stage.drawContainerTool',
  'stage.drawRectangleTool',
  'stage.drawLineTool',
  'stage.drawArrowTool',
  'stage.drawCircleTool',
  'stage.drawTextTool',
  'stage.zoomIn',
  'stage.zoomOut',
  'stage.zoomReset',
  'stage.fitSelection',
  'stage.fitContainer',
  'stage.toggleGridSnap',
  'stage.toggleSmartSnap',
  'edit.duplicate',
  'edit.group',
  'edit.ungroup',
  'edit.delete',
  'history.undo',
  'history.redo',
  'editor.settings',
]

/**
 * 在执行层之上补齐本地化名称、分组与不可用原因。
 *
 * @param context - 执行层上下文加界面语言与当前键位。
 * @returns 可直接交给命令面板的动作列表。
 * @public
 */
export function createComposeEditorActions(
  context: ComposeEditorActionContext,
): readonly ComposeCommandAction[] {
  const { formatMessage, locale } = context
  const reasons = getEditorActionReasons(locale, formatMessage)
  const handlers = createComposeEditorActionHandlers(context)

  return CATALOG_ORDER
    // 宿主没有提供设置入口时整条省略，避免产出点了没反应的条目。
    .filter((id) => id !== 'editor.settings' || context.openSettings !== undefined)
    .map((id) => {
      const entry = handlers[id]
      return {
        id,
        title: getEditorShortcutActionLabel(locale, id, formatMessage),
        category: getEditorActionCategory(
          locale,
          COMPOSE_EDITOR_SHORTCUT_SCOPES[id],
          formatMessage,
        ),
        shortcut: context.shortcuts[id],
        disabledReason: entry.disabled === undefined ? undefined : reasons[entry.disabled],
        run: entry.run,
      }
    })
}
