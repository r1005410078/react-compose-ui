import { describe, expect, it } from 'vitest'
import { createEmptyCadDocument, type CadDocument } from '../document'
import { createFakeAssetProvider } from '../test-fixtures'
import { serializeComposeCadDocument } from './cad-file'
import { createComposeCadStore } from './cad-store'

function documentWithLayer(name: string): CadDocument {
  const base = createEmptyCadDocument()
  return { ...base, layers: [{ ...base.layers[0]!, name }] }
}

function storeOn(files: Record<string, string> = {}) {
  const fake = createFakeAssetProvider({ files })
  return { fake, store: createComposeCadStore({ provider: fake.provider }) }
}

describe('CAD 文件协议与 Store', () => {
  it('OpenSpec: cad-document / CAD 文件协议与 Store / 新建后可读回', async () => {
    const { store } = storeOn()
    const created = await store.createDocument({
      parentId: null,
      fileName: 'Topology',
      document: documentWithLayer('主图层'),
    })
    expect(created.assetKey).toBe('Topology.cad.json')

    store.invalidate()
    const read = await store.readDocument(created.assetKey)
    expect(read.document.layers[0]?.name).toBe('主图层')
    expect(read.revision).toBe(created.revision)

    const catalog = await store.listDocuments()
    expect(catalog.documents.map(({ displayName }) => displayName)).toEqual(['Topology'])
    expect(catalog.issues).toEqual([])
  })

  it('保存使用 revision 做乐观并发校验', async () => {
    const { store } = storeOn()
    const created = await store.createDocument({
      parentId: null,
      fileName: 'Wiring',
      document: createEmptyCadDocument(),
    })
    const saved = await store.saveDocument(
      created.assetKey,
      documentWithLayer('已改名'),
      created.revision,
    )
    expect(saved.document.layers[0]?.name).toBe('已改名')

    await expect(store.saveDocument(
      created.assetKey,
      documentWithLayer('过期写入'),
      created.revision,
    )).rejects.toThrow()
  })

  it('OpenSpec: cad-document / CAD 文件协议与 Store / 拒绝写入非法文档', async () => {
    const { fake, store } = storeOn()
    const created = await store.createDocument({
      parentId: null,
      fileName: 'Guard',
      document: createEmptyCadDocument(),
    })
    const before = fake.getFile(created.assetKey)

    const illegal = { ...createEmptyCadDocument(), layers: [] } as unknown as CadDocument
    await expect(store.saveDocument(created.assetKey, illegal, created.revision))
      .rejects.toThrow(/拒绝写入非法 CAD 文档/)
    expect(fake.getFile(created.assetKey)).toBe(before)

    await expect(store.createDocument({ parentId: null, fileName: 'Bad', document: illegal }))
      .rejects.toThrow(/拒绝写入非法 CAD 文档/)
    expect(fake.getFile('Bad.cad.json')).toBeUndefined()
  })

  it('OpenSpec: cad-document / CAD 文件协议与 Store / 损坏文件不阻断列举', async () => {
    const { store } = storeOn({
      'Good.cad.json': serializeComposeCadDocument(createEmptyCadDocument()),
      'Broken.cad.json': '{ 这不是 JSON',
    })
    const catalog = await store.listDocuments()
    expect(catalog.documents.map(({ displayName }) => displayName)).toEqual(['Good'])
    expect(catalog.issues.map(({ assetKey }) => assetKey)).toEqual(['Broken.cad.json'])
  })

  it('Provider 缺少创建能力时给出可辨识的错误', async () => {
    const fake = createFakeAssetProvider({ omit: ['createFile'] })
    const store = createComposeCadStore({ provider: fake.provider })
    await expect(store.createDocument({
      parentId: null,
      fileName: 'X',
      document: createEmptyCadDocument(),
    })).rejects.toThrow(/不支持创建 CAD 文件/)
  })

  it('外部写入触发失效通知后重新读取', async () => {
    const { fake, store } = storeOn({
      'Topology.cad.json': serializeComposeCadDocument(documentWithLayer('原名')),
    })
    expect((await store.readDocument('Topology.cad.json')).document.layers[0]?.name).toBe('原名')

    fake.setFile('Topology.cad.json', serializeComposeCadDocument(documentWithLayer('外部改名')))
    fake.notify()
    expect((await store.readDocument('Topology.cad.json')).document.layers[0]?.name)
      .toBe('外部改名')
  })
})
