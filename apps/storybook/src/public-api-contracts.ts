/**
 * vNext 公共 API 的编译期夹具。
 *
 * 该文件由 Storybook workspace 的 typecheck 编译：一方面固定 Compose 前缀的正式入口，另一方面
 * 用 `@ts-expect-error` 防止 legacy facade、独立 locale prop 和 Preview children 模式被重新导出。
 */
import type { ComposeAssetBrowserProps } from '@compose-ui/asset-browser'
import * as assetBrowser from '@compose-ui/asset-browser'
import * as commandPanel from '@compose-ui/command-panel'
import * as components from '@compose-ui/components'
import * as editor from '@compose-ui/editor'
import * as history from '@compose-ui/history'
import * as materials from '@compose-ui/materials'
import * as operationLog from '@compose-ui/operation-log'
import * as preview from '@compose-ui/preview'
import * as sceneTree from '@compose-ui/scene-tree'
import * as stage from '@compose-ui/stage'
import type { ComposeCommandPanelProps } from '@compose-ui/command-panel'
import type { ComposeEditorProps } from '@compose-ui/editor'
import type { ComposePreviewProps } from '@compose-ui/preview'

type Assert<T extends true> = T
type IncludesKey<T, TKey extends PropertyKey> = TKey extends keyof T ? true : false

const publicVisualExports = [
  components.ComposeTree,
  commandPanel.ComposeCommandPanel,
  history.ComposeHistoryPanel,
  operationLog.ComposeOperationLogPanel,
  sceneTree.ComposeSceneTree,
  stage.ComposeStage,
  stage.ComposeComponentPalette,
  editor.ComposeEditor,
  preview.ComposePreview,
  assetBrowser.ComposeAssetBrowser,
  materials.DEFAULT_COMPOSE_RECTANGLE_PRESET,
] as const

void publicVisualExports

type _CommandPanelHasNoLocale = Assert<IncludesKey<ComposeCommandPanelProps, 'locale'> extends false ? true : false>
type _AssetBrowserHasNoLocale = Assert<IncludesKey<ComposeAssetBrowserProps, 'locale'> extends false ? true : false>
type _EditorHasNoLegacySlots = Assert<
  IncludesKey<ComposeEditorProps, 'canvasToolbar'> extends false
    ? IncludesKey<ComposeEditorProps, 'assetBrowserProps'> extends false
      ? IncludesKey<ComposeEditorProps, 'children'> extends false ? true : false
      : false
    : false
>
type _PreviewHasNoChildren = Assert<IncludesKey<ComposePreviewProps, 'children'> extends false ? true : false>

void (undefined as unknown as _CommandPanelHasNoLocale)
void (undefined as unknown as _AssetBrowserHasNoLocale)
void (undefined as unknown as _EditorHasNoLegacySlots)
void (undefined as unknown as _PreviewHasNoChildren)

// @ts-expect-error vNext 仅保留 ComposeTree。
type _LegacyTree = components.Tree
// @ts-expect-error vNext 仅保留 ComposeStage。
type _LegacyStage = stage.Stage
// @ts-expect-error Preview 不再导出 legacy 名称。
type _LegacyPreview = preview.Preview
// @ts-expect-error Theme/Locale 兼容别名已删除。
type _LegacyEditorLocale = editor.ComposeEditorLocale
// @ts-expect-error Asset Browser 不再转导资源事实来源协议。
type _ForwardedAssetProvider = assetBrowser.ComposeAssetProvider
// @ts-expect-error 默认物料常量已采用 DEFAULT_COMPOSE_* 命名。
type _LegacyDefaultMaterialDefinition = materials.DEFAULT_RECTANGLE_DEFINITION
// @ts-expect-error v4 Registry 只公开 Entity 组合协议。
type _LegacyComponentRegistry = typeof import('@compose-ui/component-registry').ComposeComponentRegistry
// @ts-expect-error Stage 不再导出独立 Frame Preset。
type _LegacyFramePreset = stage.ComposeStageFramePreset

void (undefined as unknown as _LegacyTree)
void (undefined as unknown as _LegacyStage)
void (undefined as unknown as _LegacyPreview)
void (undefined as unknown as _LegacyEditorLocale)
void (undefined as unknown as _ForwardedAssetProvider)
void (undefined as unknown as _LegacyDefaultMaterialDefinition)
void (undefined as unknown as _LegacyComponentRegistry)
void (undefined as unknown as _LegacyFramePreset)
