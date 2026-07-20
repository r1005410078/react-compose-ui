import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import { ChevronIcon, CubeIcon, DocumentIcon, EyeIcon, LockIcon } from './icons'
import type { IndexedSceneTreeNode } from './tree-model'

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

interface SceneTreeRowProps {
  editing: boolean
  expanded: boolean
  focused: boolean
  insideDropTarget: boolean
  isDragging: boolean
  queryActive: boolean
  row: IndexedSceneTreeNode
  selected: boolean
  virtualStart: number
  onClick: (event: MouseEvent<HTMLDivElement>) => void
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onRenameCancel: () => void
  onRenameCommit: (label: string) => void
  onToggleExpanded: () => void
  onToggleLocked: (locked: boolean) => void
  onToggleVisibility: (visible: boolean) => void
}

function canOperate(locked: boolean, capability: boolean | undefined) {
  return !locked && capability !== false
}

/** 单个虚拟场景节点行；所有业务决策由调用方和纯模型提供。 */
export function SceneTreeRow({
  editing,
  expanded,
  focused,
  insideDropTarget,
  isDragging,
  queryActive,
  row,
  selected,
  virtualStart,
  onClick,
  onContextMenu,
  onFocus,
  onKeyDown,
  onPointerDown,
  onRenameCancel,
  onRenameCommit,
  onToggleExpanded,
  onToggleLocked,
  onToggleVisibility,
}: SceneTreeRowProps) {
  const hasChildren = (row.node.children?.length ?? 0) > 0
  const visible = row.node.visible !== false
  const locked = row.node.locked === true
  return (
    <div
      className="st:absolute st:left-0 st:top-0 st:w-full st:max-w-full st:overflow-hidden"
      style={{ transform: `translateY(${virtualStart}px)` }}
    >
      <div
        aria-expanded={hasChildren ? (queryActive ? true : expanded) : undefined}
        aria-level={row.depth}
        aria-posinset={row.index + 1}
        aria-selected={selected}
        aria-setsize={row.setSize}
        className={`st:mx-1 st:my-px st:box-border st:flex st:h-[22px] st:w-[calc(100%-0.5rem)] st:min-w-0 st:select-none st:items-center st:overflow-hidden st:rounded-[5px] st:pr-0.5 st:text-[13px] st:outline-none ${isDragging ? 'st:cursor-grabbing' : 'st:cursor-default'} ${insideDropTarget ? 'st:bg-[#174a78] st:text-white st:shadow-[inset_0_0_0_1px_#2388ff]' : `${selected ? 'st:bg-[#37373d] st:text-white' : 'st:hover:bg-[#2a2d2e]'} st:focus-visible:bg-[#062f4a] st:focus-visible:text-white st:focus-visible:shadow-[inset_0_0_0_1px_#007fd4]`}`}
        data-scene-drop-target={insideDropTarget ? 'inside' : undefined}
        data-scene-node-id={row.node.id}
        role="row"
        style={{ touchAction: 'none' }}
        tabIndex={focused ? 0 : -1}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
      >
        <span className="st:shrink-0" style={{ width: 8 + (row.depth - 1) * 16 }} />
        <button
          aria-label={expanded ? '折叠节点' : '展开节点'}
          className="st:grid st:size-5 st:shrink-0 st:cursor-pointer st:place-items-center st:border-0 st:bg-transparent st:text-[#9aa3ae] st:disabled:invisible"
          disabled={!hasChildren}
          tabIndex={-1}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpanded()
          }}
        >
          <ChevronIcon className="st:stroke-current st:stroke-[1.8]" expanded={expanded} />
        </button>
        <span className="st:mr-1 st:grid st:size-5 st:shrink-0 st:place-items-center st:text-[#aab3bf]">
          {row.node.icon ?? (row.parentId === null
            ? <DocumentIcon className="st:stroke-current st:stroke-[1.6]" />
            : <CubeIcon className="st:stroke-current st:stroke-[1.5]" />)}
        </span>
        {editing ? (
          <input
            autoFocus
            aria-label={`重命名 ${row.node.label}`}
            className="st:min-w-0 st:flex-1 st:rounded-sm st:border st:border-[#2388ff] st:bg-[#0f1216] st:px-1 st:text-sm st:text-white st:outline-none"
            defaultValue={row.node.label}
            onBlur={(event) => onRenameCommit(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') onRenameCommit(event.currentTarget.value)
              if (event.key === 'Escape') onRenameCancel()
            }}
          />
        ) : (
          <span className="st:min-w-0 st:flex-1 st:truncate" role="gridcell">{row.node.label}</span>
        )}
        <NodeAction
          disabled={!canOperate(locked, row.node.canToggleVisibility)}
          label={visible ? `隐藏 ${row.node.label}` : `显示 ${row.node.label}`}
          onClick={() => onToggleVisibility(!visible)}
        >
          <EyeIcon className="st:stroke-current st:stroke-[1.6]" hidden={!visible} />
        </NodeAction>
        <NodeAction
          disabled={row.node.canToggleLocked === false}
          label={locked ? `解锁 ${row.node.label}` : `锁定 ${row.node.label}`}
          onClick={() => onToggleLocked(!locked)}
        >
          <LockIcon className="st:stroke-current st:stroke-[1.6]" locked={locked} />
        </NodeAction>
      </div>
    </div>
  )
}
