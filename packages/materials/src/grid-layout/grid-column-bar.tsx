/**
 * 列数的内联指示条。
 *
 * @remarks
 * 12 与 8 的差别在画布上要数格子，而这条 N 段的小条一眼就读得出来。它**不是**一个预览
 * 区块——网格的字段全是数字，画布本身就是结果；这里只把「列数」这一个不易目测的数变成
 * 可以一眼比较的形状。
 *
 * 列数很大时按可读下限收窄段数：一条挤着 64 个 1px 方块与一条实心色带在屏幕上没有区别，
 * 而后者至少不假装自己数得清。
 * @packageDocumentation
 */

/** 仍然分得清一段一段的最大段数；超过它就画成一条实心带。 */
const MAX_LEGIBLE_SEGMENTS = 24

export function GridColumnBar({ columns }: { readonly columns: number }) {
  const legible = columns <= MAX_LEGIBLE_SEGMENTS
  return (
    <div
      aria-hidden="true"
      className="grid-layout-inspector__column-bar"
      data-columns={columns}
      data-testid="grid-column-bar"
    >
      {legible
        ? Array.from({ length: Math.max(1, columns) }, (_unused, column) => (
            <i key={column} />
          ))
        : <i className="is-dense" />}
    </div>
  )
}
