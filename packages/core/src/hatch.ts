/**
 * `Hatch` Component 的类型、校验与读取。
 *
 * @remarks
 * 填充是「求面产出的那块色」。它落地之后**就是一条普通的闭合曲线 Entity**——几何的事实来源
 * 仍是 `Curve`，颜色仍是 `Appearance.backgroundPaint`，选中、resize、顶点编辑、场景树、
 * 数据绑定与外观动画轨道全部是既有路径。`Hatch` 只回答一件事：这块面当初是从哪一点找出来的。
 *
 * 与 `Wire` 是同一条判断——缺席即「这不是一块由求面产出的填充」，因此本 Component 是可选的
 * 新增，协议版本不变，既有文档逐像素不变。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeEntity,
  type ComposePosition,
  type JsonObject,
} from './document-types'

/**
 * 可选的 `Hatch` Component。
 *
 * @remarks
 * **不存「边」级引用**（某条边是与哪个对象的第几个交点，或用到了哪几段）：一条直线穿过一个
 * 圆有两个交点，选哪一个是个启发式；而段下标在顶点被增删之后就错位。`boundaryIds` 是
 * **Entity 级**的，它不回答「第几个交点」，只回答「围出这块面的是哪几个对象」，因此不受这条
 * 禁令约束。
 *
 * 也**不存烘死的环几何**——`Curve` 就是那份几何，存第二份等于给同一个形状造两个事实来源，
 * 与导线「自由端不存坐标」是同一条判断。
 * 用 `JsonObject &` 交叉而不是 `extends`：索引签名的 `JsonValue` 不接受 `undefined`，而
 * `boundaryIds` 是可选的；`ComposeWire`、`ComposeAppearance` 与 `ComposeGridItem` 出于同样
 * 原因采用这种写法。
 * @public
 */
export type ComposeHatch = JsonObject & {
  /**
   * 这块面的**锚点**：求解从这一点出发。
   *
   * @remarks
   * **Entity 局部坐标**（盒左上角为原点），与 `Ports.position`、`Curve` 的盒局部几何同一个
   * 空间。因此移动这块填充不改写 `seed`——它表达的仍是同一个位置。
   *
   * 它是**这块面的身份**而不是「当初那一下点在哪儿」：跟随成功时宿主会把它重取到新几何的
   * 最大内切圆圆心，好让它离每一条边界都尽可能远。落点停在用户点的角落时，它迟早会在某次
   * 变形之后被吞进另一块面——而那个错误在屏幕上看不见。
   */
  readonly seed: ComposePosition
  /**
   * 围出这块面的那几个 Entity 的 id。
   *
   * @remarks
   * **缺席即不跟随**（与 `Hatch` 自己「缺席即不是填充」、`Clip`「缺席即不裁剪」同一条）。
   * 这条回退让本字段不需要迁移：既有的每一块填充都没有它，因此行为逐字不变——仍然只标过期、
   * 仍然要按一下「重新生成」，而那一下会把清单补上。
   *
   * 它有**两个用途，而且是同一件事的两面**：与一次事务的 `targetIds` 求交决定**要不要**为
   * 这块填充重求（绝大多数事务与任何填充都不相干，交集为空时一次都不跑）；与重求出来的那份
   * 比对决定**跟不跟**（拓扑变了就不替用户换形状）。
   *
   * 空数组非法：不围出任何东西的清单读不出意图，不再需要时删掉整个字段。
   */
  readonly boundaryIds?: readonly string[]
}

/**
 * 填充的默认色。
 *
 * @remarks
 * 判据是**角色**而不是「区域没有最常见的那一档」：导线红取的是最常见的那一档，而区域填充问
 * 的是另一个问题——它垫在符号底下，必须让**压在它上面的墨**读得出来。同一条判据的两个答案。
 *
 * 这个值是量出来的，不是挑出来的。要同时压住两种墨：符号与辅助几何的
 * `#d8e2f1`（`DEFAULT_CURVE_PROPS.stroke`）与一次回路的 `#ff3b30`（`COMPOSE_WIRE_STROKE`）。
 * 量下来 `#2f3b4d` 对前者 8.67:1、对后者 3.19:1，两条都过 3:1——**红导线是真正卡住的那一条**，
 * 它本身就是中等明度，因此填充必须明显比它暗。
 *
 * **代价写在明处**：这么暗之后它与深色图面底（`#1d2025`）只差 1.44:1。四条约束（两种墨各
 * 3:1、深浅两种图面各 1.6:1）**无解**——穷举过整个色相环，一个都没有。放掉的是「从画布里跳
 * 出来」那一条，理由是填充**本来就该安静**：它是垫在符号底下的一层，不是一块要抢眼的图形，
 * 而大块面积在远低于 3:1 时仍然看得出来。
 *
 * 设计稿上那个 `#3f5068` 因此**没有采用**：它对红导线只有 2.31:1，一条红线压上去读不出来
 * ——而那正是「失效端点记号从红改琥珀」时已经付过一次的学费。
 *
 * 不内置色表：色表因项目而异，内置一份等于替宿主做了一个多半要改的决定，与「不内置电压等级
 * 色表」同一条。
 *
 * @public
 */
export const COMPOSE_DEFAULT_HATCH_COLOR = '#2f3b4d'

/** Hatch 候选值的字段级问题。 @internal */
export interface ComposeHatchValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const HATCH_FIELDS = ['seed', 'boundaryIds'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinitePosition(value: unknown): value is ComposePosition {
  return isRecord(value)
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Object.keys(value).every((key) => key === 'x' || key === 'y')
}

/**
 * 收集 Hatch 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposeHatchValidationIssues(
  value: unknown,
): readonly ComposeHatchValidationIssue[] {
  if (!isRecord(value)) return [{ path: [], message: 'Hatch 必须是对象' }]
  const issues: ComposeHatchValidationIssue[] = []
  const allowed = new Set<string>(HATCH_FIELDS)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) issues.push({ path: [key], message: `未知字段 ${key}` })
  })
  // seed 必填：没有它这个 Component 读不出意图，而「重新生成」也就无从谈起——那正是它存在的
  // 全部理由。不再需要重算时删掉整个 Component，与 Ports「空列表非法」是同一条判断。
  if (!isFinitePosition(value.seed)) {
    issues.push({ path: ['seed'], message: 'seed 必须是有限的 x/y' })
  }
  /*
   * `boundaryIds` 可缺席——缺席即不跟随，这条回退让既有文档不需要迁移。但**空数组非法**：
   * 缺席与空列表会让「跟不跟随」在两处读出不同答案，与 `Ports`「空 items 非法」、
   * `cornerRadius`「0 非法」是同一条判断。
   */
  if (value.boundaryIds !== undefined) {
    if (!Array.isArray(value.boundaryIds) || value.boundaryIds.length === 0) {
      issues.push({ path: ['boundaryIds'], message: 'boundaryIds 必须是非空数组' })
    } else if (value.boundaryIds.some((id) => typeof id !== 'string' || id.length === 0)) {
      issues.push({ path: ['boundaryIds'], message: 'boundaryIds 的每一项必须是非空字符串' })
    }
  }
  return issues
}

/** 判断未知输入是否为完整、严格的 Hatch。 @public */
export function isValidComposeHatch(value: unknown): value is ComposeHatch {
  return collectComposeHatchValidationIssues(value).length === 0
}

/**
 * 读取 Entity 上可选的 Hatch。
 *
 * @remarks
 * Inspector 的「重新生成」与失效标记都经这里读，不各自去摸 `components`——多一处直读就多一处
 * 会漏掉「缺席即不是填充」的地方。
 *
 * @returns 没有 `Hatch` 时是 `undefined`。
 * @public
 */
export function getComposeHatch(
  entity: ComposeEntity | undefined,
): ComposeHatch | undefined {
  return entity?.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.hatch
  ] as ComposeHatch | undefined
}
