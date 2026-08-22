/**
 * 几何数值的精度约定。
 *
 * @remarks
 * 世界坐标由 `(屏幕坐标 - 视口偏移) / zoom` 得到。zoom 是 `0.4822…` 这类非整数时，除法既
 * 产生真实小数，也留下 `82.96874999999991` 这种二进制浮点残渣——后者既不是用户的输入，
 * 也不是任何有意义的精度。约定统一在这里，是为了让「写进文档」和「显示给用户」用同一个
 * 位数：此前画布浮标 `Math.round` 成整数、属性面板原样输出 14 位，同一个值两处对不上。
 *
 * @packageDocumentation
 */

/** 几何数值保留的小数位数。 @public */
export const COMPOSE_GEOMETRY_PRECISION = 2

const FACTOR = 10 ** COMPOSE_GEOMETRY_PRECISION

/**
 * 把几何数值量化到 {@link COMPOSE_GEOMETRY_PRECISION}。
 *
 * @remarks
 * 用于手势结果写回文档之前。非有限数原样返回——量化不承担校验职责，非法值应当由命令层
 * 拒绝，在这里悄悄改成 0 只会把问题推到更远的地方。
 *
 * @public
 */
export function roundComposeGeometry(value: number): number {
  if (!Number.isFinite(value)) return value
  // 先乘后除而不是 toFixed：toFixed 返回字符串且对 x.5 的舍入方向依赖实现细节。
  return Math.round(value * FACTOR) / FACTOR
}

/**
 * 把数值格式化为最多 {@link COMPOSE_GEOMETRY_PRECISION} 位小数的显示文本。
 *
 * @remarks
 * 整数不补零，小数去掉尾随零：`1280` → `"1280"`，`82.96874999999991` → `"82.97"`，
 * `0.50` → `"0.5"`。量化后再 `String()` 即可满足——`Number` 的默认字符串化本身就不留尾随零。
 *
 * @public
 */
export function formatComposeNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  return String(roundComposeGeometry(value))
}
