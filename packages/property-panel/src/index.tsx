/**
 * 提供由 Valibot Schema 驱动、受控且可扩展的 React 组件属性面板。
 *
 * @remarks
 * 外部样式契约：结构容器输出 `data-property-part`，取值为 `toolbar`、`separator`、`fields`、
 * `ungrouped`、`field`、`label`、`editor`、`actions`、`control`；字段另外输出
 * `data-property-path`、`data-property-layout`、`data-property-depth` 与 `data-property-nested`。
 * 需要重排属性面板外壳的消费方只能依赖这些属性。`property-panel__*` 类名是实现细节，
 * 会随内部重构变化，不承诺稳定。
 *
 * @packageDocumentation
 */
import './styles.css'

export { ComposePropertyPanelBindingTargetRow } from './binding-target-row'
export type { ComposePropertyPanelBindingTargetRowProps } from './binding-target-row'

export {
  ComposePropertyPanel,
  ComposePropertyPanelRoot,
  ComposePropertyPanelSection,
} from './property-panel'
// eslint-disable-next-line react-refresh/only-export-components -- 这是无 JSX 的公共 Hook 入口，Provider 内部状态不会被热更新保留。
export { useComposePropertyPanelColorEditorPort } from './property-panel/editor-ports'
// eslint-disable-next-line react-refresh/only-export-components -- 这是无 JSX 的公共 Hook 入口，Provider 内部状态不会被热更新保留。
export { useComposePropertyPanelPaintEditorPort } from './property-panel/editor-ports'
// eslint-disable-next-line react-refresh/only-export-components -- 这是无 JSX 的公共 Hook 入口，Provider 内部状态不会被热更新保留。
export { useComposePropertyPanelNodeEditorPort } from './property-panel/editor-ports'
// eslint-disable-next-line react-refresh/only-export-components -- 公开纯绑定解析函数与组件共用包入口。
export { resolveComposePropertyBindings } from './property-panel'
export { PROPERTY_PANEL_BASE_EDITOR_IDS as COMPOSE_PROPERTY_PANEL_BASE_EDITOR_IDS } from './semantic-editors'
export type {
  ComposeResolvePropertyBindingsOptions,
  ComposeResolvePropertyBindingsResult,
  ComposePropertyPath,
  ComposePropertyPanelRendererLayout,
  ComposePropertyPanelBindingAddress,
  ComposePropertyPanelVariable,
  ComposePropertyPanelBinding,
  ComposePropertyPanelBindingTarget,
  ComposePropertyPanelResolvedBindingTarget,
  ComposePropertyPanelBindingIssue,
  ComposePropertyPanelRendererBindingTargetDescriptor,
  ComposePropertyPanelRendererBindingTargetsContext,
  ComposePropertyPanelRendererBindingTargetState,
  ComposePropertyPanelRendererBindingController,
  ComposePropertyPanelBindingTriggerRendererProps,
  ComposePropertyPanelBindingPickerRendererProps,
  ComposePropertyPanelBindingTriggerRenderer,
  ComposePropertyPanelBindingPickerRenderer,
  ComposePropertyPanelBindingConfig,
  ComposePropertyPanelMetadataBinding,
  ComposePropertyPanelSizePreset,
  ComposePropertyPanelChangeReason,
  ComposePropertyPanelMetadata,
  ComposePropertyPanelHeader,
  ComposePropertyPanelChange,
  ComposePropertyPanelInlineValueProps,
  ComposePropertyPanelRendererProps,
  ComposePropertyPanelRenderer,
  ComposePropertyPanelProps,
  ComposePropertyPanelRootProps,
  ComposePropertyPanelSectionProps,
} from './property-panel'
export type {
  ComposePropertyPanelColorEditorPort,
  ComposePropertyPanelNodeCandidate,
  ComposePropertyPanelNodeEditorPort,
  ComposePropertyPanelPaintEditorPort,
} from './property-panel/editor-ports'
export type { PropertyPanelBaseEditorId as ComposePropertyPanelBaseEditorId } from './semantic-editors'
