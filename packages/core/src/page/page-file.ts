import { createDefaultCanvasSettings } from '../canvas-settings'
import type { ComposeDocument, DocumentValidationIssue } from '../document-types'
import { validateComposeDocument } from '../document'
import { createComposeFrame } from '../frame'
import {
  COMPOSE_PAGE_FILE_SUFFIX,
  COMPOSE_PAGE_MEDIA_TYPE,
  COMPOSE_PAGE_SCHEMA_VERSION,
  type ComposePageFile,
  type ComposePageFileIssue,
} from './page-types'

/** 页面文档解析的判别结果。 @public */
export type ComposePageParseResult =
  | { readonly ok: true; readonly page: ComposePageFile }
  | { readonly ok: false; readonly issues: readonly ComposePageFileIssue[] }

/** 旧裸文档显式迁移的判别结果。 @public */
export type ComposePageMigrationResult = ComposePageParseResult

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

// setupScript 与 animation 是同形的稳定资源引用，共用一套形状校验，只在字段名与
// issue code 上区分，避免两份规则漂移。
function validateStableAssetReference(
  field: 'setupScript' | 'animation',
  code: 'page.invalid-setup-reference' | 'page.invalid-animation-reference',
  value: unknown,
  issues: ComposePageFileIssue[],
): void {
  const path = [field] as const
  if (!isRecord(value)) {
    issues.push({
      code,
      path,
      message: `${field} 必须是稳定资源引用或 null`,
    })
    return
  }
  const allowed = new Set(['providerId', 'assetKey', 'scope'])
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({
        code,
        path: [...path, key],
        message: `${field} 包含未知字段 ${key}`,
      })
    }
  })
  for (const key of ['providerId', 'assetKey'] as const) {
    if (!isNonEmptyString(value[key])) {
      issues.push({
        code,
        path: [...path, key],
        message: `${key} 必须是非空字符串`,
      })
    }
  }
  if (value.scope !== 'persistent' && value.scope !== 'session') {
    issues.push({
      code,
      path: [...path, 'scope'],
      message: 'scope 必须为 persistent 或 session',
    })
  }
}

/**
 * 判断媒体类型是否为页面。
 *
 * @remarks
 * 这是页面身份的唯一判据：文件名由用户随时可改，把 `Home.page.json` 改成 `Home.json`
 * 不应让它不再是页面。媒体类型由 Asset Provider 上报，属于数据结构而不是命名约定。
 *
 * Provider 有责任为页面文件上报该媒体类型；把存储侧的命名约定翻译成协议元数据是适配层的
 * 职责，消费方一律只看这里的判定结果。
 * @public
 */
export function isComposePageMediaType(mediaType: string | undefined): boolean {
  return mediaType?.toLowerCase() === COMPOSE_PAGE_MEDIA_TYPE
}

/**
 * 判断名称是否符合页面文件的命名约定。
 *
 * @remarks
 * 仅供**创建与规范化名称**使用，以及供 Provider 把存储命名翻译成媒体类型。
 * 判断一个条目是否为页面必须用 {@link isComposePageMediaType}，不要用名称。
 * 纯后缀（名称恰好等于后缀）不算页面，否则会产生显示名为空的页面。
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
export function parseComposePageFile(text: string): ComposePageParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  }
  catch (error) {
    return {
      ok: false,
      issues: [{
        code: 'page.invalid-json',
        path: [],
        message: `页面文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      }],
    }
  }
  return parseComposePageFileValue(parsed)
}

/**
 * 校验一个已解析出来的页面对象。
 *
 * @remarks
 * 与 {@link parseComposePageFile} 共用同一套规则——迁移入口也必须走它，否则改名后的结果会
 * 绕过悬空 `activeFrameId` 之类的既有校验。
 */
function parseComposePageFileValue(parsed: unknown): ComposePageParseResult {
  if (!isRecord(parsed)) {
    return {
      ok: false,
      issues: [{ code: 'page.invalid-shape', path: [], message: '页面文件必须是对象' }],
    }
  }
  const issues: ComposePageFileIssue[] = []
  const allowed = new Set(['kind', 'pageSchemaVersion', 'document', 'setupScript', 'activeFrameId'])
  Object.keys(parsed).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({ code: 'page.invalid-shape', path: [key], message: `页面包含未知字段 ${key}` })
    }
  })
  if (parsed.kind !== 'compose-page') {
    issues.push({
      code: 'page.invalid-shape',
      path: ['kind'],
      message: '页面 kind 必须为 compose-page',
    })
  }
  if (parsed.pageSchemaVersion !== COMPOSE_PAGE_SCHEMA_VERSION) {
    issues.push({
      code: 'page.unsupported-version',
      path: ['pageSchemaVersion'],
      message: `不支持页面版本 ${String(parsed.pageSchemaVersion)}`,
    })
  }
  const documentValidation = validateComposeDocument(parsed.document)
  if (!documentValidation.valid) {
    documentValidation.issues.forEach((issue) => {
      issues.push({ ...issue, path: ['document', ...issue.path] })
    })
  }
  if (parsed.setupScript !== null) {
    validateStableAssetReference(
      'setupScript',
      'page.invalid-setup-reference',
      parsed.setupScript,
      issues,
    )
  }
  // activeFrameId 必须指向一个真实的根 Frame；悬空值报错而不是被静默改写。
  if (parsed.activeFrameId !== undefined && parsed.activeFrameId !== null) {
    const frameId = parsed.activeFrameId
    const validFrame = typeof frameId === 'string'
      && documentValidation.valid
      && documentValidation.document.rootIds.includes(frameId)
    if (!validFrame) {
      issues.push({
        code: 'page.invalid-active-frame',
        path: ['activeFrameId'],
        message: 'activeFrameId 必须指向 rootIds 中的一个 Frame',
      })
    }
  }
  if (issues.length > 0 || !documentValidation.valid) return { ok: false, issues }
  const page = parsed as unknown as ComposePageFile
  return {
    ok: true,
    page: page.activeFrameId === undefined ? { ...page, activeFrameId: null } : page,
  }
}

/**
 * 序列化页面文档为页面文件文本。
 *
 * @remarks
 * 使用两空格缩进并以换行结尾，使页面文件在只读 JSON 查看与外部 diff 中可读。
 * @public
 */
export function serializeComposePageFile(page: ComposePageFile): string {
  // activeFrameId 在类型上可缺省，但落盘格式总是写出该字段，使外部 diff 与升级路径稳定。
  const normalized = page.activeFrameId === undefined ? { ...page, activeFrameId: null } : page
  return `${JSON.stringify(normalized, null, 2)}\n`
}

/**
 * 创建一份空白页面文档。
 *
 * @returns 每次调用均返回可独立修改的新文档：默认视口设置，加一个默认尺寸的空白根 Frame。
 * @public
 */
export function createEmptyComposePageDocument(): ComposeDocument {
  const frameId = 'frame-root'
  const frame = createComposeFrame()
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: [frameId],
    entities: {
      [frameId]: {
        id: frameId,
        name: '画板',
        components: {
          Composition: {
            presetId: 'frame',
            baseComponentKeys: [
              'Composition',
              'Transform',
              'LayoutItem',
              'Visibility',
              'Lock',
              'Hierarchy',
              'Frame',
              'Appearance',
            ],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: frame.size.width, min: 1, max: null },
            height: { mode: 'fixed', value: frame.size.height, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: [] },
          Frame: frame,
          Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        },
      },
    },
  }
}

/** 创建一份未关联 setup 与动画的空白页面聚合文件。 @public */
export function createEmptyComposePageFile(): ComposePageFile {
  return {
    kind: 'compose-page',
    pageSchemaVersion: COMPOSE_PAGE_SCHEMA_VERSION,
    document: createEmptyComposePageDocument(),
    setupScript: null,
    activeFrameId: null,
  }
}

/**
 * 把旧裸 ComposeDocument v6 显式迁移为页面聚合文件。
 *
 * @remarks
 * 正常页面解析不会隐式调用本函数，避免运行时长期兼容两种页面格式。
 * @public
 */
export function migrateLegacyComposePageFile(document: unknown): ComposePageMigrationResult {
  const validation = validateComposeDocument(document)
  return validation.valid
    ? {
        ok: true,
        page: {
          kind: 'compose-page',
          pageSchemaVersion: COMPOSE_PAGE_SCHEMA_VERSION,
          document: validation.document,
          setupScript: null,
          activeFrameId: null,
        },
      }
    : { ok: false, issues: validation.issues }
}

/**
 * 把 `pageSchemaVersion: 2` 的页面文件显式迁移到 3。
 *
 * @remarks
 * 唯一的差异是 `defaultFrameId` 恒等改名为 `activeFrameId`——字段语义从「仅回退目标」升为
 * 「激活目标」，取值不变，因此迁移是纯改名，不解析文档内容也不改写任何 id。
 *
 * 正常解析不会隐式调用本函数：运行路径不长期兼容两种页面版本。
 *
 * @param input 待迁移的 v2 页面文件对象（不是文本）。
 * @returns 迁移后的 v3 页面文件，或定位到具体字段的 issues。输入对象不被修改。
 * @public
 */
export function migrateComposePageFileV2ToV3(input: unknown): ComposePageMigrationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ code: 'page.invalid-shape', path: [], message: '页面文件必须是对象' }],
    }
  }
  if (input.pageSchemaVersion !== 2) {
    return {
      ok: false,
      issues: [{
        code: 'page.unsupported-version',
        path: ['pageSchemaVersion'],
        message: `迁移入口只接受页面版本 2，收到 ${String(input.pageSchemaVersion)}`,
      }],
    }
  }
  const { defaultFrameId, ...rest } = input
  // 迁移结果仍须通过完整校验：改名不豁免悬空 activeFrameId 之类的既有约束。
  return parseComposePageFileValue({
    ...rest,
    pageSchemaVersion: COMPOSE_PAGE_SCHEMA_VERSION,
    activeFrameId: defaultFrameId ?? null,
  })
}

/**
 * 解析页面当前的激活 Frame。
 *
 * @remarks
 * `activeFrameId` 可以缺省或为 null，也可能因为文档编辑（例如删除了那块场景）而悬空。
 * 所有读取侧都必须经由本函数取值，否则各处会各自实现回退，进而出现「预览用一块、
 * 动画绑定用另一块」的分歧。
 *
 * @param page 页面聚合文件。
 * @returns 激活 Frame 的 id；页面没有任何根 Frame 时为 `null`。
 * @public
 */
export function resolveComposePageActiveFrameId(page: ComposePageFile): string | null {
  const rootIds = page.document.rootIds
  const declared = page.activeFrameId
  if (typeof declared === 'string' && rootIds.includes(declared)) return declared
  return rootIds[0] ?? null
}

/** @deprecated 仅用于显式处理旧裸文档；页面运行路径请使用 {@link parseComposePageFile}。 */
export function parseComposePageDocument(text: string):
  | { readonly ok: true; readonly document: ComposeDocument }
  | { readonly ok: false; readonly issues: readonly DocumentValidationIssue[] } {
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
        message: `页面文档不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      }],
    }
  }
  const validation = validateComposeDocument(parsed)
  return validation.valid
    ? { ok: true, document: validation.document }
    : { ok: false, issues: validation.issues }
}

/** @deprecated 仅用于导出旧裸文档；页面写入请使用 {@link serializeComposePageFile}。 */
export function serializeComposePageDocument(document: ComposeDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}
