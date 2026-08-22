/**
 * `Curve` Component 的类型、校验、几何与归一化。
 *
 * @remarks
 * 曲线 Entity 是**带盒的普通 Entity**：位置的事实来源仍是 `LayoutItem.offset`，形状的事实
 * 来源是本 Component，盒尺寸是几何的派生（紧包围盒）。这样移动、位置/旋转关键帧、场景树、
 * 预览与撤销全部零改动可用——去掉盒才需要为每一条既有轨道再写一份曲线专用分支。
 *
 * 几何点使用**盒局部坐标**，且归一化后紧包围盒的左上角恒等于盒原点（见
 * {@link normalizeComposeCurveGeometry}）。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeEntity,
  type ComposePosition,
  type ComposeSize,
  type JsonObject,
} from './document-types'
import { roundComposeGeometry } from './geometry-precision'

/**
 * 曲线的几何种类。
 *
 * @remarks
 * v1 只有 `line`。保留为联合类型而不是字面量，使新增弧、多段线时既有文档不需要迁移。
 * @public
 */
export type ComposeCurveKind = 'line'

/** 直线段：两个盒局部端点。 @public */
export interface ComposeLineCurve extends JsonObject {
  readonly kind: 'line'
  readonly start: ComposePosition
  readonly end: ComposePosition
}

/**
 * 可选的 `Curve` Component。
 *
 * @remarks
 * MUST 与 `Renderer` 组合（曲线要被画出来），MUST NOT 与 `Hierarchy` 组合（曲线不是容器）。
 * 组合规则由 `validateComposeDocument` 强制。
 * @public
 */
export type ComposeCurve = ComposeLineCurve

/**
 * 归一化后盒在退化轴上的最小尺寸。
 *
 * @remarks
 * 水平线的紧包围盒高为 0，而 `LayoutItem` 的尺寸校验要求**有限正数**。为一根线放宽整个盒
 * 协议不值，因此退化轴钳到这个值；几何点不受影响——渲染与命中都读几何而不读盒。
 * @public
 */
export const COMPOSE_CURVE_MIN_EXTENT = 1

/** Curve 候选值的字段级问题。 @internal */
export interface ComposeCurveValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const LINE_FIELDS = ['kind', 'start', 'end'] as const
const POINT_FIELDS = ['x', 'y'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectUnknownFields(
  value: Record<string, unknown>,
  known: readonly string[],
  basePath: readonly (string | number)[],
  issues: ComposeCurveValidationIssue[],
) {
  const allowed = new Set<string>(known)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({ path: [...basePath, key], message: `未知字段 ${key}` })
    }
  })
}

function collectPointIssues(
  value: unknown,
  basePath: readonly (string | number)[],
  issues: ComposeCurveValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push({ path: basePath, message: '端点必须是对象' })
    return
  }
  collectUnknownFields(value, POINT_FIELDS, basePath, issues)
  POINT_FIELDS.forEach((key) => {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      issues.push({ path: [...basePath, key], message: `${key} 必须是有限数` })
    }
  })
}

/**
 * 收集 Curve 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposeCurveValidationIssues(
  value: unknown,
): readonly ComposeCurveValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: [], message: 'Curve 必须是对象' }]
  }
  // 未知 kind 必须拒绝而不是静默忽略：静默忽略会让一条画好的曲线在升级后无声消失。
  if (value.kind !== 'line') {
    return [{ path: ['kind'], message: `不支持的 kind ${String(value.kind)}` }]
  }
  const issues: ComposeCurveValidationIssue[] = []
  collectUnknownFields(value, LINE_FIELDS, [], issues)
  collectPointIssues(value.start, ['start'], issues)
  collectPointIssues(value.end, ['end'], issues)
  return issues
}

/** 判断未知输入是否为完整、严格的 Curve。 @public */
export function isValidComposeCurve(value: unknown): value is ComposeCurve {
  return collectComposeCurveValidationIssues(value).length === 0
}

/** 读取 Entity 上可选的 Curve。 @public */
export function getComposeCurve(entity: ComposeEntity | undefined): ComposeCurve | undefined {
  return entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.curve] as ComposeCurve | undefined
}

/**
 * 创建一条直线段 Curve。
 *
 * @remarks
 * 端点接受任意 `{ x, y }`：调用方手里通常是屏幕/世界坐标这类结构类型，逼它们先转成带索引
 * 签名的 `ComposePosition` 只会让每个调用点多一次重建。
 *
 * @public
 */
export function createComposeLineCurve(
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): ComposeLineCurve {
  return { kind: 'line', start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }
}

/**
 * 曲线的特征点。
 *
 * @remarks
 * 供包围盒、平移与捕捉共用。弧与多段线加入后在此扩展，包围盒与平移因此不必各自认识 kind。
 * @public
 */
export function composeCurvePoints(curve: ComposeCurve): readonly ComposePosition[] {
  return [curve.start, curve.end]
}

/** 曲线的紧包围盒；**不**做退化轴钳制。 @public */
export function composeCurveBounds(
  curve: ComposeCurve,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const points = composeCurvePoints(curve)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/** 平移曲线的全部几何点。 @public */
export function translateComposeCurve(
  curve: ComposeCurve,
  dx: number,
  dy: number,
): ComposeCurve {
  const shift = (point: ComposePosition): ComposePosition => ({
    x: roundComposeGeometry(point.x + dx),
    y: roundComposeGeometry(point.y + dy),
  })
  return { ...curve, start: shift(curve.start), end: shift(curve.end) }
}

/** {@link normalizeComposeCurveGeometry} 的结果。 @public */
export interface ComposeNormalizedCurveGeometry {
  /** 盒局部几何；紧包围盒左上角恒为 `(0, 0)`。 */
  readonly curve: ComposeCurve
  /** 盒相对 parent 的位置，等于输入几何紧包围盒的左上角。 */
  readonly offset: ComposePosition
  /** 盒尺寸，退化轴钳到 {@link COMPOSE_CURVE_MIN_EXTENT}。 */
  readonly size: ComposeSize
}

/**
 * 把 parent 局部坐标下的几何归一化成「盒 + 盒局部几何」。
 *
 * @remarks
 * 这是曲线几何写入的**唯一**换算：盒落在紧包围盒左上角，几何随之平移，退化轴钳到最小尺寸。
 * 归一化不变量——盒局部几何的最小 x 与最小 y 恒为 0——让渲染可以直接把几何画进盒坐标系，
 * 也让命中的窄相位不必再补一次偏移。
 *
 * 数值统一经 `roundComposeGeometry` 量化，与 `toComposeTransform` 同一条规矩。
 *
 * @param curve - parent 局部坐标下的几何
 * @public
 */
export function normalizeComposeCurveGeometry(
  curve: ComposeCurve,
): ComposeNormalizedCurveGeometry {
  const bounds = composeCurveBounds(curve)
  return {
    curve: translateComposeCurve(curve, -bounds.x, -bounds.y),
    offset: { x: roundComposeGeometry(bounds.x), y: roundComposeGeometry(bounds.y) },
    size: {
      width: roundComposeGeometry(Math.max(bounds.width, COMPOSE_CURVE_MIN_EXTENT)),
      height: roundComposeGeometry(Math.max(bounds.height, COMPOSE_CURVE_MIN_EXTENT)),
    },
  }
}

/**
 * 点到曲线的距离。
 *
 * @remarks
 * 曲线的命中判据是**点到几何的距离**而不是包围盒——一条对角线的包围盒里绝大部分是空的，
 * 按盒判定会让两条交叉线互相遮挡对方的命中区。
 *
 * 点与曲线必须在同一坐标系（通常是 Entity 局部坐标，由调用方完成换算），因此旋转后的命中
 * 自动正确。
 *
 * @public
 */
export function distanceToComposeCurve(
  curve: ComposeCurve,
  point: { readonly x: number; readonly y: number },
): number {
  const { start, end } = curve
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const px = point.x - start.x
  const py = point.y - start.y
  // 零长度线段退化成点，否则除法产生 NaN 而 NaN 的一切比较都为 false——命中会静默失效。
  if (lengthSquared === 0) return Math.hypot(px, py)
  const t = Math.min(1, Math.max(0, (px * dx + py * dy) / lengthSquared))
  return Math.hypot(px - t * dx, py - t * dy)
}
