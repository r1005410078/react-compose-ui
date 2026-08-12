import type {
  ComposeComponentAssetV1,
  ComposeResolvedComponentSnapshot,
  TransactionRuntime,
} from '@compose-ui/core'
import type { ComposeComponentStore } from '@compose-ui/component-library'

/** 当前活动组件或变体会话的对外描述。 @public */
export interface ComposeEditorActiveComponentSession {
  readonly assetKey: string
  readonly displayName: string
  readonly kind: ComposeComponentAssetV1['kind']
  readonly runtime: TransactionRuntime
  readonly snapshot: ComposeResolvedComponentSnapshot
}

/** Editor 的项目组件工作区集成配置。 @public */
export interface ComposeEditorComponentsConfig {
  /** 项目组件 Store；省略时复用 Controller 上的 Store。 */
  readonly store?: ComposeComponentStore
  /** 活动 Base/Variant 标签变化；宿主据此把其 runtime 交给 Controller。 */
  readonly onActiveSessionChange?: (
    session: ComposeEditorActiveComponentSession | null,
  ) => void
}
