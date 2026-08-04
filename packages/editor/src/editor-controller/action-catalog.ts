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
 * 构建命令目录所需的编辑器状态与执行入口。
 *
 * @remarks
 * 视口与工具入口由控制器绑定后传入，因此本模块不持有视口数学，只负责动作身份、
 * 本地化、可用性判断与派发装配。
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

/** 只有未锁定的选中项能参与结构编辑，与 Stage 键盘处理的口径保持一致。 */
function editableSelection(context: ComposeEditorActionContext): readonly string[] {
  return context.selectedIds.filter((id) => {
    const entity = context.document.entities[id]
    return entity !== undefined && !getComposeLock(entity).locked
  })
}

export function createComposeEditorActions(
  context: ComposeEditorActionContext,
): readonly ComposeCommandAction[] {
  const { document, formatMessage, layoutSnapshot, locale } = context
  const reasons = getEditorActionReasons(locale, formatMessage)
  const editable = editableSelection(context)

  const describe = (action: ComposeEditorShortcutAction) => ({
    id: action,
    title: getEditorShortcutActionLabel(locale, action, formatMessage),
    category: getEditorActionCategory(
      locale,
      COMPOSE_EDITOR_SHORTCUT_SCOPES[action],
      formatMessage,
    ),
    shortcut: context.shortcuts[action],
  })

  const groupAvailability = editable.length >= 2
    ? getGroupCommandAvailability(document, editable)
    : { available: false as const, reason: reasons.needsTwoEntities }
  const ungroupTarget = editable.length === 1 ? editable[0] : undefined
  const ungroupContainer = ungroupTarget === undefined
    ? undefined
    : document.entities[ungroupTarget]
  const ungroupAvailability = ungroupTarget === undefined
    || ungroupContainer === undefined
    || getComposeHierarchy(ungroupContainer) === undefined
    ? { available: false as const, reason: reasons.needsOneContainer }
    : getUngroupCommandAvailability(document, ungroupTarget)

  // 依赖世界包围盒的结构动作在布局快照就绪前无法规划，必须给出等待原因而不是静默失败。
  const geometryPending = layoutSnapshot === null ? reasons.layoutPending : undefined

  const actions: ComposeCommandAction[] = [
    {
      ...describe('stage.selectTool'),
      run: () => { context.setTool('select') },
    },
    {
      ...describe('stage.panTool'),
      run: () => { context.setTool('pan') },
    },
    {
      ...describe('stage.zoomIn'),
      run: () => { context.zoomBy(1.2) },
    },
    {
      ...describe('stage.zoomOut'),
      run: () => { context.zoomBy(1 / 1.2) },
    },
    {
      ...describe('stage.zoomReset'),
      run: () => { context.zoomReset() },
    },
    {
      ...describe('stage.fitSelection'),
      disabledReason: editable.length === 0 ? reasons.noSelection : geometryPending,
      run: () => { context.fitSelection() },
    },
    {
      ...describe('stage.fitContainer'),
      disabledReason: context.selectedIds.length === 0 ? reasons.noSelection : geometryPending,
      run: () => { context.fitContainer() },
    },
    {
      ...describe('stage.toggleGridSnap'),
      run: () => { context.toggleGridSnap() },
    },
    {
      ...describe('stage.toggleSmartSnap'),
      run: () => { context.toggleSmartSnap() },
    },
    {
      ...describe('edit.duplicate'),
      disabledReason: editable.length === 0 ? reasons.noSelection : geometryPending,
      run: () => {
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
      },
    },
    {
      ...describe('edit.group'),
      disabledReason: groupAvailability.available ? geometryPending : groupAvailability.reason,
      run: () => {
        if (layoutSnapshot === null || !groupAvailability.available) return
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
      },
    },
    {
      ...describe('edit.ungroup'),
      disabledReason: ungroupAvailability.available ? geometryPending : ungroupAvailability.reason,
      run: () => {
        if (layoutSnapshot === null || ungroupTarget === undefined || ungroupContainer === undefined) return
        if (!ungroupAvailability.available) return
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
      },
    },
    {
      ...describe('edit.delete'),
      disabledReason: editable.length === 0 ? reasons.noSelection : undefined,
      run: () => {
        if (editable.length === 0) return
        context.dispatch({
          id: context.idFactory(),
          type: BUILTIN_COMMAND_TYPES.deleteEntity,
          payload: { entityIds: [...editable] },
          meta: {
            label: getEditorShortcutActionLabel(locale, 'edit.delete', formatMessage),
            source: 'command-panel',
            targetIds: [...editable],
          },
        })
      },
    },
    {
      ...describe('history.undo'),
      disabledReason: context.canUndo ? undefined : reasons.nothingToUndo,
      run: () => { context.undo?.() },
    },
    {
      ...describe('history.redo'),
      disabledReason: context.canRedo ? undefined : reasons.nothingToRedo,
      run: () => { context.redo?.() },
    },
  ]

  // 宿主没有提供设置入口时整条省略，避免产出点了没反应的条目。
  if (context.openSettings !== undefined) {
    const openSettings = context.openSettings
    actions.push({ ...describe('editor.settings'), run: () => { openSettings() } })
  }

  return actions
}
