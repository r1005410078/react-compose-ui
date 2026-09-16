/**
 * 页面库端口：首页那一屏的业务目录事实来源。
 *
 * @remarks
 * 本包无 React、无 DOM，只依赖 `@compose-ui/core` 与 `@compose-ui/assets`。
 *
 * 它**不放进 `@compose-ui/pages`**：那个包的边界是页面清单、聚合 Store 与运行时导航，而首页
 * 是一个可以完全不加载编辑器的宿主；让它为一份业务目录把导航会话一起装上是多余的，而权限、
 * 审计、协作这些迟早要长在库端口上的东西，一样都不该进 `pages`。
 *
 * 库端口与资源端口（`ComposeAssetProvider`）是**两个端口，不是两个服务**：库记录与资源记录
 * 一对一挂在同一个 key 上（`pageKey === assetKey`），实现上完全可以是同一张表的几个业务列。
 *
 * @packageDocumentation
 */

export type {
  ComposeLibraryCapabilities,
  ComposeLibraryCategory,
  ComposeLibraryCategoryFacet,
  ComposeLibraryCreateInput,
  ComposeLibraryError,
  ComposeLibraryFacets,
  ComposeLibraryInstantiateInput,
  ComposeLibraryKeysInput,
  ComposeLibraryKind,
  ComposeLibraryLocationFacet,
  ComposeLibraryPage,
  ComposeLibraryPort,
  ComposeLibraryQuery,
  ComposeLibraryRecord,
  ComposeLibrarySort,
  ComposeLibraryThumbnailInput,
  ComposeLibraryUpdateInput,
} from './port'

export {
  COMPOSE_LIBRARY_DEFAULT_LIMIT,
  COMPOSE_LIBRARY_FILE_NAME,
  COMPOSE_LIBRARY_FILE_VERSION,
  COMPOSE_LIBRARY_MEDIA_TYPE,
  COMPOSE_LIBRARY_THUMBNAIL_FOLDER,
  computeComposeLibraryFacets,
  createEmptyComposeLibraryFile,
  createProviderLibraryPort,
  matchesComposeLibraryQuery,
  paginateComposeLibraryRecords,
  parseComposeLibraryFile,
  serializeComposeLibraryFile,
  sortComposeLibraryRecords,
} from './provider-port'
export type {
  ComposeLibraryFile,
  ComposeLibraryFileRecord,
  ComposeLibraryPageDescriptor,
  CreateProviderLibraryPortOptions,
} from './provider-port'

/** `@compose-ui/library` 的稳定包标识。 @public */
export const COMPOSE_UI_LIBRARY_PACKAGE = '@compose-ui/library' as const
