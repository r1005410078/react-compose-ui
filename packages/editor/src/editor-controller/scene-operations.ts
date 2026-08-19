import {
  createDuplicateCommand,
  createReparentCommand,
  getEntityParentId,
  resolveNextScenePlacement,
  resolveTargetFrameId,
} from '@compose-ui/stage-engine'
import {
  getComposeHierarchy,
  BUILTIN_COMMAND_TYPES,
  COMPOSE_DEFAULT_FRAME_SIZE,
  adoptComposeCrossAxisSizing,
  createComposeBatchCommand,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  isComposeFrameEntity,
  promoteComposeEntityToFrame,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeFlexLayout,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposeEntityRegistry, ComposeEntitySeed } from '@compose-ui/component-registry'
import type { ComposeSceneTreeOperation } from '@compose-ui/scene-tree'

/** 场景树操作命令的统一来源标识。 @internal */
const SCENE_TREE_SOURCE = 'scene-tree'

/** 嵌套容器创建时使用的默认尺寸。 @internal */
const NESTED_CONTAINER_SIZE = { width: 320, height: 180 } as const

/** 落点解析只关心"没有选中任何东西"这一种回退，因此选区常量提到模块级。 */
const NO_SELECTION: readonly string[] = []

/**
 * 规划场景树操作所需的只读上下文。
 *
 * @remarks
 * 规划器是纯函数：只读取上下文并返回结果，不派发命令、不修改文档、不产生副作用。
 *
 * @internal
 */
export interface SceneOperationContext {
  /** 规划开始时的完整文档快照。 */
  readonly document: ComposeDocument
  /** 跨父级操作冻结使用的布局结果；加载期间为 null。 */
  readonly layoutSnapshot: ComposeLayoutSnapshot | null
  /** 提供 Entity Preset 的实例级注册表。 */
  readonly registry: ComposeEntityRegistry
  /** 创建容器使用的 Entity Preset ID。 */
  readonly containerPresetId: string
  /** 命令与 Entity ID factory。 */
  readonly nextId: () => string
}

/** 一次场景树操作规划出的命令与选择副作用。 @internal */
export interface SceneOperationPlan {
  /** 待派发的结构化命令。 */
  readonly command: EditorCommand
  /** 命令提交成功后替换的选择；省略表示保持当前选择。 */
  readonly nextSelection?: readonly string[]
}

/**
 * 场景树操作的规划结果。
 *
 * @remarks
 * `unavailable` 表示宿主配置缺失（例如未注册容器 Preset），调用方应输出可定位的
 * 诊断信息；`skipped` 表示该操作在当前文档下不产生任何变更。
 *
 * @internal
 */
export type SceneOperationResult =
  | { readonly status: 'planned'; readonly plan: SceneOperationPlan }
  | { readonly status: 'skipped' }
  | { readonly status: 'unavailable'; readonly reason: string }

type SceneOperationType = ComposeSceneTreeOperation['type']

type SceneOperationPlanners = {
  readonly [K in SceneOperationType]: (
    operation: Extract<ComposeSceneTreeOperation, { type: K }>,
    context: SceneOperationContext,
  ) => SceneOperationResult
}

function planned(
  command: EditorCommand,
  nextSelection?: readonly string[],
): SceneOperationResult {
  return {
    status: 'planned',
    plan: { command, ...(nextSelection ? { nextSelection } : {}) },
  }
}

function sceneCommand(
  context: SceneOperationContext,
  type: string,
  payload: EditorCommand['payload'],
  label: string,
  targetIds: readonly string[],
): EditorCommand {
  return {
    id: context.nextId(),
    type,
    payload,
    meta: { label, source: SCENE_TREE_SOURCE, targetIds },
  }
}

/** 事务标签中对一批目标 Entity 的简短描述。 @internal */
export function describeEntityTargets(
  document: ComposeDocument,
  entityIds: readonly string[],
): string {
  if (entityIds.length === 1) return document.entities[entityIds[0]!]?.name ?? 'entity'
  return `${entityIds.length} entities`
}

function entityFromSeed(
  id: string,
  seed: ComposeEntitySeed,
  transform: ComposeSpatialTransform,
  parentLayout?: ComposeFlexLayout,
): ComposeEntity {
  const item = getComposeLayoutItem({ id: '__seed__', ...seed })
  const placed = {
    ...item,
    offset: transform.position,
    width: { ...item.width, value: transform.size.width },
    height: { ...item.height, value: transform.size.height },
  }
  return {
    id,
    name: seed.name,
    components: {
      ...seed.components,
      Transform: { rotation: transform.rotation },
      // 父级是 Auto Layout 容器时进入排队并采纳交叉轴，与画布 reparent/拖入判定一致。
      LayoutItem: parentLayout
        ? adoptComposeCrossAxisSizing({ ...placed, positioning: 'flow' }, parentLayout)
        : placed,
    },
  }
}

function planCreate(
  operation: Extract<ComposeSceneTreeOperation, { type: 'create' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  const created = context.registry.createSeed(context.containerPresetId)
  if (!created.ok) {
    return {
      status: 'unavailable',
      reason: `无法创建容器 Preset "${context.containerPresetId}"：${created.error.message}`,
    }
  }
  const entityId = context.nextId()
  const initial = getComposeSpatialTransform({ id: '__seed__', ...created.seed })
  // 场景树的"根级"就是场景所在的那一层：在那里新建一个容器等于新建一块场景，与在画布上
  // 所有场景之外画一个容器是同一条规则。MUST NOT 像过去那样悄悄塞进 rootIds[0]。
  if (operation.parentId === null) {
    const transform: ComposeSpatialTransform = {
      ...initial,
      position: { ...resolveNextScenePlacement(context.document) },
      size: { ...COMPOSE_DEFAULT_FRAME_SIZE },
    }
    const scene = promoteComposeEntityToFrame(
      entityFromSeed(entityId, created.seed, transform),
      transform.size,
    )
    const name = `场景 ${context.document.rootIds.length + 1}`
    return planned(
      sceneCommand(
        context,
        BUILTIN_COMMAND_TYPES.createEntity,
        {
          entity: { ...scene, name } as unknown as JsonValue,
          parentId: null,
          index: operation.index,
        },
        `Create ${name}`,
        [entityId],
      ),
      [entityId],
    )
  }
  const parentId = operation.parentId
  const isRoot = context.document.rootIds.includes(parentId)
  // 根 Frame 直接子级沿对角线依次错开，避免多个容器完全重叠；更深的子级从父容器原点开始。
  const siblings = isRoot
    ? getComposeHierarchy(context.document.entities[parentId])?.childIds.length ?? 0
    : 0
  const rootOffset = 80 + siblings * 40
  const transform: ComposeSpatialTransform = {
    ...initial,
    position: isRoot ? { x: rootOffset, y: rootOffset } : { x: 0, y: 0 },
    size: isRoot ? initial.size : { ...NESTED_CONTAINER_SIZE },
  }
  const parent = context.document.entities[parentId]
  const entity = entityFromSeed(
    entityId,
    created.seed,
    transform,
    parent ? getComposeLayout(parent) : undefined,
  )
  return planned(
    sceneCommand(
      context,
      BUILTIN_COMMAND_TYPES.createEntity,
      {
        entity: entity as unknown as JsonValue,
        parentId,
        index: operation.index,
      },
      `Create Container · ${transform.size.width} × ${transform.size.height}`,
      [entityId],
    ),
    [entityId],
  )
}

function planRename(
  operation: Extract<ComposeSceneTreeOperation, { type: 'rename' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  const previousName = context.document.entities[operation.nodeId]?.name ?? 'entity'
  return planned(sceneCommand(
    context,
    BUILTIN_COMMAND_TYPES.renameEntity,
    { entityId: operation.nodeId, name: operation.label },
    `Rename ${previousName} · “${previousName}” → “${operation.label}”`,
    [operation.nodeId],
  ))
}

function planDelete(
  operation: Extract<ComposeSceneTreeOperation, { type: 'delete' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  return planned(sceneCommand(
    context,
    BUILTIN_COMMAND_TYPES.deleteEntity,
    { entityIds: operation.nodeIds },
    `Delete ${describeEntityTargets(context.document, operation.nodeIds)}`,
    operation.nodeIds,
  ))
}

function planSetVisibility(
  operation: Extract<ComposeSceneTreeOperation, { type: 'set-visibility' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  return planned(sceneCommand(
    context,
    BUILTIN_COMMAND_TYPES.setVisibility,
    { entityIds: operation.nodeIds, visible: operation.visible },
    `${operation.visible ? 'Show' : 'Hide'} `
    + describeEntityTargets(context.document, operation.nodeIds),
    operation.nodeIds,
  ))
}

function planSetLocked(
  operation: Extract<ComposeSceneTreeOperation, { type: 'set-locked' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  return planned(sceneCommand(
    context,
    BUILTIN_COMMAND_TYPES.setLock,
    { entityIds: operation.nodeIds, locked: operation.locked },
    `${operation.locked ? 'Lock' : 'Unlock'} `
    + describeEntityTargets(context.document, operation.nodeIds),
    operation.nodeIds,
  ))
}

/**
 * 把场景树的"根级"落点解析为文档中的落点。
 *
 * @remarks
 * 场景树是通用受控组件，`parentId: null` 表示树的根；v7 的文档根只放 Frame，所以要么留在
 * 根层、要么落进某块场景：
 *
 * - 被移动或复制的**全是场景**时留在根层。否则在树里拖动场景排序会把它塞进上一块场景，
 *   复制一块场景也会变成嵌套容器。
 * - 其余情况落进第一块根场景。场景树没有"当前正在编辑哪块场景"的空间语义，而页面的激活
 *   场景只有 `ComposeEditor` 知道（controller 由宿主创建、页面会话在编辑器内），因此这里
 *   不去解析激活场景——想按空间意图落点的是画布，不是树。
 *
 * 所有会写入父子关系的规划器都必须走这里。
 */
function resolveDropParentId(
  context: SceneOperationContext,
  parentId: string | null,
  entityIds: readonly string[],
): string | null {
  if (parentId !== null) return parentId
  const allFrames = entityIds.length > 0
    && entityIds.every((id) => isComposeFrameEntity(context.document.entities[id]))
  if (allFrames) return null
  return resolveTargetFrameId(context.document, NO_SELECTION)
}

function planMove(
  operation: Extract<ComposeSceneTreeOperation, { type: 'move' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  // 跨父级移动必须保持世界坐标，交由 stage-engine 重算局部 Transform；
  // 同父级内只是顺序变化，用轻量的 moveEntity 即可。
  const parentId = resolveDropParentId(context, operation.parentId, operation.nodeIds)
  const crossesParent = operation.nodeIds.some(
    (id) => getEntityParentId(context.document, id) !== parentId,
  )
  if (crossesParent) {
    if (!context.layoutSnapshot) {
      return { status: 'unavailable', reason: '自动布局仍在加载，暂时不能跨容器移动' }
    }
    return planned(createReparentCommand(
      context.document,
      context.layoutSnapshot,
      operation.nodeIds,
      parentId,
      operation.index,
      context.nextId(),
    ))
  }
  return planned(sceneCommand(
    context,
    BUILTIN_COMMAND_TYPES.moveEntity,
    {
      entityIds: operation.nodeIds,
      parentId,
      index: operation.index,
    },
    `Reorder ${describeEntityTargets(context.document, operation.nodeIds)}`
    + ` · position ${operation.index + 1}`,
    operation.nodeIds,
  ))
}

function planDuplicate(
  operation: Extract<ComposeSceneTreeOperation, { type: 'duplicate' }>,
  context: SceneOperationContext,
): SceneOperationResult {
  const duplicates = operation.sourceNodeIds
    .map((id, offset) => createDuplicateCommand(
      context.document,
      id,
      context.nextId,
      context.nextId(),
      {
        parentId: resolveDropParentId(context, operation.parentId, operation.sourceNodeIds),
        index: operation.index + offset,
      },
    ))
    .filter((item): item is NonNullable<typeof item> => item !== null)
  if (duplicates.length === 0) return { status: 'skipped' }
  const selection = duplicates.map((item) => item.rootId)
  if (duplicates.length === 1) return planned(duplicates[0]!.command, selection)
  return planned(
    createComposeBatchCommand({
      id: context.nextId(),
      commands: duplicates.map((item) => item.command),
      meta: {
        label: `Duplicate ${describeEntityTargets(context.document, operation.sourceNodeIds)}`,
        source: SCENE_TREE_SOURCE,
        targetIds: operation.sourceNodeIds,
      },
    }),
    selection,
  )
}

const SCENE_OPERATION_PLANNERS: SceneOperationPlanners = {
  create: planCreate,
  rename: planRename,
  delete: planDelete,
  move: planMove,
  duplicate: planDuplicate,
  'set-visibility': planSetVisibility,
  'set-locked': planSetLocked,
}

/**
 * 把一次受控场景树操作规划成待派发命令。
 *
 * @remarks
 * 按 operation.type 查表分派。映射表以 ComposeSceneTreeOperation 的判别键构建，
 * 新增操作类型时缺少对应规划器会直接产生编译错误。
 *
 * @param operation - 场景树发出的受控操作。
 * @param context - 规划所需的文档、注册表与 ID factory。
 * @returns 待派发命令、跳过或宿主配置缺失。
 * @internal
 */
export function planSceneOperation(
  operation: ComposeSceneTreeOperation,
  context: SceneOperationContext,
): SceneOperationResult {
  // 映射表的每个成员都接受精确窄化后的操作，但用联合类型索引只能得到函数联合，
  // TypeScript 无法自证参数与键的对应关系；此处一次断言把该关系交回映射表，
  // 从而避免在调用点重新按 type 分支。
  const planners = SCENE_OPERATION_PLANNERS as Record<
    SceneOperationType,
    (operation: ComposeSceneTreeOperation, context: SceneOperationContext) => SceneOperationResult
  >
  return planners[operation.type](operation, context)
}
