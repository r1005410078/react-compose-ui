export {
  composeComponentFileName,
  isComposeComponentFileName,
  isComposeComponentMediaType,
  migrateLegacyComposeComponentAsset,
  parseComposeComponentAsset,
  serializeComposeComponentAsset,
} from './component-file'
export { applyComposeComponentOverrides } from './component-overrides'
export {
  diffComposeComponentDocuments,
  planComposeComponentRevert,
  type ComposeComponentDiffResult,
  type ComposeComponentRevertPlan,
} from './component-diff'
export {
  createComposeResolvedComponentSnapshot,
  resolveComposeComponentAsset,
} from './component-resolver'
export {
  COMPOSE_COMPONENT_FILE_SUFFIX,
  COMPOSE_COMPONENT_MEDIA_TYPE,
  COMPOSE_COMPONENT_NEST_DEPTH_LIMIT,
  COMPOSE_COMPONENT_SCHEMA_VERSION,
} from './component-types'
export type {
  ComposeBaseComponentAsset,
  ComposeComponentAddComponentOperation,
  ComposeComponentAddEntityOperation,
  ComposeComponentAssetIssue,
  ComposeComponentAssetIssueCode,
  ComposeComponentAssetParseResult,
  ComposeComponentAssetV1,
  ComposeComponentLineageEntry,
  ComposeComponentMoveEntityOperation,
  ComposeComponentOverrideApplyResult,
  ComposeComponentOverrideOperation,
  ComposeComponentPropertyDefinition,
  ComposeComponentPropertyTarget,
  ComposeComponentPropertyValueType,
  ComposeComponentReference,
  ComposeComponentRemoveComponentOperation,
  ComposeComponentRemoveEntityOperation,
  ComposeComponentRemoveFieldOperation,
  ComposeComponentResolveResult,
  ComposeComponentSetFieldOperation,
  ComposeLoadedComponentAsset,
  ComposeResolvedComponentSnapshot,
  ComposeVariantComponentAsset,
  ResolveComposeComponentAssetInput,
} from './component-types'
