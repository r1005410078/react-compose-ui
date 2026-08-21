/**
 * 无 React、无 DOM 的 CAD 文档协议与资源 Store。
 *
 * @remarks
 * `CadDocument` 复用 ComposeDocument 的 ECS 底座——Entity 结构、Patch 代数、事务运行时、
 * Undo/Redo 与序列化全部共用，差异只在校验器与 Component 词汇。因此这里没有第二套事务实现。
 *
 * CAD 是**无限图纸**：文档不带任何画布或输出尺寸，也没有 Frame，因此不受
 * 「`Frame.size` 是尺寸唯一事实来源」这条 ComposeDocument 不变量约束。单位固定 `px`。
 *
 * @packageDocumentation
 */

export {
  CAD_COMPONENT_KEYS,
  CAD_DEFAULT_LAYER_ID,
  createCadLineEntity,
  createEmptyCadDocument,
  getCadLine,
  getCadPlacement,
  validateCadDocument,
  type CadDocument,
  type CadDocumentIssue,
  type CadDocumentIssueCode,
  type CadLayer,
  type CadLine,
  type CadPlacement,
  type CadPoint,
} from './document'
export {
  CAD_SNAP_MODES,
  findCadSnap,
  type CadSnapCandidate,
  type CadSnapMode,
} from './snap'
export {
  parseCadCoordinate,
  resolveCadPoint,
  type CadCoordinateFailure,
  type CadInputPoint,
  type CadGridSettings,
  type CadPointContext,
  type CadPointSource,
  type ParseCadCoordinateResult,
} from './point-input'
export {
  CAD_COMMAND_TYPES,
  createCadCommandHandlers,
  createCadEraseCommand,
  createCadEraseSession,
  createCadLineCommand,
  createCadLineSession,
  type CadAddEntityPayload,
  type CadCommandContext,
  type CadCommandEffect,
  type CadCommandMessages,
  type CadRemoveEntityPayload,
} from './command'
export {
  applyCadSelection,
  cadSelectionBoundsFromDrag,
  cadSelectionModeFromDrag,
  findCadEntitiesInBounds,
  findCadHit,
  pruneCadSelection,
  type CadSelectionBounds,
  type CadSelectionChange,
  type CadSelectionMode,
} from './selection'
export {
  CAD_COMMAND_POINT_PLUGIN_ID,
  CAD_GESTURE_PRIORITY,
  CAD_MARQUEE_PLUGIN_ID,
  CAD_SELECT_PLUGIN_ID,
  createCadCommandPointPlugin,
  createCadInteractionPlugins,
  createCadMarqueePlugin,
  createCadPluginRegistry,
  createCadSceneIndex,
  createCadSelectPlugin,
  createCadSessionArbiter,
  type CadClaimResult,
  type CadInteractionContext,
  type CadInteractionEffect,
  type CadInteractionEvent,
  type CadInteractionPlugin,
  type CadInteractionSnapshot,
  type CadKernelProfile,
  type CadPluginContext,
  type CadPluginRegistry,
  type CadPointerDownEvent,
  type CadPointerModifiers,
  type CadSceneIndex,
  type CadSession,
  type CadSessionArbiter,
} from './interaction'
export {
  COMPOSE_CAD_FILE_SUFFIX,
  COMPOSE_CAD_MEDIA_TYPE,
  composeCadDisplayName,
  composeCadFileName,
  createComposeCadStore,
  isComposeCadFileName,
  parseComposeCadDocument,
  serializeComposeCadDocument,
  type ComposeCadCatalog,
  type ComposeCadDescriptor,
  type ComposeCadSnapshot,
  type ComposeCadStore,
  type ComposeCadStoreEvent,
  type CreateComposeCadInput,
  type ParseComposeCadResult,
} from './store'

/** `@compose-ui/cad` 的稳定包标识。 @public */
export const COMPOSE_UI_CAD_PACKAGE = '@compose-ui/cad' as const
