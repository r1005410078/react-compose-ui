/**
 * 布尔运算的解算：这几个对象合不合格、它们的世界几何是什么、结果该落在谁的位置上。
 *
 * @remarks
 * **本模块只解算，不产出命令**：新建那一支要一个 Preset 与一个新的 Entity id，而引擎不建
 * Entity、不认识 Preset id。规划住在宿主（`stage`），与 `HATCH`、`TRIM` 同一条边界。
 *
 * 拒绝 MUST 报**原因码**而不是文案——本包不认识 locale，而「哪一个对象挡住了运算」要由宿主
 * 用它自己的名称与文案说出来。
 */

import {
  composePathAsOutline,
  flattenComposeCurves,
  getComposeCurve,
  resolveComposeCurveBoolean,
  getComposeHierarchy,
  getComposeLock,
  getComposeWire,
  type ComposeBooleanOp,
  type ComposeCurve,
  type ComposeOutlinePiece,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import type { StageSceneIndex } from '../hit-testing'
import { stageBoxCurve, stageWorldCurve, stageWorldOutline } from './curve-world'

/**
 * 一次布尔运算被拒绝的原因；是原因码而不是文案。
 *
 * - `too-few`：操作数不够。
 * - `no-geometry`：其中有不带几何的对象（容器、文字、图片、组件实例）。
 * - `locked`：其中有锁定的对象——「你锁了它」和「我把它删了」是两件事。
 * - `wired`：其中有对象被导线绑着；删掉它会让那些绑定悬空，而悬空引用不让文档非法，
 *   这个错屏幕上只在 Inspector 里现形，因此必须在事前拦住。
 * - `bezier`：其中有**认不出**的曲线段——既不是直线也不是圆弧。平面图的边只有这两种，而本
 *   产品自己产出的 `path`（填充块、布尔结果、拍平的矩形与圆）边上恰好只有这两种，它们的
 *   贝塞尔本来就是从弧转过去的。真正的自由曲线（SVG 导进来的那种）落在这一档。
 * - `line`：其中有直线；直线没有可运算的面积。
 * - `unresolved`：布局里还没有它的盒（新建的那一帧）。
 * - `empty`：按这条运算保留下来的面积为零。
 * - `degenerate`：平面图退化，绕不出边界。
 *
 * **哪几种挡得住这一次运算由运算自己决定**，MUST NOT 收成一份全局清单：拍平不求交，因此
 * `bezier` 与 `line` 在它那里都放行——那两条限制的理由是求交只有线×线、线×弧、弧×弧三支，
 * 而拍平一张平面图都不用建。
 *
 * @public
 */
export type StageBooleanRejection =
  | 'too-few'
  | 'no-geometry'
  | 'bezier'
  | 'line'
  | 'locked'
  | 'wired'
  | 'unresolved'
  | 'empty'
  | 'degenerate'

/** 一个参与运算的对象。 @public */
export interface StageBooleanOperand {
  readonly entityId: string
  readonly name: string
  /**
   * 世界坐标的几何；旋转已经烘进来了。
   *
   * @remarks
   * 拍平读它——拍平要保住 `path` 的曲率，而轮廓片段里没有三次贝塞尔这一种。
   */
  readonly curve: ComposeCurve
  /**
   * 世界坐标的轮廓片段。
   *
   * @remarks
   * 区域运算读它：两两求交要的是可求交的片段，而圆角走的是命中与渲染读的**同一列**轮廓
   * （`stageWorldOutline`），因此填出来的形状不会盖过角弧。
   */
  readonly outline: readonly ComposeOutlinePiece[]
}

/** {@link resolveStageFlatten} 的结果。 @public */
export type StageBooleanResolution =
  | {
    readonly status: 'resolved'
    /** 世界坐标的产物；调用方负责换算进父级并归一化。 */
    readonly curve: ComposeCurve
    /** 按层序**从下到上**排好的操作数。 */
    readonly operands: readonly StageBooleanOperand[]
  }
  | {
    readonly status: 'rejected'
    readonly reason: StageBooleanRejection
    /** 挡住运算的那个对象；`too-few` 时缺席。 */
    readonly entityName?: string
  }

/**
 * 文档的绘制次序：`rootIds` 深度优先，先画的排在前面。
 *
 * @remarks
 * 跨父级时同层的兄弟下标不可比，因此要一条全局的次序。它与画布上「谁压着谁」是同一件事，
 * 因此结果的外观、名称、父级与插入位置读的都是这一条。
 */
function paintOrder(document: ComposeDocument): ReadonlyMap<string, number> {
  const order = new Map<string, number>()
  const visit = (ids: readonly string[]) => {
    ids.forEach((id) => {
      order.set(id, order.size)
      const entity = document.entities[id]
      if (entity) visit(getComposeHierarchy(entity)?.childIds ?? [])
    })
  }
  visit(document.rootIds)
  return order
}

/** 有没有导线的端点绑在这个 Entity 上。 */
function hasWireBinding(document: ComposeDocument, entityId: string): boolean {
  return (Object.values(document.entities) as ComposeEntity[]).some((entity) => {
    const wire = getComposeWire(entity)
    return wire?.start?.entityId === entityId || wire?.end?.entityId === entityId
  })
}

/**
 * 把一组选中的 Entity 收成按层序排好的操作数，顺带做完与文档有关的全部校验。
 *
 * @remarks
 * 校验住在这里而不住在命令会话里：判据要读文档（有没有 `Curve`、锁没锁、有没有导线绑着），
 * 而 `stage-engine` 的**命令层**不认识文档——这条边界由既有的 `isGeometryEditable` 立过一次。
 * 会话只管数量，因为数量是它手上唯一知道的事。
 */
type StageOperandCollection =
  | { readonly status: 'ok'; readonly operands: readonly StageBooleanOperand[] }
  | (StageBooleanResolution & { readonly status: 'rejected' })

function collectOperands(
  index: StageSceneIndex,
  ids: readonly string[],
  /** 这一次运算要不要求操作数有面积；拍平不求交，因此不要求。 */
  requiresArea: boolean,
): StageOperandCollection {
  const order = paintOrder(index.document)
  const unique = [...new Set(ids)].filter((id) => index.document.entities[id] !== undefined)
  const sorted = [...unique].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0))

  const operands: StageBooleanOperand[] = []
  for (const entityId of sorted) {
    const entity = index.document.entities[entityId]!
    const curve = getComposeCurve(entity)
    if (!curve) {
      return { status: 'rejected', reason: 'no-geometry', entityName: entity.name }
    }
    if (requiresArea && curve.kind === 'line') {
      return { status: 'rejected', reason: 'line', entityName: entity.name }
    }
    if (getComposeLock(entity).locked) {
      return { status: 'rejected', reason: 'locked', entityName: entity.name }
    }
    if (hasWireBinding(index.document, entityId)) {
      return { status: 'rejected', reason: 'wired', entityName: entity.name }
    }
    const matrix = index.getWorldMatrix(entityId)
    const boxCurve = stageBoxCurve(index, entityId)
    if (!matrix || !boxCurve) {
      return { status: 'rejected', reason: 'unresolved', entityName: entity.name }
    }
    /*
     * `path` 逐段识别成直线与圆弧，认不出才拒绝——整个拒掉会把本产品自己产出的每一块弧形
     * 填充都挡在门外，而那些贝塞尔本来就是从弧转过去的。
     *
     * 识别在**世界**坐标上做：非等比盒把弧投影成椭圆弧，认不出因而被拒，这是对的——椭圆弧
     * 确实不是弧，而求交只有线×线、线×弧、弧×弧三支。
     *
     * 拍平那一支（`requiresArea` 为假）不走这条：它不求交，`outline` 它连读都不读。
     */
    const worldCurve = stageWorldCurve(boxCurve, matrix)
    const outline = requiresArea && worldCurve.kind === 'path'
      ? composePathAsOutline(worldCurve)
      : stageWorldOutline(boxCurve, matrix)
    if (outline === null) {
      return { status: 'rejected', reason: 'bezier', entityName: entity.name }
    }
    operands.push({ entityId, name: entity.name, curve: worldCurve, outline })
  }
  return { status: 'ok', operands }
}

/**
 * 解算一次拍平。
 *
 * @remarks
 * 拍平**不求交**，因此它没有退化情形、也没有「结果为空」这一支——轮廓一个像素都不变，变的
 * 只是「这是几个对象」和「顶点还是控制手柄」。它也因此**不拒绝贝塞尔操作数**：那条限制的
 * 理由是平面图的边还没有三次贝塞尔这一种，而拍平一张平面图都不用建。
 *
 * 至少要一个操作数。父级不必相同、旋转过也可以：几何投影走世界空间，产物落成一条
 * `rotation` 为 0 的新曲线，与 SVG 导入「变换在导入期烘进几何」同一条。
 *
 * @public
 */
export function resolveStageFlatten(
  index: StageSceneIndex,
  ids: readonly string[],
): StageBooleanResolution {
  if (ids.length === 0) return { status: 'rejected', reason: 'too-few' }
  const collected = collectOperands(index, ids, false)
  if (collected.status === 'rejected') return collected
  const { operands } = collected
  if (operands.length === 0) return { status: 'rejected', reason: 'too-few' }
  return {
    status: 'resolved',
    curve: flattenComposeCurves(operands.map((operand) => operand.curve)),
    operands,
  }
}

/**
 * 解算一次区域运算（并集、差集、交集、异或）。
 *
 * @remarks
 * 操作数投影进**世界空间**（与命中、框选、特征点同一条链），按层序**从下到上**排好之后交给
 * core 的面分类求解。`operands[0]` 因此是画在最下面的那一个——差集减的是它，产物的外观、名称、
 * 父级与插入位置取的也是它，一条规则四处用。
 *
 * 旋转过的与跨父级的操作数都支持：投影走世界空间，产物落成一条 `rotation` 为 0 的新曲线。
 * 这与填充跟随拒绝旋转边界不冲突——那条限制的理由是每帧要按盒快照重求，而布尔是一次性的。
 *
 * 至少要两个操作数。「结果没有面积」与「求解退化」报成两种互相可分的拒绝：前者按一下别的
 * 运算就好，后者要把形状错开一点再试。
 *
 * @public
 */
export function resolveStageBoolean(
  index: StageSceneIndex,
  ids: readonly string[],
  op: ComposeBooleanOp,
): StageBooleanResolution {
  if (ids.length < 2) return { status: 'rejected', reason: 'too-few' }
  const collected = collectOperands(index, ids, true)
  if (collected.status === 'rejected') return collected
  const { operands } = collected
  if (operands.length < 2) return { status: 'rejected', reason: 'too-few' }

  /*
   * `path` 操作数把自己的曲线一并交给内外判定：一块带岛的填充是两条子路径加 `evenodd`，
   * 而片段摊平之后收成「一条环」会把岛算成实心，洞在结果里被悄悄补平。其余三种 kind 各只有
   * 一条环，两种做法给出同一个答案，因此不传——让它们的行为逐字节不变。
   */
  const result = resolveComposeCurveBoolean(
    operands.map((operand) => (operand.curve.kind === 'path'
      ? { pieces: operand.outline, curve: operand.curve }
      : { pieces: operand.outline })),
    op,
  )
  if (result.status === 'empty') return { status: 'rejected', reason: 'empty' }
  if (result.status !== 'resolved') return { status: 'rejected', reason: 'degenerate' }
  return { status: 'resolved', curve: result.curve, operands }
}
