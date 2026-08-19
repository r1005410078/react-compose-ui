import { describe, expect, it } from 'vitest'
import { COMPOSE_PAGE_MEDIA_TYPE } from './page-types'
import {
  composePageDisplayName,
  composePageFileName,
  createEmptyComposePageFile,
  isComposePageFileName,
  isComposePageMediaType,
  migrateComposePageFileV2ToV3,
  migrateLegacyComposePageFile,
  parseComposePageFile,
  resolveComposePageActiveFrameId,
  serializeComposePageFile,
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

  it('OpenSpec: compose-document / 页面文件约定 / 创建空白页面包装', () => {
    const first = createEmptyComposePageFile()
    const second = createEmptyComposePageFile()
    expect(first).toMatchObject({
      kind: 'compose-page',
      pageSchemaVersion: 3,
      setupScript: null,
      document: { schemaVersion: 7, rootIds: ['frame-root'] },
    })
    // 空白页面自带一个默认尺寸的根 Frame，而不是空的 rootIds。
    const frame = first.document.entities['frame-root']!.components.Frame as { size: { width: number } }
    expect(frame.size.width).toBeGreaterThan(0)
    expect(first.document.canvas).not.toBe(second.document.canvas)
  })

  it('OpenSpec: compose-document / 页面文件约定 / 往返聚合页面与 setup 引用', () => {
    const empty = createEmptyComposePageFile()
    const page = {
      ...empty,
      setupScript: {
        providerId: 'project',
        assetKey: 'scripts/Home.setup.js',
        scope: 'persistent' as const,
      },
    }
    const result = parseComposePageFile(serializeComposePageFile(page))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.page).toEqual(page)
  })

  it('OpenSpec: compose-document / 页面文件约定 / 非法 JSON 返回页面 issue', () => {
    const result = parseComposePageFile('{ not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).not.toHaveLength(0)
      expect(result.issues[0]?.code).toBe('page.invalid-json')
    }
  })

  it('OpenSpec: compose-document / 页面文件约定 / 拒绝版本、document 与 setup 引用错误', () => {
    const page = createEmptyComposePageFile()
    const unsupported = parseComposePageFile(JSON.stringify({ ...page, pageSchemaVersion: 2 }))
    expect(unsupported.ok).toBe(false)
    if (!unsupported.ok) {
      expect(unsupported.issues).toContainEqual(expect.objectContaining({
        code: 'page.unsupported-version',
        path: ['pageSchemaVersion'],
      }))
    }

    const invalidDocument = parseComposePageFile(JSON.stringify({
      ...page,
      document: { ...page.document, schemaVersion: 4 },
    }))
    expect(invalidDocument.ok).toBe(false)
    if (!invalidDocument.ok) {
      expect(invalidDocument.issues).toContainEqual(expect.objectContaining({
        code: 'document.unsupported-version',
        path: ['document', 'schemaVersion'],
      }))
    }

    const invalidSetup = parseComposePageFile(JSON.stringify({
      ...page,
      setupScript: { providerId: '', assetKey: 'a.ts', scope: 'project' },
    }))
    expect(invalidSetup.ok).toBe(false)
    if (!invalidSetup.ok) {
      expect(invalidSetup.issues.map((issue) => issue.code))
        .toContain('page.invalid-setup-reference')
    }
  })

  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 缺省 activeFrameId 归一化为 null', () => {
    const page = { ...createEmptyComposePageFile() }
    delete (page as { activeFrameId?: unknown }).activeFrameId
    const result = parseComposePageFile(`${JSON.stringify(page, null, 2)}\n`)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.page.activeFrameId).toBeNull()
  })

  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 序列化总是写出 activeFrameId', () => {
    const page = { ...createEmptyComposePageFile() }
    delete (page as { activeFrameId?: unknown }).activeFrameId
    expect(JSON.parse(serializeComposePageFile(page))).toHaveProperty('activeFrameId', null)
  })

  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 往返默认 Frame 并拒绝悬空值', () => {
    const empty = createEmptyComposePageFile()
    const page = { ...empty, activeFrameId: empty.document.rootIds[0]! }
    const roundTrip = parseComposePageFile(serializeComposePageFile(page))
    expect(roundTrip.ok).toBe(true)
    if (roundTrip.ok) expect(roundTrip.page).toEqual(page)

    const dangling = parseComposePageFile(JSON.stringify({ ...page, activeFrameId: 'missing' }))
    expect(dangling.ok).toBe(false)
    if (!dangling.ok) {
      expect(dangling.issues.map((issue) => issue.code)).toContain('page.invalid-active-frame')
    }
  })

  it('OpenSpec: compose-document / 页面文件约定 / 普通解析不接受旧裸文档', () => {
    const result = parseComposePageFile(JSON.stringify(createEmptyComposePageFile().document))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code))
        .toContain('page.invalid-shape')
    }
  })

  it('OpenSpec: compose-document / 页面文件约定 / 显式迁移旧裸 v6 页面', () => {
    const document = createEmptyComposePageFile().document
    const result = migrateLegacyComposePageFile(document)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.page).toEqual({
        kind: 'compose-page',
        pageSchemaVersion: 3,
        document,
        setupScript: null,
        activeFrameId: null,
      })
    }
  })
  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 页面文件 2 到 3 显式迁移', () => {
    const empty = createEmptyComposePageFile()
    const frameId = empty.document.rootIds[0]!
    const v2 = {
      kind: 'compose-page',
      pageSchemaVersion: 2,
      document: empty.document,
      setupScript: null,
      defaultFrameId: frameId,
    }
    const snapshot = JSON.stringify(v2)
    const result = migrateComposePageFileV2ToV3(v2)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.page).toEqual({
        kind: 'compose-page',
        pageSchemaVersion: 3,
        document: empty.document,
        setupScript: null,
        activeFrameId: frameId,
      })
    }
    // 迁移是纯函数：输入对象不得被就地改写。
    expect(JSON.stringify(v2)).toBe(snapshot)
  })

  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 迁移入口拒绝非 2 版本', () => {
    const result = migrateComposePageFileV2ToV3(createEmptyComposePageFile())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('page.unsupported-version')
    }
  })

  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 迁移结果仍受悬空校验约束', () => {
    const empty = createEmptyComposePageFile()
    const result = migrateComposePageFileV2ToV3({
      kind: 'compose-page',
      pageSchemaVersion: 2,
      document: empty.document,
      setupScript: null,
      defaultFrameId: 'missing',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('page.invalid-active-frame')
    }
  })

  it('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定 / 解析激活 Frame 时回退第一个根 Frame', () => {
    const empty = createEmptyComposePageFile()
    const frameId = empty.document.rootIds[0]!
    expect(resolveComposePageActiveFrameId(empty)).toBe(frameId)
    expect(resolveComposePageActiveFrameId({ ...empty, activeFrameId: frameId })).toBe(frameId)
    // 文档编辑可能让 activeFrameId 悬空（例如那块场景被删掉），读取侧回退而不是抛错。
    expect(resolveComposePageActiveFrameId({ ...empty, activeFrameId: 'missing' })).toBe(frameId)
  })
})
