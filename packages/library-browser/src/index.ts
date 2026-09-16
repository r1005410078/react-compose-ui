/**
 * 页面库那一屏：应用的入口。
 *
 * @remarks
 * 受控 React Widget，消费 `@compose-ui/library` 的 `ComposeLibraryPort`，与
 * `@compose-ui/asset-browser` 之于 `assets` 同构。**不依赖 `editor` 与 `stage`**：页面库是一个
 * 可以完全不加载编辑器的宿主，编辑器只是把它当作一个领域组件挂上。
 *
 * 样式在 `@compose-ui/library-browser/styles.css`。
 *
 * @packageDocumentation
 */

import './styles.css'

export { ComposeLibraryBrowser } from './library-browser'
export type {
  ComposeLibraryBrowserProps,
  ComposeLibraryLocation,
  ComposeLibrarySection,
  ComposeLibraryView,
  ComposeLibraryViewState,
} from './library-browser'
export { LibraryDemoScreen } from './demo-screen'

/** `@compose-ui/library-browser` 的稳定包标识。 @public */
export const COMPOSE_UI_LIBRARY_BROWSER_PACKAGE = '@compose-ui/library-browser' as const
