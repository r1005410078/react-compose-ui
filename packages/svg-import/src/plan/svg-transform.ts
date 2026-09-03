/**
 * 二维仿射矩阵，与 SVG 的 `matrix(a b c d e f)` 同序。
 *
 * @remarks
 * `x' = a·x + c·y + e`，`y' = b·x + d·y + f`。用元组而不是对象，因为它要和 `svgpath` 的
 * `matrix()` 直接对接，那边收的就是这六个数。
 *
 * @public
 */
export type SvgMatrix = readonly [number, number, number, number, number, number]

/** 单位矩阵。 @public */
export const SVG_IDENTITY: SvgMatrix = [1, 0, 0, 1, 0, 0]

const TO_RADIANS = Math.PI / 180

/** 先 `a` 后 `b`：`multiplySvgMatrix(parent, child)` 是「先按子级变换、再按父级变换」。 @public */
export function multiplySvgMatrix(a: SvgMatrix, b: SvgMatrix): SvgMatrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

/** 把点映射过去。 @public */
export function applySvgMatrix(
  matrix: SvgMatrix,
  point: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  }
}

/**
 * 解析 `transform` 属性。
 *
 * @remarks
 * 一个属性里可以串多个函数，**从左到右依次应用**意味着矩阵要从左往右相乘：写反的症状是
 * `translate(...) rotate(...)` 变成绕原点转完再平移，图形跑到别处去。
 *
 * 无法解析的函数跳过而不是整条放弃：放弃整条会让这个元素完全不动，那比少一次变换更糟。
 *
 * @public
 */
export function parseSvgTransform(value: string | undefined): SvgMatrix {
  if (!value) return SVG_IDENTITY
  let matrix = SVG_IDENTITY
  for (const match of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const name = (match[1] ?? '').toLowerCase()
    const args = (match[2] ?? '')
      .split(/[\s,]+/)
      .map((raw) => Number(raw))
      .filter((number) => Number.isFinite(number))
    matrix = multiplySvgMatrix(matrix, toMatrix(name, args))
  }
  return matrix
}

function toMatrix(name: string, args: readonly number[]): SvgMatrix {
  if (name === 'matrix' && args.length === 6) {
    return [args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, args[5]!]
  }
  if (name === 'translate') return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]
  if (name === 'scale') return [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]
  if (name === 'rotate') {
    const radians = (args[0] ?? 0) * TO_RADIANS
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const rotation: SvgMatrix = [cos, sin, -sin, cos, 0, 0]
    // 带旋转中心的三参数形式：绕 `(cx, cy)` 转等于「平移过去、转、平移回来」。
    if (args.length < 3) return rotation
    const cx = args[1] ?? 0
    const cy = args[2] ?? 0
    return multiplySvgMatrix(
      multiplySvgMatrix([1, 0, 0, 1, cx, cy], rotation),
      [1, 0, 0, 1, -cx, -cy],
    )
  }
  if (name === 'skewx') return [1, 0, Math.tan((args[0] ?? 0) * TO_RADIANS), 1, 0, 0]
  if (name === 'skewy') return [1, Math.tan((args[0] ?? 0) * TO_RADIANS), 0, 1, 0, 0]
  return SVG_IDENTITY
}

/**
 * 两个轴向的缩放量。
 *
 * @remarks
 * 取两个基向量的长度。含斜切时它不是严格意义上的「缩放」，但本包只用它回答两个问题——
 * 「等比吗」和「线宽该乘多少」，两者对斜切的近似都够用。
 */
export function svgMatrixScale(matrix: SvgMatrix): { readonly x: number; readonly y: number } {
  return {
    x: Math.hypot(matrix[0], matrix[1]),
    y: Math.hypot(matrix[2], matrix[3]),
  }
}

/**
 * 这个矩阵是不是等比的。
 *
 * @remarks
 * 容差取相对值：绝对小量会让一个放大一千倍的等比矩阵被判成非等比，而那正是大图纸上会发生的事。
 *
 * @public
 */
export function isUniformSvgMatrix(matrix: SvgMatrix): boolean {
  const scale = svgMatrixScale(matrix)
  const larger = Math.max(scale.x, scale.y)
  if (larger === 0) return true
  // 斜切会让两个基向量不再正交，此时「等比」这句话本身就不成立。
  const skew = Math.abs(matrix[0] * matrix[2] + matrix[1] * matrix[3]) / (larger * larger)
  return Math.abs(scale.x - scale.y) / larger <= 1e-6 && skew <= 1e-6
}

/**
 * 线宽在这个矩阵下该乘多少。
 *
 * @remarks
 * 取两轴的**几何平均**（也就是 `sqrt(|det|)`）。非等比缩放下线宽没有单一正确答案——沿不同
 * 方向的那一段被拉伸的量不同，而 `stroke-width` 只有一个数。几何平均是 SVG 规范给
 * `stroke-width` 在非等比变换下的既有近似，取它而不是自己发明一个。
 *
 * @public
 */
export function svgStrokeScale(matrix: SvgMatrix): number {
  return Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]))
}
