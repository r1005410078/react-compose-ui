import type { JsonObject, JsonValue } from '../document-types'
import type { ComposeAppManifest } from './page-types'
import { COMPOSE_APP_MANIFEST_SCHEMA_VERSION } from './page-types'

/** 应用清单解析问题的稳定分类。 @public */
export type ComposeAppManifestIssueCode =
  | 'invalid-json'
  | 'invalid-shape'
  | 'unsupported-version'

/** 一条应用清单解析问题。 @public */
export interface ComposeAppManifestIssue {
  readonly code: ComposeAppManifestIssueCode
  readonly message: string
}

/** 应用清单解析结果。 @public */
export interface ComposeAppManifestParseResult {
  /** 解析出的清单；任何问题都降级为无首页而不是失败。 */
  readonly manifest: ComposeAppManifest
  /**
   * 清单中不属于当前 Schema 的顶层字段。
   *
   * @remarks
   * 由 {@link serializeComposeAppManifest} 原样写回，因此设首页不会覆盖宿主自有的清单数据。
   */
  readonly unknownFields: JsonObject
  readonly issues: readonly ComposeAppManifestIssue[]
}

/** 无首页的空清单。 @public */
export function createEmptyComposeAppManifest(): ComposeAppManifest {
  return { schemaVersion: COMPOSE_APP_MANIFEST_SCHEMA_VERSION, homePageKey: null }
}

/**
 * 宽容解析应用清单文本。
 *
 * @remarks
 * 清单是纯配置，损坏时不应让整个资源面板不可用，因此内容缺失、非法 JSON、结构不符或版本不受
 * 支持都降级为「无首页」并附带 issue，由宿主以非阻断方式提示。
 *
 * @param text - 清单文件文本；传入 undefined 表示清单不存在。
 * @public
 */
export function parseComposeAppManifest(text: string | undefined): ComposeAppManifestParseResult {
  if (text === undefined || text.trim().length === 0) {
    return { manifest: createEmptyComposeAppManifest(), unknownFields: {}, issues: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  }
  catch (error) {
    return {
      manifest: createEmptyComposeAppManifest(),
      unknownFields: {},
      issues: [{
        code: 'invalid-json',
        message: `应用清单不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      }],
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      manifest: createEmptyComposeAppManifest(),
      unknownFields: {},
      issues: [{ code: 'invalid-shape', message: '应用清单必须是对象' }],
    }
  }
  const record = parsed as Record<string, unknown>
  const issues: ComposeAppManifestIssue[] = []
  const unknownFields: Record<string, JsonValue> = {}
  Object.entries(record).forEach(([key, value]) => {
    if (key === 'schemaVersion' || key === 'homePageKey') return
    unknownFields[key] = value as JsonValue
  })
  if (record.schemaVersion !== COMPOSE_APP_MANIFEST_SCHEMA_VERSION) {
    issues.push({
      code: 'unsupported-version',
      message: `只支持应用清单 schemaVersion ${COMPOSE_APP_MANIFEST_SCHEMA_VERSION}`,
    })
    return { manifest: createEmptyComposeAppManifest(), unknownFields, issues }
  }
  const homePageKey = record.homePageKey
  if (homePageKey !== null && typeof homePageKey !== 'string') {
    issues.push({ code: 'invalid-shape', message: 'homePageKey 必须是字符串或 null' })
    return { manifest: createEmptyComposeAppManifest(), unknownFields, issues }
  }
  return {
    manifest: {
      schemaVersion: COMPOSE_APP_MANIFEST_SCHEMA_VERSION,
      homePageKey: homePageKey === '' ? null : homePageKey,
    },
    unknownFields,
    issues,
  }
}

/**
 * 序列化应用清单为清单文件文本。
 *
 * @param unknownFields - 解析时保留的未知顶层字段；协议字段优先，不会被其覆盖。
 * @public
 */
export function serializeComposeAppManifest(
  manifest: ComposeAppManifest,
  unknownFields: JsonObject = {},
): string {
  return `${JSON.stringify({ ...unknownFields, ...manifest }, null, 2)}\n`
}

/**
 * 改写清单的首页指向。
 *
 * @returns 首页未变化时返回原清单，便于调用方跳过一次写入。
 * @public
 */
export function setComposeAppManifestHomePage(
  manifest: ComposeAppManifest,
  pageKey: string | null,
): ComposeAppManifest {
  const next = pageKey === null || pageKey.length === 0 ? null : pageKey
  return next === manifest.homePageKey ? manifest : { ...manifest, homePageKey: next }
}
