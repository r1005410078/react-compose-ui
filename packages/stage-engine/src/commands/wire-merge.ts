import {
  BUILTIN_COMMAND_TYPES,
  getComposeCurve,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeLock,
  getComposeWire,
  projectComposeCurveToBox,
  translateComposeCurve,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePosition,
  type ComposeWire,
  type ComposeWireBinding,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import { getEntityParentId } from '../geometry/stage-geometry'

/**
 * 一条接在某一点上的导线支路。
 *
 * @remarks
 * `entityId` 是导线，`end` 是它绑在那一点上的那一端。名字叫「支路」而不是「端」，是因为
 * `StageWireEnd` 已经被呈现层占着（它回答「这个端点画在哪儿、接线状态如何」）。
 *
 * @public
 */
export interface StageWireBranch {
  readonly entityId: string
  readonly end: 'start' | 'end'
}

/** {@link planStageWireMerge} 的结果。 @public */
export interface StageWireMergePlan {
  /** 留下来的那条导线；它的 id、名称与全部呈现都不变。 */
  readonly keptId: string
  /** 被并掉的那条；命令里已经含了删掉它的那一条。 */
  readonly removedId: string
  /** 改几何那一条加删除那一条，按这个顺序。 */
  readonly commands: readonly EditorCommand[]
}

/**
 * 一条导线在 parent 局部坐标下的顶点。
 *
 * @remarks
 * 盒与几何之间的换算只有一个入口。盒尺寸读 `LayoutItem` 而不是布局快照：合并与剪断都由
 * 只拿得到文档的那些路径调用——而导线是绝对定位，`entity.curve.set` 每次都把这两个值写成
 * 紧包围盒，因此它就是那个盒。
 *
 * @returns 不是合法的导线几何（闭合折线、弧、`path`、顶点不足）时为 `null`。
 * @public
 */
export function stageWireParentVertices(
  entity: ComposeEntity,
): readonly ComposePosition[] | null {
  const curve = getComposeCurve(entity)
  const item = getComposeLayoutItem(entity)
  if (!curve || !item) return null
  const box = projectComposeCurveToBox(curve, { width: item.width.value, height: item.height.value })
  const local = translateComposeCurve(box, item.offset.x, item.offset.y)
  if (local.kind === 'line') return [local.start, local.end]
  // 闭合折线没有首尾两端可言，弧与 `path` 本来就不是合法的导线几何。
  if (local.kind !== 'polyline' || local.closed) return null
  return local.vertices.length >= 2 ? local.vertices : null
}

/**
 * 把顶点摆成「相接点在末尾」或「相接点在开头」。
 *
 * @remarks
 * 相接点可能是这条导线的首顶点，也可能是末顶点，因此接起来之前要按需反转。
 *
 * @public
 */
export function orientStageWireVertices(
  vertices: readonly ComposePosition[],
  end: 'start' | 'end',
  joint: 'last' | 'first',
): readonly ComposePosition[] {
  const jointIsLast = end === 'end'
  return (joint === 'last') === jointIsLast ? vertices : [...vertices].reverse()
}

/** 一条支路的**远端**绑定；相接点那一端不算。 */
function farBinding(entity: ComposeEntity, end: 'start' | 'end'): ComposeWireBinding | undefined {
  return getComposeWire(entity)?.[end === 'start' ? 'end' : 'start']
}

/** 场景树里的位置：同父级下的下标。 */
function siblingIndex(document: ComposeDocument, parentId: string | null, entityId: string): number {
  const siblings = parentId
    ? getComposeHierarchy(document.entities[parentId] as ComposeEntity)?.childIds ?? []
    : document.rootIds
  return siblings.indexOf(entityId)
}

/**
 * 把两条在同一点相接的导线合并成一条。
 *
 * @remarks
 * 两条线在一点相接、而那一点上再没有第三样东西时，它们在电气上**就是**一条线，而同一张图
 * 不该有两种文档形态——这正是「一次画出 A→B→C」与「先画 A→B 再画 B→C」今天产出不同文档的
 * 原因，也是「把搭上去的那条删掉之后两半合不回去」的原因。
 *
 * **相接点作为顶点留下，不做共线消解**：一次画出的 A→B→C 是三个顶点，分两次画出的合并之后
 * 也必须是三个顶点。顺手消解共线点只是把这两种画法重新分家、分在了另一处。
 *
 * **留下场景树里更靠前的那一条**：两条的呈现可能各是各的，而「合并之后这条线是什么颜色」
 * 必须能从图上读出来；取更靠前的那一条等于「并进图上先有的那一条」，与搭接时「第一段留在
 * 原 Entity 上」是同一条判断。取顶点数更多的那一条会要求用户在脑子里比一个他看不见的量。
 *
 * 相接点的坐标取**留下来那一条**的：两端都绑在同一个端口上，求解已经把它们写到了同一个点，
 * 因此两者本来就相等；取其中一个而不是取中点，是为了让这条规划的结果只依赖一个来源。
 *
 * @returns 三种情形下为 `null`——两条其实是同一条导线（合并会把它接成一个环）、两者跨父级
 * （导线与它绑定的实体必须同父级）、任一条被锁定或几何不是合法的导线几何。
 * @public
 */
export function planStageWireMerge(
  document: ComposeDocument,
  ends: readonly [StageWireBranch, StageWireBranch],
  options: { readonly idFactory: () => string },
): StageWireMergePlan | null {
  const [first, second] = ends
  if (first.entityId === second.entityId) return null
  const a = document.entities[first.entityId]
  const b = document.entities[second.entityId]
  if (!a || !b) return null
  if (getComposeLock(a).locked || getComposeLock(b).locked) return null
  const parentId = getEntityParentId(document, a.id)
  if (parentId !== getEntityParentId(document, b.id)) return null

  // 更靠前的那一条留下来；两者都在同一个父级下，因此这两个下标可比。
  const keepFirst = siblingIndex(document, parentId, a.id) <= siblingIndex(document, parentId, b.id)
  const kept = keepFirst ? first : second
  const removed = keepFirst ? second : first
  const keptEntity = keepFirst ? a : b
  const removedEntity = keepFirst ? b : a

  const head = stageWireParentVertices(keptEntity)
  const tail = stageWireParentVertices(removedEntity)
  if (!head || !tail) return null

  // 留下来那条的相接点摆到末尾，被并掉那条的摆到开头，接起来时丢掉重复的那一个。
  const vertices = [
    ...orientStageWireVertices(head, kept.end, 'last'),
    ...orientStageWireVertices(tail, removed.end, 'first').slice(1),
  ]
  const start = farBinding(keptEntity, kept.end)
  const end = farBinding(removedEntity, removed.end)
  const merged: ComposeWire = { ...(start ? { start } : {}), ...(end ? { end } : {}) }
  const nextWire = Object.keys(merged).length > 0
    ? merged
    : (getComposeWire(keptEntity) ? null : undefined)

  return {
    keptId: keptEntity.id,
    removedId: removedEntity.id,
    commands: [
      {
        id: options.idFactory(),
        type: BUILTIN_COMMAND_TYPES.setCurve,
        payload: {
          entityId: keptEntity.id,
          curve: { kind: 'polyline', closed: false, vertices } as unknown as JsonValue,
          /*
           * 两端都没绑的导线不留一个空壳 `Wire`：`null` 在这条命令上就是「把它去掉」。它本来
           * 就没有时**不写这个字段**——去掉一个不存在的 Component 会让整条批次被拒
           * （`patch.invalid-path`），而两端都自由正是一张图上最常见的状态。
           */
          ...(nextWire === undefined ? {} : { wire: nextWire as unknown as JsonValue }),
        },
        meta: { label: keptEntity.name, source: 'stage', targetIds: [keptEntity.id] },
      },
      {
        id: options.idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds: [removedEntity.id] },
        meta: { source: 'stage', targetIds: [removedEntity.id] },
      },
    ],
  }
}
