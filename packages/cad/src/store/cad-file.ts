import { validateCadDocument, type CadDocument, type CadDocumentIssue } from '../document'

/** CAD 文档文件的媒体类型。 @public */
export const COMPOSE_CAD_MEDIA_TYPE = 'application/vnd.compose-ui.cad+json'

/** CAD 文档文件的后缀。 @public */
export const COMPOSE_CAD_FILE_SUFFIX = '.cad.json'

/** 判定文件名是否为 CAD 文档。 @public */
export function isComposeCadFileName(name: string) {
  return name.endsWith(COMPOSE_CAD_FILE_SUFFIX) && name.length > COMPOSE_CAD_FILE_SUFFIX.length
}

/** 由展示名构造 CAD 文件名。 @public */
export function composeCadFileName(displayName: string) {
  const trimmed = displayName.trim()
  return isComposeCadFileName(trimmed) ? trimmed : `${trimmed}${COMPOSE_CAD_FILE_SUFFIX}`
}

/** 由 CAD 文件名还原展示名。 @public */
export function composeCadDisplayName(name: string) {
  return isComposeCadFileName(name) ? name.slice(0, -COMPOSE_CAD_FILE_SUFFIX.length) : name
}

/** 解析结果；失败时给出全部校验问题而不是只报第一条。 @public */
export type ParseComposeCadResult =
  | { readonly ok: true; readonly document: CadDocument }
  | { readonly ok: false; readonly issues: readonly CadDocumentIssue[] }

/**
 * 解析 CAD 文档文本。
 *
 * @remarks
 * JSON 语法错误与协议校验失败都归一成 `issues`，因此调用方只需处理一种失败形状。
 * @public
 */
export function parseComposeCadDocument(text: string): ParseComposeCadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch (error) {
    return {
      ok: false,
      issues: [{
        code: 'document.invalid',
        path: [],
        message: `CAD 文档不是合法 JSON：${error instanceof Error ? error.message : '未知错误'}`,
      }],
    }
  }
  const validation = validateCadDocument(parsed)
  return validation.valid
    ? { ok: true, document: validation.document }
    : { ok: false, issues: validation.issues }
}

/** 序列化 CAD 文档；缩进两格，便于版本管理中 diff。 @public */
export function serializeComposeCadDocument(document: CadDocument) {
  return `${JSON.stringify(document, null, 2)}\n`
}
