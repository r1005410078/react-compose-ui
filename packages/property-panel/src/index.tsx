/**
 * 提供由 Valibot Schema 驱动、受控且可扩展的 React 组件属性面板。
 *
 * @packageDocumentation
 */
import './styles.css'

export { ComposePropertyPanel } from './property-panel'
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
  ComposePropertyPanelRendererProps,
  ComposePropertyPanelRenderer,
  ComposePropertyPanelProps,
} from './property-panel'
export type { PropertyPanelBaseEditorId as ComposePropertyPanelBaseEditorId } from './semantic-editors'
