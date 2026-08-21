import type { JsonValue } from './document-types'
import type {
  ApplyDocumentPatchesResult,
  DocumentPatch,
  DocumentPath,
  PatchIssue,
} from './command-types'

type MutableContainer = Record<string, unknown> | unknown[]

function hasOwn(value: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function cloneDocument<TDocument>(document: TDocument): TDocument {
  return JSON.parse(JSON.stringify(document)) as TDocument
}

function isContainer(value: unknown): value is MutableContainer {
  return value !== null && typeof value === 'object'
}

function getAtPath(root: unknown, path: DocumentPath): unknown {
  let current = root
  for (const segment of path) {
    if (!isContainer(current)) return undefined
    if (Array.isArray(current)) {
      if (typeof segment !== 'number' || segment < 0 || segment >= current.length) return undefined
      current = current[segment]
    }
    else {
      if (typeof segment !== 'string' || !hasOwn(current, segment)) return undefined
      current = current[segment]
    }
  }
  return current
}

function getParent(
  root: unknown,
  path: DocumentPath,
): { container: MutableContainer; key: string | number } | null {
  if (path.length === 0) return null
  const parent = getAtPath(root, path.slice(0, -1))
  if (!isContainer(parent)) return null
  return { container: parent, key: path[path.length - 1] }
}

/**
 * Patch 应用失败的分支。
 *
 * @remarks
 * 单独命名而不是复用 `ApplyDocumentPatchesResult`：后者带文档类型参数，而失败分支不携带
 * 文档，四个私有 helper 因此可以在任意文档类型上复用同一个返回类型。
 */
type PatchFailure = { readonly ok: false; readonly issue: PatchIssue }

function issue(
  code: PatchIssue['code'],
  path: DocumentPath,
  message: string,
): PatchFailure {
  return { ok: false, issue: { code, path, message } }
}

function setPatch(
  root: object,
  patch: Extract<DocumentPatch, { op: 'set' }>,
): { inverse: DocumentPatch } | PatchFailure {
  const target = getParent(root, patch.path)
  if (!target) return issue('patch.invalid-path', patch.path, 'set 路径不存在')
  const { container, key } = target
  if (Array.isArray(container)) {
    if (typeof key !== 'number' || key < 0 || key >= container.length) {
      return issue('patch.invalid-index', patch.path, 'set 数组索引越界')
    }
    const previous = container[key] as JsonValue
    container[key] = patch.value
    return { inverse: { op: 'set', path: patch.path, value: previous } }
  }
  if (typeof key !== 'string') {
    return issue('patch.invalid-path', patch.path, '对象字段必须使用字符串路径')
  }
  const existed = hasOwn(container, key)
  const previous = container[key] as JsonValue
  container[key] = patch.value
  return {
    inverse: existed
      ? { op: 'set', path: patch.path, value: previous }
      : { op: 'remove', path: patch.path },
  }
}

function insertPatch(
  root: object,
  patch: Extract<DocumentPatch, { op: 'insert' }>,
): { inverse: DocumentPatch } | PatchFailure {
  const target = getAtPath(root, patch.path)
  if (!Array.isArray(target)) {
    return issue('patch.invalid-path', patch.path, 'insert 目标必须是数组')
  }
  if (!Number.isInteger(patch.index) || patch.index < 0 || patch.index > target.length) {
    return issue('patch.invalid-index', [...patch.path, patch.index], 'insert 数组索引越界')
  }
  target.splice(patch.index, 0, patch.value)
  return { inverse: { op: 'remove', path: [...patch.path, patch.index] } }
}

function removePatch(
  root: object,
  patch: Extract<DocumentPatch, { op: 'remove' }>,
): { inverse: DocumentPatch } | PatchFailure {
  const target = getParent(root, patch.path)
  if (!target) return issue('patch.invalid-path', patch.path, 'remove 路径不存在')
  const { container, key } = target
  if (Array.isArray(container)) {
    if (typeof key !== 'number' || key < 0 || key >= container.length) {
      return issue('patch.invalid-index', patch.path, 'remove 数组索引越界')
    }
    const [previous] = container.splice(key, 1) as JsonValue[]
    return {
      inverse: {
        op: 'insert',
        path: patch.path.slice(0, -1),
        index: key,
        value: previous,
      },
    }
  }
  if (typeof key !== 'string' || !hasOwn(container, key)) {
    return issue('patch.invalid-path', patch.path, 'remove 对象字段不存在')
  }
  const previous = container[key] as JsonValue
  delete container[key]
  return { inverse: { op: 'set', path: patch.path, value: previous } }
}

function movePatch(
  root: object,
  patch: Extract<DocumentPatch, { op: 'move' }>,
): { inverse: DocumentPatch } | PatchFailure {
  const target = getAtPath(root, patch.path)
  if (!Array.isArray(target)) {
    return issue('patch.invalid-path', patch.path, 'move 目标必须是数组')
  }
  if (
    !Number.isInteger(patch.from)
    || !Number.isInteger(patch.to)
    || patch.from < 0
    || patch.from >= target.length
    || patch.to < 0
    || patch.to >= target.length
  ) {
    return issue('patch.invalid-index', patch.path, 'move 数组索引越界')
  }
  const [value] = target.splice(patch.from, 1)
  target.splice(patch.to, 0, value)
  return {
    inverse: { op: 'move', path: patch.path, from: patch.to, to: patch.from },
  }
}

/**
 * 在文档克隆上原子应用 Patch，并捕获逆序 inverse。
 *
 * @param document - 不会被原地修改的当前文档。
 * @param patches - 按顺序应用的 forward Patch。
 * @returns 成功候选文档与 inverse，或第一个失败问题。
 * @public
 */
export function applyDocumentPatches<TDocument extends object>(
  document: TDocument,
  patches: readonly DocumentPatch[],
): ApplyDocumentPatchesResult<TDocument> {
  const candidate = cloneDocument(document)
  const inverse: DocumentPatch[] = []
  for (const patch of patches) {
    const result = patch.op === 'set'
      ? setPatch(candidate, patch)
      : patch.op === 'insert'
        ? insertPatch(candidate, patch)
        : patch.op === 'remove'
          ? removePatch(candidate, patch)
          : movePatch(candidate, patch)
    if ('ok' in result) return result
    inverse.unshift(result.inverse)
  }
  return { ok: true, document: candidate, inverse }
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right || left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => jsonEqual(item, right[index]))
  }
  if (typeof left !== 'object' || typeof right !== 'object') return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => hasOwn(rightRecord, key)
      && jsonEqual(leftRecord[key], rightRecord[key]))
}
