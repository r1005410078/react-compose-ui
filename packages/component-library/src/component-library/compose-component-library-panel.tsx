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
import { COMPOSE_DEFAULT_COMPONENT_SHELF, resolveComponentShelf } from './component-shelf'
import type {
  ComposeComponentShelf,
  ComposeComponentShelfGroup,
  ComposeComponentShelfTile,
} from './component-shelf'
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
  /**
   * 货架：面板列什么、按什么分段。
   *
   * @remarks
   * 缺省是 {@link COMPOSE_DEFAULT_COMPONENT_SHELF}。它由工作区给出，因此同一个面板在不同
   * 工作区里铺不同的东西——组件本身没有模式。
   */
  readonly shelf?: ComposeComponentShelf
  /**
   * 当前工作区的工具栏上有哪几条命令 / 工具的 Preset id。
   *
   * @remarks
   * 只用来求值 `paletteHidden: 'toolbar'` 那一档：工具栏已提供入口的物料不必在面板上再占一块
   * 瓦片，而工具栏货架按工作区不同，因此这个判断也按工作区不同。宿主不给时那一档照旧全部
   * 藏起来——不接工作区的宿主一个瓦片都不该多出来。
   *
   * 本面板**不认识工具栏**，拿到的只是一份 id 名单。
   */
  readonly toolbarPresetIds?: readonly string[]
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

/** 面板会话的空状态；`shelf` 是它挂在哪一份货架上的身份。 */
function emptyShelfSession(shelf: ComposeComponentShelf) {
  return {
    shelf,
    query: '',
    collapseOverrides: new Map<string, boolean>() as ReadonlyMap<string, boolean>,
    dismissed: new Set<string>() as ReadonlySet<string>,
  }
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
  shelf = COMPOSE_DEFAULT_COMPONENT_SHELF,
  toolbarPresetIds,
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
  /**
   * 面板自己的会话状态：搜索词、被点开或收起过的段与组、被「去掉」的段。
   *
   * @remarks
   * 三样一起挂在**当前这份货架**上：货架换了（多半是切了工作区）就整份作废，回到新货架说的
   * 样子。派生而不是用 effect 重置——后者会多渲染一帧，那一帧里用的还是上一份货架的折叠状态。
   *
   * 折叠只记**改动**而不是记全部状态，因此没被点过的段仍然听货架的话。「去掉」只收起视图、
   * 不改货架——货架住在工作区定义里，改它是另一件事（自定义货架），换个工作区再回来它还在，
   * 用户不会以为自己刚删掉了一段配置。
   */
  const [session, setSession] = useState(() => emptyShelfSession(shelf))
  const active = session.shelf === shelf ? session : emptyShelfSession(shelf)
  const { collapseOverrides, dismissed, query } = active
  const setQuery = (next: string) => { setSession({ ...active, query: next }) }
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
    // 上一次拖拽若在面板外松手，click 不会在 tile 上发生，抑制标志会滞留并吞掉
    // 下一次点击添加；每次新指针会话开始时复位（click 总在本次 pointerdown 之后）。
    suppressClick.current = false
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

  // 没有 Store 时文件夹段整段不出现（不是出现一个写着 0 的空段）：没接项目资源的宿主看到的
  // 就该是今天那份只有基础 Preset 的面板。
  const visibleSections = store
    ? shelf.sections
    : shelf.sections.filter((section) => section.kind !== 'folder')
  /*
   * `paletteHidden` 在 Registry 上带着**理由**：`'always'` 恒藏，`'toolbar'` 只在工具栏已经
   * 提供入口时才藏。后者按工作区不同，而本包不认识工具栏——由宿主用 `toolbarPresetIds` 告诉
   * 我们「当前工作区的工具栏上有哪几条命令」，这里把它求值成一个布尔再往下传。
   *
   * 宿主不给这份名单时（独立使用本面板），`'toolbar'` 一档照旧藏起来：那是它在货架落地之前
   * 的行为，不接工作区的宿主一个瓦片都不该多出来。
   */
  const hiddenByToolbar = (presetId: string) => (
    toolbarPresetIds === undefined || toolbarPresetIds.includes(presetId)
  )
  const sections = resolveComponentShelf({
    shelf: { ...shelf, sections: visibleSections },
    presets: registry.listPresets().map((preset) => ({
      ...preset,
      paletteHidden: preset.paletteHidden === 'always'
        || (preset.paletteHidden === 'toolbar' && hiddenByToolbar(preset.id)),
    })),
    catalog,
    query,
    labels: {
      basics: zh ? '基础组件' : 'Basics',
      components: zh ? '项目组件' : 'Project components',
    },
    locale: i18n?.locale,
  }).filter((section) => !dismissed.has(section.id))

  const isCollapsed = (id: string, fallback: boolean) => collapseOverrides.get(id) ?? fallback
  const toggleCollapsed = (id: string) => {
    const definitionDefault = sections.find((section) => section.id === id)?.collapsed ?? false
    const next = new Map(collapseOverrides)
    next.set(id, !(collapseOverrides.get(id) ?? definitionDefault))
    setSession({ ...active, collapseOverrides: next })
  }
  const dismissSection = (id: string) => {
    setSession({ ...active, dismissed: new Set(dismissed).add(id) })
  }

  const renderTile = (tile: ComposeComponentShelfTile) => {
    if (tile.kind === 'preset') {
      const item: ComposeComponentLibraryItem = { kind: 'preset', presetId: tile.presetId }
      return (
        <button
          aria-label={`${zh ? '添加' : 'Add'} ${tile.label}`}
          className="compose-component-library__tile"
          key={tile.presetId}
          onClick={() => { activate(item) }}
          onPointerDown={(event) => { pointerDown(event, item) }}
          type="button"
        >
          <span aria-hidden="true" className="compose-component-library__icon">
            {registry.getPreset(tile.presetId)?.icon ?? <ComposeComponentAssetIcon kind="base" />}
          </span>
          <span>{tile.label}</span>
        </button>
      )
    }
    const { descriptor } = tile
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
  }

  const renderGroup = (group: ComposeComponentShelfGroup) => {
    if (group.title === null) {
      return (
        <div className="compose-component-library__grid" key={group.id}>
          {group.tiles.map(renderTile)}
        </div>
      )
    }
    const collapsed = isCollapsed(group.id, false)
    return (
      <div className="compose-component-library__group" key={group.id}>
        <h4>
          <button
            aria-expanded={!collapsed}
            className="compose-component-library__section-toggle"
            onClick={() => { toggleCollapsed(group.id) }}
            type="button"
          >
            {`${group.title} (${group.tiles.length})`}
          </button>
        </h4>
        {collapsed ? null : (
          <div className="compose-component-library__grid">{group.tiles.map(renderTile)}</div>
        )}
      </div>
    )
  }

  return (
    <section
      {...htmlProps}
      aria-label={shelf.title ?? (zh ? '组件库内容' : 'Component library content')}
      className={['compose-component-library', className].filter(Boolean).join(' ')}
    >
      {shelf.search ? (
        <div className="compose-component-library__search">
          <input
            aria-label={zh ? '搜索组件' : 'Search components'}
            data-testid="component-library-search"
            onChange={(event) => { setQuery(event.target.value) }}
            placeholder={zh ? '搜索' : 'Search'}
            type="search"
            value={query}
          />
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {store && !catalog && !error ? <p role="status">{zh ? '正在加载…' : 'Loading…'}</p> : null}
      {sections.map((section) => {
        // 搜索期间不受折叠限制：有命中的段一律展开，否则用户搜出来的东西藏在一行标题后面。
        const collapsed = query.trim() === ''
          ? isCollapsed(section.id, section.collapsed)
          : section.count === 0
        return (
          <section className="compose-component-library__section" data-shelf-section={section.id} key={section.id}>
            <h3>
              <button
                aria-expanded={!collapsed}
                className="compose-component-library__section-toggle"
                onClick={() => { toggleCollapsed(section.id) }}
                type="button"
              >
                {section.missing ? section.title : `${section.title} (${section.count})`}
              </button>
            </h3>
            {collapsed ? null : section.missing ? (
              <p className="compose-component-library__missing">
                <span role="status">{zh ? '找不到这个文件夹' : 'Folder not found'}</span>
                <button
                  onClick={() => { dismissSection(section.id) }}
                  type="button"
                >
                  {zh ? '去掉' : 'Remove'}
                </button>
              </p>
            ) : section.groups.map(renderGroup)}
          </section>
        )
      })}
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
