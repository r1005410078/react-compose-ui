import { BUILTIN_COMMAND_TYPES } from '@compose-ui/core'
import {
  createStageDeleteEntitiesCommand,
  createDuplicateCommand,
  createGroupCommand,
  createLayerOrderCommand,
  createUngroupCommand,
  getGroupCommandAvailability,
  getLayerOrderCommandAvailability,
  getUngroupCommandAvailability,
  resolveNextScenePlacement,
  type ComposeLayerOrderOperation,
} from '@compose-ui/stage-engine'
import {
  COMPOSE_DEFAULT_FRAME_SIZE,
  createComposeFrameEntity,
  getComposeHierarchy,
  getComposeLock,
} from '@compose-ui/core'
import type { JsonValue } from '@compose-ui/core'
import { createComposeImmediateCommand } from '@compose-ui/commands'
import type { ComposeCommandAction } from '@compose-ui/command-panel'
import type { ComposeCommandDefinition, ComposeCommandDescriptor } from '@compose-ui/commands'
import type { StageDraftingContext, StageDraftingEffect } from '@compose-ui/stage-engine'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
} from '@compose-ui/core'
import { isStageJunctionEntity } from '@compose-ui/stage'
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
  /** 打开“创建组件”命名流程；未配置 Component Store 时目录整条省略。 */
  readonly createComponent?: () => void
  /** 当前会话剪贴板是否可复制。省略时按选区推断。 */
  readonly canCopy?: boolean
  /** 当前会话剪贴板是否可剪切。省略时按未锁定选区推断。 */
  readonly canCut?: boolean
  /** 当前会话剪贴板是否可粘贴。 */
  readonly canPaste?: boolean
  /** 把当前选区写入会话剪贴板。 */
  readonly copySelection?: () => void
  /** 把当前未锁定选区写入剪切剪贴板。 */
  readonly cutSelection?: () => void
  /** 按建议落点粘贴会话剪贴板。 */
  readonly pasteSelection?: () => void
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
  const layerOrderDisabled = (
    operation: ComposeLayerOrderOperation,
  ): ComposeEditorActionDisabledKey | undefined => {
    if (context.selectedIds.length === 0) return 'noSelection'
    return getLayerOrderCommandAvailability(
      document,
      context.selectedIds,
      operation,
    ).available
      ? undefined
      : 'layerOrderBoundary'
  }

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
    'stage.drawContainerTool': handler(undefined, () => { context.setTool('draw-container') }),
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
    'edit.copy': handler(
      (context.canCopy ?? context.selectedIds.length > 0) ? undefined : 'noSelection',
      () => { context.copySelection?.() },
    ),
    'edit.cut': handler(
      (context.canCut ?? editable.length > 0) ? undefined : 'noSelection',
      () => { context.cutSelection?.() },
    ),
    'edit.paste': handler(
      context.canPaste ? undefined : 'emptyClipboard',
      () => { context.pasteSelection?.() },
    ),
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
    'edit.bringForward': handler(layerOrderDisabled('bring-forward'), () => {
      const command = createLayerOrderCommand(
        document,
        context.selectedIds,
        'bring-forward',
        context.idFactory(),
      )
      if (command) context.dispatch(command)
    }),
    'edit.sendBackward': handler(layerOrderDisabled('send-backward'), () => {
      const command = createLayerOrderCommand(
        document,
        context.selectedIds,
        'send-backward',
        context.idFactory(),
      )
      if (command) context.dispatch(command)
    }),
    'edit.bringToFront': handler(layerOrderDisabled('bring-to-front'), () => {
      const command = createLayerOrderCommand(
        document,
        context.selectedIds,
        'bring-to-front',
        context.idFactory(),
      )
      if (command) context.dispatch(command)
    }),
    'edit.sendToBack': handler(layerOrderDisabled('send-to-back'), () => {
      const command = createLayerOrderCommand(
        document,
        context.selectedIds,
        'send-to-back',
        context.idFactory(),
      )
      if (command) context.dispatch(command)
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
    'edit.createComponent': handler(selectionMissing ?? geometryPending, () => {
      context.createComponent?.()
    }),
    'scene.create': handler(undefined, () => {
      // 摆位与场景树的根级新建共用同一个解析器，否则两个入口会给出两种排布。
      // 刻意不自动激活：激活写在页面文件里、不进撤销历史，自动激活会造出
      // 「撤销后场景已删除但激活仍指向它」的悬空状态。
      const entity = createComposeFrameEntity({
        id: context.idFactory(),
        // 与 core 写入根场景的默认名保持同一措辞；序号让多场景在场景树里可区分。
        name: `场景 ${document.rootIds.length + 1}`,
        offset: resolveNextScenePlacement(document),
        size: COMPOSE_DEFAULT_FRAME_SIZE,
      })
      const result = context.dispatch({
        id: context.idFactory(),
        type: BUILTIN_COMMAND_TYPES.createEntity,
        payload: { entity: entity as unknown as JsonValue, parentId: null },
        meta: {
          label: `Create ${entity.name}`,
          source: 'command-panel',
          targetIds: [entity.id],
        },
      })
      if (result.status === 'committed') context.setSelectedIds([entity.id])
    }),
    'edit.delete': handler(selectionMissing, () => {
      // 删除与「因此失去支路的节点」收进同一条命令：四个删除入口共用这一份清理，
      // 逐条挂钩子漏一条的症状是「删掉一条线之后图上留着一个孤零零的点」。
      const removal = createStageDeleteEntitiesCommand(document, [...editable], {
        idFactory: context.idFactory,
        isJunction: isStageJunctionEntity,
        source: 'command-panel',
        // 与 Stage 键盘删除保持同一措辞：英文动词加 Entity 名称，便于历史面板辨认。
        label: `Delete ${editable
          .map((id) => document.entities[id]?.name ?? id)
          .join(', ')}`,
      })
      if (removal) context.dispatch(removal)
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
  'stage.drawContainerTool',
  'stage.drawTextTool',
  'stage.zoomIn',
  'stage.zoomOut',
  'stage.zoomReset',
  'stage.fitSelection',
  'stage.fitContainer',
  'stage.toggleGridSnap',
  'stage.toggleSmartSnap',
  'edit.duplicate',
  'edit.copy',
  'edit.cut',
  'edit.paste',
  'edit.bringForward',
  'edit.sendBackward',
  'edit.bringToFront',
  'edit.sendToBack',
  'edit.group',
  'edit.ungroup',
  'edit.createComponent',
  'scene.create',
  'edit.delete',
  'history.undo',
  'history.redo',
  'editor.settings',
]

/**
 * 动作在命令行里的键入写法。
 *
 * @remarks
 * **不本地化**：它是用户键入的标识，与 `LINE`、`MOVE` 同类。本地化会让同一条动作在中英文
 * 界面下敲法不同，而肌肉记忆、文档与截图全部会失效——AutoCAD 的本地化版本正是靠 `_LINE`
 * 这个下划线前缀保住英文名的。
 *
 * 表里**故意缺席**的九条不是漏掉的，它们已经有等价的画布命令：
 *
 * - 八个工具切换（`stage.selectTool` … `stage.drawTextTool`）——绘制工具与绘图命令是同一
 *   能力的两个入口，`RECTANGLE` 这个词已经属于命令。
 * - `edit.delete`——`ERASE`/`E` 严格更强：没选中时它会提示选择对象，而本动作只能报「没有
 *   选中对象」。给它一个 `DELETE` 别名等于给同一件事造两个词，其中一个还更差。
 *
 * 缺席不等于敲不出来：`resolve` 大小写无关，`EDIT.DELETE` 仍然命中。
 *
 * 剪贴板三条借 AutoCAD 的既有解法（`COPYCLIP` / `CUTCLIP` / `PASTECLIP`），因为 `COPY`
 * 已经被几何复制命令占着。
 *
 * @public
 */
export const COMPOSE_EDITOR_COMMAND_ALIASES: Partial<
  Record<ComposeEditorActionId, readonly string[]>
> = {
  'stage.zoomIn': ['ZOOMIN'],
  'stage.zoomOut': ['ZOOMOUT'],
  'stage.zoomReset': ['ZOOMRESET'],
  'stage.fitSelection': ['FITSELECTION'],
  'stage.fitContainer': ['FITCONTAINER'],
  'stage.toggleGridSnap': ['GRIDSNAP'],
  'stage.toggleSmartSnap': ['SMARTSNAP'],
  'edit.duplicate': ['DUPLICATE'],
  'edit.copy': ['COPYCLIP'],
  'edit.cut': ['CUTCLIP'],
  'edit.paste': ['PASTECLIP'],
  'edit.bringForward': ['BRINGFORWARD'],
  'edit.sendBackward': ['SENDBACKWARD'],
  'edit.bringToFront': ['BRINGTOFRONT'],
  'edit.sendToBack': ['SENDTOBACK'],
  'edit.group': ['GROUP'],
  'edit.ungroup': ['UNGROUP'],
  'edit.createComponent': ['COMPONENT'],
  'scene.create': ['SCENE'],
  'history.undo': ['UNDO', 'U'],
  'history.redo': ['REDO'],
  'editor.settings': ['SETTINGS'],
}

/**
 * 目录的一条：可呈现半边加一个执行入口。
 *
 * @remarks
 * 命令面板与画布命令行都从它派生，因此可用性只算一次。两个入口各自装配会让同一条动作在两处
 * 出现不同的名称、分组或可用性，而用户无法判断哪一个才对。
 *
 * @public
 */
export interface ComposeEditorCatalogEntry {
  readonly descriptor: ComposeCommandDescriptor
  run(): void
}

/**
 * 在执行层之上补齐本地化名称、分组、别名与不可用原因。
 *
 * @param context - 执行层上下文加界面语言与当前键位。
 * @returns 命令面板与命令行共用的目录。
 * @public
 */
export function createComposeEditorCatalog(
  context: ComposeEditorActionContext,
): readonly ComposeEditorCatalogEntry[] {
  const { formatMessage, locale } = context
  const reasons = getEditorActionReasons(locale, formatMessage)
  const handlers = createComposeEditorActionHandlers(context)

  return CATALOG_ORDER
    // 宿主没有提供设置入口时整条省略，避免产出点了没反应的条目。
    .filter((id) => (
      (id !== 'editor.settings' || context.openSettings !== undefined)
      && (id !== 'edit.createComponent' || context.createComponent !== undefined)
    ))
    .map((id) => {
      const entry = handlers[id]
      const aliases = COMPOSE_EDITOR_COMMAND_ALIASES[id]
      return {
        descriptor: {
          id,
          ...(aliases ? { aliases } : {}),
          title: getEditorShortcutActionLabel(locale, id, formatMessage),
          category: getEditorActionCategory(
            locale,
            COMPOSE_EDITOR_SHORTCUT_SCOPES[id],
            formatMessage,
          ),
          shortcut: context.shortcuts[id],
          disabledReason: entry.disabled === undefined ? undefined : reasons[entry.disabled],
        },
        run: entry.run,
      }
    })
}

/**
 * 装配可直接交给命令面板的动作列表。
 *
 * @param context - 执行层上下文加界面语言与当前键位。
 * @returns 面板动作，与命令行的定义同源。
 * @public
 */
export function createComposeEditorActions(
  context: ComposeEditorActionContext,
): readonly ComposeCommandAction[] {
  return createComposeEditorCatalog(context)
    .map(({ descriptor, run }) => ({ ...descriptor, run }))
}

/**
 * 装配注入画布命令行的命令定义。
 *
 * @remarks
 * 一次性动作是命令会话的**退化情形**，因此这里不需要第二种形状：包一层就与内建的 `LINE`、
 * `MOVE` 同类，可以直接放进同一个注册表。动作所需的依赖已经在 `context` 上闭包捕获，因此
 * 命令启动上下文保持窄，不需要为它们加任何字段。
 *
 * @param context - 执行层上下文加界面语言与当前键位。
 * @returns 命令定义，与命令面板的动作同源。
 * @public
 */
export function createComposeEditorCommands(
  context: ComposeEditorActionContext,
): readonly ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>[] {
  return createComposeEditorCatalog(context)
    .map(({ descriptor, run }) => createComposeImmediateCommand<
      StageDraftingContext,
      StageDraftingEffect
    >({ ...descriptor, run }))
}
