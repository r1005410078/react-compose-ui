import type { CadInputPoint } from '../point-input'
import type { CadSegment } from './cad-segment-geometry'

/**
 * 把顶点序列展开成线段序列。
 *
 * @remarks
 * 闭合时**多产出一段**（末点回到首点）。闭合由布尔标志表达而不是把首点再写一遍：重复表示法
 * 里 `[A,B,C,A]` 是闭合三角形还是回到起点的开放折线无法区分，而两者在框选与捕捉上给出不同
 * 的候选——重复的那个顶点会产生两个端点候选。
 *
 * 展开**不丢任何东西**：顶点仍是各段的端点，各段仍有自己的中点，形状逐像素相同。这与「不把
 * 圆弧拍扁」不矛盾——圆弧是曲线，线段集合只能逼近它；多段线本来就是一串线段。
 *
 * @internal
 */
export function cadPolylineSegments(
  vertices: readonly CadInputPoint[],
  closed: boolean,
): readonly CadSegment[] {
  const segments: CadSegment[] = []
  for (let i = 0; i + 1 < vertices.length; i += 1) {
    segments.push({ start: vertices[i]!, end: vertices[i + 1]! })
  }
  if (closed && vertices.length > 2) {
    segments.push({ start: vertices[vertices.length - 1]!, end: vertices[0]! })
  }
  return segments
}

/**
 * 顶点序列是否退化：跨度为零，屏幕上什么都没有。
 *
 * @remarks
 * 与半径为零的圆、内容为空的文字是同一类幽灵——点不中也删不掉。校验与命令各拦一次：命令层
 * 拦是为了让用户当场得到答案，而不是提交后被校验器打回一条看不懂的路径。
 *
 * @internal
 */
export function isDegenerateCadPolyline(vertices: readonly CadInputPoint[]) {
  if (vertices.length < 2) return true
  const first = vertices[0]!
  return vertices.every(({ x, y }) => x === first.x && y === first.y)
}
