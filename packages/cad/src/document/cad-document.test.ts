import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { CommandHandler, DocumentValidationIssueShape } from '@compose-ui/core'
import { createEmptyCadDocument, validateCadDocument } from './cad-document'
import { CAD_DEFAULT_LAYER_ID, type CadDocument } from './cad-document-types'

function codes(input: unknown) {
  const result = validateCadDocument(input)
  return result.valid ? [] : result.issues.map(({ code }) => code)
}

function entity(id: string) {
  return { id, name: id, components: {} }
}

describe('CadDocument v1 协议', () => {
  it('OpenSpec: cad-document / CadDocument v1 协议 / 空文档合法且带默认图层', () => {
    const document = createEmptyCadDocument()
    const result = validateCadDocument(document)
    expect(result.valid).toBe(true)
    expect(document.layers).toHaveLength(1)
    expect(document.layers[0]?.id).toBe(CAD_DEFAULT_LAYER_ID)
    expect(document.entities).toEqual({})
    // 无限图纸：文档不带任何画布或输出尺寸。
    expect(document).not.toHaveProperty('canvas')
    expect(document).not.toHaveProperty('size')
  })

  it('OpenSpec: cad-document / CadDocument v1 协议 / 缺少图层被拒绝', () => {
    expect(codes({ ...createEmptyCadDocument(), layers: [] })).toContain('layer.empty')
    const layer = createEmptyCadDocument().layers[0]!
    expect(codes({ ...createEmptyCadDocument(), layers: [layer, { ...layer, name: '副本' }] }))
      .toContain('layer.duplicate-id')
    expect(codes({ ...createEmptyCadDocument(), layers: [{ id: 'a', name: 'a' }] }))
      .toContain('layer.invalid')
  })

  it('OpenSpec: cad-document / CadDocument v1 协议 / 结构完整性', () => {
    const base = createEmptyCadDocument()
    expect(codes({ ...base, rootIds: ['missing'] })).toContain('document.missing-root')
    expect(codes({ ...base, entities: { a: entity('b') } })).toContain('entity.id-mismatch')
    expect(codes({ ...base, entities: { a: entity('a') } })).toContain('document.orphan-entity')
    expect(codes({ ...base, entities: { a: entity('a') }, rootIds: ['a', 'a'] }))
      .toContain('document.duplicate-root')
  })

  it('版本与单位是硬约束', () => {
    expect(codes({ ...createEmptyCadDocument(), schemaVersion: 2 }))
      .toContain('document.unsupported-version')
    expect(codes({ ...createEmptyCadDocument(), units: 'mm' })).toContain('document.invalid-units')
    expect(codes('not an object')).toContain('document.invalid')
  })

  it('合法时返回规范化后的文档，多余字段被剔除', () => {
    const result = validateCadDocument({ ...createEmptyCadDocument(), extra: '应当被丢弃' })
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.document).not.toHaveProperty('extra')
  })
})

describe('接入通用事务运行时', () => {
  const addEntity: CommandHandler<CadDocument> = {
    type: 'cad.entity.add',
    execute(document, command) {
      const { id } = command.payload as { id: string }
      return {
        status: 'patches',
        patches: [
          { op: 'set', path: ['entities', id], value: { id, name: id, components: {} } },
          { op: 'insert', path: ['rootIds'], index: document.rootIds.length, value: id },
        ],
      }
    },
  }

  it('OpenSpec: cad-document / CadDocument v1 协议 / 接入通用事务运行时', () => {
    const runtime = createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
      document: createEmptyCadDocument(),
      validate: validateCadDocument,
      handlers: [addEntity],
    })

    expect(runtime.dispatch({ id: 'c1', type: 'cad.entity.add', payload: { id: 'line-1' } }).status)
      .toBe('committed')
    expect(runtime.document.rootIds).toEqual(['line-1'])

    runtime.undo()
    expect(runtime.document.rootIds).toEqual([])
    runtime.redo()
    expect(runtime.document.rootIds).toEqual(['line-1'])

    // ComposeDocument 的内建命令词汇不应被预置给 CAD 文档。
    expect(runtime.dispatch({ id: 'c2', type: 'entity.transform.set', payload: {} }).status)
      .toBe('rejected')
  })

  it('校验拒绝的命令不改变文档', () => {
    const runtime = createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
      document: createEmptyCadDocument(),
      validate: validateCadDocument,
      handlers: [{
        type: 'cad.entity.orphan',
        // 只写 entities 不写 rootIds，因此产出一个孤儿，必须被校验拦下。
        execute: () => ({
          status: 'patches',
          patches: [{ op: 'set', path: ['entities', 'x'], value: entity('x') }],
        }),
      }],
    })
    expect(runtime.dispatch({ id: 'c1', type: 'cad.entity.orphan', payload: {} }).status)
      .toBe('rejected')
    expect(runtime.document.entities).toEqual({})
  })
})
