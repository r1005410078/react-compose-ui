/**
 * 页面文件约定、应用清单与页面引用的公共协议。
 *
 * @remarks
 * 页面文件以版本化聚合包装 `ComposeDocument v6` 与可选 setup 脚本引用；视觉模板本身仍保持
 * 独立、严格 JSON，不承载脚本运行值。
 *
 * @packageDocumentation
 */

import type { ComposeDocument, DocumentValidationIssueCode, JsonObject } from '../document-types'

/** 页面文件的名称后缀。 @public */
export const COMPOSE_PAGE_FILE_SUFFIX = '.page.json' as const

/**
 * 页面文件的媒体类型。
 *
 * @remarks
 * Asset Provider 应为页面文件上报该媒体类型，宿主据此在不解析文件内容的前提下识别页面。
 * @public
 */
export const COMPOSE_PAGE_MEDIA_TYPE = 'application/vnd.compose-ui.page+json' as const

/** 资源根应用清单的文件名。 @public */
export const COMPOSE_APP_MANIFEST_FILE_NAME = 'app.json' as const

/** 当前支持的应用清单版本。 @public */
export const COMPOSE_APP_MANIFEST_SCHEMA_VERSION = 1 as const

/** 当前页面聚合文件版本。 @public */
export const COMPOSE_PAGE_SCHEMA_VERSION = 3 as const

/** 页面 setup 脚本的稳定资源引用。 @public */
export interface ComposePageSetupReference extends JsonObject {
  readonly [key: string]: string
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
}

/**
 * 页面绑定动画文件的稳定资源引用。
 *
 * @remarks
 * 与 {@link ComposePageSetupReference} 同形：按 providerId + assetKey 引用，动画文件随后
 * 重命名或移动不改变页面关联。页面只保存引用；动画文件内容由 `@compose-ui/animation`
 * 的文件协议解析，core 不理解它。
 * @public
 */
export interface ComposePageAnimationReference extends JsonObject {
  readonly [key: string]: string
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
}

/** 页面视觉模板与可选 setup 脚本、动画文件引用的版本化聚合文件。 @public */
export interface ComposePageFile {
  readonly kind: 'compose-page'
  readonly pageSchemaVersion: typeof COMPOSE_PAGE_SCHEMA_VERSION
  readonly document: ComposeDocument
  readonly setupScript: ComposePageSetupReference | null
  /**
   * 页面的激活 Frame（界面上称「激活场景」）。
   *
   * @remarks
   * 它是这个页面对外发布哪一块的事实来源：预览的默认目标、以及「生成真实页面」时渲染的
   * Frame 都取它；没有任何选择时，Frame 相关动作也回退到它。它 MUST NOT 覆盖显式选择——
   * 选中另一个 Frame 时那个才是动作目标。必须指向 `document.rootIds` 中的一个 Frame；
   * 缺省时读取侧回退到第一个根 Frame，用 {@link resolveComposePageActiveFrameId} 解析。
   */
  readonly activeFrameId?: string | null
}

/** 页面文件解析问题的稳定机器码。 @public */
export type ComposePageFileIssueCode =
  | 'page.invalid-json'
  | 'page.invalid-shape'
  | 'page.unsupported-version'
  | 'page.invalid-setup-reference'
  | 'page.invalid-animation-reference'
  | 'page.invalid-active-frame'
  | DocumentValidationIssueCode

/** 页面文件中一个可定位的问题。 @public */
export interface ComposePageFileIssue {
  readonly code: ComposePageFileIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
}

/**
 * 资源根应用清单。
 *
 * @remarks
 * 首页由清单唯一表达，页面文档自身不携带首页标记，避免出现多首页或无首页的不一致状态。
 * @public
 */
export interface ComposeAppManifest {
  readonly schemaVersion: typeof COMPOSE_APP_MANIFEST_SCHEMA_VERSION
  /** 首页页面的稳定资源 key；未指定首页时为 null。 */
  readonly homePageKey: string | null
}

/**
 * 指向一个页面的引用值。
 *
 * @remarks
 * 字段刻意与 `ComposeAssetReference` 同名，因此可由资源引用展开后附加 `kind` 派生；
 * 索引签名使其保持为扁平字符串映射，可直接嵌入 Renderer props 等 `JsonObject` 位置。
 * `core` 不依赖 `@compose-ui/assets`，两者只是结构兼容。
 * @public
 */
export interface ComposePageReference extends JsonObject {
  readonly [key: string]: string
  readonly kind: 'page'
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
}

/**
 * 按页面引用加载页面聚合的宿主端口。
 *
 * @remarks
 * 这里只声明协议：`core` 不实现加载，`@compose-ui/pages` 提供由页面 Store 派生的默认实现。
 * 由于本类型是纯协议，Stage 与 Preview 接受该端口时不会因此依赖任何实现包。
 * @public
 */
export interface ComposePageLoader {
  /**
   * 加载被引用页面的聚合文件。
   *
   * @param signal - 调用方取消加载的信号；实现必须在取消后停止工作并拒绝该 Promise。
   * @throws 页面不存在、无权限或内容不合法时抛出错误，调用方负责呈现失败状态。
   */
  load(reference: ComposePageReference, signal?: AbortSignal): Promise<ComposePageFile>
  /**
   * 订阅被引用页面的变更。
   *
   * @returns 取消订阅的函数；实现缺省该方法时调用方不做增量刷新。
   */
  subscribe?(reference: ComposePageReference, listener: () => void): () => void
}


/** 导航失败的稳定原因。 @public */
export type ComposeNavigationIssueCode =
  /** 目标 `assetKey` 在当前 Provider 中找不到对应页面。 */
  | 'navigation.target-missing'
  /** 目标页面存在但读取或解析失败。 */
  | 'navigation.load-failed'

/**
 * 一次失败跳转的可判别说明。
 *
 * @remarks
 * 「目标不存在」与「读取失败」必须可区分：前者是引用错了或页面被删了，后者是 Provider
 * 出问题，两者对用户的下一步操作完全不同。
 * @public
 */
export interface ComposeNavigationIssue {
  readonly code: ComposeNavigationIssueCode
  readonly reference: ComposePageReference
  readonly message: string
  readonly cause?: unknown
}

/**
 * 导航状态的只读快照。
 *
 * @remarks
 * 实现必须在状态未变化时返回**同一个对象引用**——React 消费方使用 `useSyncExternalStore`，
 * 每次调用都新建对象会造成无限重渲染。
 * @public
 */
export interface ComposeNavigationSnapshot {
  /** 当前页面的稳定资源 key；未设首页且宿主未指定初始页面时为 null。 */
  readonly currentPageKey: string | null
  /**
   * 当前页面的完整引用。
   *
   * @remarks
   * 与 `currentPageKey` 同源，单独给出是因为渲染入口需要一个完整引用才能调用
   * {@link ComposePageLoader}，只有 key 时它还得自己拼 providerId 与 scope。
   */
  readonly current: ComposePageReference | null
  /** 返回栈是否非空。 */
  readonly canGoBack: boolean
  /** 最近一次失败跳转的说明；成功跳转后清空。 */
  readonly issue: ComposeNavigationIssue | null
}

/**
 * 页面导航的宿主端口。
 *
 * @remarks
 * 与 {@link ComposePageLoader} 同样只是协议：`core` 不实现导航，`@compose-ui/pages` 提供
 * 由页面目录派生的默认实现，渲染入口只消费本类型，因此不会因此依赖实现包。
 *
 * 声明式 `Interaction` 与页面脚本的 `navigate` 必须委托同一个端口实例，否则两条路径会各自
 * 维护一份当前页面与返回栈。
 * @public
 */
export interface ComposeNavigationPort {
  /** 读取当前快照；状态未变化时必须返回同一引用。 */
  getSnapshot(): ComposeNavigationSnapshot
  /**
   * 跳转到目标页面。
   *
   * @param params - 预留的跳转参数；v1 的实现不消费它。
   * @remarks 目标不可解析时实现必须停留在当前页面并在快照中发布 issue，而不是抛出。
   */
  navigate(reference: ComposePageReference, params?: JsonObject): Promise<void>
  /** 返回上一页；返回栈为空时是无副作用的 no-op。 */
  back(): Promise<void>
  /**
   * 由页面 key 构造完整引用。
   *
   * @remarks
   * `providerId` 与 `scope` 只有实现知道，所以引用构造归端口。声明式 `Interaction` 存的
   * 已经是完整引用，这个方法服务于只拿得到 key 的调用方——例如页面脚本里的
   * `ctx.navigate('pages/detail.page.json')`。
   */
  referenceFor(pageKey: string): ComposePageReference
  /**
   * 把会话起点设到指定页面。
   *
   * @remarks
   * 同步、不验证目标、不进返回栈——它表达的是"这次会话从这里开始"。渲染入口用它把起点
   * 对齐到宿主正在编辑的那一页：会话没有起点时跳转无法记录来路，返回就成了死键。
   * 传 null 回到"无当前页面"。
   */
  reset(pageKey: string | null): void
  /** 订阅快照变化。 @returns 取消订阅的函数。 */
  subscribe(listener: () => void): () => void
}
