import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { ROW_HEIGHT } from './drag-model'
import type { SceneTreeProps } from './index'
import { SceneTreeContextMenu } from './scene-tree-context-menu'
import { SceneTreeDragPreview, SceneTreeDropIndicator } from './scene-tree-overlays'
import { SceneTreeRow } from './scene-tree-row'
import { SceneTreeToolbar } from './scene-tree-toolbar'
import { useSceneTreeCommands } from './use-scene-tree-commands'
import { useSceneTreeDrag } from './use-scene-tree-drag'
import { useSceneTreeInteraction } from './use-scene-tree-interaction'

interface DragControlsRef {
  cancelDrag: () => void
  isDragging: boolean
}

/**
 * 渲染受控、虚拟化的场景树，并提供检索、选择、重命名、命令菜单和 Pointer 拖拽交互。
 *
 * @remarks
 * 组件不会直接拥有或修改业务树。选择、展开和所有节点操作都通过回调交给宿主应用；未提供
 * `commands` 时，仅为组件内部菜单和快捷键创建一个命令控制器。
 *
 * @param props - 受控树状态、操作回调以及根 `div` 的 HTML 属性。
 * @returns 场景树 React 元素。
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
  className,
  ...htmlProps
}: SceneTreeProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragControlsRef = useRef<DragControlsRef | null>(null)
  const scrollToIndexRef = useRef<(rowIndex: number) => void>(() => undefined)
  const internalCommands = useSceneTreeCommands({ nodes, selectedIds, onOperation })
  const commands = providedCommands ?? internalCommands

  const interaction = useSceneTreeInteraction({
    cancelDrag: () => dragControlsRef.current?.cancelDrag(),
    commands,
    expandedIds,
    isDragging: () => dragControlsRef.current?.isDragging ?? false,
    nodes,
    onExpandedChange,
    onOperation,
    onSelectionChange,
    scrollRef,
    scrollToIndex: (rowIndex) => scrollToIndexRef.current(rowIndex),
    selectedIds,
  })

  // TanStack Virtual 返回命令式实例，其方法不适合由 React Compiler 自动记忆化。
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: interaction.rows.length,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (rowIndex) => interaction.rows[rowIndex]?.node.id ?? rowIndex,
    getScrollElement: () => scrollRef.current,
    initialRect: { width: 280, height: 320 },
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement
      if (!element) return
      const reportRect = () => {
        const rect = element.getBoundingClientRect()
        callback({
          width: Math.round(rect.width || element.clientWidth || 280),
          height: Math.round(rect.height || element.clientHeight || 320),
        })
      }
      reportRect()
      const Observer = instance.targetWindow?.ResizeObserver
      if (!Observer) return () => undefined
      const observer = new Observer(reportRect)
      observer.observe(element)
      return () => observer.disconnect()
    },
    overscan: 12,
    useFlushSync: false,
  })
  scrollToIndexRef.current = (rowIndex) => virtualizer.scrollToIndex(rowIndex, { align: 'auto' })

  const drag = useSceneTreeDrag({
    expandedIds,
    index: interaction.index,
    onExpandedChange,
    onOperation,
    onSelectionChange,
    query: interaction.query,
    rows: interaction.rows,
    scrollRef,
    selectedIds,
  })
  dragControlsRef.current = { cancelDrag: drag.cancelDrag, isDragging: drag.isDragging }

  const expandedSet = new Set(expandedIds)
  const rootClassName = [
    'st:flex st:h-full st:min-h-0 st:flex-col st:overflow-hidden st:bg-[#111419] st:text-[#c5ccd6]',
    drag.isDragging ? 'st:cursor-grabbing' : null,
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      {...htmlProps}
      className={rootClassName}
      data-compose-ui="scene-tree"
      onContextMenu={(event) => interaction.openContextMenu(event, null)}
    >
      <SceneTreeToolbar
        caseSensitive={interaction.caseSensitive}
        error={interaction.searchResult.error}
        query={interaction.query}
        regex={interaction.regex}
        wholeWord={interaction.wholeWord}
        onAdd={() => commands.execute('create-suggested')}
        onCaseSensitiveChange={() => interaction.setCaseSensitive((value) => !value)}
        onQueryChange={interaction.setQuery}
        onRegexChange={() => interaction.setRegex((value) => !value)}
        onWholeWordChange={() => interaction.setWholeWord((value) => !value)}
      />
      <div
        ref={scrollRef}
        aria-label={htmlProps['aria-label'] ?? '场景树'}
        className="scene-tree__scroll st:min-h-0 st:min-w-0 st:flex-1 st:overflow-x-hidden st:overflow-y-auto st:outline-none"
        role="treegrid"
        onContextMenu={(event) => interaction.openContextMenu(event, null)}
        onLostPointerCapture={drag.handlePointerCancel}
        onPointerCancel={drag.handlePointerCancel}
        onPointerMove={drag.handlePointerMove}
        onPointerUp={drag.handlePointerUp}
        onScroll={drag.handleScroll}
      >
        <div
          className="st:relative st:w-full st:max-w-full st:overflow-hidden"
          style={{ height: virtualizer.getTotalSize() }}
        >
          <SceneTreeDropIndicator target={drag.moveTarget} />
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = interaction.rows[virtualRow.index]
            if (!row) return null
            const insideDropTarget = drag.moveTarget !== null
              && 'kind' in drag.moveTarget
              && drag.moveTarget.kind === 'inside'
              && drag.moveTarget.targetNodeId === row.node.id
            return (
              <SceneTreeRow
                key={row.node.id}
                editing={interaction.editingId === row.node.id}
                expanded={expandedSet.has(row.node.id)}
                focused={interaction.focusedId === row.node.id
                  || (!interaction.focusedId && virtualRow.index === 0)}
                insideDropTarget={insideDropTarget}
                isDragging={drag.isDragging}
                queryActive={interaction.query.length > 0}
                row={row}
                selected={selectedIds.includes(row.node.id)}
                virtualStart={virtualRow.start}
                onClick={(event) => {
                  if (!drag.consumeSuppressedClick()) interaction.requestSelection(row.node.id, event)
                }}
                onContextMenu={(event) => {
                  event.stopPropagation()
                  interaction.openContextMenu(event, row.node.id)
                }}
                onFocus={() => interaction.setFocusedId(row.node.id)}
                onKeyDown={(event) => interaction.handleKeyDown(event, virtualRow.index)}
                onPointerDown={(event) => drag.handlePointerDown(event, row.node.id)}
                onRenameCancel={() => interaction.setEditingId(null)}
                onRenameCommit={(label) => interaction.commitRename(row.node.id, label)}
                onToggleExpanded={() => interaction.toggleExpanded(row.node.id)}
                onToggleLocked={(locked) => onOperation?.({
                  type: 'set-locked', nodeIds: [row.node.id], locked,
                })}
                onToggleVisibility={(visible) => onOperation?.({
                  type: 'set-visibility', nodeIds: [row.node.id], visible,
                })}
              />
            )
          })}
        </div>
      </div>
      {interaction.contextMenu ? (
        <SceneTreeContextMenu
          {...interaction.contextMenu}
          commands={commands}
          menuRef={interaction.contextMenuRef}
          onClose={() => interaction.setContextMenu(null)}
        />
      ) : null}
      <SceneTreeDragPreview preview={drag.dragPreview} />
    </div>
  )
}
