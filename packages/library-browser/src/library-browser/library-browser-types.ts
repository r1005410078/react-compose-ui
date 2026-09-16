import type {
  ComposeLibraryCategory,
  ComposeLibraryPort,
  ComposeLibraryRecord,
  ComposeLibrarySort,
} from '@compose-ui/library'

/**
 * 左栏上段的四个去处。
 *
 * @remarks
 * 它们是**互斥的位置**，回答「在哪儿找」。与下段的场景类型筛选是两个问题，因此两段在语义上
 * 也分开：去处走 `aria-current`（导航），筛选走 `aria-pressed`（开关）。**视觉上两种选中画法
 * 不同，正是因为语义上本来就不同**——同一种画法会让它们读成并列的两个选项。
 *
 * `recent` 横跨三者，因此它不是第四个 `kind`，只是第四个去处。
 * @public
 */
export type ComposeLibraryLocation = 'recent' | 'project' | 'template' | 'trash'

/** 主区的两种呈现。 @public */
export type ComposeLibraryView = 'grid' | 'list'

/** 一次查询的可见状态。 @public */
export interface ComposeLibraryViewState {
  readonly location: ComposeLibraryLocation
  /** `null` 即未分类那一档；`undefined` 即不筛。 */
  readonly category: string | null | undefined
  readonly search: string
  readonly sort: ComposeLibrarySort
  readonly view: ComposeLibraryView
}

/** @public */
export interface ComposeLibraryBrowserProps {
  readonly port: ComposeLibraryPort
  /** 打开一个页面去编辑它。 */
  readonly onOpenPage: (pageKey: string) => void
  /**
   * 新建一份空白页面。
   *
   * @remarks
   * 缺席即不画那颗按钮——一个按下去什么都不发生的按钮比没有更差。
   */
  readonly onNewPage?: () => void
  /** 一页取多少条。 */
  readonly pageSize?: number
  readonly className?: string
}

/** 交给图墙渲染的一段。 @public */
export interface ComposeLibrarySection {
  readonly category: string | null
  readonly label: string
  readonly count: number
  readonly items: readonly ComposeLibraryRecord[]
}

/** @internal */
export interface LibraryLoadState {
  readonly status: 'idle' | 'loading' | 'ready' | 'failed'
  readonly items: readonly ComposeLibraryRecord[]
  readonly categories: readonly ComposeLibraryCategory[]
  readonly categoryCounts: ReadonlyMap<string | null, number>
  readonly locationCounts: {
    readonly project: number
    readonly template: number
    readonly trash: number
  }
  readonly nextCursor: string | null
  readonly error: unknown
}

/** @internal */
export type LibraryPortRef = ComposeLibraryPort
