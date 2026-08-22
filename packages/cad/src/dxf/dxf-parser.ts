/**
 * 一条 DXF 组码对。
 *
 * @remarks
 * 值一律保持字符串，由映射层按组码语义转换——同一个组码在不同实体里可能是长度、角度或标志位，
 * 分词层不该假装认识它们。
 *
 * @internal
 */
export interface DxfPair {
  readonly code: number
  readonly value: string
}

/**
 * 一条 DXF 记录：一个组码 0 开启，到下一个组码 0 为止。
 *
 * @remarks
 * `pairs` 是**数组而不是映射**：`LWPOLYLINE` 的顶点是重复出现的 `10`/`20`，收成
 * 「组码 → 单值」只会剩下最后一个顶点——而这个错误在三角形上看不出来（三点塌成一点会直接被
 * 文档校验拦下），要等到有人导入一条长折线才现形。
 *
 * @internal
 */
export interface DxfRecord {
  /** 组码 0 的值，例如 `SECTION`、`LINE`、`ENDSEC`。 */
  readonly type: string
  readonly pairs: readonly DxfPair[]
}

/**
 * 把 DXF 文本切成组码对。
 *
 * @remarks
 * ASCII DXF 是严格的两行一对：组码一行、值一行。容忍 CRLF 与两侧空白——真实文件常在 Windows
 * 与 Unix 之间来回，而值本身可能带前导空格（例如文字内容）。因此**只对组码那一行 trim**，
 * 值只去掉行尾的 `\r`。
 *
 * 组码不是整数的行直接丢弃：宁可少读一对，也不要把后续所有对错位一格。
 *
 * @internal
 */
export function tokenizeDxf(text: string): readonly DxfPair[] {
  const lines = text.split('\n')
  const pairs: DxfPair[] = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]!.trim())
    if (!Number.isInteger(code)) continue
    pairs.push({ code, value: lines[i + 1]!.replace(/\r$/, '') })
  }
  return pairs
}

/**
 * 把组码对分组成记录。
 *
 * @remarks
 * 组码 0 是唯一的记录边界，这一条对 DXF 的全部段落都成立——`SECTION`、`TABLE`、`BLOCK`、
 * 各类实体都是它开的头。因此分组层不需要认识任何实体类型。
 *
 * @internal
 */
export function groupDxfRecords(pairs: readonly DxfPair[]): readonly DxfRecord[] {
  const records: DxfRecord[] = []
  let type: string | null = null
  let current: DxfPair[] = []
  for (const pair of pairs) {
    if (pair.code === 0) {
      if (type !== null) records.push({ type, pairs: current })
      type = pair.value.trim()
      current = []
      continue
    }
    if (type !== null) current.push(pair)
  }
  if (type !== null) records.push({ type, pairs: current })
  return records
}

/** 记录里某个组码的第一个值；没有时为 undefined。 @internal */
export function firstValue(record: DxfRecord, code: number): string | undefined {
  return record.pairs.find((pair) => pair.code === code)?.value
}

/** 记录里某个组码的全部值，保持出现顺序。 @internal */
export function allValues(record: DxfRecord, code: number): readonly string[] {
  return record.pairs.filter((pair) => pair.code === code).map(({ value }) => value)
}

/** 读一个数值组码；缺失或不是有限数时返回 `fallback`。 @internal */
export function numberValue(record: DxfRecord, code: number, fallback: number): number {
  const raw = firstValue(record, code)
  if (raw === undefined) return fallback
  const parsed = Number(raw.trim())
  return Number.isFinite(parsed) ? parsed : fallback
}
