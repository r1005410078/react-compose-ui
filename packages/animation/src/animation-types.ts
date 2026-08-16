import type { JsonObject, JsonValue } from '@compose-ui/core'

/**
 * Entity 上承载关键帧轨道的 Component Key。
 *
 * @remarks
 * 不是 core 的内建 Component。core 对未知 Component 只检查 key 是 PascalCase、value 是
 * 合法 JSON，因此本包不需要修改 core 的任何校验代码就能扩展文档。
 *
 * @public
 */
export const COMPOSE_ANIMATION_COMPONENT_KEY = 'Animation'

/** 轨道值的语义，决定校验形状与插值算法。 @public */
export type ComposeAnimationValueKind = 'number' | 'vector2' | 'color'

/**
 * 关键帧到下一个关键帧之间的插值方式。
 *
 * @remarks
 * 与 Rive 一致，插值挂在**出向段**：一个关键帧描述的是它到下一帧之间怎么走。轨道最后一个
 * 关键帧仍然携带该字段但不参与求值——这样拖动关键帧改变前后顺序时不需要搬运插值数据。
 *
 * @public
 */
export type ComposeKeyframeInterpolation =
  /** 保持本帧值直到下一帧，在下一帧瞬间跳变。 */
  | { readonly kind: 'hold' }
  | { readonly kind: 'linear' }
  /** 标准 CSS `cubic-bezier(x1, y1, x2, y2)` 时间重映射。 */
  | { readonly kind: 'cubic'; readonly control: readonly [number, number, number, number] }

/**
 * 二维轨道关键帧的空间切线，决定运动路径在该顶点的弯曲。
 *
 * @remarks
 * 切线是**相对该关键帧位置的增量**，不是绝对坐标；这样拖动顶点时切线自动跟随。
 * `corner` 表示折点，两侧退化为直线段。
 *
 * @public
 */
export interface ComposeSpatialTangent extends JsonObject {
  readonly mode: 'corner' | 'smooth'
  readonly inX: number
  readonly inY: number
  readonly outX: number
  readonly outY: number
}

/**
 * 轨道上某个时刻的属性取值。
 *
 * @remarks
 * 使用 `JsonObject &` 交叉而不是 `extends JsonObject`，因为索引签名的 `JsonValue`
 * 不接受 `undefined`，而 `spatial` 是可选的。
 *
 * @public
 */
export type ComposeKeyframe = JsonObject & {
  /** 在所属轨道内稳定且唯一的标识。 */
  readonly id: string
  /** 相对动画开头的毫秒位置，落在 `[0, durationMs]` 内。 */
  readonly timeMs: number
  /** 形状由所属轨道的 `valueKind` 决定：数值、`{ x, y }` 或规范化颜色字符串。 */
  readonly value: JsonValue
  readonly interpolation: ComposeKeyframeInterpolation
  /** 仅 `vector2` 轨道使用；缺省等价于 `corner` 且切线为零。 */
  readonly spatial?: ComposeSpatialTangent
}

/**
 * 宿主 Entity 上某个属性的关键帧序列。
 *
 * @remarks
 * 轨道住在被动画的 Entity 里，所以不保存 `entityId`——冗余字段迟早和宿主对不上。也没有独立
 * 的 `id`：`path` 就是轨道在该 Entity 该动画分组内的唯一键，第二套身份只会漂移。时间线 UI
 * 需要的稳定行标识由宿主用 Entity ID、动画 ID 与路径合成，属于表示层。
 *
 * 位置刻意用一条 `vector2` 轨道而不是 x / y 两条标量轨道：运动路径的空间切线是二维量，
 * 必须和位置值挂在同一个关键帧上，拆开后切线就没有归属，两条轨道的时间也可能不对齐。
 *
 * @public
 */
export interface ComposeAnimationTrack extends JsonObject {
  /** 相对 Entity 的属性路径，例如 `['LayoutItem', 'offset']`。 */
  readonly path: readonly (string | number)[]
  readonly valueKind: ComposeAnimationValueKind
  /** 按 `timeMs` 升序排列，同一时间至多一个关键帧。 */
  readonly keyframes: readonly ComposeKeyframe[]
}

/**
 * Entity 的 `Animation` Component。
 *
 * @remarks
 * 按动画 ID 分组，因为一个 Entity 可以同时参与多条动画。分组键必须能在文档动画清单中找到；
 * 找不到的分组是悬空数据，由 {@link collectComposeAnimationIssues} 报告，但不影响采样与命令。
 *
 * @public
 */
export interface ComposeAnimationComponent extends JsonObject {
  readonly clips: Readonly<Record<string, readonly ComposeAnimationTrack[]>>
}
