import { createPortal } from 'react-dom'
import { clampDragPreviewPosition, INDENT_BASE, INDENT_SIZE, ROW_HEIGHT } from './drag-model'
import type { SceneTreeMoveTarget } from './tree-model'
import type { DragPreviewState } from './use-scene-tree-drag'

export function SceneTreeDropIndicator({ target }: { target: SceneTreeMoveTarget | null }) {
  if (!target || 'kind' in target) return null
  return (
    <div
      aria-hidden="true"
      className="st:pointer-events-none st:absolute st:z-10 st:h-0.5 st:bg-[#2388ff] st:shadow-[0_0_4px_rgb(35_136_255_/_70%)]"
      data-testid="scene-tree-drop-indicator"
      style={{
        left: INDENT_BASE + (target.depth - 1) * INDENT_SIZE,
        right: 4,
        top: target.lineIndex * ROW_HEIGHT - 1,
      }}
    />
  )
}

export function SceneTreeDragPreview({ preview }: { preview: DragPreviewState | null }) {
  if (!preview || typeof document === 'undefined' || typeof window === 'undefined') return null
  const multiple = preview.movingIds.length > 1
  const position = clampDragPreviewPosition(
    preview.x,
    preview.y,
    multiple,
    window.innerWidth,
    window.innerHeight,
  )
  return createPortal(
    <div
      aria-hidden="true"
      className={multiple
        ? 'st:pointer-events-none st:fixed st:z-[1000] st:grid st:size-9 st:place-items-center st:rounded-full st:border st:border-[#2388ff] st:bg-[#172a3a] st:text-sm st:font-medium st:text-white st:shadow-[0_6px_18px_rgb(0_0_0_/_45%)]'
        : 'st:pointer-events-none st:fixed st:z-[1000] st:w-max st:max-w-[200px] st:truncate st:rounded-full st:border st:border-[#2388ff] st:bg-[#172a3a] st:px-3 st:py-1.5 st:text-sm st:text-white st:shadow-[0_6px_18px_rgb(0_0_0_/_45%)]'}
      data-testid="scene-tree-drag-preview"
      style={position}
    >
      {multiple ? preview.movingIds.length : preview.label}
    </div>,
    document.body,
  )
}
