import { describe, expect, it } from 'vitest'
import { COMPOSE_PAGE_MEDIA_TYPE } from './page-types'
import {
  composePageDisplayName,
  composePageFileName,
  createEmptyComposePageDocument,
  isComposePageFileName,
  isComposePageMediaType,
  parseComposePageDocument,
  serializeComposePageDocument,
} from './page-file'

describe('OpenSpec: compose-document / 页面文件约定', () => {
  it('识别页面文件并完成显示名双向转换', () => {
    expect(isComposePageFileName('Home.page.json')).toBe(true)
    expect(composePageDisplayName('Home.page.json')).toBe('Home')
    expect(composePageFileName('Home')).toBe('Home.page.json')
  })

  it('页面身份只由媒体类型决定，与文件名无关', () => {
    expect(isComposePageMediaType(COMPOSE_PAGE_MEDIA_TYPE)).toBe(true)
    // 大小写不敏感：媒体类型的比较按小写进行。
    expect(isComposePageMediaType(COMPOSE_PAGE_MEDIA_TYPE.toUpperCase())).toBe(true)
    expect(isComposePageMediaType('application/json')).toBe(false)
    expect(isComposePageMediaType(undefined)).toBe(false)
    // 名称助手只服务于创建与规范化，不表达身份。
    expect(isComposePageFileName('Home.page.json')).toBe(true)
    expect(isComposePageMediaType('application/json')).toBe(false)
  })

  it('把已带后缀的输入视为同一文件名，并裁剪空白', () => {
    expect(composePageFileName('Home.page.json')).toBe('Home.page.json')
    expect(composePageFileName('  Detail  ')).toBe('Detail.page.json')
  })

  it('拒绝非页面文件且不改写其名称', () => {
    expect(isComposePageFileName('Home.json')).toBe(false)
    expect(isComposePageFileName('page.json.txt')).toBe(false)
    // 名称恰好等于后缀会得到空显示名，因此不算页面文件。
    expect(isComposePageFileName('.page.json')).toBe(false)
    expect(composePageDisplayName('logo.svg')).toBe('logo.svg')
  })

  it('创建的空白页面文档是 v6、无实体且每次独立', () => {
    const first = createEmptyComposePageDocument()
    const second = createEmptyComposePageDocument()
    expect(first.schemaVersion).toBe(6)
    expect(first.rootIds).toEqual([])
    expect(first.entities).toEqual({})
    expect(first.output.width).toBeGreaterThan(0)
    expect(first.canvas).not.toBe(second.canvas)
  })

  it('往返序列化保持页面文档等价', () => {
    const document = createEmptyComposePageDocument()
    const result = parseComposePageDocument(serializeComposePageDocument(document))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.document).toEqual(document)
  })

  it('解析非法 JSON 返回 issue 而不抛异常', () => {
    const result = parseComposePageDocument('{ not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).not.toHaveLength(0)
      expect(result.issues[0]?.code).toBe('document.invalid')
    }
  })

  it('解析非 v5 文档返回版本 issue', () => {
    const document = createEmptyComposePageDocument()
    const text = JSON.stringify({ ...document, schemaVersion: 4 })
    const result = parseComposePageDocument(text)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code))
        .toContain('document.unsupported-version')
    }
  })
})
