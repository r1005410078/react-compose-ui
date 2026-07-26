import { Tree } from '@compose-ui/components'
import type {
  TreeItemAdapter,
  TreeItemRenderContext,
} from '@compose-ui/components'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useMemo, useRef } from 'react'
import type {
  CSSProperties,
  KeyboardEvent,
  ReactNode,
} from 'react'
import type { SceneTreeNode, SceneTreeProps } from './index'
import { CubeIcon, DocumentIcon, EyeIcon, LockIcon } from './icons'
import { SceneTreeContextMenu } from './scene-tree-context-menu'
import { SceneTreeToolbar } from './scene-tree-toolbar'
import { useSceneTreeCommands } from './use-scene-tree-commands'
import { useSceneTreeInteraction } from './use-scene-tree-interaction'
import { getSceneTreeMessages } from './scene-tree-i18n'

const sceneTreeAdapter: TreeItemAdapter<SceneTreeNode> = {
  getChildren: (node) => node.children,
  getId: (node) => node.id,
  getLabel: (node) => node.label,
  hasChildren: (node) => (node.children?.length ?? 0) > 0,
  canHaveChildren: (node) => node.canHaveChildren !== false && !node.locked,
  canMove: (node) => node.canMove !== false && !node.locked,
}

function findSceneChildren(
  nodes: readonly SceneTreeNode[],
  parentId: string | null,
): readonly SceneTreeNode[] {
  if (parentId === null) return nodes
  const stack = [...nodes]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (node.id === parentId) return node.children ?? []
    if (node.children) stack.push(...node.children)
  }
  return []
}

/**
 * 通用 Tree 的 index 以移除被拖节点后的兄弟列表为基准；SceneTree 的既有公共协议则以
 * 操作前的列表为基准。适配边界必须恢复旧语义，避免宿主命令再次扣除移动节点。
 */
function toSceneMoveIndex(
  nodes: readonly SceneTreeNode[],
  parentId: string | null,
  itemIds: readonly string[],
  normalizedIndex: number,
) {
  const movingIds = new Set(itemIds)
  const siblings = findSceneChildren(nodes, parentId)
  const remaining = siblings.filter((node) => !movingIds.has(node.id))
  const nextSibling = remaining[normalizedIndex]
  if (!nextSibling) return siblings.length
  return siblings.findIndex((node) => node.id === nextSibling.id)
}

interface NodeActionProps {
  children: ReactNode
  disabled: boolean
  label: string
  onClick: () => void
}

function NodeAction({ children, disabled, label, onClick }: NodeActionProps) {
  return (
    <button
      aria-label={label}
      className="st:grid st:size-5 st:shrink-0 st:cursor-pointer st:place-items-center st:border-0 st:bg-transparent st:text-[#929ca9] st:opacity-80 st:hover:text-white st:disabled:cursor-not-allowed st:disabled:opacity-30"
      disabled={disabled}
      tabIndex={-1}
      title={label}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function shouldUseSceneKeyboard(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey) {
    return ['c', 'x', 'v'].includes(event.key.toLowerCase())
  }
  return ['Enter', 'F2', 'Delete'].includes(event.key)
}

/**
 * 渲染受控、虚拟化的场景树，并提供检索、选择、重命名、命令菜单和 Pointer 拖拽交互。
 *
 * @remarks
 * 通用虚拟行、选择、展开和拖排由 `@compose-ui/components` Tree 承载；场景命令、可见性、
 * 锁定和剪贴板语义仍由本包拥有。组件不会直接修改宿主业务树。
 *
 * @public
 */
export function SceneTree({
  nodes,
  selectedIds,
  expandedIds,
  onSelectionChange,
  onExpandedChange,
  onOperation,
  commands: providedCommands,
  locale,
  className,
  style,
  ...htmlProps
}: SceneTreeProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = locale ?? i18n?.locale ?? 'zh-CN'
  const messages = getSceneTreeMessages(resolvedLocale, i18n?.formatMessage)
  const scrollRef = useRef<HTMLDivElement>(null)
  const internalCommands = useSceneTreeCommands({ nodes, selectedIds, onOperation })
  const commands = providedCommands ?? internalCommands
  const interaction = useSceneTreeInteraction({
    cancelDrag: () => undefined,
    commands,
    expandedIds,
    isDragging: () => false,
    nodes,
    onExpandedChange,
    onOperation,
    onSelectionChange,
    scrollRef,
    scrollToIndex: () => undefined,
    selectedIds,
  })
  const visibleIds = useMemo(
    () => new Set(interaction.searchResult.rows.map((row) => row.node.id)),
    [interaction.searchResult.rows],
  )
  const rootClassName = [
    'st:flex st:h-full st:min-h-0 st:flex-col st:overflow-hidden st:bg-[#111419] st:text-[#c5ccd6]',
    className,
  ].filter(Boolean).join(' ')

  const renderContextIcon = (context: TreeItemRenderContext<SceneTreeNode>) => (
    context.item.icon ?? (context.parentId === null
      ? <DocumentIcon className="st:stroke-current st:stroke-[1.6]" />
      : <CubeIcon className="st:stroke-current st:stroke-[1.5]" />)
  )

  return (
    <div
      {...htmlProps}
      className={rootClassName}
      data-compose-ui="scene-tree"
      data-compose-theme={theme?.resolvedTheme}
      lang={resolvedLocale}
      onContextMenu={(event) => interaction.openContextMenu(event, null)}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      <SceneTreeToolbar
        caseSensitive={interaction.caseSensitive}
        error={interaction.searchResult.error ? messages.invalidRegex : null}
        messages={messages}
        query={interaction.query}
        regex={interaction.regex}
        wholeWord={interaction.wholeWord}
        onAdd={() => commands.execute('create-suggested')}
        onCaseSensitiveChange={() => interaction.setCaseSensitive((value) => !value)}
        onQueryChange={interaction.setQuery}
        onRegexChange={() => interaction.setRegex((value) => !value)}
        onWholeWordChange={() => interaction.setWholeWord((value) => !value)}
      />
      <Tree
        adapter={sceneTreeAdapter}
        aria-label={htmlProps['aria-label'] ?? messages.tree}
        className="scene-tree__common-tree"
        dragPreviewTestId="scene-tree-drag-preview"
        dropIndicatorTestId="scene-tree-drop-indicator"
        dropTargetDataAttribute="data-scene-drop-target"
        expandedIds={expandedIds}
        filter={interaction.query.length > 0
          ? (node) => visibleIds.has(node.id)
          : undefined}
        getCollapseLabel={() => messages.collapse}
        getExpandLabel={() => messages.expand}
        getItemAttributes={(context) => ({
          'data-scene-node-id': context.id,
          onKeyDown: (event) => {
            if (!shouldUseSceneKeyboard(event)) return
            const rowIndex = interaction.rows.findIndex((row) => row.node.id === context.id)
            interaction.handleKeyDown(event, rowIndex)
          },
        })}
        items={nodes}
        renderActions={(context) => {
          const visible = context.item.visible !== false
          const locked = context.item.locked === true
          return (
            <>
              <NodeAction
                disabled={locked || context.item.canToggleVisibility === false}
                label={visible
                  ? messages.hide(context.item.label)
                  : messages.show(context.item.label)}
                onClick={() => onOperation?.({
                  type: 'set-visibility',
                  nodeIds: [context.id],
                  visible: !visible,
                })}
              >
                <EyeIcon className="st:stroke-current st:stroke-[1.6]" hidden={!visible} />
              </NodeAction>
              <NodeAction
                disabled={context.item.canToggleLocked === false}
                label={locked
                  ? messages.unlock(context.item.label)
                  : messages.lock(context.item.label)}
                onClick={() => onOperation?.({
                  type: 'set-locked',
                  nodeIds: [context.id],
                  locked: !locked,
                })}
              >
                <LockIcon className="st:stroke-current st:stroke-[1.6]" locked={locked} />
              </NodeAction>
            </>
          )
        }}
        renderDragPreview={(_items, content) => content}
        renderIcon={renderContextIcon}
        renderLabel={(context) => interaction.editingId === context.id ? (
          <input
            autoFocus
            aria-label={messages.rename(context.item.label)}
            className="st:min-w-0 st:w-full st:rounded-sm st:border st:border-[#2388ff] st:bg-[#0f1216] st:px-1 st:text-sm st:text-white st:outline-none"
            defaultValue={context.item.label}
            onBlur={(event) => interaction.commitRename(context.id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                interaction.commitRename(context.id, event.currentTarget.value)
              }
              if (event.key === 'Escape') interaction.setEditingId(null)
            }}
          />
        ) : context.item.label}
        scrollRef={scrollRef}
        selectedIds={selectedIds}
        onBackgroundContextMenu={(event) => interaction.openContextMenu(event, null)}
        onExpandedChange={onExpandedChange}
        onItemContextMenu={(event, node) => {
          event.stopPropagation()
          interaction.openContextMenu(event, node.id)
        }}
        onMove={(operation) => onOperation?.({
          type: 'move',
          nodeIds: operation.itemIds,
          parentId: operation.parentId,
          index: toSceneMoveIndex(
            nodes,
            operation.parentId,
            operation.itemIds,
            operation.index,
          ),
        })}
        onSelectionChange={onSelectionChange}
      />
      {interaction.contextMenu ? (
        <SceneTreeContextMenu
          {...interaction.contextMenu}
          commands={commands}
          messages={messages}
          menuRef={interaction.contextMenuRef}
          onClose={() => interaction.setContextMenu(null)}
        />
      ) : null}
    </div>
  )
}
