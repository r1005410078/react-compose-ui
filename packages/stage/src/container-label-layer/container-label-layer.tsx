import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import type { StageViewport } from '@compose-ui/stage-engine'
import { resolveComposeContainerLabels } from './container-labels'

/**
 * 双击判定阈值。
 *
 * Pointer Events 规范规定 `pointerdown` 的 `detail` 恒为 0，拿不到浏览器的连击计数；
 * 500ms / 5px 与 Stage 其他连击判定取同一组常见值。
 */
const DOUBLE_CLICK_INTERVAL_MS = 500
const DOUBLE_CLICK_SLOP_PX = 5

/** {@link ComposeContainerLabelLayer} 的受控输入。 @internal */
export interface ComposeContainerLabelLayerProps {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly viewport: StageViewport
  readonly selectedIds: readonly string[]
  readonly hiddenEntityIds?: ReadonlySet<string>
  /** 图层无障碍名称。 */
  readonly label: string
  /** 重命名输入框的无障碍名称。 */
  readonly renameLabel: (name: string) => string
  /** 在标签上按下；宿主据此走与容器体一致的选中/移动路径。 */
  readonly onLabelPointerDown: (entityId: string, event: ReactPointerEvent<HTMLElement>) => void
  /**
   * 提交重命名。
   *
   * @remarks
   * 未提供时标签只读：Stage 不持有文档写权限，重命名必须由宿主用与场景树相同的命令提交，
   * 否则同一个动作会产生两种 Undo 语义。
   */
  readonly onRename?: (entityId: string, name: string) => void
  /**
   * 当前激活场景。
   *
   * @remarks
   * 只影响场景标签的呈现：激活的那一块显示实心标记与播放按钮。Stage 不写入激活状态，
   * 它只发出请求，由宿主决定如何持久化。
   */
  readonly activeFrameId?: string | null
  /** 请求把某个场景设为激活；未提供时不渲染激活标记。 */
  readonly onSceneActivate?: (entityId: string) => void
  /** 请求以某个场景为目标打开预览；未提供时不渲染播放按钮。 */
  readonly onScenePreview?: (entityId: string) => void
  /** 场景标记的无障碍名称。 */
  readonly sceneActiveLabel?: (name: string) => string
  readonly sceneInactiveLabel?: (name: string) => string
  readonly scenePreviewLabel?: (name: string) => string
}

/**
 * 顶层容器的画布标题标签层。
 *
 * @remarks
 * 挂在 Scene 之后、Overlay 之前：标签要盖住容器边框，但不能挡住变换手柄的命中区。
 * @internal
 */
export function ComposeContainerLabelLayer({
  document,
  layoutSnapshot,
  viewport,
  selectedIds,
  hiddenEntityIds,
  label,
  renameLabel,
  onLabelPointerDown,
  onRename,
  activeFrameId,
  onSceneActivate,
  onScenePreview,
  sceneActiveLabel,
  sceneInactiveLabel,
  scenePreviewLabel,
}: ComposeContainerLabelLayerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // 按 entityId 区分：整层共享一个 ref 时，先点 A 再点 B 会被 5px slop 误判成双击 B。
  const lastPointerDownRef = useRef<
    { entityId: string; x: number; y: number; time: number } | null
  >(null)
  const labels = resolveComposeContainerLabels(
    document,
    layoutSnapshot,
    viewport,
    hiddenEntityIds,
  )

  // 容器被删除或不再是顶层时编辑会话自然失效。这里按渲染派生而不是在 effect 里清 state：
  // 目标消失只是「这一帧没有可编辑的标签」，不需要额外一轮渲染。
  const activeEditingId = editingId !== null
    && labels.some((item) => item.entityId === editingId)
    ? editingId
    : null

  useEffect(() => {
    if (activeEditingId === null) return
    // 进入编辑的那次 pointerdown 已经 preventDefault，焦点不会自动落到输入框上。
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [activeEditingId])

  const commit = (entityId: string) => {
    const next = draft.trim()
    setEditingId(null)
    if (next.length > 0) onRename?.(entityId, next)
  }

  return (
    <div aria-label={label} className="compose-stage__container-labels" role="group">
      {labels.map((item) => {
        const selected = selectedIds.includes(item.entityId)
        const editing = activeEditingId === item.entityId
        // 锁定容器退出画布交互，标签只剩「这是谁」的信息；改名与选中都回到场景树。
        if (item.locked) {
          return (
            <span
              className="compose-stage__container-label is-locked"
              data-testid={`stage-container-label-${item.entityId}`}
              key={item.entityId}
              style={{ left: item.x, top: item.y, maxWidth: item.maxWidth }}
            >
              {item.name}
            </span>
          )
        }
        const isActiveScene = item.scene && item.entityId === activeFrameId
        return editing
          ? (
              <input
                aria-label={renameLabel(item.name)}
                className="compose-stage__container-label is-editing"
                data-testid={`stage-container-label-input-${item.entityId}`}
                key={item.entityId}
                ref={inputRef}
                style={{ left: item.x, top: item.y, maxWidth: item.maxWidth }}
                value={draft}
                onBlur={() => commit(item.entityId)}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commit(item.entityId)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setEditingId(null)
                  }
                  // Stage 的全局快捷键会把普通字符当成工具切换，编辑期间必须挡在输入框内。
                  event.stopPropagation()
                }}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
              />
            )
          : (
              <div
                className={`compose-stage__label-row${item.scene ? ' is-scene' : ''}`}
                data-label-entity-id={item.entityId}
                key={item.entityId}
                style={{ left: item.x, top: item.y, maxWidth: item.maxWidth }}
              >
                {item.scene && isActiveScene && onScenePreview ? (
                  <button
                    aria-label={scenePreviewLabel?.(item.name)}
                    className="compose-stage__scene-play"
                    data-testid={`stage-scene-play-${item.entityId}`}
                    type="button"
                    // 必须在 pointerdown 阶段拦截：Stage 会在这一步对 surface 设置 pointer
                    // capture，放行的话这次点击会变成标签的选中手势，click 也收不到。
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onClick={() => onScenePreview(item.entityId)}
                  >
                    ▶
                  </button>
                ) : null}
              <button
                className={`compose-stage__container-label${selected ? ' is-selected' : ''}`}
                data-testid={`stage-container-label-${item.entityId}`}
                type="button"
                onPointerDown={(event) => {
                  // 自己判连击而不是用 dblclick：第一次按下会让 Stage 对 surface 设置
                  // pointer capture，之后的兼容鼠标事件全部重定向到 capture 目标，标签
                  // 再也收不到 dblclick。
                  const previous = lastPointerDownRef.current
                  const now = event.timeStamp || Date.now()
                  const isSecondClick = previous !== null
                    && previous.entityId === item.entityId
                    && now - previous.time <= DOUBLE_CLICK_INTERVAL_MS
                    && Math.abs(event.clientX - previous.x) <= DOUBLE_CLICK_SLOP_PX
                    && Math.abs(event.clientY - previous.y) <= DOUBLE_CLICK_SLOP_PX
                  lastPointerDownRef.current = isSecondClick
                    ? null
                    : { entityId: item.entityId, x: event.clientX, y: event.clientY, time: now }
                  if (onRename && isSecondClick) {
                    // 不 preventDefault 的话，浏览器的默认聚焦会在输入框挂载后立刻把焦点
                    // 交还给 Stage，输入框当帧就 blur 提交，重命名根本进不去。
                    event.preventDefault()
                    event.stopPropagation()
                    setDraft(item.name)
                    setEditingId(item.entityId)
                    return
                  }
                  onLabelPointerDown(item.entityId, event)
                }}
              >
                <span className="compose-stage__container-label-name">{item.name}</span>
              </button>
                {item.scene && onSceneActivate ? (
                  <button
                    aria-label={isActiveScene
                      ? sceneActiveLabel?.(item.name)
                      : sceneInactiveLabel?.(item.name)}
                    className={`compose-stage__scene-tag${isActiveScene ? ' is-active' : ''}`}
                    data-testid={`stage-scene-tag-${item.entityId}`}
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onClick={() => {
                      if (!isActiveScene) onSceneActivate(item.entityId)
                    }}
                  >
                    {isActiveScene ? '●' : '○'}
                  </button>
                ) : null}
              </div>
            )
      })}
    </div>
  )
}
