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
  isValidComposeTransform,
  isValidComposeTransformConstraints,
  validateComposeDocument,
} from './document'
export { createDefaultCanvasSettings } from './canvas-settings'
export { createDefaultOutputSettings } from './output-settings'
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
  getComposeClip,
  getComposeComponent,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLock,
  getComposeRenderer,
  getComposeTransform,
  getComposeTransformConstraints,
  getComposeVisibility,
  isComposeComponentKey,
  isComposeContainerEntity,
  isComposeEntityLocked,
  isComposeEntityVisible,
  resolveComposeTransformConstraints,
} from './entity'
export { applyDocumentPatches } from './patches'
export { createTransactionRuntime } from './runtime'
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
  ComposeAppearance,
  ComposeBuiltinComponentKey,
  ComposeCanvasGuide,
  ComposeCanvasSettings,
  ComposeClip,
  ComposeComposition,
  ComposeDocument,
  ComposeEntity,
  ComposeHierarchy,
  ComposeLock,
  ComposeOutputSettings,
  ComposePosition,
  ComposeRenderer,
  ComposeResizeMode,
  ComposeShadow,
  ComposeSize,
  ComposeTransform,
  ComposeTransformConstraints,
  ComposeVisibility,
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

/** `@compose-ui/core` 的稳定包标识。 @public */
export const COMPOSE_UI_CORE_PACKAGE = '@compose-ui/core' as const
