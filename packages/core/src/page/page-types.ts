/**
 * 页面文件约定、应用清单与页面引用的公共协议。
 *
 * @remarks
 * 页面就是一份未经扩展的 `ComposeDocument v6`，以名称后缀区分，因此本模块不改变
 * `ComposeDocument` 的形状，也不引入多文档协议。
 *
 * @packageDocumentation
 */

import type { ComposeDocument, JsonObject } from '../document-types'

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
 * 页面嵌套渲染的判定结果。
 *
 * @remarks
 * `cycle` 与 `depth-exceeded` 都要求调用方停止加载并呈现警示，而不是回退为空内容 ——
 * 否则用户无法区分「引用错了」和「目标页面是空的」。
 * @public
 */
export type ComposePageNestState = 'ok' | 'cycle' | 'depth-exceeded'

/**
 * 按页面引用加载页面文档的宿主端口。
 *
 * @remarks
 * 这里只声明协议：`core` 不实现加载，`@compose-ui/pages` 提供由页面 Store 派生的默认实现。
 * 由于本类型是纯协议，Stage 与 Preview 接受该端口时不会因此依赖任何实现包。
 * @public
 */
export interface ComposePageDocumentLoader {
  /**
   * 加载被引用页面的文档。
   *
   * @param signal - 调用方取消加载的信号；实现必须在取消后停止工作并拒绝该 Promise。
   * @throws 页面不存在、无权限或内容不合法时抛出错误，调用方负责呈现失败状态。
   */
  load(reference: ComposePageReference, signal?: AbortSignal): Promise<ComposeDocument>
  /**
   * 订阅被引用页面的变更。
   *
   * @returns 取消订阅的函数；实现缺省该方法时调用方不做增量刷新。
   */
  subscribe?(reference: ComposePageReference, listener: () => void): () => void
}
