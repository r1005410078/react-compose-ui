import { createDefaultCanvasSettings } from '../canvas-settings'
import type { ComposeDocument, DocumentValidationIssue } from '../document-types'
import { validateComposeDocument } from '../document'
import { createDefaultOutputSettings } from '../output-settings'
import { COMPOSE_PAGE_FILE_SUFFIX } from './page-types'

/** 页面文档解析的判别结果。 @public */
export type ComposePageParseResult =
  | { readonly ok: true; readonly document: ComposeDocument }
  | { readonly ok: false; readonly issues: readonly DocumentValidationIssue[] }

/**
 * 判断资源名称是否为页面文件。
 *
 * @remarks
 * 只看名称后缀，因此无需读取文件内容即可在资源树上分流。纯后缀（名称恰好等于后缀）不算页面，
 * 否则会产生显示名为空的页面。
 * @public
 */
export function isComposePageFileName(name: string): boolean {
  return name.length > COMPOSE_PAGE_FILE_SUFFIX.length
    && name.endsWith(COMPOSE_PAGE_FILE_SUFFIX)
}

/**
 * 取页面文件对应的用户可见显示名。
 *
 * @returns 去掉页面后缀后的名称；传入的不是页面文件时原样返回。
 * @public
 */
export function composePageDisplayName(fileName: string): string {
  return isComposePageFileName(fileName)
    ? fileName.slice(0, -COMPOSE_PAGE_FILE_SUFFIX.length)
    : fileName
}

/**
 * 由显示名生成页面文件名。
 *
 * @remarks
 * 已经带页面后缀的输入原样返回，因此可直接用于规范化用户在命名对话框中的输入 ——
 * 无论用户输入 `Home` 还是 `Home.page.json` 都得到同一结果。
 * @public
 */
export function composePageFileName(displayName: string): string {
  const trimmed = displayName.trim()
  return isComposePageFileName(trimmed) ? trimmed : `${trimmed}${COMPOSE_PAGE_FILE_SUFFIX}`
}

/**
 * 解析页面文件文本为 ComposeDocument。
 *
 * @remarks
 * 解析失败不抛异常，而是返回带 issue 的判别结果，使调用方能把原因呈现给用户。
 * 文档结构校验直接复用 {@link validateComposeDocument}，因此 v5 之外的版本会被拒绝。
 * @public
 */
export function parseComposePageDocument(text: string): ComposePageParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  }
  catch (error) {
    return {
      ok: false,
      issues: [{
        code: 'document.invalid',
        path: [],
        message: `页面文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      }],
    }
  }
  const validation = validateComposeDocument(parsed)
  return validation.valid
    ? { ok: true, document: validation.document }
    : { ok: false, issues: validation.issues }
}

/**
 * 序列化页面文档为页面文件文本。
 *
 * @remarks
 * 使用两空格缩进并以换行结尾，使页面文件在只读 JSON 查看与外部 diff 中可读。
 * @public
 */
export function serializeComposePageDocument(document: ComposeDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

/**
 * 创建一份空白页面文档。
 *
 * @returns 每次调用均返回可独立修改的新文档，使用默认画布设置与默认输出设置。
 * @public
 */
export function createEmptyComposePageDocument(): ComposeDocument {
  return {
    schemaVersion: 5,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: [],
    entities: {},
  }
}
