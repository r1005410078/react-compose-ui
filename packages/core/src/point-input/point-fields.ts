import type { ComposeInputPoint } from './coordinate'

/**
 * 一步取点的数值参数化。
 *
 * @remarks
 * 与 `@compose-ui/commands` 的 `ComposeCommandPointFields` 是**逐字相同**的联合。那个包零
 * 运行时依赖、连 `core` 都不依赖，因此声明不了这里的类型；这处重复是包边界造成的，与
 * property-panel 自带一份数字格式化是同一种情形。
 *
 * @public
 */
export type ComposePointFieldKind =
  | 'absolute'
  | 'polar'
  | 'cartesian'
  | 'radius'
  | 'diameter'
  | 'angle'

/**
 * 单字段的参数化：呈现只暴露第一个字段。
 *
 * @remarks
 * 圆是旋转对称的，半径点的角度对结果没有任何影响——一个永远不影响结果的只读字段比没有更差，
 * 它占着屏幕、占着 `Tab` 的一个去处，却什么也不回答。数学仍然算得出第二个字段（`radius`
 * 与 `polar` 逐字相同），因此覆盖操作不需要为单字段特判。
 *
 * @public
 */
export const COMPOSE_SINGLE_FIELD_KINDS: readonly ComposePointFieldKind[] = ['radius', 'diameter', 'angle']

/**
 * 这一步只有一个字段吗。
 *
 * @remarks
 * 呈现出几个框、`Tab` 接不接管、有没有锁定这一档，三处读同一个判断——各判一次的症状是
 * 「只画了一个框，`Tab` 却把落点锁死了」。
 *
 * @public
 */
export function isComposeSingleFieldKind(kind: ComposePointFieldKind) {
  return COMPOSE_SINGLE_FIELD_KINDS.includes(kind)
}

/**
 * 一步取点读出的两个数值。
 *
 * @remarks
 * 字段没有名字，只有次序——名字（X/Y、距离/角度、宽/高）是呈现层的事，而这一层只做数学。
 *
 * @public
 */
export interface ComposePointFieldValues {
  readonly first: number
  readonly second: number
}

/** 一步取点里的字段序号。 @public */
export type ComposePointFieldIndex = 0 | 1

const RADIANS_PER_DEGREE = Math.PI / 180

/** 屏幕 Y 轴向下，因此角度取负——与 `距离<角度` 的坐标写法同一套约定。 */
function angleDegrees(dx: number, dy: number) {
  return Math.atan2(-dy, dx) / RADIANS_PER_DEGREE
}

/**
 * 第一个字段相对极坐标距离的倍率。
 *
 * @remarks
 * `diameter` 是「第一个字段乘二的 `polar`」，正反算与覆盖三处共用这一个数——各写一处 `* 2`
 * 的症状是打进去的直径与读出来的差一倍，而它只在切到直径档之后才现形。
 *
 * `angle` 不参与：它的第一个字段是角度而不是距离，乘除二没有意义。
 */
function firstFieldScale(kind: ComposePointFieldKind) {
  return kind === 'diameter' ? 2 : 1
}

/**
 * 把落点读成两个数值字段。
 *
 * @remarks
 * `radius` 与 `polar` 的数学**逐字相同**，差别只在呈现暴露几个字段；`diameter` 在第一个
 * 字段上乘二。半径就是极坐标的第一个分量，共用同一份数学让「裸数字 = 活动字段的值」在圆上
 * 不需要任何特判。
 *
 * `cartesian` 返回的是**量值**：矩形的自然量纲是两条边长，屏幕上出现 `-440` 会让用户以为
 * 自己画错了。这是本模块唯一一处「显示值不等于内部值」，因此覆盖那一侧要把符号补回来
 * （见 {@link applyComposeFieldOverride}）。
 *
 * @param kind - 参数化种类。
 * @param point - 已经过点输入管线解算的落点。
 * @param reference - 原点；`absolute` 忽略它，另两种缺省时按世界原点。
 * @public
 */
export function composePointToFields(
  kind: ComposePointFieldKind,
  point: ComposeInputPoint,
  reference?: ComposeInputPoint,
): ComposePointFieldValues {
  if (kind === 'absolute') return { first: point.x, second: point.y }
  const origin = reference ?? { x: 0, y: 0 }
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  if (kind === 'cartesian') return { first: Math.abs(dx), second: Math.abs(dy) }
  // `angle` 把角度放在**第一个**字段：单字段的呈现只暴露第一个，而旋转唯一影响结果的量是角度。
  // 到中心的距离对旋转没有任何影响，一个永远不影响结果的只读字段比没有更差。
  if (kind === 'angle') return { first: angleDegrees(dx, dy), second: Math.hypot(dx, dy) }
  return { first: Math.hypot(dx, dy) * firstFieldScale(kind), second: angleDegrees(dx, dy) }
}

/**
 * 由两个数值字段求出落点。
 *
 * @remarks
 * 与 {@link composePointToFields} 互逆，`cartesian` 除外——它丢掉了符号，因此这里需要调用方
 * 把符号带进 `values`（负的宽表示落点在原点左侧）。
 *
 * @public
 */
export function composeFieldsToPoint(
  kind: ComposePointFieldKind,
  values: ComposePointFieldValues,
  reference?: ComposeInputPoint,
): ComposeInputPoint {
  if (kind === 'absolute') return { x: values.first, y: values.second }
  const origin = reference ?? { x: 0, y: 0 }
  if (kind === 'cartesian') {
    return { x: origin.x + values.first, y: origin.y + values.second }
  }
  // `angle` 的两个字段与 `polar` 互换了位置，反算因此也换回来。
  if (kind === 'angle') {
    const radians = values.first * RADIANS_PER_DEGREE
    return {
      x: origin.x + values.second * Math.cos(radians),
      y: origin.y - values.second * Math.sin(radians),
    }
  }
  const radians = values.second * RADIANS_PER_DEGREE
  const distance = values.first / firstFieldScale(kind)
  return {
    x: origin.x + distance * Math.cos(radians),
    y: origin.y - distance * Math.sin(radians),
  }
}

/**
 * 把落点的**某一个**字段替换成键入值，另一个保持不变。
 *
 * @remarks
 * 这是锁定与直接距离输入共用的那一步：键入一个裸数字时缺的是**方向**，而方向正是另一个分量
 * 此刻的值。因此覆盖必须从当前落点出发，而不是从零开始拼一个点。
 *
 * `cartesian` 的覆盖**沿用当前落点在那一轴上的符号**（落在轴上时取正）：读出来的是量值，
 * 用户键入的也是量值，而落点需要符号。少了这一步，往左上拖时键入宽度会把矩形翻到右下去。
 *
 * @param kind - 参数化种类。
 * @param point - 当前落点，已经过点输入管线解算。
 * @param reference - 原点；`absolute` 忽略它。
 * @param index - 要替换的字段序号。
 * @param value - 键入的值。
 * @returns 新的落点。
 * @public
 */
export function applyComposeFieldOverride(
  kind: ComposePointFieldKind,
  point: ComposeInputPoint,
  reference: ComposeInputPoint | undefined,
  index: ComposePointFieldIndex,
  value: number,
): ComposeInputPoint {
  const current = composePointToFields(kind, point, reference)
  const next = index === 0
    ? { first: value, second: current.second }
    : { first: current.first, second: value }
  if (kind !== 'cartesian') return composeFieldsToPoint(kind, next, reference)

  const origin = reference ?? { x: 0, y: 0 }
  // 量值加回符号；分量为 0 时取正——那一刻没有方向可沿用，而正号是用户拖出去的默认方向。
  const signOf = (delta: number) => (delta < 0 ? -1 : 1)
  return composeFieldsToPoint('cartesian', {
    first: next.first * signOf(point.x - origin.x),
    second: next.second * signOf(point.y - origin.y),
  }, reference)
}
