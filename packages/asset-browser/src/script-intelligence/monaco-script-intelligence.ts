import type * as Monaco from 'monaco-editor'
import type { ComposeScriptIntelligenceProfile } from './script-intelligence-types'
import {
  createComposeVirtualTextDocument,
} from './virtual-text'
import type { ComposeVirtualTextDocument } from './virtual-text'

const MARKER_OWNER = 'compose-script-intelligence'
const DIAGNOSTIC_DELAY_MS = 180

type MonacoApi = typeof import('monaco-editor')
type MonacoTypeScriptApi = typeof import('monaco-editor')['typescript']
interface TextSpan {
  readonly start: number
  readonly length: number
}

interface DisplayPart {
  readonly text: string
}

interface CompletionEntry {
  readonly name: string
  readonly kind: string
  readonly kindModifiers?: string
  readonly sortText: string
  readonly insertText?: string
  readonly isSnippet?: boolean
  readonly replacementSpan?: TextSpan
}

interface CompletionInfo {
  readonly entries: readonly CompletionEntry[]
  readonly isIncomplete?: boolean
}

interface CompletionDetails {
  readonly name: string
  readonly kind: string
  readonly displayParts?: readonly DisplayPart[]
  readonly documentation?: readonly DisplayPart[]
}

interface QuickInfo {
  readonly textSpan: TextSpan
  readonly displayParts?: readonly DisplayPart[]
  readonly documentation?: readonly DisplayPart[]
}

interface SignatureParameter {
  readonly displayParts?: readonly DisplayPart[]
  readonly documentation?: readonly DisplayPart[]
}

interface SignatureItem {
  readonly prefixDisplayParts?: readonly DisplayPart[]
  readonly separatorDisplayParts?: readonly DisplayPart[]
  readonly suffixDisplayParts?: readonly DisplayPart[]
  readonly documentation?: readonly DisplayPart[]
  readonly parameters: readonly SignatureParameter[]
}

interface SignatureInfo {
  readonly argumentIndex: number
  readonly selectedItemIndex: number
  readonly items: readonly SignatureItem[]
}

interface TypeScriptDiagnostic {
  readonly start?: number
  readonly length?: number
  readonly category: 0 | 1 | 2 | 3
  readonly code: number
  readonly messageText: string | {
    readonly messageText: string
    readonly next?: readonly TypeScriptDiagnostic['messageText'][]
  }
  readonly reportsDeprecated?: object
  readonly reportsUnnecessary?: object
}

interface CompletionMetadata {
  readonly composeShadowOffset: number
  readonly composeEntryName: string
}

interface ExtraLibraryRegistration {
  count: number
  readonly content: string
  readonly disposable: Monaco.IDisposable
}

const extraLibraries = new Map<string, ExtraLibraryRegistration>()
let sessionSequence = 0

function displayPartsToString(parts: readonly DisplayPart[] | undefined) {
  return parts?.map(({ text }) => text).join('') ?? ''
}

function flattenDiagnosticMessage(message: TypeScriptDiagnostic['messageText']): string {
  if (typeof message === 'string') return message
  const children = message.next?.map(flattenDiagnosticMessage).filter(Boolean) ?? []
  return [message.messageText, ...children].join('\n')
}

function completionKind(monaco: MonacoApi, kind: string) {
  const kinds = monaco.languages.CompletionItemKind
  switch (kind) {
    case 'keyword':
    case 'primitive type': return kinds.Keyword
    case 'var':
    case 'let':
    case 'const':
    case 'local var': return kinds.Variable
    case 'function':
    case 'local function':
    case 'method':
    case 'call':
    case 'construct': return kinds.Function
    case 'class': return kinds.Class
    case 'interface': return kinds.Interface
    case 'enum': return kinds.Enum
    case 'module': return kinds.Module
    case 'property':
    case 'getter':
    case 'setter': return kinds.Field
    default: return kinds.Property
  }
}

function markerSeverity(monaco: MonacoApi, category: TypeScriptDiagnostic['category']) {
  switch (category) {
    case 0: return monaco.MarkerSeverity.Warning
    case 1: return monaco.MarkerSeverity.Error
    case 2: return monaco.MarkerSeverity.Hint
    case 3: return monaco.MarkerSeverity.Info
  }
}

function markerTags(monaco: MonacoApi, diagnostic: TypeScriptDiagnostic) {
  const tags: Monaco.MarkerTag[] = []
  if (diagnostic.reportsUnnecessary) tags.push(monaco.MarkerTag.Unnecessary)
  if (diagnostic.reportsDeprecated) tags.push(monaco.MarkerTag.Deprecated)
  return tags
}

function sourceMarkerSeverity(
  monaco: MonacoApi,
  severity: 'hint' | 'info' | 'warning' | 'error',
) {
  switch (severity) {
    case 'hint': return monaco.MarkerSeverity.Hint
    case 'info': return monaco.MarkerSeverity.Info
    case 'warning': return monaco.MarkerSeverity.Warning
    case 'error': return monaco.MarkerSeverity.Error
  }
}

function acquireExtraLibrary(
  typescript: MonacoTypeScriptApi,
  profile: ComposeScriptIntelligenceProfile,
) {
  if (!profile.typeDeclarations) return () => undefined
  const key = profile.id
  const current = extraLibraries.get(key)
  if (current && current.content === profile.typeDeclarations) {
    current.count += 1
    return () => {
      current.count -= 1
      if (current.count === 0) {
        current.disposable.dispose()
        extraLibraries.delete(key)
      }
    }
  }
  const filePath = `inmemory://compose-script-intelligence/${encodeURIComponent(profile.id)}.d.ts`
  const registration: ExtraLibraryRegistration = {
    content: profile.typeDeclarations,
    count: 1,
    disposable: typescript.javascriptDefaults.addExtraLib(
      profile.typeDeclarations,
      filePath,
    ),
  }
  extraLibraries.set(key, registration)
  return () => {
    registration.count -= 1
    if (registration.count === 0) {
      registration.disposable.dispose()
      extraLibraries.delete(key)
    }
  }
}

/** @internal */
export interface CreateComposeScriptIntelligenceSessionOptions {
  readonly monaco: MonacoApi
  readonly typescript: MonacoTypeScriptApi
  readonly model: Monaco.editor.ITextModel
  readonly profile: ComposeScriptIntelligenceProfile
}

/** 创建并管理一个可见源码到 JavaScript shadow model 的语言服务桥。 @internal */
export function createComposeScriptIntelligenceSession({
  monaco,
  model,
  profile,
  typescript,
}: CreateComposeScriptIntelligenceSessionOptions): Monaco.IDisposable {
  let disposed = false
  let diagnosticTimer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let virtualDocument = createVirtualDocument(model.getValue())
  const sessionId = ++sessionSequence
  const shadowUri = monaco.Uri.parse(
    `compose-script-shadow://${encodeURIComponent(profile.id)}/${sessionId}.js`,
  )
  const shadowModel = monaco.editor.createModel(
    virtualDocument.text,
    profile.language,
    shadowUri,
  )
  const releaseExtraLibrary = acquireExtraLibrary(typescript, profile)

  function createVirtualDocument(source: string): ComposeVirtualTextDocument {
    try {
      const insertions = profile.createVirtualInsertions(source)
      return createComposeVirtualTextDocument(source, insertions)
        ?? createComposeVirtualTextDocument(source, [])!
    } catch {
      return createComposeVirtualTextDocument(source, [])!
    }
  }

  const rangeFromSource = (offset: number, length: number) => {
    const start = model.getPositionAt(offset)
    const end = model.getPositionAt(offset + length)
    return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
  }

  async function getWorker(snapshot: ComposeVirtualTextDocument, version: number) {
    const factory = await typescript.getJavaScriptWorker()
    if (disposed || generation !== version || snapshot !== virtualDocument) return null
    const worker = await factory(shadowUri)
    if (disposed || generation !== version || snapshot !== virtualDocument) return null
    return worker
  }

  const getQuery = (position: Monaco.Position) => {
    const sourceOffset = model.getOffsetAt(position)
    const shadowOffset = virtualDocument.sourceOffsetToVirtual(sourceOffset)
    if (shadowOffset === null) return null
    return {
      document: virtualDocument,
      generation,
      shadowOffset,
    }
  }

  async function publishDiagnostics(version: number, snapshot: ComposeVirtualTextDocument) {
    const worker = await getWorker(snapshot, version)
    if (!worker) return
    const fileName = shadowUri.toString()
    const diagnostics = (await Promise.all([
      worker.getSyntacticDiagnostics(fileName),
      worker.getSemanticDiagnostics(fileName),
      worker.getSuggestionDiagnostics(fileName),
    ])).flat() as TypeScriptDiagnostic[]
    if (disposed || generation !== version || snapshot !== virtualDocument) return
    const markers = diagnostics.flatMap((diagnostic): Monaco.editor.IMarkerData[] => {
      const mapped = snapshot.virtualRangeToSource(
        diagnostic.start ?? 0,
        diagnostic.length ?? 1,
      )
      if (!mapped) return []
      const range = rangeFromSource(mapped.offset, mapped.length)
      return [{
        ...range,
        code: String(diagnostic.code),
        message: flattenDiagnosticMessage(diagnostic.messageText),
        severity: markerSeverity(monaco, diagnostic.category),
        tags: markerTags(monaco, diagnostic),
      }]
    })
    try {
      const source = model.getValue()
      for (const diagnostic of profile.getSourceDiagnostics?.(source) ?? []) {
        if (!Number.isInteger(diagnostic.offset)
          || !Number.isInteger(diagnostic.length)
          || diagnostic.offset < 0
          || diagnostic.length < 0
          || diagnostic.offset + diagnostic.length > source.length) continue
        const range = rangeFromSource(diagnostic.offset, diagnostic.length)
        markers.push({
          ...range,
          message: diagnostic.message,
          severity: sourceMarkerSeverity(monaco, diagnostic.severity),
        })
      }
    } catch {
      // Profile 提示失败不能影响 Monaco worker 诊断、编辑或保存。
    }
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers)
  }

  function scheduleDiagnostics(delay = DIAGNOSTIC_DELAY_MS) {
    if (diagnosticTimer !== undefined) clearTimeout(diagnosticTimer)
    const version = generation
    const snapshot = virtualDocument
    diagnosticTimer = setTimeout(() => {
      diagnosticTimer = undefined
      void publishDiagnostics(version, snapshot).catch(() => {
        // Worker 暂时不可用时保留编辑与保存能力；下次内容变化会重新调度。
      })
    }, delay)
  }

  const completionProvider = monaco.languages.registerCompletionItemProvider(
    model.getLanguageId(),
    {
      triggerCharacters: ['.'],
      provideCompletionItems: async (candidate, position, _context, token) => {
        if (candidate !== model || token.isCancellationRequested) return
        const query = getQuery(position)
        if (!query) return
        const worker = await getWorker(query.document, query.generation)
        if (!worker || token.isCancellationRequested) return
        const info = await worker.getCompletionsAtPosition(
          shadowUri.toString(),
          query.shadowOffset,
        ) as CompletionInfo | undefined
        if (!info || disposed || query.document !== virtualDocument) return
        const word = model.getWordUntilPosition(position)
        const defaultRange = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        )
        const suggestions = info.entries.flatMap((entry) => {
          let range: Monaco.IRange = defaultRange
          if (entry.replacementSpan) {
            const mapped = query.document.virtualRangeToSource(
              entry.replacementSpan.start,
              entry.replacementSpan.length,
            )
            if (!mapped) return []
            range = rangeFromSource(mapped.offset, mapped.length)
          }
          const item: Monaco.languages.CompletionItem & CompletionMetadata = {
            composeEntryName: entry.name,
            composeShadowOffset: query.shadowOffset,
            insertText: entry.insertText ?? entry.name,
            kind: completionKind(monaco, entry.kind),
            label: entry.name,
            range,
            sortText: entry.sortText,
            tags: entry.kindModifiers?.includes('deprecated')
              ? [monaco.languages.CompletionItemTag.Deprecated]
              : undefined,
          }
          if (entry.isSnippet) {
            item.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
          }
          return [item]
        })
        return { incomplete: info.isIncomplete, suggestions }
      },
      resolveCompletionItem: async (item, token) => {
        const metadata = item as Monaco.languages.CompletionItem & Partial<CompletionMetadata>
        if (metadata.composeShadowOffset === undefined || !metadata.composeEntryName) return item
        const snapshot = virtualDocument
        const version = generation
        const worker = await getWorker(snapshot, version)
        if (!worker || token.isCancellationRequested) return item
        const details = await worker.getCompletionEntryDetails(
          shadowUri.toString(),
          metadata.composeShadowOffset,
          metadata.composeEntryName,
        ) as CompletionDetails | undefined
        if (!details || disposed || snapshot !== virtualDocument) return item
        return {
          ...item,
          detail: displayPartsToString(details.displayParts),
          documentation: { value: displayPartsToString(details.documentation) },
        }
      },
    },
  )

  const hoverProvider = monaco.languages.registerHoverProvider(model.getLanguageId(), {
    provideHover: async (candidate, position, token) => {
      if (candidate !== model || token.isCancellationRequested) return
      const query = getQuery(position)
      if (!query) return
      const worker = await getWorker(query.document, query.generation)
      if (!worker || token.isCancellationRequested) return
      const info = await worker.getQuickInfoAtPosition(
        shadowUri.toString(),
        query.shadowOffset,
      ) as QuickInfo | undefined
      if (!info || disposed || query.document !== virtualDocument) return
      const mapped = query.document.virtualRangeToSource(
        info.textSpan.start,
        info.textSpan.length,
      )
      if (!mapped) return
      return {
        range: rangeFromSource(mapped.offset, mapped.length),
        contents: [
          { value: `\`\`\`typescript\n${displayPartsToString(info.displayParts)}\n\`\`\`` },
          { value: displayPartsToString(info.documentation) },
        ],
      }
    },
  })

  const signatureProvider = monaco.languages.registerSignatureHelpProvider(
    model.getLanguageId(),
    {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: async (candidate, position, token) => {
        if (candidate !== model || token.isCancellationRequested) return
        const query = getQuery(position)
        if (!query) return
        const worker = await getWorker(query.document, query.generation)
        if (!worker || token.isCancellationRequested) return
        const info = await worker.getSignatureHelpItems(
          shadowUri.toString(),
          query.shadowOffset,
          { triggerReason: { kind: 'invoked' } },
        ) as SignatureInfo | undefined
        if (!info || disposed || query.document !== virtualDocument) return
        return {
          value: {
            activeParameter: info.argumentIndex,
            activeSignature: info.selectedItemIndex,
            signatures: info.items.map((item) => {
              const separator = displayPartsToString(item.separatorDisplayParts)
              const parameters = item.parameters.map((parameter) => ({
                documentation: displayPartsToString(parameter.documentation),
                label: displayPartsToString(parameter.displayParts),
              }))
              return {
                documentation: displayPartsToString(item.documentation),
                label: displayPartsToString(item.prefixDisplayParts)
                  + parameters.map(({ label }) => label).join(separator)
                  + displayPartsToString(item.suffixDisplayParts),
                parameters,
              }
            }),
          },
          dispose: () => undefined,
        }
      },
    },
  )

  const changeListener = model.onDidChangeContent(() => {
    generation += 1
    virtualDocument = createVirtualDocument(model.getValue())
    shadowModel.setValue(virtualDocument.text)
    scheduleDiagnostics()
  })
  scheduleDiagnostics(0)

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      generation += 1
      if (diagnosticTimer !== undefined) clearTimeout(diagnosticTimer)
      changeListener.dispose()
      completionProvider.dispose()
      hoverProvider.dispose()
      signatureProvider.dispose()
      monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
      shadowModel.dispose()
      releaseExtraLibrary()
    },
  }
}
