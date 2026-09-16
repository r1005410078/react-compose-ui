import * as v from 'valibot'

/**
 * 批量录入的解析结果。
 *
 * @remarks
 * 失败时带上**是第几项**（1 起）。只报「有一项不合法」不够——用户贴进来的是二十行数字，
 * 而屏幕上得指出去看哪一行。
 *
 * @internal
 */
export type ComposeBulkArrayParse =
  | { readonly ok: true; readonly items: readonly unknown[] }
  | { readonly ok: false; readonly position: number; readonly text: string }

/**
 * 元素是不是**基本类型**——批量录入只对它们成立。
 *
 * @remarks
 * 「一行一个对象」没有意义，因此对象、数组、union 这些一律不出这个入口。判据走解包之后的
 * `type`，`v.pipe(v.number(), v.minValue(0))` 这类带校验的管道同样算 number。
 *
 * @internal
 */
export function isComposeBulkArrayItem(type: string): boolean {
  return type === 'number' || type === 'string'
}

/**
 * 把当前数组渲染成一行一项的文本。
 *
 * @remarks
 * 与 {@link parseComposeBulkArray} 是一对：「打开、不改、确认」必须是一次无变化的提交，
 * 因此这两个函数的往返要恒等。
 *
 * @internal
 */
export function formatComposeBulkArray(items: readonly unknown[]): string {
  return items.map((item) => (item === null || item === undefined ? '' : String(item))).join('\n')
}

/**
 * 解析批量录入的文本。
 *
 * @remarks
 * 分隔符收三种：换行、制表符、逗号。从表格里复制**一列**得到换行、复制**一行**得到制表符、
 * 从 CSV 粘来得到逗号，而用户不该为了这个差别做第二次操作。
 *
 * 任何一项不合法**整体拒绝**，MUST NOT 只收合法的那些：静默丢弃会让用户贴进 20 个数、看到
 * 18 个，而屏幕上没有任何东西说明少掉的是哪两个。
 *
 * number 走 `Number()` 而不是 `parseFloat`：后者把 `12abc` 读成 12，那正是一次该被拒绝的
 * 输入。空串被 `Number()` 读成 0，因此空项在切分那一步就丢掉了。
 *
 * @internal
 */
export function parseComposeBulkArray(
  text: string,
  itemSchema: v.GenericSchema,
  itemType: string,
): ComposeBulkArrayParse {
  const pieces = text
    .split(/[\n\r\t,]+/u)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
  const items: unknown[] = []
  for (const [index, piece] of pieces.entries()) {
    const candidate: unknown = itemType === 'number' ? Number(piece) : piece
    if (itemType === 'number' && !Number.isFinite(candidate as number)) {
      return { ok: false, position: index + 1, text: piece }
    }
    if (!v.safeParse(itemSchema, candidate).success) {
      return { ok: false, position: index + 1, text: piece }
    }
    items.push(candidate)
  }
  return { ok: true, items }
}
