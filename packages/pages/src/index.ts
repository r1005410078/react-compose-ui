/**
 * 提供页面目录、应用清单与页面文档的无框架事实来源。
 *
 * @remarks
 * 本包无 React、无 DOM，只依赖 `@compose-ui/core` 的页面协议与 `@compose-ui/assets` 的
 * Provider 端口。编辑器与独立预览运行时共用同一 Store，因此页面加载不依赖编辑器。
 *
 * @packageDocumentation
 */

export { listComposePageDescriptors } from './page-catalog'
export type { ComposePageDescriptor } from './page-catalog'
export { createComposePageDocumentLoader, createComposePageLoader } from './page-document-loader'
export {
  COMPOSE_NAVIGATION_BACK_STACK_LIMIT,
  createComposeNavigationSession,
} from './navigation-session'
export type {
  ComposeNavigationSession,
  CreateComposeNavigationSessionOptions,
} from './navigation-session'
export { createComposePageStore } from './page-store'
export type {
  ComposePageCatalog,
  ComposePageSnapshot,
  ComposePageStore,
  ComposePageStoreEvent,
  CreateComposePageInput,
} from './page-store'

/** `@compose-ui/pages` 的稳定包标识。 @public */
export const COMPOSE_UI_PAGES_PACKAGE = '@compose-ui/pages' as const
