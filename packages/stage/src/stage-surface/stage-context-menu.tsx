import { Fragment } from 'react'
import type { ReactNode } from 'react'
import {
  ComposeContextMenu,
  ComposeContextMenuCheckboxItem,
  ComposeContextMenuContent,
  ComposeContextMenuGroup,
  ComposeContextMenuItem,
  ComposeContextMenuLabel,
  ComposeContextMenuSeparator,
  ComposeContextMenuShortcut,
  ComposeContextMenuSub,
  ComposeContextMenuSubContent,
  ComposeContextMenuSubTrigger,
  formatComposeKeybindings,
} from '@compose-ui/components'
import {
  getComposeHierarchy,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import {
  createStageDeleteEntitiesCommand,
  createDuplicateCommand,
  createGroupCommand,
  createLayerOrderCommand,
  createUngroupCommand,
  describeEntityTargets,
  getEntityParentId,
  getGroupCommandAvailability,
  getLayerOrderCommandAvailability,
  getUngroupCommandAvailability,
  type ComposeLayerOrderOperation,
  type StageRect,
  type StageViewport,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageAddComponentGroup,
  ComposeStageDispatch,
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
} from '../types'
import type { getStageMessages } from '../stage-i18n'
import { isStageJunctionEntity } from '../drafting/wire-tap'
import type { StageClipboardAction, StageClipboardAvailability } from './use-stage-clipboard'
import {
  fitViewportTo,
  zoomViewportByIntent,
  type StageSurfaceSize,
} from './stage-viewport-actions'

/** 四个层级顺序操作在菜单里的固定排列：由外向内。 */
const LAYER_ORDER_ITEMS: readonly (readonly [
  ComposeLayerOrderOperation,
  ComposeStageShortcutAction,
  'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack',
])[] = [
  ['bring-to-front', 'edit.bringToFront', 'bringToFront'],
  ['bring-forward', 'edit.bringForward', 'bringForward'],
  ['send-backward', 'edit.sendBackward', 'sendBackward'],
  ['send-to-back', 'edit.sendToBack', 'sendToBack'],
]

/** 画布右键菜单的完整契约。 */
export interface StageContextMenuProps {
  /** `useComposeContextMenu` 的 root props，含开合与定位。 */
  readonly rootProps: Record<string, unknown>
  /**
   * 右键命中的对象；`null` 表示右键在空白工作区。
   *
   * @remarks
   * 命中与否决定菜单形态：空白处只提供剪贴板与视图，因为编组、层级与删除都需要对象。
   */
  readonly contextNodeId: string | null
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 选区中未锁定的部分；所有结构类操作都以它为目标。 */
  readonly editableIds: readonly string[]
  readonly clipboardAvailability: StageClipboardAvailability
  readonly onClipboardAction: (action: StageClipboardAction, targetId: string | null) => void
  readonly viewport: StageViewport
  readonly surfaceSize: StageSurfaceSize
  /** 选区世界包围盒，「适配选择」的目标。 */
  readonly selectionBounds: StageRect | null
  readonly activeFrameId: string | null | undefined
  readonly shortcuts: Readonly<
    Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>
  >
  readonly messages: ReturnType<typeof getStageMessages>
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly onSceneActivate?: (frameId: string) => void
  readonly onCreateComponentIntent?: (entityIds: readonly string[]) => void
  /** 「添加组件」的树；缺省时不渲染该项。 */
  readonly addComponentMenu?: readonly ComposeStageAddComponentGroup[]
  /** 选中一项：宿主的 id 与右键那一下的视口坐标。 */
  readonly onAddComponent?: (itemId: string, clientPoint: { readonly x: number, readonly y: number }) => void
  /** 右键那一下的视口坐标；由 `useComposeContextMenu` 的锚点给出。 */
  readonly anchorPoint?: { readonly x: number, readonly y: number } | null
}

/**
 * 画布右键菜单。
 *
 * @remarks
 * 这是一个受控组件：可用性、文案与动作回调全部由 props 给定，组件自身只做两件事——按
 * 可用性渲染，以及把「哪个对象」这一上下文补进宿主给的回调。
 *
 * 只服务于本菜单的可用性派生（层级顺序、编组、取消编组）住在这里而不是宿主里：它们的唯一
 * 消费者就是下面这几个 `disabled`，放在宿主意味着派生与使用相隔数百行。
 */
export function StageContextMenu({
  activeFrameId,
  clipboardAvailability,
  contextNodeId,
  dispatch,
  document,
  editableIds,
  idFactory,
  layoutSnapshot,
  messages,
  onClipboardAction,
  onCreateComponentIntent,
  addComponentMenu,
  onAddComponent,
  anchorPoint,
  onSceneActivate,
  onSelectedIdsChange,
  onViewportChange,
  rootProps,
  selectionBounds,
  shortcuts,
  surfaceSize,
  viewport,
}: StageContextMenuProps) {
  const shortcutHint = (action: ComposeStageShortcutAction): ReactNode => {
    const label = formatComposeKeybindings(shortcuts[action])
    return label ? <ComposeContextMenuShortcut>{label}</ComposeContextMenuShortcut> : null
  }

  // 空白处右键不查层级可用性：没有目标时四项一律不可用，查了也是同一个结论。
  const layerOrderAvailability = (operation: ComposeLayerOrderOperation) => (
    contextNodeId
      ? getLayerOrderCommandAvailability(document, editableIds, operation)
      : { available: false, reason: '' } as const
  )
  const groupAvailability = getGroupCommandAvailability(document, editableIds)
  const ungroupAvailability = editableIds.length === 1
    ? getUngroupCommandAvailability(document, editableIds[0]!)
    : { available: true as const }
  // 编组还要求同父级：跨父级编组会改变每一项的坐标空间，那不是这个命令的语义。
  const canGroup = groupAvailability.available
    && editableIds.length >= 2
    && editableIds.every((id) =>
      getEntityParentId(document, id) === getEntityParentId(document, editableIds[0]!))
  // 取消编组要求目标确实有子级，否则命令提交出来是个空事务。
  const canUngroup = ungroupAvailability.available
    && editableIds.length === 1
    && Boolean(getComposeHierarchy(document.entities[editableIds[0]!]!)?.childIds.length)

  const applyLayerOrder = (operation: ComposeLayerOrderOperation) => {
    const command = createLayerOrderCommand(document, editableIds, operation, idFactory())
    if (command) dispatch(command)
  }

  const applyFitViewport = () => {
    const next = fitViewportTo(selectionBounds, surfaceSize)
    if (next) onViewportChange(next)
  }

  return (
    <ComposeContextMenu {...rootProps}>
      <ComposeContextMenuContent aria-label={messages.canvasActions}>
        {/*
          * 「添加组件」排在最上面并与其余项之间留一条分隔：它是菜单里**唯一产出新内容**的一项，
          * 其余每一项都是对已有对象的操作。
          */}
        {addComponentMenu && addComponentMenu.length > 0 && onAddComponent ? (
          <>
            <ComposeContextMenuSub>
              <ComposeContextMenuSubTrigger>{messages.addComponent}</ComposeContextMenuSubTrigger>
              <ComposeContextMenuSubContent aria-label={messages.addComponent}>
                {addComponentMenu.map((group, index) => (
                  <Fragment key={group.id}>
                    {index > 0 ? <ComposeContextMenuSeparator /> : null}
                    {/*
                      * 标题必须包在 Group 里：Base UI 的 GroupLabel 缺少 Group 会**抛错**，
                      * 而抛错的后果是整个菜单当场卸载——屏幕上看起来像「一悬停就关掉」。
                      */}
                    <ComposeContextMenuGroup>
                      <ComposeContextMenuLabel>{group.title}</ComposeContextMenuLabel>
                      {group.items.map((item) => (
                      <ComposeContextMenuItem
                        key={item.id}
                        onClick={() => {
                          // 落点是右键那一下：交回视口坐标，宿主走与面板拖入完全相同的那条路径。
                          if (anchorPoint) onAddComponent(item.id, anchorPoint)
                        }}
                      >
                        {item.icon ? (
                          <span aria-hidden="true" className="compose-stage__menu-icon">{item.icon}</span>
                        ) : null}
                        {item.label}
                      </ComposeContextMenuItem>
                      ))}
                    </ComposeContextMenuGroup>
                  </Fragment>
                ))}
              </ComposeContextMenuSubContent>
            </ComposeContextMenuSub>
            <ComposeContextMenuSeparator />
          </>
        ) : null}
        {onSceneActivate && contextNodeId && document.rootIds.includes(contextNodeId) ? (
          <ComposeContextMenuItem
            disabled={contextNodeId === activeFrameId}
            onClick={() => onSceneActivate(contextNodeId)}
          >
            {messages.setActiveScene}
          </ComposeContextMenuItem>
        ) : null}
        <ComposeContextMenuItem
          disabled={!clipboardAvailability.canCopy}
          onClick={() => onClipboardAction('edit.copy', contextNodeId)}
        >{messages.copy}{shortcutHint('edit.copy')}</ComposeContextMenuItem>
        <ComposeContextMenuItem
          disabled={!clipboardAvailability.canCut}
          onClick={() => onClipboardAction('edit.cut', contextNodeId)}
        >{messages.cut}{shortcutHint('edit.cut')}</ComposeContextMenuItem>
        <ComposeContextMenuItem
          disabled={!clipboardAvailability.canPaste}
          onClick={() => onClipboardAction('edit.paste', contextNodeId)}
        >{messages.paste}{shortcutHint('edit.paste')}</ComposeContextMenuItem>
        {contextNodeId ? (
          <>
            <ComposeContextMenuItem
              disabled={editableIds.length !== 1}
              onClick={() => {
                const id = editableIds[0]
                const duplicate = id
                  ? createDuplicateCommand(document, id, idFactory, idFactory())
                  : null
                if (duplicate && dispatch(duplicate.command).status === 'committed') {
                  onSelectedIdsChange([duplicate.rootId])
                }
              }}
            >{messages.duplicate}{shortcutHint('edit.duplicate')}</ComposeContextMenuItem>
            <ComposeContextMenuSub>
              <ComposeContextMenuSubTrigger>{messages.layerOrder}</ComposeContextMenuSubTrigger>
              <ComposeContextMenuSubContent aria-label={messages.layerOrder}>
                {LAYER_ORDER_ITEMS.map(([operation, action, label]) => {
                  const { available } = layerOrderAvailability(operation)
                  return (
                    <ComposeContextMenuItem
                      disabled={!available}
                      key={operation}
                      title={available ? undefined : messages.layerOrderUnavailable}
                      onClick={() => applyLayerOrder(operation)}
                    >{messages[label]}{shortcutHint(action)}</ComposeContextMenuItem>
                  )
                })}
              </ComposeContextMenuSubContent>
            </ComposeContextMenuSub>
            <ComposeContextMenuItem
              disabled={!canGroup}
              title={groupAvailability.available ? undefined : groupAvailability.reason}
              onClick={() => {
                const groupId = idFactory()
                if (dispatch(createGroupCommand(
                  document,
                  layoutSnapshot,
                  editableIds,
                  groupId,
                  idFactory(),
                )).status === 'committed') onSelectedIdsChange([groupId])
              }}
            >{messages.group}{shortcutHint('edit.group')}</ComposeContextMenuItem>
            <ComposeContextMenuItem
              disabled={!canUngroup}
              title={ungroupAvailability.available ? undefined : ungroupAvailability.reason}
              onClick={() => {
                const container = document.entities[editableIds[0]!]
                const hierarchy = container && getComposeHierarchy(container)
                if (
                  dispatch(createUngroupCommand(
                    document,
                    layoutSnapshot,
                    editableIds[0]!,
                    idFactory(),
                  )).status === 'committed'
                  && hierarchy
                ) onSelectedIdsChange(hierarchy.childIds)
              }}
            >{messages.ungroup}{shortcutHint('edit.ungroup')}</ComposeContextMenuItem>
            {onCreateComponentIntent ? (
              <ComposeContextMenuItem
                disabled={editableIds.length === 0}
                onClick={() => { onCreateComponentIntent(editableIds) }}
              >{messages.createComponent}</ComposeContextMenuItem>
            ) : null}
            <ComposeContextMenuItem
              disabled={editableIds.length === 0}
              variant="destructive"
              onClick={() => {
                const removal = createStageDeleteEntitiesCommand(document, editableIds, {
                  idFactory,
                  isJunction: isStageJunctionEntity,
                  label: `Delete ${describeEntityTargets(document, editableIds)}`,
                })
                if (removal) dispatch(removal)
              }}
            >{messages.delete}{shortcutHint('edit.delete')}</ComposeContextMenuItem>
            <ComposeContextMenuSeparator />
          </>
        ) : null}
        <ComposeContextMenuSub>
          <ComposeContextMenuSubTrigger>{messages.viewMenu}</ComposeContextMenuSubTrigger>
          <ComposeContextMenuSubContent aria-label={messages.viewMenu}>
            <ComposeContextMenuItem
              disabled={!selectionBounds}
              onClick={applyFitViewport}
            >{messages.fitSelection}{shortcutHint('stage.fitSelection')}</ComposeContextMenuItem>
            <ComposeContextMenuItem
              onClick={() => onViewportChange(zoomViewportByIntent(viewport, surfaceSize, 'in'))}
            >{messages.zoomIn}{shortcutHint('stage.zoomIn')}</ComposeContextMenuItem>
            <ComposeContextMenuItem
              onClick={() => onViewportChange(zoomViewportByIntent(viewport, surfaceSize, 'out'))}
            >{messages.zoomOut}{shortcutHint('stage.zoomOut')}</ComposeContextMenuItem>
            <ComposeContextMenuItem
              onClick={() =>
                onViewportChange(zoomViewportByIntent(viewport, surfaceSize, 'reset'))}
            >{messages.zoomReset}{shortcutHint('stage.zoomReset')}</ComposeContextMenuItem>
          </ComposeContextMenuSubContent>
        </ComposeContextMenuSub>
        <ComposeContextMenuCheckboxItem
          checked={document.canvas.grid.snapEnabled}
          onCheckedChange={() => dispatch({
            id: idFactory(),
            type: 'canvas.configure',
            payload: {
              grid: {
                ...document.canvas.grid,
                snapEnabled: !document.canvas.grid.snapEnabled,
              },
              smartSnap: document.canvas.smartSnap,
            },
            meta: { label: messages.toggleGridSnap, source: 'stage' },
          })}
        >{messages.gridSnap}{shortcutHint('stage.toggleGridSnap')}</ComposeContextMenuCheckboxItem>
        <ComposeContextMenuCheckboxItem
          checked={document.canvas.smartSnap.nodes || document.canvas.smartSnap.guides}
          onCheckedChange={() => {
            // 两个开关在 UI 上是一个：任一为真即视为开启，切换时同时写两侧。
            const next = !(document.canvas.smartSnap.nodes || document.canvas.smartSnap.guides)
            dispatch({
              id: idFactory(),
              type: 'canvas.configure',
              payload: {
                grid: document.canvas.grid,
                smartSnap: { nodes: next, guides: next },
              },
              meta: { label: messages.toggleSmartSnap, source: 'stage' },
            })
          }}
        >{messages.smartSnap}{shortcutHint('stage.toggleSmartSnap')}</ComposeContextMenuCheckboxItem>
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
