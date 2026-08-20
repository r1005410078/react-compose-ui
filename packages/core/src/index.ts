/**
 * 提供 React Compose UI 的可序列化文档、同步命令与通用领域逻辑。
 *
 * @remarks
 * 本包保持与 React 和 DOM 无关。React 编辑器、Stage 与 Preview 只能通过这里的公共协议共享
 * 文档，不得引用彼此内部源码。
 *
 * @packageDocumentation
 */

export {
  createComposeEdges,
  adoptComposeCrossAxisSizing,
  createDefaultComposeLayoutItem,
  createDefaultComposeFlexLayout,
  createFixedComposeAxisSizing,
  isValidComposeLayoutItem,
  isValidComposeLayout,
} from './layout'
export {
  isValidComposeTransform,
  isValidComposeSpatialTransform,
  isValidComposeGeometryConstraints,
  validateComposeDocument,
} from './document'
export {
  findComposeAnimation,
  getComposeAnimations,
  getFrameAnimations,
  resolveAnimationHostFrameId,
} from './animations'
export { createDefaultCanvasSettings } from './canvas-settings'
export {
  COMPOSE_GEOMETRY_PRECISION,
  formatComposeNumber,
  roundComposeGeometry,
} from './geometry-precision'
export {
  COMPOSE_DEFAULT_FRAME_SIZE,
  COMPOSE_DEFAULT_SCENE_APPEARANCE,
  COMPOSE_SCENE_SIZE_PRESETS,
  createComposeFrame,
  createComposeFrameEntity,
  findComposeSceneSizePreset,
  formatComposeSceneSize,
  formatComposeSceneSizePresetLabel,
  getComposeFrame,
  getComposeFrameGuides,
  isComposeFrameEntity,
  isWithinFrame,
  listComposeFrameIds,
  promoteComposeEntityToFrame,
  resolveOwningFrameId,
} from './frame'
export type { ComposeSceneSizePreset } from './frame'
export {
  COMPOSE_GROUP_PRESET_ID,
  createComposeGroupEntitySeed,
  isComposeGroupEntity,
  isComposeUngroupableEntity,
  isLegacyComposeGroupEntity,
} from './group'
export type { CreateComposeGroupEntitySeedInput } from './group'
export * from './component'
export {
  DEFAULT_COMPOSE_APPEARANCE,
  DEFAULT_COMPOSE_SHADOW,
  resolveComposeAppearance,
} from './appearance'
export {
  DEFAULT_COMPOSE_BACKGROUND_PAINT,
  describeComposePaint,
  evaluateComposePaintAtLocalPoint,
  isComposeColor,
  isValidComposePaint,
  normalizeComposeColor,
  normalizeComposePaint,
} from './paint'
export type {
  ComposeAngularGradientPaint,
  ComposeColor,
  ComposeGradientStop,
  ComposeImageFit,
  ComposeImagePaint,
  ComposeImagePaintOverlay,
  ComposeLinearGradientPaint,
  ComposePaint,
  ComposePaintImageAsset,
  ComposePaintPoint,
  ComposePaintRenderDescriptor,
  ComposeRadialGradientPaint,
  ComposeSolidPaint,
} from './paint'
export {
  getComposeAppearance,
  getComposeBindings,
  getComposeClip,
  getComposeComponent,
  getComposeComposition,
  getComposeGeometryConstraints,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeLock,
  getComposeLayout,
  getComposeRenderer,
  getComposeSpatialTransform,
  getComposeTransform,
  getComposeVisibility,
  getComposeWidgetSwitcher,
  isComposeComponentKey,
  isComposeContainerEntity,
  isComposeEntityLocked,
  isComposeEntityVisible,
  normalizeComposeOverflow,
  resolveComposeGeometryConstraints,
  resolveComposeOverflow,
} from './entity'
export {
  collectComposeSwitcherHiddenIds,
  isValidComposeWidgetSwitcher,
  resolveComposeActiveChildId,
  resolveComposeRenderedChildIds,
  resolveComposeSwitcherPreview,
} from './widget-switcher'
export type { ComposeWidgetSwitcherPreview } from './widget-switcher'
export { applyDocumentPatches, jsonEqual } from './patches'
export { createTransactionRuntime } from './runtime'
export {
  migrateComposeDocumentV5ToV7,
  migrateComposeDocumentV6ToV7,
} from './migration'
export type { ComposeDocumentMigrationResult } from './migration'
export {
  BUILTIN_COMMAND_TYPES,
  createBuiltinCommandHandlers,
  createComposeBatchCommand,
} from './builtin-commands'
export type {
  ApplyDocumentPatchesResult,
  CommandDispatchResult,
  CommandHandler,
  CommandHandlerResult,
  CommandIssue,
  DocumentPatch,
  DocumentPath,
  EditorCommand,
  EditorCommandMeta,
  EditorTransaction,
  InsertDocumentPatch,
  MoveDocumentPatch,
  PatchIssue,
  RemoveDocumentPatch,
  SetDocumentPatch,
  TransactionHistoryEntry,
  TransactionResetResult,
  TransactionRuntime,
  TransactionRuntimeEvent,
  TransactionRuntimeOptions,
  TransactionRuntimeState,
} from './command-types'
export type {
  ComposeAnimation,
  ComposeAnimationBindings,
  ComposeAnimationPlaybackMode,
  ComposeAppearance,
  ComposeBindings,
  ComposeAxisSizing,
  ComposeBuiltinComponentKey,
  ComposeAnimations,
  ComposeFrame,
  ComposeFrameGuide,
  ComposeCanvasSettings,
  ComposeClip,
  ComposeComposition,
  ComposeDocument,
  ComposeEdges,
  ComposeEntity,
  ComposeGeometryConstraints,
  ComposeHierarchy,
  ComposeLayout,
  ComposeLayoutDiagnostic,
  ComposeLayoutMeasurementDiagnostic,
  ComposeLayoutItem,
  ComposeLayoutMeasurementPort,
  ComposeLayoutSnapshot,
  ComposeLock,
  ComposeMeasureConstraint,
  ComposeMeasuredSize,
  ComposePageExportReference,
  ComposeRendererPropsBindings,
  ComposeOverflowMode,
  ComposePosition,
  ComposeRenderer,
  ComposeResolvedLayoutBox,
  ComposeResolvedOverflow,
  ComposeResizeMode,
  ComposeShadow,
  ComposeSize,
  ComposeSpatialTransform,
  ComposeTransform,
  ComposeVisibility,
  ComposeWidgetSwitcher,
  ComposeAlignContent,
  ComposeAlignItems,
  ComposeFlexDirection,
  ComposeFlexLayout,
  ComposeFlexWrap,
  ComposeJustifyContent,
  DocumentValidationIssue,
  DocumentValidationIssueCode,
  DocumentValidationResult,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ResolvedComposeAppearance,
} from './document-types'
export { COMPOSE_BUILTIN_COMPONENT_KEYS } from './document-types'
export {
  COMPOSE_APP_MANIFEST_FILE_NAME,
  COMPOSE_APP_MANIFEST_SCHEMA_VERSION,
  COMPOSE_PAGE_FILE_SUFFIX,
  COMPOSE_PAGE_MEDIA_TYPE,
  COMPOSE_PAGE_SCHEMA_VERSION,
  COMPOSE_PAGE_NEST_DEPTH_LIMIT,
  composePageDisplayName,
  composePageFileName,
  createEmptyComposeAppManifest,
  createEmptyComposePageDocument,
  createEmptyComposePageFile,
  isComposePageFileName,
  isComposePageMediaType,
  migrateComposePageFileV2ToV3,
  migrateLegacyComposePageFile,
  parseComposeAppManifest,
  parseComposePageFile,
  resolveComposePageActiveFrameId,
  parseComposePageDocument,
  readComposePageReference,
  resolveComposePageNestState,
  serializeComposeAppManifest,
  serializeComposePageDocument,
  serializeComposePageFile,
  setComposeAppManifestHomePage,
} from './page'
export type {
  ComposeAppManifest,
  ComposeAppManifestIssue,
  ComposeAppManifestIssueCode,
  ComposeAppManifestParseResult,
  ComposePageAnimationReference,
  ComposePageDocumentLoader,
  ComposePageFile,
  ComposePageFileIssue,
  ComposePageFileIssueCode,
  ComposePageLoader,
  ComposePageMigrationResult,
  ComposePageNestState,
  ComposePageParseResult,
  ComposePageReference,
  ComposePageSetupReference,
  ResolveComposePageNestStateInput,
} from './page'

/** `@compose-ui/core` 的稳定包标识。 @public */
export const COMPOSE_UI_CORE_PACKAGE = '@compose-ui/core' as const
