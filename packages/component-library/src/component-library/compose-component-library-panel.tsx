import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComposeComponentCatalog, ComposeComponentDescriptor, ComposeComponentStore } from '../component-store'
import './styles.css'

/** 混合组件目录发布的创建项目。 @public */
export type ComposeComponentLibraryItem =
  | { readonly kind: 'preset'; readonly presetId: string }
  | { readonly kind: 'component'; readonly descriptor: ComposeComponentDescriptor }

/** 混合组件目录的规范化拖拽数据。 @public */
export interface ComposeComponentLibraryDragEvent {
  readonly item: ComposeComponentLibraryItem
  readonly clientPoint: { readonly x: number; readonly y: number }
}

/** {@link ComposeComponentLibraryPanel} 属性。 @public */
export interface ComposeComponentLibraryPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'onDragStart'> {
  /** 基础代码 Preset 的实例级 Registry。 */
  readonly registry: ComposeEntityRegistry
  /** 项目 Component Asset Store；省略时只显示基础 Preset。 */
  readonly store?: ComposeComponentStore
  /** 点击 Tile 时发布无 Stage 依赖的创建意图。 */
  readonly onCreateIntent?: (item: ComposeComponentLibraryItem) => void
  /** 双击项目 Component/Variant 时请求在独立工作区打开；基础 Preset 不触发。 */
  readonly onOpenIntent?: (descriptor: ComposeComponentDescriptor) => void
  /** 从 Base 创建直接子 Variant；Variant 行不显示该入口。 */
  readonly onCreateVariantIntent?: (descriptor: ComposeComponentDescriptor) => void
  /** 指针越过阈值开始拖拽。 */
  readonly onItemDragStart?: (event: ComposeComponentLibraryDragEvent) => void
  /** 活动拖拽移动。 */
  readonly onItemDragMove?: (event: ComposeComponentLibraryDragEvent) => void
  /** 活动拖拽正常结束。 */
  readonly onItemDragEnd?: (event: ComposeComponentLibraryDragEvent) => void
  /** 拖拽因 pointer cancel 结束。 */
  readonly onItemDragCancel?: (item: ComposeComponentLibraryItem) => void
}

interface PointerSession {
  readonly pointerId: number
  readonly item: ComposeComponentLibraryItem
  readonly start: { readonly x: number; readonly y: number }
  started: boolean
}

interface DragPreview {
  readonly item: ComposeComponentLibraryItem
  readonly clientPoint: { readonly x: number; readonly y: number }
}

/** 组件与变体共享的关联立方体图标。 @public */
export function ComposeComponentAssetIcon({ kind }: {
  readonly kind: ComposeComponentDescriptor['kind']
}) {
  return kind === 'base' ? (
    <svg aria-hidden="true" data-testid="component-library-base-icon" viewBox="0 0 24 24">
      <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z" fill="none" stroke="currentColor" />
      <path d="m5 7.5 7 3.5 7-3.5M12 11v9" fill="none" stroke="currentColor" />
    </svg>
  ) : (
    <svg aria-hidden="true" data-testid="component-library-variant-icon" viewBox="0 0 24 24">
      <path d="M4.5 7.5 11 4l6.5 3.5v8L11 19l-6.5-3.5z" fill="none" stroke="currentColor" />
      <path d="m4.5 7.5 6.5 3.3 6.5-3.3M11 10.8V19M17.5 12.5h3m-1.5-1.5 1.5 1.5L19 14" fill="none" stroke="currentColor" />
    </svg>
  )
}

/**
 * 聚合 Registry Preset、Base Component 与 Variant 的领域组件目录。
 *
 * @remarks
 * 面板只发布普通创建/拖拽意图；Stage 定位、资源解析和 Editor 文档事务由上层接线。
 *
 * @public
 */
export function ComposeComponentLibraryPanel({
  registry,
  store,
  onCreateIntent,
  onOpenIntent,
  onCreateVariantIntent,
  onItemDragStart,
  onItemDragMove,
  onItemDragEnd,
  onItemDragCancel,
  className,
  ...htmlProps
}: ComposeComponentLibraryPanelProps) {
  const i18n = useComposeI18nContext()
  const zh = (i18n?.locale ?? 'zh-CN') === 'zh-CN'
  const [catalog, setCatalog] = useState<ComposeComponentCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const pointer = useRef<PointerSession | null>(null)
  const pointerCleanup = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  const pendingProjectActivation = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback((signal?: AbortSignal) => {
    if (!store) return Promise.resolve()
    return store.listComponents(signal).then(
      (value) => {
        if (signal?.aborted) return
        setCatalog(value)
        setError(null)
      },
      (reason: unknown) => {
        if (signal?.aborted) return
        setError(reason instanceof Error ? reason.message : String(reason))
      },
    )
  }, [store])

  useEffect(() => {
    if (!store) return undefined
    const controller = new AbortController()
    void refresh(controller.signal)
    const unsubscribe = store?.subscribe(() => { void refresh(controller.signal) })
    return () => {
      controller.abort()
      unsubscribe?.()
    }
  }, [refresh, store])

  useEffect(() => () => {
    pointerCleanup.current?.()
    if (pendingProjectActivation.current !== null) {
      clearTimeout(pendingProjectActivation.current)
    }
  }, [])

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, item: ComposeComponentLibraryItem) => {
    if (event.button !== 0) return
    pointerCleanup.current?.()
    pointer.current = {
      pointerId: event.pointerId,
      item,
      start: { x: event.clientX, y: event.clientY },
      started: false,
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
      pointerCleanup.current = null
    }
    const move = (pointerEvent: globalThis.PointerEvent) => {
      const session = pointer.current
      if (!session || session.pointerId !== pointerEvent.pointerId) return
      const clientPoint = { x: pointerEvent.clientX, y: pointerEvent.clientY }
      if (!session.started
        && Math.hypot(clientPoint.x - session.start.x, clientPoint.y - session.start.y) >= 4) {
        session.started = true
        suppressClick.current = true
        onItemDragStart?.({ item: session.item, clientPoint })
      }
      if (session.started) {
        setDragPreview({ item: session.item, clientPoint })
        onItemDragMove?.({ item: session.item, clientPoint })
      }
    }
    const release = (pointerEvent: globalThis.PointerEvent) => {
      const session = pointer.current
      if (!session || session.pointerId !== pointerEvent.pointerId) return
      cleanup()
      pointer.current = null
      if (session.started) {
        setDragPreview(null)
        onItemDragEnd?.({
          item: session.item,
          clientPoint: { x: pointerEvent.clientX, y: pointerEvent.clientY },
        })
      }
    }
    const cancel = (pointerEvent: globalThis.PointerEvent) => {
      const session = pointer.current
      if (!session || session.pointerId !== pointerEvent.pointerId) return
      cleanup()
      pointer.current = null
      if (session.started) {
        setDragPreview(null)
        onItemDragCancel?.(session.item)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', cancel)
    pointerCleanup.current = cleanup
  }
  const activate = (item: ComposeComponentLibraryItem) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onCreateIntent?.(item)
  }
  const activateProject = (
    event: ReactMouseEvent<HTMLButtonElement>,
    item: ComposeComponentLibraryItem,
  ) => {
    // 真实浏览器需要等待 dblclick 判定，避免双击打开工作区时先向 Stage 创建两个实例。
    // Testing Library 的合成 click 没有连续点击 detail，保持同步创建契约便于无计时器消费方。
    if (!onOpenIntent || event.detail === 0) {
      activate(item)
      return
    }
    if (pendingProjectActivation.current !== null) clearTimeout(pendingProjectActivation.current)
    pendingProjectActivation.current = setTimeout(() => {
      pendingProjectActivation.current = null
      activate(item)
    }, 220)
  }
  const openProject = (descriptor: ComposeComponentDescriptor) => {
    if (pendingProjectActivation.current !== null) {
      clearTimeout(pendingProjectActivation.current)
      pendingProjectActivation.current = null
    }
    onOpenIntent?.(descriptor)
  }

  const presets = registry.listPresets().filter((preset) => !preset.paletteHidden)
  const projectComponents = catalog?.components ?? []
  return (
    <section
      {...htmlProps}
      aria-label={zh ? '组件库内容' : 'Component library content'}
      className={['compose-component-library', className].filter(Boolean).join(' ')}
    >
      <section className="compose-component-library__section">
        <h3>{zh ? `基础组件 (${presets.length})` : `Basics (${presets.length})`}</h3>
        <div className="compose-component-library__grid">
          {presets.map((preset) => {
            const item: ComposeComponentLibraryItem = { kind: 'preset', presetId: preset.id }
            return (
              <button
                aria-label={`${zh ? '添加' : 'Add'} ${preset.label}`}
                className="compose-component-library__tile"
                key={preset.id}
                onClick={() => { activate(item) }}
                onPointerDown={(event) => { pointerDown(event, item) }}
                type="button"
              >
                <span aria-hidden="true" className="compose-component-library__icon">
                  {preset.icon ?? <ComposeComponentAssetIcon kind="base" />}
                </span>
                <span>{preset.label}</span>
              </button>
            )
          })}
        </div>
      </section>
      {store
        ? (
            <section className="compose-component-library__section">
              <h3>{zh ? `项目组件 (${projectComponents.length})` : `Project components (${projectComponents.length})`}</h3>
              {error ? <p role="alert">{error}</p> : null}
              {!catalog && !error ? <p role="status">{zh ? '正在加载…' : 'Loading…'}</p> : null}
              <div className="compose-component-library__grid">
                {projectComponents.map((descriptor) => {
                  const item: ComposeComponentLibraryItem = { kind: 'component', descriptor }
                  const kindLabel = descriptor.kind === 'base'
                    ? (zh ? '组件' : 'component')
                    : (zh ? '变体' : 'variant')
                  return (
                    <div className="compose-component-library__project-item" key={descriptor.assetKey}>
                      <button
                        aria-label={`${zh ? '添加' : 'Add'}${zh ? kindLabel : ` ${kindLabel}`} ${descriptor.displayName}`}
                        className="compose-component-library__tile"
                        onClick={(event) => { activateProject(event, item) }}
                        onDoubleClick={() => { openProject(descriptor) }}
                        onPointerDown={(event) => { pointerDown(event, item) }}
                        type="button"
                      >
                        <span aria-hidden="true" className="compose-component-library__icon">
                          <ComposeComponentAssetIcon kind={descriptor.kind} />
                        </span>
                        <span>{descriptor.displayName}</span>
                      </button>
                      {descriptor.kind === 'base' && onCreateVariantIntent ? (
                        <button
                          aria-label={`${zh ? '创建变体' : 'Create variant'} ${descriptor.displayName}`}
                          className="compose-component-library__variant-action"
                          title={zh ? '创建变体' : 'Create variant'}
                          type="button"
                          onClick={() => { onCreateVariantIntent(descriptor) }}
                        >◇</button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        : null}
      {dragPreview ? (
        <div
          className="component-palette__drag-preview compose-component-library__drag-preview"
          role="status"
          style={{
            left: `${dragPreview.clientPoint.x + 12}px`,
            top: `${dragPreview.clientPoint.y + 12}px`,
          }}
        >
          <span aria-hidden="true" className="compose-component-library__drag-preview-icon">
            {dragPreview.item.kind === 'component'
              ? <ComposeComponentAssetIcon kind={dragPreview.item.descriptor.kind} />
              : registry.getPreset(dragPreview.item.presetId)?.icon}
          </span>
          <span>
            {dragPreview.item.kind === 'component'
              ? dragPreview.item.descriptor.displayName
              : registry.getPreset(dragPreview.item.presetId)?.label ?? dragPreview.item.presetId}
          </span>
        </div>
      ) : null}
    </section>
  )
}
