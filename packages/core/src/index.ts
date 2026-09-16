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
  createDefaultComposeLayoutItem,
  createDefaultComposeFlexLayout,
  createDefaultComposeGridLayout,
  isComposeGridLayout,
  createFixedComposeAxisSizing,
  isValidComposeLayoutItem,
  isValidComposeLayout,
} from './layout'
export {
  collectComposeGridItemValidationIssues,
  createComposeGridItem,
  getComposeGridItem,
  isValidComposeGridItem,
} from './grid-item'
export {
  composeGridCellAtPoint,
  composeGridColumnWidth,
  composeGridContentHeight,
  findComposeGridVacancy,
  projectComposeGridCell,
  solveComposeGrid,
} from './grid-geometry'
export type {
  ComposeGridCell,
  ComposeGridMetrics,
  ComposeGridRect,
  ComposeGridSolveOptions,
} from './grid-geometry'
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
export {
  COMPOSE_LATTICE_FADE_START,
  COMPOSE_LATTICE_MIN_FULL_SPACING,
  composeLatticeDetailFade,
  composeLatticeStackedAlpha,
  createAxisLattice,
  createRulerTicks,
  latticeLineBand,
  latticeLinePosition,
  type ComposeAxisLattice,
  type ComposeLatticeBand,
  type ComposeRulerTick,
} from './axis-lattice'
export { createDefaultCanvasSettings } from './canvas-settings'
export {
  composeCanvasPan,
  composeCanvasScreenToWorld,
  composeCanvasWorldToScreen,
  composeCanvasZoomAt,
  type ComposeCanvasPoint,
  type ComposeCanvasRect,
  type ComposeCanvasViewport,
  type ComposeZoomRange,
} from './canvas-viewport'
export {
  COMPOSE_GEOMETRY_PRECISION,
  COMPOSE_GEOMETRY_QUANTUM,
  formatComposeNumber,
  roundComposeGeometry,
} from './geometry-precision'
export {
  COMPOSE_DEFAULT_FRAME_SIZE,
  COMPOSE_DEFAULT_SCENE_APPEARANCE,
  COMPOSE_SCENE_SIZE_PRESETS,
  COMPOSE_SNAP_RADIUS,
  createComposeFrame,
  createComposeFrameEntity,
  findComposeSceneSizePreset,
  formatComposeAspectRatio,
  formatComposeSceneSize,
  formatComposeSceneSizePresetLabel,
  getComposeFrame,
  getComposeFrameGuides,
  isComposeFrameEntity,
  isWithinFrame,
  listComposeFrameIds,
  promoteComposeEntityToFrame,
  resolveOwningFrameId,
  snapComposeScreenSize,
} from './frame'
export type {
  ComposeSceneSizePreset,
  ComposeScreenSizeSnapCandidate,
  ComposeScreenSizeSnapOptions,
  ComposeScreenSizeSnapResult,
} from './frame'
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
  getComposeTransformPivot,
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
export {
  collectComposeInteractionValidationIssues,
  createComposeNavigateInteraction,
  getComposeInteraction,
  isValidComposeInteraction,
  resolveComposeInteractionAction,
} from './interaction'
export type {
  ComposeInteraction,
  ComposeInteractionAction,
  ComposeInteractionEvent,
  ComposeInteractionTrigger,
  ComposeInteractionValidationIssue,
  ComposeNavigateAction,
  ComposeNavigateBackAction,
} from './interaction'
export { flattenComposeCurves, resolveComposeCurveBoolean } from './curve-boolean'
export type {
  ComposeBooleanOp,
  ComposeBooleanOperand,
  ComposeCurveBooleanResult,
} from './curve-boolean'
export { composeCurveFromOutline } from './curve-arrangement'
export { composeCurveInnerAnchor, resolveComposeCurveRegion } from './curve-region'
export { resolveComposeHatches } from './hatch-solve'
export type { ComposeResolvedHatches } from './hatch-solve'
export type { ComposeCurveRegionResult, ComposeCurveRegionSource } from './curve-region'
export {
  COMPOSE_DEFAULT_HATCH_COLOR,
  collectComposeHatchValidationIssues,
  getComposeHatch,
  isValidComposeHatch,
} from './hatch'
export type {
  ComposeHatch,
  ComposeHatchValidationIssue,
} from './hatch'
export {
  collectComposePortsValidationIssues,
  getComposeEntityPorts,
  getComposePortItems,
  getComposePorts,
  isValidComposePorts,
} from './ports'
export type {
  ComposePort,
  ComposePorts,
  ComposePortsValidationIssue,
} from './ports'
export {
  getComposeStyleRef,
  planComposeApplyTextStyle,
  planComposeDetachTextStyle,
  getComposeTextStyleState,
  getComposeTextStyles,
  resolveComposeStyles,
} from './text-style'
export type {
  ComposeStyleRef,
  ComposeStyleRefState,
  ComposeTextStyle,
} from './text-style'
export {
  collectComposeWireValidationIssues,
  getComposeWire,
  getComposeWireEndState,
  isValidComposeWire,
  resolveComposePortPoint,
  resolveComposeWires,
} from './wire'
export type {
  ComposeResolvedWires,
  ComposeWire,
  ComposeWireBinding,
  ComposeWireEndState,
  ComposeWireValidationIssue,
} from './wire'
export {
  COMPOSE_CURVE_MIN_EXTENT,
  COMPOSE_CURVE_PICK_TOLERANCE,
  COMPOSE_JUNCTION_SIZE_RATIO,
  COMPOSE_JUNCTION_PORT_ID,
  composeJunctionGeometry,
  composeJunctionSize,
  collectComposeCurveValidationIssues,
  composeCurveSegments,
  composeCurveBounds,
  composeCurveBoxScale,
  composeCurvePoints,
  composePathAsOutline,
  composePathCubics,
  composePolylineOutline,
  composeCurveViewBox,
  createComposeLineCurve,
  distanceToComposeCurve,
  getComposeCurve,
  getComposeCurveFill,
  isComposeClosedCurve,
  isPointInsideComposeCurve,
  isValidComposeCurve,
  normalizeComposeCurveGeometry,
  projectComposeCurveToBox,
  splitComposeCurveAt,
  translateComposeCurve,
  composeCurveParameterSpan,
  composeCurvePointAtParameter,
  nearestComposeCurveParameter,
  sliceComposeCurve,
  type ComposeCurveBoxScale,
  type ComposeCurveParameter,
  type ComposeCurveSlice,
  type ComposeCurveSplit,
  type ComposeCurveViewBox,
} from './curve'
export {
  composeArcBoundsPoints,
  composeArcContainsAngle,
  composeArcEndpoints,
  composeArcMidpoint,
  composeArcPointAt,
  composeArcQuadrants,
  composeArcThroughPoints,
  composeArcToCubicShapes,
  composeArcTravelledDegrees,
  composeCubicAsArc,
  composeCubicAsSegment,
  intersectComposeArcs,
  intersectComposeSegmentArc,
  intersectComposeSegments,
  clampComposeCornerRadius,
  composeCornerArcCenter,
  composeCornerRadiusAt,
  composePolylineCornerFrames,
  composePolylineCornerRoundings,
  composePolylineSegments,
  composeRegularPolygonVertices,
  composeRoundedPolylineOutline,
  composeSegmentIntersectsRect,
  composeSegmentMidpoint,
  composeSquaredDistance,
  closestPointOnComposeSegment,
  composeCubicBoundsPoints,
  composeCubicPointAt,
  flattenComposeArc,
  flattenComposeCubic,
  flattenComposeOutline,
  isComposeFullCircle,
  isDegenerateComposePolyline,
  nearestComposeCubicT,
  pointToComposeArcDistance,
  pointToComposeCubicDistance,
  pointToComposeSegmentDistance,
  splitComposeCubic,
} from './curve-geometry'
export type {
  ComposeArcShape,
  ComposeCubicShape,
  ComposeOutlinePiece,
  ComposePlanarPoint,
  ComposePolylineCornerFrame,
  ComposePolylineCornerRounding,
  ComposeRectShape,
  ComposeRegularPolygonFit,
  ComposeSegmentShape,
  ComposeShapeIntersection,
} from './curve-geometry'
export {
  composeHorizontalMirrorAxis,
  reflectComposeCurve,
  reflectComposePoint,
} from './curve-reflect'
export type { ComposeMirrorAxis } from './curve-reflect'
export {
  applyComposeAngleConstraint,
  applyComposeFieldOverride,
  composeFieldsToPoint,
  composePointToFields,
  isComposeSingleFieldKind,
  COMPOSE_SINGLE_FIELD_KINDS,
  parseComposeCoordinate,
  resolveComposePoint,
  resolveComposePointDetail,
} from './point-input'
export type {
  ComposeAngleConstraint,
  ComposeAngleConstraintResult,
  ComposeCoordinateFailure,
  ComposeGridSettings,
  ComposePolarSettings,
  ComposeInputPoint,
  ComposePointContext,
  ComposePointFieldIndex,
  ComposePointFieldKind,
  ComposePointFieldValues,
  ComposePointSource,
  ParseComposeCoordinateResult,
} from './point-input'
export type {
  ComposeArcCurve,
  ComposeCubicSegment,
  ComposeCurve,
  ComposeCurveKind,
  ComposeCurveValidationIssue,
  ComposeLineCurve,
  ComposeNormalizedCurveGeometry,
  ComposePathCurve,
  ComposePolylineCurve,
  ComposeSubpath,
} from './curve'
export { applyDocumentPatches, jsonEqual } from './patches'
export { createDocumentTransactionRuntime, createTransactionRuntime } from './runtime'
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
  ComposeGridLayout,
  ComposeGridItem,
  ComposeFlexWrap,
  ComposeJustifyContent,
  DocumentValidationIssue,
  DocumentValidationIssueCode,
  DocumentValidationResult,
  DocumentValidationIssueShape,
  DocumentValidationResultOf,
  DocumentValidator,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ResolvedComposeAppearance,
} from './document-types'
export { COMPOSE_BUILTIN_COMPONENT_KEYS, COMPOSE_DEFAULT_TRANSFORM_PIVOT } from './document-types'
export {
  COMPOSE_APP_MANIFEST_FILE_NAME,
  COMPOSE_APP_MANIFEST_SCHEMA_VERSION,
  COMPOSE_PAGE_FILE_SUFFIX,
  COMPOSE_PAGE_MEDIA_TYPE,
  COMPOSE_PAGE_SCHEMA_VERSION,
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
  ComposeNavigationIssue,
  ComposeNavigationIssueCode,
  ComposeNavigationPort,
  ComposeNavigationSnapshot,
  ComposePageAnimationReference,
  ComposePageFile,
  ComposePageFileIssue,
  ComposePageFileIssueCode,
  ComposePageLoader,
  ComposePageMigrationResult,
  ComposePageParseResult,
  ComposePageReference,
  ComposePageSetupReference,
} from './page'

/** `@compose-ui/core` 的稳定包标识。 @public */
export const COMPOSE_UI_CORE_PACKAGE = '@compose-ui/core' as const
