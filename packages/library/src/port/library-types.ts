import type { ComposeAssetError } from '@compose-ui/assets'

/**
 * 页面在库里的性质。
 *
 * @remarks
 * 恒有，且与删除状态**正交**。回收站不是这里的第三个取值——一个模板被删除之后恢复必须回到
 * 「模板」，三元枚举把「恢复到哪儿」这件事从数据里擦掉了。回收站读
 * {@link ComposeLibraryRecord.deletedAt}，跨 `kind`。
 * @public
 */
export type ComposeLibraryKind = 'project' | 'template'

/**
 * 场景类型标签。
 *
 * @remarks
 * 清单由服务端给出且**有序**——那个顺序就是左栏的渲染顺序。不给顺序的话两个宿主会各排一种，
 * 而用户记的是位置。
 * @public
 */
export interface ComposeLibraryCategory {
  readonly id: string
  readonly label: string
  /** 内置标签不可删除；缺席即按可删除处理。 */
  readonly builtIn?: boolean
}

/**
 * 库里的一条页面记录。
 *
 * @public
 */
export interface ComposeLibraryRecord {
  /**
   * 稳定 key，与资源服务上那份 `.page.json` 的 `assetKey` **同值**。
   *
   * @remarks
   * 这是库端口与资源端口之间**唯一**的连接点。
   */
  readonly pageKey: string
  readonly title: string
  readonly kind: ComposeLibraryKind
  /**
   * 场景类型标签 id。
   *
   * @remarks
   * 空数组即「未分类」——未分类**不是**一个保留的标签 id：留一个会造出「既打了未分类又打了
   * PCS」这种非法态，而且需要有人去维护它。
   */
  readonly categories: readonly string[]
  /**
   * 缩略图的直接 URL；`null` 即还没有，消费方画占位而不是留空或报错。
   *
   * @remarks
   * 只有能给出 URL 的实现会填它。给不出的实现（本地目录、内存）把这里留成 `null`，由
   * {@link ComposeLibraryPort.readThumbnail} 交出字节。
   */
  readonly thumbnailUrl: string | null
  /** 缩略图 URL 的失效时刻（epoch 毫秒）；缺席即不过期。 */
  readonly thumbnailExpiresAt?: number
  /** 激活场景的尺寸；还没量过时为 null。 */
  readonly width: number | null
  readonly height: number | null
  /**
   * 被「就用这个」用作底稿的次数。
   *
   * @remarks
   * 只能由 {@link ComposeLibraryPort.instantiate} 在同一个事务里加一。端口上没有任何可以单独
   * 自增它的方法——那样打开一次就能刷，而这个数存在的全部理由是回答「哪个画法是大家在用的」。
   */
  readonly useCount: number
  /** 非 null 即在回收站。 */
  readonly deletedAt: number | null
  readonly createdAt: number
  readonly modifiedAt: number
  /**
   * 页面文件当前的 revision，**只作缓存提示**。
   *
   * @remarks
   * 乐观锁的事实来源仍是 `ComposeAssetProvider.read()` 交回的那一个。两处都当锁用就是两个
   * 事实来源，而它们会在任何一次不经过库端口的写入之后分家。
   */
  readonly revisionHint?: string
}

/** @public */
export type ComposeLibrarySort
  = | 'modified-desc'
    | 'created-desc'
    | 'used-desc'
    | 'title-asc'

/** @public */
export interface ComposeLibraryQuery {
  /** 缺席即不限。 */
  readonly kind?: ComposeLibraryKind
  /** 缺席即 false（不含回收站）。true 时只看回收站，跨 `kind`。 */
  readonly deleted?: boolean
  /**
   * 成员之间是「或」。`null` 这一档表示**未分类**；缺席即不限。
   *
   * @remarks
   * 用数组而不是单值，是为了让将来的多选是一次加法而不是一次破坏性变更；用 `null` 表示未分类，
   * 是因为它不可能与任何标签 id 撞车。
   */
  readonly categories?: readonly (string | null)[]
  /**
   * 按标题匹配。
   *
   * @remarks
   * **不匹配页面内容**——那要服务端解析每一份 `.page.json`。
   */
  readonly search?: string
  /** 缺席即 `modified-desc`。 */
  readonly sort?: ComposeLibrarySort
  /** 上一页返回的 {@link ComposeLibraryPage.nextCursor}。 */
  readonly cursor?: string
  /** 缺席由实现定。 */
  readonly limit?: number
  readonly signal?: AbortSignal
}

/** @public */
export interface ComposeLibraryCategoryFacet {
  /** `null` 这一项是未分类。 */
  readonly category: string | null
  readonly count: number
}

/** @public */
export interface ComposeLibraryLocationFacet {
  readonly project: number
  readonly template: number
  readonly trash: number
}

/** @public */
export interface ComposeLibraryFacets {
  /**
   * 每个场景类型各有多少。
   *
   * @remarks
   * 实现 MUST 在**摘掉 `categories` 这一项条件、保留其余条件（尤其是 `search`）**的前提下求。
   * 不摘的话，选中某一类之后其余每一类都变成 0，左栏再也切不出去——这是这条协议上最容易实现
   * 错的一处。
   */
  readonly byCategory: readonly ComposeLibraryCategoryFacet[]
  /**
   * 左栏上段三个去处各有多少。
   *
   * @remarks
   * MUST 只受 `search` 影响，不受 `kind` / `deleted` / `categories` 影响——它回答的是
   * 「切过去有多少」。
   */
  readonly byLocation: ComposeLibraryLocationFacet
}

/** @public */
export interface ComposeLibraryPage {
  readonly items: readonly ComposeLibraryRecord[]
  /** 没有下一页时为 null。 */
  readonly nextCursor: string | null
  readonly facets: ComposeLibraryFacets
}

/** @public */
export interface ComposeLibraryCreateInput {
  readonly title: string
  readonly kind: ComposeLibraryKind
  readonly categories?: readonly string[]
  /** 页面文件内容；缺席时实现落一份空白页面。 */
  readonly content?: Blob
  /** 资源树上的落点；缺席即库的默认目录。 */
  readonly folderId?: string
  readonly signal?: AbortSignal
}

/**
 * 「就用这个」：以一条记录为底新建，并给来源 `useCount` 加一。
 *
 * @public
 */
export interface ComposeLibraryInstantiateInput {
  readonly sourcePageKey: string
  readonly title: string
  /**
   * 缺席即 `'project'`，**不继承来源**。
   *
   * @remarks
   * 「就用这个」的意思是拿模板做一张要交付的图；继承的话从模板复制出来的还是模板，
   * 那不是用户按下那一下的意思。
   */
  readonly kind?: ComposeLibraryKind
  /** 缺席即继承来源的标签。 */
  readonly categories?: readonly string[]
  readonly folderId?: string
  readonly signal?: AbortSignal
}

/**
 * 只改业务字段。
 *
 * @remarks
 * 页面**内容**走资源端口的 `writeFile`。库端口上没有第二条保存入口——同一件事的两个入口
 * 迟早写出两种行为。
 * @public
 */
export interface ComposeLibraryUpdateInput {
  readonly pageKey: string
  readonly title?: string
  readonly kind?: ComposeLibraryKind
  readonly categories?: readonly string[]
  readonly signal?: AbortSignal
}

/** @public */
export interface ComposeLibraryKeysInput {
  readonly pageKeys: readonly string[]
  readonly signal?: AbortSignal
}

/** @public */
export interface ComposeLibraryThumbnailInput {
  readonly pageKey: string
  readonly image: Blob
  readonly signal?: AbortSignal
}

/**
 * 库端口可独立缺席的能力。
 *
 * @public
 */
export interface ComposeLibraryCapabilities {
  readonly create: boolean
  readonly update: boolean
  readonly trash: boolean
  /** 彻底删除。 */
  readonly purge: boolean
  readonly thumbnail: boolean
  readonly recents: boolean
}

/**
 * 首页连接的页面库事实来源。
 *
 * @remarks
 * 端口上**没有鉴权参数**（token、用户标识）：鉴权属于 HTTP 适配器，放进端口会让本地实现凭空
 * 多出一个它答不了的参数，而那个参数每一个调用点都要传。
 *
 * 失败一律抛 {@link @compose-ui/assets#ComposeAssetError}，**不另起一套同样六档的分类**
 * ——那只会让消费方把同一个 `switch` 写两遍。
 *
 * @throws {@link @compose-ui/assets#ComposeAssetError}
 * @public
 */
export interface ComposeLibraryPort {
  readonly id: string
  readonly capabilities: ComposeLibraryCapabilities

  /**
   * 一次调用回答整屏：列表、下一页游标与两组 facet。
   *
   * @remarks
   * `items` 与 `facets` **必须一起返回**。分成两条调用会让用户改一次筛选就看到计数是旧的、
   * 图是新的，而那个不一致屏幕上没有任何东西解释。
   */
  query(input: ComposeLibraryQuery): Promise<ComposeLibraryPage>
  get(input: {
    readonly pageKey: string
    readonly signal?: AbortSignal
  }): Promise<ComposeLibraryRecord>

  /** 有序；顺序就是左栏的渲染顺序。 */
  listCategories(input?: {
    readonly signal?: AbortSignal
  }): Promise<readonly ComposeLibraryCategory[]>

  /**
   * 建一个页面：**同一次调用**里落页面文件与库记录。
   *
   * @remarks
   * 拆成两步会在中间失败时留下一个孤儿文件或一条孤儿记录，而它们都不可见。
   */
  create?(input: ComposeLibraryCreateInput): Promise<ComposeLibraryRecord>
  /** 复制在实现侧完成，页面字节不经过调用方；同一个事务里给来源加一。 */
  instantiate?(input: ComposeLibraryInstantiateInput): Promise<ComposeLibraryRecord>
  update?(input: ComposeLibraryUpdateInput): Promise<ComposeLibraryRecord>

  /** 软删除：置 `deletedAt`，**不动页面文件**。 */
  trash?(input: ComposeLibraryKeysInput): Promise<void>
  restore?(input: ComposeLibraryKeysInput): Promise<void>
  /** 彻底删除：记录与页面文件一起删。 */
  purge?(input: ComposeLibraryKeysInput): Promise<void>

  /**
   * 上传缩略图。
   *
   * @remarks
   * 调用方 MUST 在页面保存成功**之后异步**调用它，失败 MUST NOT 使保存失败。
   */
  putThumbnail?(input: ComposeLibraryThumbnailInput): Promise<void>
  /**
   * 取缩略图的**字节**。
   *
   * @remarks
   * 给不出直接 URL 的实现（本地目录、内存）走这一条，由渲染它的组件持有 objectURL 的生命周期
   * ——本包既不认识 DOM 也不知道谁该释放它，在这里合成一个 URL 就是一处没有归属的泄漏。
   * 这与 `ComposeAssetProvider` 上 `resolveAsset` 与 `resolveUrl` 的分工逐字相同。
   *
   * 还没有缩略图时返回 `null`，**不抛错**：没有图是常态（见
   * {@link ComposeLibraryRecord.thumbnailUrl}），不是失败。
   */
  readThumbnail?(input: {
    readonly pageKey: string
    readonly signal?: AbortSignal
  }): Promise<{ readonly blob: Blob; readonly mediaType: string } | null>

  recordOpen?(input: {
    readonly pageKey: string
    readonly signal?: AbortSignal
  }): Promise<void>
  listRecents?(input?: {
    readonly limit?: number
    readonly signal?: AbortSignal
  }): Promise<readonly ComposeLibraryRecord[]>

  /** 无参数失效通知，与 `ComposeAssetProvider.subscribe` 同语义。 */
  subscribe?(listener: () => void): () => void
}

/**
 * 端口抛出的错误类型别名。
 *
 * @remarks
 * 复用资源那一套六档分类，见 {@link ComposeLibraryPort}。
 * @public
 */
export type ComposeLibraryError = ComposeAssetError
