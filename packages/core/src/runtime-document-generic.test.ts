import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from './runtime'
import type { CommandHandler, DocumentValidator } from './index'

/** 一个与 ComposeDocument 完全无关的最小文档类型。 */
interface SketchDocument {
  readonly kind: 'sketch'
  readonly lines: readonly { readonly id: string; readonly length: number }[]
}

function sketch(lines: SketchDocument['lines'] = []): SketchDocument {
  return { kind: 'sketch', lines }
}

/**
 * 只接受 kind 正确且长度为正的文档，并把长度规范化为整数。
 *
 * 规范化不是装饰：运行时必须采用校验器返回的那一份，否则第一次 dispatch 就会把规范化悄悄
 * 回退成送入校验的原始值。
 */
const validateSketch: DocumentValidator<SketchDocument> = (input) => {
  const candidate = input as SketchDocument
  if (candidate?.kind !== 'sketch' || !Array.isArray(candidate.lines)) {
    return { valid: false, issues: [{ code: 'document.invalid', path: [], message: '不是 sketch 文档' }] }
  }
  const invalid = candidate.lines.find((line) => !(line.length > 0))
  if (invalid) {
    return {
      valid: false,
      issues: [{ code: 'document.invalid', path: ['lines'], message: `长度必须为正：${invalid.id}` }],
    }
  }
  return {
    valid: true,
    document: { ...candidate, lines: candidate.lines.map((line) => ({ ...line, length: Math.round(line.length) })) },
  }
}

const appendLine: CommandHandler<SketchDocument> = {
  type: 'sketch.line.append',
  execute(document, command) {
    const { id, length } = command.payload as { id: string; length: number }
    return {
      status: 'patches',
      patches: [{ op: 'insert', path: ['lines'], index: document.lines.length, value: { id, length } }],
    }
  },
}

function runtime(document = sketch()) {
  return createDocumentTransactionRuntime<SketchDocument>({
    document,
    validate: validateSketch,
    handlers: [appendLine],
  })
}

function append(id: string, length: number) {
  return { id: `cmd-${id}`, type: 'sketch.line.append', payload: { id, length } }
}

describe('可注入的文档校验器', () => {
  it('OpenSpec: command-transaction / 可注入的文档校验器 / 其他文档类型获得事务与历史', () => {
    const store = runtime()
    expect(store.dispatch(append('a', 10)).status).toBe('committed')
    expect(store.dispatch(append('b', 20)).status).toBe('committed')
    expect(store.document.lines.map((line) => line.id)).toEqual(['a', 'b'])

    store.undo()
    expect(store.document.lines.map((line) => line.id)).toEqual(['a'])
    store.redo()
    expect(store.document.lines.map((line) => line.id)).toEqual(['a', 'b'])

    expect(store.reset(sketch([{ id: 'c', length: 5 }])).status).toBe('reset')
    expect(store.document.lines).toEqual([{ id: 'c', length: 5 }])
    expect(store.canUndo).toBe(false)
  })

  it('OpenSpec: command-transaction / 可注入的文档校验器 / 采用校验器返回的文档', () => {
    // 初始文档与 dispatch 结果都要经过规范化：取错哪一份，长度都会停在未取整的原值。
    const store = runtime(sketch([{ id: 'a', length: 10.4 }]))
    expect(store.document.lines[0]?.length).toBe(10)

    store.dispatch(append('b', 20.6))
    expect(store.document.lines[1]?.length).toBe(21)
  })

  it('OpenSpec: command-transaction / 可注入的文档校验器 / 校验器拒绝时不提交', () => {
    const store = runtime()
    const result = store.dispatch(append('a', -1))
    expect(result.status).toBe('rejected')
    expect(store.document.lines).toEqual([])
    expect(store.canUndo).toBe(false)
  })

  it('OpenSpec: command-transaction / 可注入的文档校验器 / 不注册 ComposeDocument 内建命令', () => {
    // 内建的 entity.* 词汇属于 ComposeDocument，泛型运行时不得预置——否则其他文档类型会
    // 拿到一批必然失败的 handler，且这些 type 还会占位。
    const store = runtime()
    expect(store.dispatch({ id: 'cmd-x', type: 'entity.transform.set', payload: {} }).status)
      .toBe('rejected')
  })
})
