/**
 * 提供 React Compose UI 的可序列化文档、同步命令与通用领域逻辑。
 *
 * @remarks
 * 本包保持与 React 和 DOM 无关。React 编辑器、Stage 与 Preview 只能通过这里的公共协议共享
 * 文档，不得引用彼此内部源码。
 *
 * @packageDocumentation
 */

export { validateComposeDocument } from './document'
export { applyDocumentPatches } from './patches'
export { createTransactionRuntime } from './runtime'
export {
  BUILTIN_COMMAND_TYPES,
  createBuiltinCommandHandlers,
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
  ComposeComponentNode,
  ComposeDocument,
  ComposeFrameNode,
  ComposeGroupNode,
  ComposeNode,
  ComposeNodeBase,
  DocumentValidationIssue,
  DocumentValidationIssueCode,
  DocumentValidationResult,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  NodeTransform,
} from './document-types'

/** `@compose-ui/core` 的稳定包标识。 @public */
export const COMPOSE_UI_CORE_PACKAGE = '@compose-ui/core' as const
