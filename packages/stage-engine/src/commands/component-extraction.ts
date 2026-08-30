import {
  COMPOSE_DEFAULT_TRANSFORM_PIVOT,
  getComposeTransformPivot,
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  createComposeGroupEntitySeed,
  getComposeCurve,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeLock,
  getComposeAnimations,
  promoteComposeEntityToFrame,
  resolveOwningFrameId,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import {
  decomposeMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  multiplyMatrices,
  toComposeTransform,
  translationMatrix,
  unionRects,
} from '../geometry'

/** 组件抽取失败的稳定原因。 @public */
export type ComposeComponentExtractionUnavailableReason =
  | 'selection-empty'
  | 'selection-invalid'
  | 'different-parents'
  | 'flow-selection'
  | 'locked-selection'
  | 'layout-pending'
  | 'group-id-conflict'

/** 场景选区抽取为组件文档后的纯规划结果。 @public */
export interface ComposeComponentExtractionPlan {
  readonly status: 'ready'
  readonly sourceEntityIds: readonly string[]
  readonly parentId: string | null
  readonly siblingIndex: number
  readonly componentDocument: ComposeDocument
  readonly instanceTransform: ComposeSpatialTransform
}

/** 组件抽取规划的判别结果。 @public */
export type ComposeComponentExtractionResult = ComposeComponentExtractionPlan | {
  readonly status: 'unavailable'
  readonly reason: ComposeComponentExtractionUnavailableReason
}

function childrenOf(document: ComposeDocument, parentId: string | null): readonly string[] {
  return parentId === null
    ? document.rootIds
    : getComposeHierarchy(document.entities[parentId]!)?.childIds ?? []
}

function hasSelectedAncestor(
  document: ComposeDocument,
  entityId: string,
  selected: ReadonlySet<string>,
) {
  let parentId = getEntityParentId(document, entityId)
  while (parentId !== null) {
    if (selected.has(parentId)) return true
    parentId = getEntityParentId(document, parentId)
  }
  return false
}

function normalizeSelection(
  document: ComposeDocument,
  selectedIds: readonly string[],
): readonly string[] | null {
  const unique = [...new Set(selectedIds)]
  if (unique.length === 0 || unique.some((id) => document.entities[id] === undefined)) return null
  const selected = new Set(unique)
  const roots = unique.filter((id) => !hasSelectedAncestor(document, id, selected))
  const parentId = getEntityParentId(document, roots[0]!)
  if (roots.some((id) => getEntityParentId(document, id) !== parentId)) return roots
  const order = childrenOf(document, parentId)
  return [...roots].sort((left, right) => order.indexOf(left) - order.indexOf(right))
}

function collectSubtree(
  document: ComposeDocument,
  entityId: string,
  entities: Record<string, ComposeEntity>,
) {
  const entity = document.entities[entityId]
  if (!entity || entities[entityId]) return
  entities[entityId] = structuredClone(entity)
  getComposeHierarchy(entity)?.childIds.forEach((childId) => {
    collectSubtree(document, childId, entities)
  })
}

function withTransform(
  entity: ComposeEntity,
  transform: ComposeSpatialTransform,
): ComposeEntity {
  const item = getComposeLayoutItem(entity)
  return {
    ...entity,
    components: {
      ...entity.components,
      Transform: { rotation: transform.rotation },
      LayoutItem: {
        ...item,
        positioning: 'absolute',
        offset: transform.position,
        width: { ...item.width, value: transform.size.width },
        height: { ...item.height, value: transform.size.height },
      },
    },
  }
}

function transformRelativeTo(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
  targetWorld: ReturnType<typeof translationMatrix>,
): ComposeSpatialTransform | null {
  const box = snapshot.boxes[entityId]
  if (!box) return null
  return toComposeTransform(decomposeMatrix(
    multiplyMatrices(
      invertMatrix(targetWorld),
      getEntityWorldMatrix(document, snapshot, entityId),
    ),
    box.width,
    box.height,
    getComposeTransformPivot(document.entities[entityId]!),
  ))
}

function transformUnderParent(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  world: ReturnType<typeof translationMatrix>,
  parentId: string | null,
  width: number,
  height: number,
): ComposeSpatialTransform {
  const parentWorld = parentId === null
    ? null
    : getEntityWorldMatrix(document, snapshot, parentId)
  const local = parentWorld ? multiplyMatrices(invertMatrix(parentWorld), world) : world
  // 唯一调用方求的是**本次新建**的组件实例的几何，它还没有基点。
  return toComposeTransform(decomposeMatrix(local, width, height, COMPOSE_DEFAULT_TRANSFORM_PIVOT))
}

/**
 * 把同父级 Absolute 顶层选区克隆为透明、单根 Group 的独立 v6 组件文档。
 *
 * @remarks
 * 规划器不修改正式文档。选区中的后代会被祖先覆盖，结果沿原 sibling 顺序排列；只有资源
 * 写入成功后，调用方才应使用 `createReplaceSelectionWithEntityCommand` 提交场景替换。
 *
 * @public
 */

/**
 * 收集应当跟着组件走的动画清单条目。
 *
 * @remarks
 * 判据是「这条动画**至少有一条轨道落在被提取的实体上**」。整份清单照抄会让组件多出几条
 * 它一根轨道都没有的动画；只按选区顶层判断则会漏掉后代身上的轨道。
 *
 * **id 逐字保留。**轨道按动画 id 分组（`Animation.clips[animationId]`），换一个新 id 会让
 * 刚提取出来的轨道全部变成悬空分组——时间线上什么都不动，而文档校验不会拒绝它，因为悬空
 * 分组本来就只是一条 issue。这是本函数唯一真正容易写错的地方。
 *
 * **复制而不是搬运**：源文档一个字节都不改。选区可能只是这条动画的一部分——同一条动画给
 * A 和 B 都打了点，用户只把 A 存成组件时删掉源条目，会让 B 的轨道全部悬空，而用户根本没有
 * 选中 B。留下一条零轨道的清单条目不是数据丢失，它在时间线上看得见。
 *
 * `bindings` 被丢弃：它指向页面 setup 的导出名，而嵌套文档没有脚本作用域，那份声明在任何
 * 实例上都解析不出值。驱动实例的是宿主侧实例 Entity 上的播放头 Renderer Prop。
 *
 * 轨道 Component（`Animation`）属于 `@compose-ui/animation` 的词汇，本包不依赖它，因此
 * 「一个 Entity 参与了哪几条动画」由调用方以 `readEntityAnimationIds` 注入。清单
 * （`Animations`）是 core 的内建 Component，直接读。
 */
/** 整体重写组件根的 `Animations`；没有条目时连 Component 一起去掉。 */
function withAnimations(
  entity: ComposeEntity,
  items: readonly JsonObject[],
): ComposeEntity {
  if (items.length === 0) {
    if (entity.components.Animations === undefined) return entity
    const components = Object.fromEntries(
      Object.entries(entity.components).filter(([key]) => key !== 'Animations'),
    )
    return { ...entity, components }
  }
  return { ...entity, components: { ...entity.components, Animations: { items } } }
}

function collectExtractedAnimations(
  document: ComposeDocument,
  extracted: Readonly<Record<string, ComposeEntity>>,
  anchorId: string,
  readEntityAnimationIds: ((entity: ComposeEntity) => readonly string[]) | undefined,
): readonly JsonObject[] {
  if (!readEntityAnimationIds) return []
  const used = new Set<string>()
  Object.values(extracted).forEach((item) => {
    readEntityAnimationIds(item).forEach((id) => used.add(id))
  })
  if (used.size === 0) return []
  const frameId = resolveOwningFrameId(document, anchorId)
  if (!frameId) return []
  return getComposeAnimations(document, frameId)
    .filter((item) => used.has(item.id))
    .map((item) => Object.fromEntries(
      Object.entries(structuredClone(item as JsonObject)).filter(([key]) => key !== 'bindings'),
    ))
}

export function createComponentExtractionPlan(input: {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly selectedIds: readonly string[]
  readonly groupId: string
  readonly name: string
  /**
   * 读一个 Entity 参与了哪几条动画（即它 `Animation.clips` 的分组键）。
   *
   * @remarks
   * 轨道 Component 属于 `@compose-ui/animation` 的词汇，本包不依赖那个包，因此这一步由
   * 调用方注入。省略时不搬运任何清单，既有调用方行为不变。
   */
  readonly readEntityAnimationIds?: (entity: ComposeEntity) => readonly string[]
}): ComposeComponentExtractionResult {
  const roots = normalizeSelection(input.document, input.selectedIds)
  if (!roots) return { status: 'unavailable', reason: 'selection-empty' }
  const parentId = getEntityParentId(input.document, roots[0]!)
  if (roots.some((id) => getEntityParentId(input.document, id) !== parentId)) {
    return { status: 'unavailable', reason: 'different-parents' }
  }
  if (roots.some((id) => getComposeLayoutItem(input.document.entities[id]!).positioning !== 'absolute')) {
    return { status: 'unavailable', reason: 'flow-selection' }
  }
  if (
    roots.some((id) => getComposeLock(input.document.entities[id]!).locked)
    || (parentId !== null && getComposeLock(input.document.entities[parentId]!).locked)
  ) return { status: 'unavailable', reason: 'locked-selection' }
  if (roots.some((id) => !input.layoutSnapshot.boxes[id])) {
    return { status: 'unavailable', reason: 'layout-pending' }
  }

  const bounds = unionRects(roots.map((id) => (
    getEntityWorldBounds(input.document, input.layoutSnapshot, id)
  )))
  if (!bounds) return { status: 'unavailable', reason: 'selection-invalid' }
  const safeBounds = {
    ...bounds,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
  }
  const outputWorld = translationMatrix(safeBounds.x, safeBounds.y)
  /*
   * 单选时直接复用被选中的节点作为组件根：追加包装层会在场景树里多出一级同名节点，
   * 且组件根不再要求是 Group，任意 Entity 都可以承担。只有多选才需要 Group 归拢。
   *
   * **带 `Curve` 的 Entity 例外**：组件根必须是 Frame，而 Frame 蕴含 Hierarchy，
   * 「`Curve` 不能与 Hierarchy 组合」——一条曲线不是容器。复用它会造出一份非法文档，
   * 症状是「创建组件」按下去没反应、对话框里留一句读不懂的校验错误。因此退回 Group 包装，
   * 与多选走同一条路。
   */
  const curveRoot = roots.length === 1
    && getComposeCurve(input.document.entities[roots[0]!]) !== undefined
  const reuseRoot = roots.length === 1 && !curveRoot
  if (!reuseRoot && input.document.entities[input.groupId]) {
    return { status: 'unavailable', reason: 'group-id-conflict' }
  }

  const entities: Record<string, ComposeEntity> = {}
  roots.forEach((rootId) => collectSubtree(input.document, rootId, entities))
  for (const rootId of roots) {
    const transform = transformRelativeTo(
      input.document,
      input.layoutSnapshot,
      rootId,
      outputWorld,
    )
    if (!transform) return { status: 'unavailable', reason: 'layout-pending' }
    entities[rootId] = withTransform(entities[rootId]!, transform)
  }

  const componentRootId = reuseRoot ? roots[0]! : input.groupId
  if (reuseRoot) {
    entities[componentRootId] = { ...entities[componentRootId]!, name: input.name }
  }
  else {
    entities[componentRootId] = createComposeGroupEntitySeed({
      id: componentRootId,
      name: input.name,
      childIds: roots,
      size: safeBounds,
    })
  }
  // 组件根必须是 Frame（Component Asset v2）。这里是「创建组件」这一用户动作的隐含升格，
  // 与「在场景外画容器」共用同一个纯函数：只加 Frame，其余原地保留。
  entities[componentRootId] = promoteComposeEntityToFrame(
    entities[componentRootId]!,
    { width: safeBounds.width, height: safeBounds.height },
  )
  /*
   * 动画清单跟着走。轨道住在 Entity 的 `Animation` 上，已经被 `collectSubtree` 带过来了；
   * 清单住在 Frame 的 `Animations` 上，留在源页面——两者分家的结果是一份有轨道没清单的
   * 文档，而清单才是「有哪些动画」的事实来源。
   *
   * 写在升格**之后**而不是塞进 `promoteComposeEntityToFrame`：升格只做一件事是一条不变量，
   * 而它还有「在场景外画容器」等调用方，那些调用方没有源清单可搬。
   *
   * 整体重写 `Animations` 而不是合并：复用的根可能本来就是一块场景，带着自己的 `source`
   * 与别的清单条目；组件不该有文件引用（见 `collectExtractedAnimations`）。没有条目时
   * 连 Component 一起去掉，避免文档里攒下读不出意图的空壳。
   */
  const extractedAnimations = collectExtractedAnimations(
    input.document,
    entities,
    roots[0]!,
    input.readEntityAnimationIds,
  )
  entities[componentRootId] = withAnimations(entities[componentRootId]!, extractedAnimations)
  const siblings = childrenOf(input.document, parentId)
  const siblingIndex = Math.min(...roots.map((id) => siblings.indexOf(id)))
  const componentDocument: ComposeDocument = {
    schemaVersion: 7,
    canvas: structuredClone(input.document.canvas),
    rootIds: [componentRootId],
    entities,
  }
  return {
    status: 'ready',
    sourceEntityIds: roots,
    parentId,
    siblingIndex,
    componentDocument,
    instanceTransform: transformUnderParent(
      input.document,
      input.layoutSnapshot,
      outputWorld,
      parentId,
      safeBounds.width,
      safeBounds.height,
    ),
  }
}

/**
 * 创建“删除源子树并在最小 sibling index 插入实例”的原子可逆命令。
 *
 * @public
 */
export function createReplaceSelectionWithEntityCommand(input: {
  readonly document: ComposeDocument
  readonly plan: ComposeComponentExtractionPlan
  readonly entity: ComposeEntity
  readonly commandId: string
  readonly deleteCommandId: string
  readonly createCommandId: string
}): EditorCommand {
  const entity = withTransform(input.entity, input.plan.instanceTransform)
  const deleteCommand: EditorCommand = {
    id: input.deleteCommandId,
    type: BUILTIN_COMMAND_TYPES.deleteEntity,
    payload: { entityIds: input.plan.sourceEntityIds },
    meta: { label: 'Remove component source', source: 'component-library' },
  }
  const createCommand: EditorCommand = {
    id: input.createCommandId,
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId: input.plan.parentId,
      index: input.plan.siblingIndex,
    },
    meta: { label: `Create ${entity.name} instance`, source: 'component-library' },
  }
  return createComposeBatchCommand({
    id: input.commandId,
    commands: [deleteCommand, createCommand],
    meta: {
      label: `Create Component · ${entity.name}`,
      source: 'component-library',
      targetIds: [...input.plan.sourceEntityIds, entity.id],
    },
  })
}
