/**
 * ComposeDocument 场景动画的无 React、无 DOM 领域模型。
 *
 * @remarks
 * 关键帧轨道存放在被动画 Entity 的 `Animation` Component 上，而不是文档顶层——这样复制、
 * 删除、Group 与组件继承都自动带上动画，不需要任何补偿逻辑。文档只在
 * `ComposeDocument.animations` 里保留动画清单（身份与时间属性），由 `@compose-ui/core` 定义。
 *
 * 本包只依赖 `@compose-ui/core`，不得依赖 `editor`、`stage`、`preview`、`animation-panel`
 * 或任何 UI Context。命令 handler 通过 `TransactionRuntimeOptions.handlers` 注入运行时。
 *
 * @packageDocumentation
 */
export { COMPOSE_ANIMATION_COMPONENT_KEY } from './animation-types'
export type {
  ComposeAnimationComponent,
  ComposeAnimationTrack,
  ComposeAnimationValueKind,
  ComposeKeyframe,
  ComposeKeyframeInterpolation,
  ComposeSpatialTangent,
} from './animation-types'
export {
  findComposeAnimationTrack,
  findComposeKeyframeAt,
  getComposeAnimationComponent,
  getComposeEntityTracks,
  isSameComposeAnimationPath,
  listComposeAnimationEntities,
} from './animation-component'
export {
  isComposeAnimationValue,
  mixComposeAnimationValue,
  mixComposeColor,
} from './animation-value'
export type { ComposeAnimationVector2 } from './animation-value'
export { collectComposeAnimationIssues } from './animation-validation'
export type { ComposeAnimationIssue, ComposeAnimationIssueCode } from './animation-validation'
export { applyComposeAnimationAtTime, sampleComposeAnimationTrack } from './animation-sampler'
export { sampleComposeMotionPath } from './animation-motion-path'
export type {
  ComposeMotionPathGeometry,
  ComposeMotionPathPoint,
  ComposeMotionPathVertex,
} from './animation-motion-path'
export {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  createComposeAnimationCommandHandlers,
} from './animation-commands'
export {
  COMPOSE_ANIMATION_FILE_SCHEMA_VERSION,
  COMPOSE_ANIMATION_FILE_SUFFIX,
  COMPOSE_ANIMATION_MEDIA_TYPE,
  composeAnimationDisplayName,
  composeAnimationFileName,
  createComposeAnimationFile,
  isComposeAnimationFileName,
  parseComposeAnimationFile,
  serializeComposeAnimationFile,
} from './animation-file'
export type {
  ComposeAnimationFile,
  ComposeAnimationFileIssue,
  ComposeAnimationFileIssueCode,
  ComposeAnimationFileParseResult,
} from './animation-file'

/** `@compose-ui/animation` 的稳定包标识。 @public */
export const COMPOSE_UI_ANIMATION_PACKAGE = '@compose-ui/animation' as const
