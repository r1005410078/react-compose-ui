import type { ComposeVirtualTextInsertion } from './script-intelligence-types'

interface ComposeTextRange {
  readonly offset: number
  readonly length: number
}

interface AppliedInsertion extends ComposeVirtualTextInsertion {
  readonly virtualStart: number
  readonly virtualEnd: number
}

/** 可见源码与插入隐藏文本后的 shadow source 之间的映射。 @internal */
export interface ComposeVirtualTextDocument {
  readonly text: string
  sourceOffsetToVirtual(offset: number): number | null
  virtualOffsetToSource(offset: number): number | null
  sourceRangeToVirtual(offset: number, length: number): ComposeTextRange | null
  virtualRangeToSource(offset: number, length: number): ComposeTextRange | null
}

function isValidRange(offset: number, length: number, sourceLength: number) {
  return Number.isInteger(offset)
    && Number.isInteger(length)
    && offset >= 0
    && length >= 0
    && offset + length <= sourceLength
}

/**
 * 应用仅插入型虚拟文本并建立 UTF-16 offset 映射。
 *
 * @returns 插入非法时返回 `null`，调用方应退化为普通 JavaScript 编辑。
 * @internal
 */
export function createComposeVirtualTextDocument(
  source: string,
  insertions: readonly ComposeVirtualTextInsertion[],
): ComposeVirtualTextDocument | null {
  let previousOffset = -1
  let insertedLength = 0
  const applied: AppliedInsertion[] = []

  for (const insertion of insertions) {
    if (!Number.isInteger(insertion.offset)
      || insertion.offset < 0
      || insertion.offset > source.length
      || insertion.offset <= previousOffset
      || insertion.text.length === 0) {
      return null
    }
    const virtualStart = insertion.offset + insertedLength
    const virtualEnd = virtualStart + insertion.text.length
    applied.push({ ...insertion, virtualStart, virtualEnd })
    insertedLength += insertion.text.length
    previousOffset = insertion.offset
  }

  let cursor = 0
  let text = ''
  for (const insertion of applied) {
    text += source.slice(cursor, insertion.offset)
    text += insertion.text
    cursor = insertion.offset
  }
  text += source.slice(cursor)

  const sourceOffsetToVirtualWithAffinity = (
    offset: number,
    affinity: 'before' | 'after',
  ) => {
    if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return null
    let delta = 0
    for (const insertion of applied) {
      if (insertion.offset < offset
        || (affinity === 'after' && insertion.offset === offset)) {
        delta += insertion.text.length
      }
    }
    return offset + delta
  }

  const virtualOffsetToSource = (offset: number) => {
    if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return null
    let delta = 0
    for (const insertion of applied) {
      if (offset > insertion.virtualStart && offset < insertion.virtualEnd) return null
      if (offset === insertion.virtualStart && insertion.virtualStart !== insertion.virtualEnd) {
        return insertion.offset
      }
      if (insertion.virtualEnd <= offset) delta += insertion.text.length
    }
    return offset - delta
  }

  return {
    text,
    sourceOffsetToVirtual: (offset) => sourceOffsetToVirtualWithAffinity(offset, 'after'),
    virtualOffsetToSource,
    sourceRangeToVirtual: (offset, length) => {
      if (!isValidRange(offset, length, source.length)) return null
      const end = offset + length
      if (applied.some((insertion) => insertion.offset > offset && insertion.offset < end)) {
        return null
      }
      const virtualStart = sourceOffsetToVirtualWithAffinity(offset, 'after')
      const virtualEnd = sourceOffsetToVirtualWithAffinity(end, 'before')
      if (virtualStart === null || virtualEnd === null || virtualEnd < virtualStart) return null
      return { offset: virtualStart, length: virtualEnd - virtualStart }
    },
    virtualRangeToSource: (offset, length) => {
      if (!isValidRange(offset, length, text.length)) return null
      const end = offset + length
      const touchesInsertion = applied.some((insertion) => length === 0
        ? offset > insertion.virtualStart && offset < insertion.virtualEnd
        : offset < insertion.virtualEnd && end > insertion.virtualStart)
      if (touchesInsertion) return null
      const sourceStart = virtualOffsetToSource(offset)
      const sourceEnd = virtualOffsetToSource(end)
      if (sourceStart === null || sourceEnd === null || sourceEnd < sourceStart) return null
      return { offset: sourceStart, length: sourceEnd - sourceStart }
    },
  }
}
