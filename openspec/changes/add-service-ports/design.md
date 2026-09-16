# 设计：资源存取端口与页面库端口

## 上下文

产品要长出后端。这份设计不定服务端怎么实现，定的是**浏览器这一侧看见的形状**——服务端照着
实现，本地实现顶在同一个位置，两者可以互换。

今天已经有的：`ComposeAssetProvider`（`@compose-ui/assets`）是一棵异步文件树，
File System Access 与内存两个实现；`listComposePageDescriptors`（`@compose-ui/pages`）
走遍整棵树、按媒体类型挑出 `.page.json`，产出页面目录。

## 两个端口不等于两个服务

拆的是**接口**，不是部署。库记录与资源记录**一对一挂在同一个 `assetKey` 上**，实现上
完全可以是同一张表的几个业务列、同一个进程的两组路由。

这一条有个直接的好处，值得写在最前面：**`modifiedAt` 与 `revision` 不需要在两边同步**——
它们本来就是同一行。若把库做成一个独立服务、自己存一份 `modifiedAt`，那么每一次编辑器保存
都要有人去通知它，而漏掉那条通知的症状是「图改了但首页上的排序没动」，用户会以为保存没成功。

## 决策

### D1. 库记录的性质是两个正交字段，不是三元枚举

```
kind: 'project' | 'template'   // 恒有
deletedAt: number | null       // 正交
```

设计稿上左栏是三个去处（项目 / 模板 / 回收站），但数据里**不能**是三元的：一个模板被删掉
之后恢复，必须回到「模板」，而三元枚举把这件事擦掉了——「恢复到哪儿」在数据里读不出来。

UI 的三段与数据的两个字段不必一一对应。**回收站 = `deletedAt != null`，跨 kind**。

### D2. 场景类型是标签，「未分类」是标签为空

`categories: string[]`，标签清单由 `listCategories()` 从服务端取、**有序**（那个顺序就是左栏
渲染的顺序；不给顺序的话两个宿主会排出两种）。

写死成枚举，第九种场景就要发版；完全自由会退化成 `PCS` / `pcs` / `PCS柜` 并存。
**「未分类」不是一个标签 id**，它是数组为空——留一个 `uncategorized` 标签会造出
「既打了未分类又打了 PCS」这个非法态，而且需要有人去维护它。

查询里因此用 `readonly (string | null)[]`，`null` 就是「未分类」这一档：`null` 不可能与任何
标签 id 撞车，而数组形状让将来的多选是一次加法而不是一次破坏性变更。

### D3. `items` 与 `facets` 一次返回，facet 要把 category 条件摘掉

左栏那八个计数与主区那些图是同一次查询的两半。分两条调用会让用户点一下筛选之后计数是旧的、
图是新的，而那个不一致屏幕上没有任何东西解释。

**求 facet 时 MUST 摘掉 `categories` 这一项条件、保留其余**（尤其保留 `search`）：不摘的话
选中 PCS 之后其余七项全变成 0，左栏就再也切不出去了。这是服务端最容易实现错的一处。

`byLocation`（项目 / 模板 / 回收站三个数）则**只受 `search` 影响**，不受 `kind`、`deleted`、
`categories` 影响——它回答的是「切过去有多少」。

### D4. 游标分页

图墙是滚动加载。offset 在并发写入下会漏项与重项，而这个库正被多个实施工程师同时写。

### D5. `useCount` 只能由 `instantiate()` 加

没有一条前端可以调的自增——那样打开一次就能刷，而这个数存在的全部理由是回答
「哪个画法是大家在用的」。服务端在复制页面的**同一个事务**里 +1。

这是整份设计里唯一要求服务端写业务数据的地方。

### D6. 新建与复制由库端口一次完成，前端不编排两步

建一个页面是两件事：往对象存储写一份 `.page.json`，以及建一条库记录。让前端顺序做这两步，
中间失败就留下一个孤儿文件或一条孤儿记录，而它们都不可见。

因此 `create()` / `instantiate()` **一次调用两件事都做完**，返回的记录里带着刚签发的 `pageKey`。

`instantiate()` 的复制**在服务端完成**，字节不经过浏览器：一张大接线图好几 MB，而在对象存储
里复制是一次 server-side copy。

`instantiate()` 的 `kind` **默认 `'project'` 而不是继承来源**：「就用这个」的意思是拿模板做一张
要交付的图；继承的话从模板复制出来的还是模板，那不是用户按那一下的意思。

### D7. 编辑器的保存路径**一行不改**

保存仍然走 `ComposeAssetProvider.writeFile(fileId, content, expectedRevision)`。库端口上
**没有** `save`：多一条等于给同一件事造第二个入口，而两个入口迟早写出两种行为。
`modifiedAt` 由「两个端口不等于两个服务」那一条（库记录与资源记录本来就是同一行）白拿。

### D8. `assetKey` 是服务端签发的不透明 id，对象 key 就是它

协议已经写着 assetKey「在 rename/move 后保持不变」。若把对象存储的路径当 assetKey，用户在
资源浏览器里改一下文件夹名，**图上每一个引用它的实例同时断掉**——而这个错误只在改名之后才
出现，屏幕上没有任何东西解释它。

所以名字与父级住在服务端的表里，对象存储里是扁平的 `assets/{assetKey}`。rename 与 move
因此都是一次 UPDATE，一个字节都不搬。

推论：服务端实现里 `ComposeAssetEntry.id` 与 `assetKey` **可以是同一个值**。协议把两者分开
是因为 File System Access 那类 Provider 只有路径；同值不违反任何一条约束（前端照旧不持久化
`entryId`）。

### D9. 目录是表上的 `parentId`，不是对象前缀

前缀表达不了**空文件夹**——前缀下没有对象就等于它不存在，而资源浏览器允许建空文件夹，
用户建完刷新一下就没了。

### D10. 读走预签名 URL，写分两条路

**读**：`resolveUrl?()` 返回一个浏览器可以直接放进 `<img src>` 的 URL。今天 `resolve()` 返回
`Blob`，一张接线图上几十个符号就是几十个 objectURL 要管生命周期，而且内容要穿过业务服务
两次（对象存储 → 服务 → 浏览器）。

返回值 **MUST 带 `expiresAt`**：签名会过期而一张图可能开着好几个小时，不带它的症状是图在某
一刻**集体变成裂图**。消费方在过期前重取，复用 `subscribe` 那条既有的重解路径。

**写分两条，判据是有没有乐观锁要守**：

| | 走哪条 | 理由 |
|---|---|---|
| 保存页面 / 组件 / 动画（JSON，几十到几百 KB） | `writeFile`，经业务服务 | 有「上一版」要守，`expectedRevision` → `If-Match` 直接映射 |
| 导入 DXF / 位图 / 字体（可能几十 MB） | `createUpload` + `completeUpload` 直传 | 新建，没有上一版可冲突；让它穿过业务服务是纯粹的带宽浪费 |

把保存也改成直传要多一次「回执」握手才能拿到新 revision，而页面文件本来就小，不值。

### D11. 缩略图：客户端画、异步传、可以没有

三种做法里：服务端 headless 渲染要把整个渲染栈搬过去并跟着版本走，不做；打开首页现画
418 张不可行。剩下客户端画一张 PNG 传上去——渲染器只有一份，画出来的一定与编辑器一致。

关键是**把它从保存路径上摘下来**：保存成功之后异步上传，失败不阻断保存，`thumbnailUrl`
**可以为 null**，缺席时图墙画一格占位。这是「把一个静默的错换成一个看得见的错」的又一次
应用——缺一张缩略图用户看得见，而让保存因为一张缩略图失败是不可接受的。

推论：DXF 导入、接口直写这些不经过编辑器的写入方**不必**产出缩略图，它们的记录先没有图。

### D12. 端口上没有鉴权字段

没有 `token`、没有 `userId`。鉴权是 HTTP 适配器的事（请求头里）。放进端口会让本地实现凭空
多出一个它答不了的参数，而那个参数每一个调用点都要传。

### D13. 错误复用 `ComposeAssetError`

`not-found` / `permission-denied` / `conflict` / `invalid-name` / `unsupported` / `io` 这六档
在库这边逐条成立，而 `library` 本来就依赖 `assets`。另起一套同样六档的分类，只会让消费方
把同一个 `switch` 写两遍。

## 端口定义

### `@compose-ui/library`

```ts
/** 页面在库里的性质。恒有，与删除状态正交（见 D1）。 @public */
export type ComposeLibraryKind = 'project' | 'template'

/** 场景类型标签。顺序由服务端给出，就是左栏渲染的顺序。 @public */
export interface ComposeLibraryCategory {
  readonly id: string
  readonly label: string
  /** 内置标签不可删除；省略时按可删除处理。 */
  readonly builtIn?: boolean
}

/** 库里的一条页面记录。 @public */
export interface ComposeLibraryRecord {
  /**
   * 稳定 key，与资源服务上那份 `.page.json` 的 `assetKey` **同值**。
   * 这是两个端口之间唯一的连接点。
   */
  readonly pageKey: string
  readonly title: string
  readonly kind: ComposeLibraryKind
  /** 场景类型标签 id。空数组即「未分类」——未分类不是一个标签（D2）。 */
  readonly categories: readonly string[]
  /** 缺席即还没生成，消费方画占位（D11）。 */
  readonly thumbnailUrl: string | null
  /** 缩略图 URL 的失效时刻（epoch ms）；缺席即不过期。 */
  readonly thumbnailExpiresAt?: number
  /** 激活场景的尺寸；还没量过时为 null。 */
  readonly width: number | null
  readonly height: number | null
  /** 被「就用这个」用作底稿的次数（D5）。 */
  readonly useCount: number
  /** 非 null 即在回收站。 */
  readonly deletedAt: number | null
  readonly createdAt: number
  readonly modifiedAt: number
  /**
   * 页面文件当前的 revision，**只作缓存提示**。
   * 乐观锁的事实来源仍是 `ComposeAssetProvider.read()` 交回的那一个——
   * 两处都当锁用就是两个事实来源。
   */
  readonly revisionHint?: string
}

/** @public */
export type ComposeLibrarySort =
  | 'modified-desc' | 'created-desc' | 'used-desc' | 'title-asc'

/** @public */
export interface ComposeLibraryQuery {
  /** 缺席即不限。 */
  readonly kind?: ComposeLibraryKind
  /** 缺席即 false（不含回收站）。true 时只看回收站，跨 kind。 */
  readonly deleted?: boolean
  /** 成员之间是「或」。`null` 这一档表示未分类。缺席即不限。 */
  readonly categories?: readonly (string | null)[]
  /** 按标题匹配，**不匹配内容**——匹配内容要服务端解析每一份 `.page.json`。 */
  readonly search?: string
  /** 缺席即 `modified-desc`。 */
  readonly sort?: ComposeLibrarySort
  /** 上一页返回的 `nextCursor`。 */
  readonly cursor?: string
  /** 缺席由实现定，建议 48。 */
  readonly limit?: number
  readonly signal?: AbortSignal
}

/** @public */
export interface ComposeLibraryFacets {
  /**
   * 每个场景类型各有多少。
   * MUST 在**摘掉 `categories` 条件、保留其余条件**的前提下求（D3）。
   * `category` 为 `null` 的那一项是未分类。
   */
  readonly byCategory: readonly {
    readonly category: string | null
    readonly count: number
  }[]
  /**
   * 左栏上段三个去处各有多少。
   * MUST 只受 `search` 影响，不受 `kind`/`deleted`/`categories` 影响——
   * 它回答的是「切过去有多少」。
   */
  readonly byLocation: {
    readonly project: number
    readonly template: number
    readonly trash: number
  }
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
  /** 页面文件内容；缺席时服务端落一份空白页面。 */
  readonly content?: Blob
  /** 资源树上的落点；缺席即库的默认目录。 */
  readonly folderId?: string
  readonly signal?: AbortSignal
}

/** 「就用这个」：以一条记录为底新建，并给来源 `useCount` +1。 @public */
export interface ComposeLibraryInstantiateInput {
  readonly sourcePageKey: string
  readonly title: string
  /** 缺席即 `'project'`，**不继承来源**（D6）。 */
  readonly kind?: ComposeLibraryKind
  /** 缺席即继承来源的标签。 */
  readonly categories?: readonly string[]
  readonly folderId?: string
  readonly signal?: AbortSignal
}

/** 只改业务字段；页面内容走资源端口。 @public */
export interface ComposeLibraryUpdateInput {
  readonly pageKey: string
  readonly title?: string
  readonly kind?: ComposeLibraryKind
  readonly categories?: readonly string[]
  readonly signal?: AbortSignal
}

/** 库端口可独立缺席的能力。 @public */
export interface ComposeLibraryCapabilities {
  readonly create: boolean
  readonly update: boolean
  readonly trash: boolean
  /** 彻底删除。 */
  readonly purge: boolean
  readonly thumbnail: boolean
  readonly recents: boolean
}

/** 首页连接的页面库事实来源。 @public */
export interface ComposeLibraryPort {
  readonly id: string
  readonly capabilities: ComposeLibraryCapabilities

  /** 一次调用回答整屏：列表、下一页游标与两组 facet（D3）。 */
  query(input: ComposeLibraryQuery): Promise<ComposeLibraryPage>
  get(input: {
    readonly pageKey: string
    readonly signal?: AbortSignal
  }): Promise<ComposeLibraryRecord>

  /** 有序；顺序就是左栏的渲染顺序（D2）。 */
  listCategories(input?: {
    readonly signal?: AbortSignal
  }): Promise<readonly ComposeLibraryCategory[]>

  create?(input: ComposeLibraryCreateInput): Promise<ComposeLibraryRecord>
  /** 服务端复制，字节不经过浏览器；同一个事务里给来源 +1（D5、D6）。 */
  instantiate?(input: ComposeLibraryInstantiateInput): Promise<ComposeLibraryRecord>
  update?(input: ComposeLibraryUpdateInput): Promise<ComposeLibraryRecord>

  /** 软删除：置 `deletedAt`，**不动文件**。 */
  trash?(input: {
    readonly pageKeys: readonly string[]
    readonly signal?: AbortSignal
  }): Promise<void>
  restore?(input: {
    readonly pageKeys: readonly string[]
    readonly signal?: AbortSignal
  }): Promise<void>
  /** 彻底删除：记录与页面文件一起删。 */
  purge?(input: {
    readonly pageKeys: readonly string[]
    readonly signal?: AbortSignal
  }): Promise<void>

  /** 异步上传缩略图；失败 MUST NOT 影响保存（D11）。 */
  putThumbnail?(input: {
    readonly pageKey: string
    readonly image: Blob
    readonly signal?: AbortSignal
  }): Promise<void>

  recordOpen?(input: {
    readonly pageKey: string
    readonly signal?: AbortSignal
  }): Promise<void>
  listRecents?(input: {
    readonly limit?: number
    readonly signal?: AbortSignal
  }): Promise<readonly ComposeLibraryRecord[]>

  /** 无参数失效通知，与 `ComposeAssetProvider.subscribe` 同语义。 */
  subscribe?(listener: () => void): () => void
}
```

### `@compose-ui/assets` 的三处加法

```ts
/** 可直接交给浏览器的资源 URL。 @public */
export interface ComposeResolvedAssetUrl {
  readonly url: string
  readonly revision: string
  readonly mediaType: string
  /** 失效时刻（epoch ms）。缺席即不过期。消费方 MUST 在过期前重取（D10）。 */
  readonly expiresAt?: number
}

/** 直传大文件的一次授权。 @public */
export interface ComposeAssetUpload {
  readonly uploadUrl: string
  readonly method: 'PUT' | 'POST'
  readonly headers?: Readonly<Record<string, string>>
  readonly expiresAt?: number
  /** 交回 `completeUpload` 的回执凭据。 */
  readonly uploadToken: string
}

// ComposeAssetCapabilities 上新增两档，缺席即按 false 处理：
interface ComposeAssetCapabilities {
  /** 是否能给出直接 URL。 */
  readonly directUrl?: boolean
  /** 是否能授权直传。 */
  readonly directUpload?: boolean
}

// ComposeAssetProvider 上新增三个可选方法，缺席时行为与今天逐字相同：
interface ComposeAssetProvider {
  /** 缺席即退回 `resolveAsset`。 */
  resolveUrl?(input: ResolveAssetInput): Promise<ComposeResolvedAssetUrl>
  /** 只用于**新建**大文件；改已有文件仍走 `writeFile`（D10）。 */
  createUpload?(input: {
    readonly parentId: string
    readonly name: string
    readonly mediaType: string
    readonly size?: number
    readonly signal?: AbortSignal
  }): Promise<ComposeAssetUpload>
  completeUpload?(input: {
    readonly uploadToken: string
    readonly signal?: AbortSignal
  }): Promise<ComposeAssetEntry>
}
```

## 没有后端时：`createProviderLibraryPort({ provider })`

用今天就有的 `ComposeAssetProvider` 实现同一个端口。**这是「现在没有后端」这句话的落点**：
前端整条流程今天跑得通，后端到了只换端口的实现。

- 目录用既有的 `listComposePageDescriptors`（那趟 BFS 降为它的内部实现，**不删**）。
- Provider 答不了的那几个字段落在根目录一份 **`library.json`**：
  `{ version, categories, records: { [pageKey]: { kind, categories, useCount, deletedAt } } }`。
  `title` / `modifiedAt` / `revision` **不进这份文件**——它们在 entry 上，存两份必然漂移。
- **没有记录的页面按默认值补**（`project`、无标签、`useCount 0`），**不要求先注册**：
  用户手动往目录里放一个 `.page.json`，它照样出现在库里。
- 回收站置 `deletedAt`，**文件一动不动**——移动会改 entry id，而且用户在资源浏览器里会看见
  自己的文件凭空消失。
- 缩略图写 `.thumbnails/{pageKey}.png`；`resolveUrl` 缺席时退回 `read` + objectURL。
- facet 与排序在内存里算。418 条量级毫无压力。

**代价写在明处**：`library.json` 是整份重写的，两个标签页同时改会互相覆盖；本地单人用可接受，
这也正是它只是过渡实现的原因。

## HTTP 映射（建议，不是契约）

契约是上面那些 TypeScript 端口。线上怎么走由实现方定，下面这一份能满足它：

| 端口方法 | HTTP |
|---|---|
| `query` | `GET /library/pages?kind=&deleted=&category=&q=&sort=&cursor=&limit=` |
| `get` | `GET /library/pages/{pageKey}` |
| `listCategories` | `GET /library/categories` |
| `create` | `POST /library/pages`（multipart：元数据 + 可选内容） |
| `instantiate` | `POST /library/pages/{pageKey}/instantiate` |
| `update` | `PATCH /library/pages/{pageKey}` |
| `trash` / `restore` / `purge` | `POST /library/pages:trash` / `:restore` / `:purge` |
| `putThumbnail` | `PUT /library/pages/{pageKey}/thumbnail` |
| `recordOpen` / `listRecents` | `POST /library/recents` / `GET /library/recents` |
| `subscribe` | `GET /library/events`（SSE），掉线退回轮询 |
| `list` | `GET /assets/folders/{folderId}/entries` |
| `read` | `GET /assets/{assetKey}/content` |
| `resolveUrl` | `GET /assets/{assetKey}/url` → 预签名 GET |
| `writeFile` | `PUT /assets/{assetKey}/content`，`If-Match: {revision}`，409 → `conflict` |
| `createUpload` / `completeUpload` | `POST /assets/uploads` → 预签名 PUT；`POST /assets/uploads/{token}:complete` |
| `createFolder`/`rename`/`move`/`delete` | `/assets` 上的普通 CRUD，只动表 |

错误映射：404 → `not-found`，403 → `permission-denied`，409/412 → `conflict`，
422 → `invalid-name`，501 → `unsupported`，其余 → `io`。

## 明确不做

- **`list()` 分页**：目录规模由用户自己的组织方式决定，眼下没有消费者被它挡住。真要做时加的是
  一个可选 `cursor` 参数与一个可选 `nextCursor` 返回，既有两个实现不受影响——先不加，
  免得为一个没有消费者的字段定语义。
- **全文检索**：`search` 只匹配标题。匹配内容要服务端解析每一份 `.page.json`。
- **多人协同编辑**：`expectedRevision` 只保证「后写的不会悄悄盖掉先写的」，不是 OT/CRDT。
- **首页宿主应用本身**：这次只落端口与本地实现。
- **权限模型**：`capabilities` 表达「这个端口能不能做」，不表达「这个用户能不能做这一条」。
  后者出现时它是每条记录上的一个字段，与 `ComposeAssetEntry.capabilities` 同构。
