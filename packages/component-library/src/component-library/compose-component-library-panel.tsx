import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
  useComposeContextMenu,
} from '@compose-ui/components'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComposeComponentCatalog, ComposeComponentDescriptor, ComposeComponentStore } from '../component-store'
import {
  COMPOSE_DEFAULT_COMPONENT_SHELF,
  keepOnlyComponentShelfSection,
  resolveComponentShelf,
  setComponentShelfPresetVisible,
} from './component-shelf'
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
  /**
   * 改当前工作区的物料货架；不给时瓦片右键里那些改货架的项整个不出现。
   *
   * @remarks
   * 这三个回调走 **prop** 而不是 Context，与工具栏那边（`ComposeToolbarShelfContext`）**有意
   * 不同**：那边的中间层属于宿主（工具栏元素由 controller 造、经 `slots.stageToolbar` 交回去，
   * 宿主可以把它包进自己的 Fragment），`cloneElement` 补 prop 那条路会断；而本面板由编辑器
   * 直接渲染、`shelf` 本来就是 prop，没有那一层。Context 不是 prop 透传的默认替代。
   */
  readonly onShelfChange?: (shelf: ComposeComponentShelf) => void
  /** 打开「自定义物料面板…」对话框；不给时那一项不出现。 */
  readonly onCustomize?: () => void
  /** 在资源浏览器里定位某个文件夹；只有文件夹来源的瓦片会用到。 */
  readonly onRevealFolder?: (folderPath: readonly string[]) => void
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
 * 段 / 组标题的折叠箭头。
 *
 * @remarks
 * 画法照抄 `@compose-ui/components` Tree 的 chevron（16 网格、同一条路径、14px、1.8 描边）：
 * 面板与场景树并排在同一列里，两处箭头长得不一样会被读成两种不同的折叠。此前是一个文字字形
 * `▾` 再旋转 90°，字形随字体变、与 SVG 描边的粗细也对不上。
 */
function SectionChevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <span aria-hidden="true" className="compose-component-library__section-chevron">
      <svg viewBox="0 0 16 16">
        <path d={expanded ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'} />
      </svg>
    </span>
  )
}

/**
 * 项目组件的单色线稿图标：等轴测立方体的三种画法。
 *
 * @remarks
 * 主组件是实线立方体并画出内棱；变体在右侧多两道短线（变体标记，形状先分开，颜色再分开）；
 * 实例是虚线立方体——它引用别处的定义，自己没有实体。三者都走 `currentColor`，与物料图标
 * 同一条规则：颜色由所在的行给出。
 *
 * @public
 */
export function ComposeComponentAssetIcon({ kind }: {
  readonly kind: ComposeComponentDescriptor['kind'] | 'instance'
}) {
  // 等轴测三面：顶 / 左前 / 右前（路径按 viewBox 24 对齐）。
  const outline = 'M4.4 7.4 12 3.2 19.6 7.4 19.6 16 12 20.2 4.4 16Z'
  const edges = 'M12 11.6V20.2M4.4 7.4 12 11.6 19.6 7.4'
  const shared = {
    'aria-hidden': true as const,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
  }

  if (kind === 'base') {
    return (
      <svg
        {...shared}
        className="compose-component-asset-icon compose-component-asset-icon--base"
        data-testid="component-library-base-icon"
      >
        <path d={outline} />
        <path d={edges} />
      </svg>
    )
  }

  if (kind === 'variant') {
    return (
      <svg
        {...shared}
        className="compose-component-asset-icon compose-component-asset-icon--variant"
        data-testid="component-library-variant-icon"
      >
        <path d="M3.4 7.4 11 3.2 18.6 7.4 18.6 16 11 20.2 3.4 16Z" />
        <path d="M11 11.6V20.2M3.4 7.4 11 11.6 18.6 7.4" />
        {/* 侧向两道短线：变体标记 */}
        <path d="M21 10.5v5.5M22.6 11.4v3.6" />
      </svg>
    )
  }

  return (
    <svg
      {...shared}
      className="compose-component-asset-icon compose-component-asset-icon--instance"
      data-testid="component-library-instance-icon"
    >
      <path d={outline} strokeDasharray="2.5 2" />
      <path d={edges} strokeOpacity="0.6" />
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
  onShelfChange,
  onCustomize,
  onRevealFolder,
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
  // 求值一次给两个消费者：解析出瓦片，以及右键菜单里「藏 / 显」要用的那份可见 Preset 名单。
  const presetEntries = registry.listPresets().map((preset) => ({
    ...preset,
    paletteHidden: preset.paletteHidden === 'always'
      || (preset.paletteHidden === 'toolbar' && hiddenByToolbar(preset.id)),
  }))
  const sections = resolveComponentShelf({
    shelf: { ...shelf, sections: visibleSections },
    presets: presetEntries,
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

  /*
   * 瓦片右键。payload 是「哪一段的哪一个 Preset」，从 DOM 上的 data 属性读——与工具栏那边
   * 逐字同一条做法，也免去把段 id 一路穿过 renderGroup / renderTile 两层。段 id 是稳定的，
   * 因此这里不像工具栏那样需要按下标寻址（那边的分隔线可以有多条，id 认不出是哪一条）。
   */
  const shelfMenu = useComposeContextMenu<{ sectionId: string | null; presetId: string | null }>()
  const menuTarget = shelfMenu.payload
  const menuSection = menuTarget?.sectionId === undefined || menuTarget.sectionId === null
    ? null
    : shelf.sections.find((section) => section.id === menuTarget.sectionId) ?? null
  // 可见 Preset 的 id，顺序即呈现顺序——`setComponentShelfPresetVisible` 要拿它把 `include` 写出来。
  const availablePresetIds = presetEntries
    .filter((preset) => preset.paletteHidden !== true)
    .map((preset) => preset.id)
  const applyShelf = (next: ComposeComponentShelf) => {
    onShelfChange?.(next)
    shelfMenu.close()
  }
  const canEditShelf = onShelfChange !== undefined

  const renderTile = (tile: ComposeComponentShelfTile) => {
    if (tile.kind === 'preset') {
      const item: ComposeComponentLibraryItem = { kind: 'preset', presetId: tile.presetId }
      return (
        <button
          aria-label={`${zh ? '添加' : 'Add'} ${tile.label}`}
          className="compose-component-library__tile"
          data-shelf-preset={tile.presetId}
          key={tile.presetId}
          onClick={() => { activate(item) }}
          onPointerDown={(event) => { pointerDown(event, item) }}
          type="button"
        >
          <span aria-hidden="true" className="compose-component-library__icon">
            {registry.getPreset(tile.presetId)?.icon ?? <ComposeComponentAssetIcon kind="base" />}
          </span>
          <span className="compose-component-library__name">{tile.label}</span>
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
            <SectionChevron expanded={!collapsed} />
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
      onContextMenu={(event) => {
        if (!canEditShelf && onCustomize === undefined) return
        /*
         * 落在瓦片上就把那一段（以及基础瓦片的那个 Preset）交给菜单，落在空白处只给自定义
         * 入口——空白处没有可操作的目标，列一个按下去什么都不做的项比不列更糟。
         */
        const target = event.target as HTMLElement | null
        shelfMenu.openAt(event, {
          sectionId: target?.closest?.('[data-shelf-section]')?.getAttribute('data-shelf-section')
            ?? null,
          presetId: target?.closest?.('[data-shelf-preset]')?.getAttribute('data-shelf-preset')
            ?? null,
        })
      }}
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
                <SectionChevron expanded={!collapsed} />
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
      {canEditShelf || onCustomize ? (
        <ComposeContextMenu {...shelfMenu.rootProps}>
          <ComposeContextMenuContent>
            {canEditShelf && menuSection?.kind === 'presets' && menuTarget?.presetId ? (
              <>
                <ComposeContextMenuItem
                  onClick={() => applyShelf(setComponentShelfPresetVisible({
                    shelf,
                    sectionId: menuSection.id,
                    presetId: menuTarget.presetId!,
                    visible: false,
                    available: availablePresetIds,
                  }))}
                >
                  {zh ? '从面板隐藏' : 'Hide from panel'}
                </ComposeContextMenuItem>
                <ComposeContextMenuSeparator />
              </>
            ) : null}
            {menuSection?.kind === 'folder' ? (
              <>
                {/*
                  * 文件夹来源里的瓦片**不能单个隐藏**：那会让「往这个文件夹里再导十个符号，
                  * 它们自动出现」变成谎言。这里能做的只有整段的两件事。
                  */}
                {canEditShelf && shelf.sections.length > 1 ? (
                  <ComposeContextMenuItem
                    onClick={() => applyShelf(keepOnlyComponentShelfSection(shelf, menuSection.id))}
                  >
                    {zh ? '只看这一组' : 'Show only this group'}
                  </ComposeContextMenuItem>
                ) : null}
                {onRevealFolder ? (
                  <ComposeContextMenuItem
                    onClick={() => {
                      shelfMenu.close()
                      onRevealFolder(menuSection.folderPath)
                    }}
                  >
                    {zh ? '在资源里打开此文件夹' : 'Reveal folder in assets'}
                  </ComposeContextMenuItem>
                ) : null}
                <ComposeContextMenuSeparator />
              </>
            ) : null}
            {onCustomize ? (
              <ComposeContextMenuItem onClick={() => { shelfMenu.close(); onCustomize() }}>
                {zh ? '自定义物料面板…' : 'Customize palette…'}
              </ComposeContextMenuItem>
            ) : null}
          </ComposeContextMenuContent>
        </ComposeContextMenu>
      ) : null}
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
