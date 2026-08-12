import {
  useCallback,
  useEffect,
  useId,
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

/**
 * 主组件 / 变体 / 页面实例的等轴测立方体图标。
 *
 * @remarks
 * 三个可见面使用不同明度与色相形成透视深度（顶亮、左中、右暗）。
 * 主组件：实心蓝系；变体：半透明青绿 + 侧向标记；实例：线框灰蓝（引用非本体）。
 *
 * @public
 */
export function ComposeComponentAssetIcon({ kind }: {
  readonly kind: ComposeComponentDescriptor['kind'] | 'instance'
}) {
  // 多实例同页时 gradient id 必须唯一，否则后渲染的 defs 会覆盖填充。
  const uid = useId().replace(/:/g, '')
  // 等轴测三面：顶 / 左前 / 右前（路径按 viewBox 24 对齐）。
  const top = 'M12 3.2 19.6 7.4 12 11.6 4.4 7.4Z'
  const left = 'M4.4 7.4 12 11.6 12 20.2 4.4 16Z'
  const right = 'M19.6 7.4 12 11.6 12 20.2 19.6 16Z'

  if (kind === 'base') {
    const topId = `cube-base-top-${uid}`
    const leftId = `cube-base-left-${uid}`
    const rightId = `cube-base-right-${uid}`
    return (
      <svg
        aria-hidden="true"
        className="compose-component-asset-icon compose-component-asset-icon--base"
        data-testid="component-library-base-icon"
        fill="none"
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id={topId} x1="4" x2="20" y1="3" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9fd0ff" />
            <stop offset="100%" stopColor="#5aa8f0" />
          </linearGradient>
          <linearGradient id={leftId} x1="4" x2="12" y1="8" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3d8fd9" />
            <stop offset="100%" stopColor="#2563a8" />
          </linearGradient>
          <linearGradient id={rightId} x1="12" x2="20" y1="8" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2a6fbc" />
            <stop offset="100%" stopColor="#1a4a82" />
          </linearGradient>
        </defs>
        <path d={right} fill={`url(#${rightId})`} />
        <path d={left} fill={`url(#${leftId})`} />
        <path d={top} fill={`url(#${topId})`} />
        <path
          d={`${top} ${left} ${right}`}
          fill="none"
          stroke="#0c2744"
          strokeLinejoin="round"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
        <path d="M12 11.6V20.2M4.4 7.4 12 11.6 19.6 7.4" stroke="#cfe6ff" strokeOpacity="0.22" strokeWidth="0.7" />
      </svg>
    )
  }

  if (kind === 'variant') {
    const topId = `cube-var-top-${uid}`
    const leftId = `cube-var-left-${uid}`
    const rightId = `cube-var-right-${uid}`
    return (
      <svg
        aria-hidden="true"
        className="compose-component-asset-icon compose-component-asset-icon--variant"
        data-testid="component-library-variant-icon"
        fill="none"
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id={topId} x1="4" x2="20" y1="3" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8af0c8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3ecf8e" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={leftId} x1="4" x2="12" y1="8" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2db87a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1a7a52" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={rightId} x1="12" x2="20" y1="8" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#23966a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#145c40" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        <path d={right} fill={`url(#${rightId})`} />
        <path d={left} fill={`url(#${leftId})`} />
        <path d={top} fill={`url(#${topId})`} />
        <path
          d="M4.4 7.4 12 3.2 19.6 7.4 19.6 16 12 20.2 4.4 16Z"
          fill="none"
          stroke="#7dffe0"
          strokeLinejoin="round"
          strokeOpacity="0.75"
          strokeWidth="1.15"
        />
        <path d="M12 11.6V20.2M4.4 7.4 12 11.6 19.6 7.4" stroke="#b8ffe8" strokeOpacity="0.45" strokeWidth="0.9" />
        {/* 侧向条纹：变体标记，色相独立于立方体 */}
        <path d="M21 10.5v5.5M22.6 11.4v3.6" stroke="#e8b84a" strokeLinecap="round" strokeWidth="1.35" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className="compose-component-asset-icon compose-component-asset-icon--instance"
      data-testid="component-library-instance-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      {/* 线框三面不同描边明度，形成空心深度 */}
      <path d={top} fill="none" stroke="#a8c4e8" strokeLinejoin="round" strokeWidth="1.25" />
      <path d={left} fill="none" stroke="#6a8ab0" strokeLinejoin="round" strokeWidth="1.25" />
      <path d={right} fill="none" stroke="#4a6588" strokeLinejoin="round" strokeWidth="1.25" />
      <path d="M12 11.6V20.2" stroke="#8aa6c8" strokeOpacity="0.7" strokeWidth="1" />
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
                  // 产品术语：库内是主组件/变体资源；拖入页面才是实例。
                  const kindLabel = descriptor.kind === 'base'
                    ? (zh ? '主组件' : 'base component')
                    : (zh ? '变体' : 'variant')
                  return (
                    <div
                      className="compose-component-library__project-item"
                      data-component-kind={descriptor.kind}
                      key={descriptor.assetKey}
                    >
                      <button
                        aria-label={`${zh ? '添加' : 'Add'}${zh ? kindLabel : ` ${kindLabel}`} ${descriptor.displayName}`}
                        className="compose-component-library__tile"
                        data-component-kind={descriptor.kind}
                        onClick={(event) => { activateProject(event, item) }}
                        onDoubleClick={() => { openProject(descriptor) }}
                        onPointerDown={(event) => { pointerDown(event, item) }}
                        type="button"
                      >
                        <span aria-hidden="true" className="compose-component-library__icon">
                          <ComposeComponentAssetIcon kind={descriptor.kind} />
                        </span>
                        <span className="compose-component-library__name">{descriptor.displayName}</span>
                        <span className="compose-component-library__meta">{kindLabel}</span>
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
