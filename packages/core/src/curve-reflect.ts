import { roundComposeGeometry } from './geometry-precision'
import type { ComposeCurve } from './curve'
import type { ComposePosition } from './document-types'

/**
 * 一条镜像轴：轴上任意两个不重合的点。
 *
 * @remarks
 * 用两个点而不是「一点加角度」：`MIRROR` 取的就是两个点，而角度要从它们算出来——把角度当作
 * 协议会让同一份事实有两处来源，还要回答「零长度轴的角度是多少」。
 *
 * @public
 */
export interface ComposeMirrorAxis {
  readonly a: ComposePosition
  readonly b: ComposePosition
}

/**
 * 轴的方向角（弧度）。
 *
 * @remarks
 * 两点重合时没有方向可言，返回 `null`——猜一个（比如水平）会让一次误操作静默产出一个用户
 * 从未指定的镜像。
 */
function axisAngle(axis: ComposeMirrorAxis): number | null {
  const dx = axis.b.x - axis.a.x
  const dy = axis.b.y - axis.a.y
  if (dx === 0 && dy === 0) return null
  return Math.atan2(dy, dx)
}

/**
 * 把一个点按轴反射。
 *
 * @remarks
 * 先平移到轴上一点为原点，再按轴的方向角作反射，最后平移回去。
 * 反射矩阵是 `[[cos2φ, sin2φ], [sin2φ, −cos2φ]]`——它是**自己的逆**，因此镜像两次回到原处。
 *
 * @returns 轴退化成一个点时返回 `null`。
 * @public
 */
export function reflectComposePoint(
  point: { readonly x: number; readonly y: number },
  axis: ComposeMirrorAxis,
): ComposePosition | null {
  const angle = axisAngle(axis)
  if (angle === null) return null
  return reflectAt(point, axis.a, Math.cos(2 * angle), Math.sin(2 * angle))
}

function reflectAt(
  point: { readonly x: number; readonly y: number },
  origin: ComposePosition,
  cos2: number,
  sin2: number,
): ComposePosition {
  const x = point.x - origin.x
  const y = point.y - origin.y
  return {
    x: origin.x + cos2 * x + sin2 * y,
    y: origin.y + sin2 * x - cos2 * y,
  }
}

/**
 * 把一条曲线按轴反射。
 *
 * @remarks
 * 几何点全部反射；**弧只反射圆心**，方向由角度承担：反射把方向角 θ 映成 `2φ − θ`，并且
 * **翻转扫掠的符号**——反射改变定向，一段顺时针的弧镜像之后是逆时针的。只反射圆心而不动角度
 * 的症状是「弧翻到了另一边但鼓的方向没变」，在半圆上看不出来，在跨象限的弧上一眼就看得见。
 *
 * 半径、`closed` 与 `cornerRadius` 都不动：反射是等距变换，长度不变；圆角是角上的一段定半径
 * 圆弧，镜像之后仍然是同一个半径。
 *
 * 坐标按既有的几何精度量化，与平移同一条规则——反射会引入 `cos2φ` 这类浮点残渣，不量化的话
 * 一条水平线镜像之后两端的 y 会差在第十五位上，而那正是「盒是不是退化」判定的分母。
 *
 * @returns 轴退化成一个点时返回 `null`，调用方据此放弃这次写入。
 * @public
 */
export function reflectComposeCurve(
  curve: ComposeCurve,
  axis: ComposeMirrorAxis,
): ComposeCurve | null {
  const angle = axisAngle(axis)
  if (angle === null) return null
  const cos2 = Math.cos(2 * angle)
  const sin2 = Math.sin(2 * angle)
  // `+ 0` 把 `-0` 归一成 `0`：反射恒会在轴上产出它，而 JSON 序列化写成 `0`，内存里的 `-0`
  // 因此是一个只在断言里现形的幽灵差异。与平移同一条处理。
  const map = (point: ComposePosition): ComposePosition => {
    const reflected = reflectAt(point, axis.a, cos2, sin2)
    return { x: roundComposeGeometry(reflected.x) + 0, y: roundComposeGeometry(reflected.y) + 0 }
  }
  if (curve.kind === 'line') return { ...curve, start: map(curve.start), end: map(curve.end) }
  if (curve.kind === 'polyline') return { ...curve, vertices: curve.vertices.map(map) }
  if (curve.kind === 'path') {
    return {
      ...curve,
      subpaths: curve.subpaths.map((subpath) => ({
        ...subpath,
        start: map(subpath.start),
        segments: subpath.segments.map((segment) => ({
          c1: map(segment.c1),
          c2: map(segment.c2),
          to: map(segment.to),
        })),
      })),
    }
  }
  const degrees = 2 * angle * 180 / Math.PI
  return {
    ...curve,
    center: map(curve.center),
    startAngle: roundComposeGeometry(degrees - curve.startAngle) + 0,
    sweep: roundComposeGeometry(-curve.sweep) + 0,
  }
}

/**
 * 水平中线的镜像轴：`y = value`。
 *
 * @remarks
 * 容器子树的递归反射用得上——子级在父盒里上下翻转，正是关于父盒中线的一次反射。
 *
 * @public
 */
export function composeHorizontalMirrorAxis(value: number): ComposeMirrorAxis {
  return { a: { x: 0, y: value }, b: { x: 1, y: value } }
}
