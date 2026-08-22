import { CommandPanelWithActions } from './command-panel-actions'
import { createComposeEditorActionHandlers } from './action-catalog'
import type { ComposeEditorActionHandlerContext } from './action-catalog'
import { ComposeComponentPalette } from '@compose-ui/stage'
import {
  ComposeComponentLibraryPanel,
  ComposeComponentAssetIcon,
  createComposeComponentInstanceEntity,
  readComposeComponentInstance,
  type ComposeComponentLibraryItem,
  type ComposeComponentSnapshot,
  type ComposeComponentStore,
} from '@compose-ui/component-library'
import {
  createComponentExtractionPlan,
  createReplaceSelectionWithEntityCommand,
  createStageInteractionController,
  createStageSceneIndex,
  getEntityWorldBounds,
  unionRects,
  zoomViewportAt,
} from '@compose-ui/stage-engine'
import {
  COMPOSE_COMPONENT_SCHEMA_VERSION,
  getComposeFrame,
  BUILTIN_COMMAND_TYPES,
  composeInstancePathHostId,
  createTransactionRuntime,
  diffComposeComponentDocuments,
  decodeComposeInstancePath,
  encodeComposeInstancePath,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeLock,
  getComposeRenderer,
  getComposeVisibility,
  isComposeFrameEntity,
  isComposeInstancePath,
  resolveComposeInstanceOverrides,
  type ComposeBaseComponentAsset,
  type CommandDispatchResult,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
  type EditorTransaction,
  type TransactionRuntime,
} from '@compose-ui/core'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import type { ComposeCommandPreset } from '@compose-ui/command-panel'
import type {
  ComposeEntityRegistry,
  ComposeNodeEditPort,
  ComposePaintEditPort,
} from '@compose-ui/component-registry'
import type { ComposeHistoryNavigationController } from '@compose-ui/history'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import {
  useComposeSceneTreeCommands,
  type ComposeSceneTreeExternalDragEvent,
  type ComposeSceneTreeNode,
  type ComposeSceneTreeOperation,
  type ComposeSceneTreeProps,
} from '@compose-ui/scene-tree'
import type {
  ComposeStageDelegatableAction,
  ComposeStagePolicy,
  ComposeStageProps,
  ComposeStageMarqueeMode,
  ComposeStageServices,
  ComposeStageTool,
} from '@compose-ui/stage'
import type {
  StageInteractionController,
  StagePaintEditing,
  StagePaintSampling,
  StageViewport,
} from '@compose-ui/stage-engine'
import {
  DefaultEmptyInspector,
  EntityInspector,
  PageInspector,
} from '../inspector'
import { planSceneOperation } from './scene-operations'
import {
  ViewportBoundStage,
} from './viewport-bound-panels'
import { composeEditorStageProps } from './stage-props-composition'
import type { ComposeEditorStageOverrides } from './stage-props-composition'
import { DefaultStageToolbar } from '../stage-toolbar'
import { createViewportStore } from './viewport-store'
import { useComposeEditorLayout } from './use-layout-runtime'

type InspectionTarget = 'entities' | null
type ShapeDrawingTool = 'draw-rectangle' | 'draw-line' | 'draw-arrow' | 'draw-circle'

function isShapeDrawingTool(tool: ComposeStageTool): tool is ShapeDrawingTool {
  return tool === 'draw-rectangle'
    || tool === 'draw-line'
    || tool === 'draw-arrow'
    || tool === 'draw-circle'
}

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `editor-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function useFinalControllerDisposal(controller: StageInteractionController) {
  const effectGeneration = useRef(0)
  useEffect(() => {
    effectGeneration.current += 1
    const mountedGeneration = effectGeneration.current
    return () => {
      // StrictMode 会同步 cleanup 后重放 setup；只在没有后续 setup 的最终卸载后永久释放。
      queueMicrotask(() => {
        if (effectGeneration.current === mountedGeneration) controller.dispose()
      })
    }
  }, [controller])
}

/**
 * 把组件实例解析后的内部实体投影为 Scene Tree 节点。
 *
 * @remarks
 * 投影只存在于编辑期表示层：宿主文档中实例仍是单个 Entity，内部节点用复合地址标识。
 *
 * 地址段数对应实例嵌套层数，而不是树深度：内部实体 ID 在组件文档内已唯一，因此同一实例内的
 * 任意深度都共用同一个前缀。按树深度逐层拼接会让层级较深的组件误撞段数上限。
 *
 * 能力位只放行已接线的操作：删除与实例内部移动写入实例覆盖；重命名无法由稳定操作代数
 * 表达（name 不是 Component 字段），可见性与锁定同理，因此保持关闭而不是留成静默失效。
 */
/**
 * 判断组件实例是否含可投影的内部子项。
 *
 * @remarks
 * 只读组件根的直接子项，不递归；用于在未展开时决定展开控件是否出现。
 */
function instanceHasInnerChildren(instance: ComposeEntity): boolean {
  const facts = readComposeComponentInstance(instance)
  if (!facts) return false
  const rootId = facts.snapshot.document.rootIds[0]
  if (!rootId) return false
  const root = facts.snapshot.document.entities[rootId]
  return root ? (getComposeHierarchy(root)?.childIds.length ?? 0) > 0 : false
}

function projectInstanceChildren(
  registry: ComposeEntityRegistry,
  instance: ComposeEntity,
  expandedIds: ReadonlySet<string>,
  addressPrefix: readonly string[],
): readonly ComposeSceneTreeNode[] | undefined {
  const facts = readComposeComponentInstance(instance)
  if (!facts) return undefined
  const resolved = resolveComposeInstanceOverrides({
    document: facts.snapshot.document,
    overrides: facts.overrides,
  })
  if (!resolved.ok) return undefined
  const innerDocument = resolved.document
  const rootId = innerDocument.rootIds[0]
  if (!rootId) return undefined
  // 组件根就是实例节点本身，因此投影从根的直接子项开始。
  const rootChildren = getComposeHierarchy(innerDocument.entities[rootId]!)?.childIds ?? []
  const project = (entityId: string): ComposeSceneTreeNode | null => {
    const inner = innerDocument.entities[entityId]
    if (!inner) return null
    const address = encodeComposeInstancePath([...addressPrefix, entityId])
    const innerHierarchy = getComposeHierarchy(inner)
    const composition = getComposeComposition(inner)
    const expanded = expandedIds.has(address)
    const children = innerHierarchy && expanded
      ? innerHierarchy.childIds
        .map((childId) => project(childId))
        .filter((node): node is ComposeSceneTreeNode => node !== null)
      : undefined
    return {
      id: address,
      label: inner.name,
      visible: getComposeVisibility(inner).visible,
      locked: getComposeLock(inner).locked,
      icon: composition.presetId ? registry.getPreset(composition.presetId)?.icon : undefined,
      canHaveChildren: innerHierarchy !== undefined,
      // 内部层级同样惰性物化，每一层都必须显式声明，否则第二层起就没有展开控件。
      hasChildren: (innerHierarchy?.childIds.length ?? 0) > 0,
      canRename: false,
      canDelete: true,
      canMove: true,
      canToggleVisibility: false,
      canToggleLocked: false,
      ...(children ? { children } : {}),
    }
  }
  return rootChildren
    .map((childId) => project(childId))
    .filter((node): node is ComposeSceneTreeNode => node !== null)
}

/**
 * 求出为了让复合地址可见而必须展开的祖先集合。
 *
 * @remarks
 * 从 Stage 下钻选中内部节点时，树上对应行可能还没被投影出来。这里解析实例内部文档，
 * 补齐宿主实例与内部祖先链，使选中行必然可见。
 */
function instanceSelectionAncestors(
  document: ComposeDocument,
  ids: readonly string[],
): readonly string[] {
  const ancestors: string[] = []
  for (const id of ids) {
    if (!isComposeInstancePath(id)) continue
    const decoded = decodeComposeInstancePath(id)
    if (!decoded.ok) continue
    const hostId = decoded.segments[0]!
    const innerId = decoded.segments[1]
    ancestors.push(hostId)
    const host = document.entities[hostId]
    if (!host || innerId === undefined) continue
    const facts = readComposeComponentInstance(host)
    if (!facts) continue
    const resolved = resolveComposeInstanceOverrides({
      document: facts.snapshot.document,
      overrides: facts.overrides,
    })
    if (!resolved.ok) continue
    // 组件根即实例节点本身，因此祖先链只收集根以下、目标以上的实体。
    const parentOf = new Map<string, string>()
    for (const entity of Object.values(resolved.document.entities)) {
      for (const childId of getComposeHierarchy(entity)?.childIds ?? []) {
        parentOf.set(childId, entity.id)
      }
    }
    const rootId = resolved.document.rootIds[0]
    for (
      let current = parentOf.get(innerId);
      current !== undefined && current !== rootId;
      current = parentOf.get(current)
    ) {
      ancestors.push(encodeComposeInstancePath([hostId, current]))
    }
  }
  return ancestors
}

/**
 * 在实例内部文档上执行命令并把结果写回宿主实例覆盖。
 *
 * @remarks
 * 命令先在内部文档的一次性 Runtime 上执行，再与「未施加实例覆盖」的快照做稳定 diff，
 * 重算整份结构操作后一次写回。重算而非追加，避免同一字段反复编辑累积成等价操作长串。
 *
 * 任一命令未提交或 diff 失败时整体放弃，不产生半应用覆盖。
 */
function applyInstanceInnerCommands(
  runtime: TransactionRuntime,
  host: ComposeEntity,
  facts: NonNullable<ReturnType<typeof readComposeComponentInstance>>,
  innerDocument: ComposeDocument,
  commands: readonly EditorCommand[],
  label: string,
): boolean {
  const innerRuntime = createTransactionRuntime({ document: innerDocument })
  for (const command of commands) {
    if (innerRuntime.dispatch(command).status !== 'committed') return false
  }
  const diff = diffComposeComponentDocuments({
    parent: facts.snapshot.document,
    current: innerRuntime.document,
  })
  if (!diff.ok) return false
  const renderer = host.components.Renderer
  if (!renderer) return false
  // 同步组件根 Frame 的尺寸到根 fixed LayoutItem：嵌套 Layout Runtime 以 Frame.size 为画布。
  const nextInner = innerRuntime.document
  const rootId = nextInner.rootIds[0]
  const root = rootId ? nextInner.entities[rootId] : undefined
  let nextSnapshotDocument = facts.snapshot.document
  if (root && rootId) {
    const rootItem = getComposeLayoutItem(root)
    const snapshotRoot = facts.snapshot.document.entities[rootId]
    const snapshotFrame = getComposeFrame(snapshotRoot)
    if (snapshotRoot && snapshotFrame
      && (rootItem.width.mode === 'fixed' || rootItem.height.mode === 'fixed')) {
      const size = {
        width: rootItem.width.mode === 'fixed' ? rootItem.width.value : snapshotFrame.size.width,
        height: rootItem.height.mode === 'fixed' ? rootItem.height.value : snapshotFrame.size.height,
      }
      nextSnapshotDocument = {
        ...facts.snapshot.document,
        entities: {
          ...facts.snapshot.document.entities,
          [rootId]: {
            ...snapshotRoot,
            components: {
              ...snapshotRoot.components,
              Frame: { ...snapshotFrame, size },
            },
          },
        },
      }
    }
  }
  const dispatched = runtime.dispatch({
    // 不用 controller 的 idFactory：它读 ref，会被 React Compiler 判为渲染期访问。
    id: defaultIdFactory(),
    type: BUILTIN_COMMAND_TYPES.setRendererProps,
    payload: {
      entityId: host.id,
      props: {
        ...(renderer.props as Record<string, unknown>),
        resolvedSnapshot: {
          ...facts.snapshot,
          document: nextSnapshotDocument,
        },
        instanceOverrides: {
          operations: diff.operations,
        },
      },
    },
    meta: { label, source: 'inspector', targetIds: [host.id] },
  } as unknown as EditorCommand)
  return dispatched.status === 'committed'
}

/**
 * 把作用于实例内部节点的场景树操作翻译成内部文档命令。
 *
 * @remarks
 * 内部子树是封闭编辑域：所有目标必须属于同一实例，移动的落点也必须仍在该实例内部。
 * 跨越实例边界的操作返回 `null`，由调用方整体拒绝，而不是退化成宿主文档上的操作。
 */
function planInstanceInnerSceneOperation(
  operation: ComposeSceneTreeOperation,
  instanceId: string,
): readonly EditorCommand[] | null {
  const innerOf = (id: string) => {
    if (!isComposeInstancePath(id)) return null
    const decoded = decodeComposeInstancePath(id)
    if (!decoded.ok || decoded.segments[0] !== instanceId) return null
    return decoded.segments[1] ?? null
  }
  const command = (type: string, payload: Record<string, unknown>, label: string) => ({
    id: defaultIdFactory(),
    type,
    payload,
    meta: { label, source: 'scene-tree', targetIds: [instanceId] },
  } as unknown as EditorCommand)

  if (operation.type === 'delete') {
    const ids = operation.nodeIds.map(innerOf)
    if (ids.some((id) => id === null)) return null
    return [command(
      BUILTIN_COMMAND_TYPES.deleteEntity,
      { entityIds: ids },
      `Delete inside ${instanceId}`,
    )]
  }
  if (operation.type === 'move') {
    const ids = operation.nodeIds.map(innerOf)
    if (ids.some((id) => id === null)) return null
    // parentId 为 null 表示落到宿主根，等同于移出实例，必须拒绝。
    if (operation.parentId === null) return null
    const parentInner = innerOf(operation.parentId)
    if (parentInner === null) return null
    return [command(
      BUILTIN_COMMAND_TYPES.moveEntity,
      { entityIds: ids, parentId: parentInner, index: operation.index },
      `Move inside ${instanceId}`,
    )]
  }
  // create/rename/duplicate 尚未接线：rename 无法由稳定操作代数表达，create/duplicate
  // 需要在实例覆盖里生成稳定 ID，留待后续任务。
  return null
}

/** 列出一个场景树操作触及的全部节点 ID，含落点父级。 */
function sceneOperationNodeIds(operation: ComposeSceneTreeOperation): readonly string[] {
  if (operation.type === 'delete') return operation.nodeIds
  if (operation.type === 'rename') return [operation.nodeId]
  if (operation.type === 'move') {
    return operation.parentId === null
      ? operation.nodeIds
      : [...operation.nodeIds, operation.parentId]
  }
  if (operation.type === 'duplicate') {
    return operation.parentId === null
      ? operation.sourceNodeIds
      : [...operation.sourceNodeIds, operation.parentId]
  }
  if (operation.type === 'set-visibility' || operation.type === 'set-locked') {
    return operation.nodeIds
  }
  return operation.parentId === null ? [] : [operation.parentId]
}

/**
 * 为宿主实例中的某个内部实体构造 Inspector 编辑入口。
 *
 * @remarks
 * `innerId` 省略时目标是组件根——实例的最外层就是组件根，选中实例本身时编辑的正是它。
 */
function resolveInstanceEditTarget(
  runtime: TransactionRuntime,
  document: ComposeDocument,
  instanceId: string,
  innerId?: string,
): ComposeInstanceInnerSelection | null {
  const host = document.entities[instanceId]
  if (!host) return null
  const facts = readComposeComponentInstance(host)
  if (!facts) return null
  const resolved = resolveComposeInstanceOverrides({
    document: facts.snapshot.document,
    overrides: facts.overrides,
  })
  if (!resolved.ok) return null
  const targetId = innerId ?? resolved.document.rootIds[0]
  if (!targetId) return null
  const entity = resolved.document.entities[targetId]
  if (!entity) return null
  return {
    instanceId,
    entity,
    document: resolved.document,
    // 每次命令从 runtime 最新文档取宿主与覆盖，避免闭包陈旧导致二次编辑/Apply 列表丢失。
    dispatch: (command: EditorCommand) => {
      const latestHost = runtime.document.entities[instanceId]
      if (!latestHost) return
      const latestFacts = readComposeComponentInstance(latestHost)
      if (!latestFacts) return
      const latestResolved = resolveComposeInstanceOverrides({
        document: latestFacts.snapshot.document,
        overrides: latestFacts.overrides,
      })
      if (!latestResolved.ok) return
      const ok = applyInstanceInnerCommands(
        runtime,
        latestHost,
        latestFacts,
        latestResolved.document,
        [command],
        `Edit ${entity.name} inside ${latestHost.name}`,
      )
      if (!ok) {
        // 保持与 TransactionRuntime 一致：调用方难以拿到 boolean，至少打到控制台便于诊断。
        console.warn(
          `[compose-editor] 实例内部命令未写入覆盖：${command.type} → ${instanceId}`,
        )
      }
    },
  }
}

/**
 * 把作用于组件实例的 Resize 命令改写为以组件根为目标的实例覆盖。
 *
 * @remarks
 * 实例保持 Hug，尺寸的唯一事实来源是组件根：两处各存一份会立刻不一致，而且内部嵌套 Runtime
 * 只认组件文档里的尺寸，直接改宿主 LayoutItem 会让外框变了、内容不动。
 *
 * @returns 已处理返回 `true`；命令与实例无关时返回 `false` 交回默认通路。
 */
function routeInstanceResize(
  runtime: TransactionRuntime,
  document: ComposeDocument,
  command: EditorCommand,
): boolean {
  if (command.type !== BUILTIN_COMMAND_TYPES.setTransform) return false
  const payload = command.payload as {
    readonly operation?: unknown
    readonly updates?: readonly { readonly entityId?: unknown; readonly transform?: unknown }[]
  } | undefined
  if (payload?.operation !== 'resize' || !Array.isArray(payload.updates)) return false
  const instanceUpdates = payload.updates.filter((update) => {
    const entity = typeof update.entityId === 'string' ? document.entities[update.entityId] : undefined
    return entity ? readComposeComponentInstance(entity) !== null : false
  })
  if (instanceUpdates.length === 0) return false
  // 混合选区不在此拦截：宿主实体与实例的尺寸语义不同，合并成一次事务会让 Undo 粒度失真。
  if (instanceUpdates.length !== payload.updates.length) return false
  let handled = false
  for (const update of instanceUpdates) {
    const instanceId = update.entityId as string
    const transform = update.transform as {
      readonly size?: { readonly width?: number; readonly height?: number }
    } | undefined
    const size = transform?.size
    if (!size || typeof size.width !== 'number' || typeof size.height !== 'number') continue
    const target = resolveInstanceEditTarget(runtime, document, instanceId)
    if (!target) continue
    const rootId = target.entity.id
    const rootItem = getComposeLayoutItem(target.entity)
    // 用 LayoutItem 固定宽高，不依赖根 GeometryConstraints.resize（根可能为 none）。
    const ok = applyInstanceInnerCommands(
      runtime,
      runtime.document.entities[instanceId]!,
      readComposeComponentInstance(runtime.document.entities[instanceId]!)!,
      target.document,
      [{
        id: defaultIdFactory(),
        type: BUILTIN_COMMAND_TYPES.updateComponent,
        payload: {
          entityId: rootId,
          key: 'LayoutItem',
          value: {
            ...rootItem,
            width: { ...rootItem.width, mode: 'fixed', value: size.width },
            height: { ...rootItem.height, mode: 'fixed', value: size.height },
          },
        },
        meta: {
          label: `Resize ${target.entity.name}`,
          source: 'stage',
          targetIds: [rootId],
        },
      } as unknown as EditorCommand],
      `Resize ${target.entity.name} inside instance`,
    )
    if (!ok) {
      console.warn(`[compose-editor] 实例 Resize 未写入覆盖：${instanceId}`)
      continue
    }
    // 同步宿主 Hug 回退值，避免 Inspector/测量回退到旧尺寸。
    const host = runtime.document.entities[instanceId]
    if (host) {
      const hostItem = getComposeLayoutItem(host)
      runtime.dispatch({
        id: defaultIdFactory(),
        type: BUILTIN_COMMAND_TYPES.updateComponent,
        payload: {
          entityId: instanceId,
          key: 'LayoutItem',
          value: {
            ...hostItem,
            width: { ...hostItem.width, mode: 'hug', value: size.width },
            height: { ...hostItem.height, mode: 'hug', value: size.height },
          },
        },
        meta: {
          label: `Sync ${host.name} hug fallback`,
          source: 'stage',
          targetIds: [instanceId],
          mergeKey: `instance:${instanceId}:hug-fallback`,
        },
      } as unknown as EditorCommand)
    }
    handled = true
  }
  return handled
}

/**
 * 把 Inspector 对实例宿主 LayoutItem 的尺寸编辑改写为组件根覆盖。
 *
 * @remarks
 * 基础区「尺寸宽度/高度」走 `entity.component.update` 更新宿主 LayoutItem；若不改写，
 * 外框变了、内容不动，且 Apply 列表永远没有可写回主组件的操作。偏移仍留在宿主。
 */
function routeInstanceLayoutItemSize(
  runtime: TransactionRuntime,
  document: ComposeDocument,
  command: EditorCommand,
): boolean {
  if (command.type !== BUILTIN_COMMAND_TYPES.updateComponent) return false
  const payload = command.payload as {
    readonly entityId?: unknown
    readonly key?: unknown
    readonly value?: unknown
  } | undefined
  if (payload?.key !== 'LayoutItem' || typeof payload.entityId !== 'string') return false
  const host = document.entities[payload.entityId]
  if (!host || !readComposeComponentInstance(host)) return false
  if (!payload.value || typeof payload.value !== 'object' || Array.isArray(payload.value)) {
    return false
  }
  const nextItem = payload.value as ReturnType<typeof getComposeLayoutItem>
  const hostItem = getComposeLayoutItem(host)
  const sizeChanged = !layoutSizingEqual(hostItem.width, nextItem.width)
    || !layoutSizingEqual(hostItem.height, nextItem.height)
  // 仅偏移/对齐变化时仍写宿主，页面布局位置属于实例层。
  if (!sizeChanged) return false

  const target = resolveInstanceEditTarget(runtime, document, payload.entityId)
  if (!target) return false
  const rootItem = getComposeLayoutItem(target.entity)
  // 根必须 fixed：若把宿主的 hug 模式原样写入根，Auto Layout 会按内容回缩，外框 Resize 失效。
  const widthValue = typeof nextItem.width.value === 'number'
    ? nextItem.width.value
    : rootItem.width.value
  const heightValue = typeof nextItem.height.value === 'number'
    ? nextItem.height.value
    : rootItem.height.value
  target.dispatch({
    id: defaultIdFactory(),
    type: BUILTIN_COMMAND_TYPES.updateComponent,
    payload: {
      entityId: target.entity.id,
      key: 'LayoutItem',
      value: {
        ...rootItem,
        width: { ...rootItem.width, mode: 'fixed', value: widthValue },
        height: { ...rootItem.height, mode: 'fixed', value: heightValue },
      },
    },
    meta: {
      label: `Resize ${target.entity.name} layout`,
      source: 'inspector',
      targetIds: [target.entity.id],
    },
  } as unknown as EditorCommand)

  // 宿主只同步偏移等非尺寸字段，尺寸保持原 Hug/跟随根，避免双份事实。
  if (
    hostItem.offset.x !== nextItem.offset.x
    || hostItem.offset.y !== nextItem.offset.y
    || hostItem.alignSelf !== nextItem.alignSelf
    || JSON.stringify(hostItem.margin) !== JSON.stringify(nextItem.margin)
  ) {
    runtime.dispatch({
      id: defaultIdFactory(),
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: {
        entityId: payload.entityId,
        key: 'LayoutItem',
        value: {
          ...hostItem,
          offset: nextItem.offset,
          alignSelf: nextItem.alignSelf,
          margin: nextItem.margin,
        },
      },
      meta: {
        label: `Move ${host.name}`,
        source: 'inspector',
        targetIds: [payload.entityId],
      },
    } as unknown as EditorCommand)
  }
  return true
}

function layoutSizingEqual(
  left: { readonly mode: string; readonly value: number },
  right: { readonly mode: string; readonly value: number },
): boolean {
  return left.mode === right.mode && left.value === right.value
}

/** 当前下钻选中的实例内部实体及其编辑入口。 @public */
export interface ComposeInstanceInnerSelection {
  /** 宿主文档中的实例 Entity ID。 */
  readonly instanceId: string
  /** 解析后的内部实体，供 Inspector 渲染。 */
  readonly entity: ComposeEntity
  /** 解析后的完整内部文档，Inspector 需要它读取父子关系。 */
  readonly document: ComposeDocument
  /**
   * 接收 Inspector 命令并写入实例覆盖。
   *
   * @remarks
   * 命令本是针对宿主文档的，这里先在内部文档的独立 Runtime 上执行，再用稳定 diff 重算
   * 整份结构操作列表，最后一次写回宿主实例。重算而不是追加，可以避免同一字段反复编辑
   * 累积成一长串等价操作。
   */
  readonly dispatch: (command: EditorCommand) => void
}

function sceneEntity(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
  entity: ComposeEntity,
  expandedIds: ReadonlySet<string>,
): ComposeSceneTreeNode {
  const hierarchy = getComposeHierarchy(entity)
  const locked = getComposeLock(entity).locked
  const composition = getComposeComposition(entity)
  const renderer = getComposeRenderer(entity)
  const componentInstance = composition.presetId === 'component-instance'
    || renderer?.type === 'component-instance'
  return {
    id: entity.id,
    label: entity.name,
    visible: getComposeVisibility(entity).visible,
    locked,
    // 页面上永远是实例：空心组件符，与库内实心主组件区分。
    icon: componentInstance
      ? <ComposeComponentAssetIcon kind="instance" />
      : composition.presetId
      ? registry.getPreset(composition.presetId)?.icon
      : undefined,
    // 场景与容器共用同一个图标（场景就是放在顶层的容器），可访问名称仍要区分两者，
    // 且必须按 Frame-ness 判定而不是 presetId：在场景外画出来的场景 presetId 仍是 container。
    iconLabel: componentInstance
      ? '组件实例'
      : isComposeFrameEntity(entity)
        ? 'Scene'
        : composition.presetId === 'group'
          ? 'Group'
          : composition.presetId === 'container'
            ? 'Container'
            : undefined,
    // 实例没有 Hierarchy，但其内部层级可投影，因此仍可展开。
    canHaveChildren: hierarchy !== undefined || componentInstance,
    // 投影是惰性的：未展开时 children 尚未构建，必须显式声明才会出现展开控件。
    ...(componentInstance ? { hasChildren: instanceHasInnerChildren(entity) } : {}),
    canRename: !locked,
    canDelete: !locked,
    canMove: !locked,
    canToggleVisibility: true,
    canToggleLocked: true,
    ...(hierarchy
      ? {
          children: hierarchy.childIds
            .map((id) => document.entities[id])
            .filter((child): child is ComposeEntity => child !== undefined)
            .map((child) => sceneEntity(document, registry, child, expandedIds)),
        }
      : {}),
    ...(componentInstance && expandedIds.has(entity.id)
      ? (() => {
          const children = projectInstanceChildren(registry, entity, expandedIds, [entity.id])
          return children ? { children } : {}
        })()
      : {}),
  }
}

function deriveSceneEntities(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
  expandedIds: readonly string[],
): readonly ComposeSceneTreeNode[] {
  const expanded = new Set(expandedIds)
  return document.rootIds
    .map((id) => document.entities[id])
    .filter((entity): entity is ComposeEntity => entity !== undefined)
    .map((entity) => sceneEntity(document, registry, entity, expanded))
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

/**
 * 归一化选区。
 *
 * @remarks
 * 实例内部复合地址不对应宿主实体，只校验宿主实例是否仍存在且可见；内部实体是否存在由投影
 * 与命中阶段决定，避免在这里重复解析快照。
 */
function validSelection(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    const entity = document.entities[composeInstancePathHostId(id)]
    if (!entity || !getComposeVisibility(entity).visible) return false
    return isComposeInstancePath(id) ? readComposeComponentInstance(entity) !== null : true
  })
}

/**
 * 归一化展开集合。
 *
 * @remarks
 * 除宿主容器外，组件实例与实例内部复合地址也可展开；复合地址只校验宿主实例是否仍存在，
 * 内部实体是否存在由投影阶段决定，避免在这里重复解析快照。
 */
/**
 * 根 Frame 默认展开。
 *
 * @remarks
 * v7 的顶层 Entity 都挂在画板下面，画板折叠会让场景树看上去只有一行——默认展开才与
 * 「画板是工作区」的心智一致。宿主显式给出 `initialExpandedIds` 时仍然完全由它决定。
 */
function withExpandedRootFrames(document: ComposeDocument, ids: readonly string[]) {
  return unique([...document.rootIds, ...ids])
}

function validExpanded(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    if (isComposeInstancePath(id)) {
      const host = document.entities[composeInstancePathHostId(id)]
      return host ? readComposeComponentInstance(host) !== null : false
    }
    const entity = document.entities[id]
    if (!entity) return false
    return getComposeHierarchy(entity) !== undefined || readComposeComponentInstance(entity) !== null
  })
}

/**
 * controller 成功事务或历史导航的单一宿主观察事件。
 *
 * @public
 */
export interface ComposeEditorTransactionEvent {
  /** 当前通知对应的编辑或导航方向。 */
  readonly direction: 'commit' | 'undo' | 'redo' | 'navigate'
  /** 导航涉及多个事务时，提供离当前状态最近的一个；记录已被裁剪时为 `null`。 */
  readonly transaction: EditorTransaction | null
  /** 当前事件涉及的全部稳定事务 ID。 */
  readonly transactionIds: readonly string[]
  /** committed 使用原命令来源，历史导航固定为 `history`。 */
  readonly source: string
  /** committed 或被导航事务涉及的 Entity ID 去重集合。 */
  readonly targets: readonly string[]
}

/**
 * 编辑器 controller 的初始化依赖与会话默认值。
 *
 * @public
 */
export interface UseComposeEditorControllerOptions {
  /** 所有编辑入口共享的正式文档与历史运行时。 */
  readonly runtime: TransactionRuntime
  /** Palette、Stage、Inspector 共用的实例级 Entity 注册表。 */
  readonly registry: ComposeEntityRegistry
  /** 可选项目组件 Store；省略时保持仅 Registry Preset 的基础组件面板。 */
  readonly componentStore?: ComposeComponentStore
  /** 初始选择；不会写入文档历史。 */
  readonly initialSelection?: readonly string[]
  /** 初始场景树展开项；不会写入文档历史。 */
  readonly initialExpandedIds?: readonly string[]
  /** 初始无限 Stage 视口。 @defaultValue `{ x: 80, y: 64, zoom: 1 }` */
  readonly initialViewport?: StageViewport
  /**
   * 首次布局就绪时是否把视口自动适配到激活场景。
   *
   * @remarks
   * 关闭时 `initialViewport` 就是用户进入后看到的取景。宿主自己恢复上次保存的视口，
   * 或需要确定性取景（视觉回归、端到端）时传 `false`。
   *
   * @defaultValue true
   */
  readonly autoFitActiveFrame?: boolean
  /** 初始 Stage 工具。 @defaultValue `"select"` */
  readonly initialTool?: ComposeStageTool
  /** ComposeCommandPanel 显示的结构化命令预设。 */
  readonly commandPresets?: readonly ComposeCommandPreset[]
  /**
   * 场景树与工具栏“新建容器”使用的 Entity Preset ID。
   *
   * @remarks
   * Registry 中必须存在该 Preset（默认物料由 `@compose-ui/materials` 的
   * `createComposeBasicMaterials` 提供）；缺失时创建入口会失败并输出警告。
   *
   * @defaultValue `"container"`
   */
  readonly containerPresetId?: string
  /** 成功事务和成功历史导航的唯一外部审计边界。 */
  readonly onTransaction?: (
    event: ComposeEditorTransactionEvent,
  ) => void | Promise<void>
  /** controller 创建 Entity 和命令时使用的稳定 ID factory。 */
  readonly idFactory?: () => string
  /**
   * 节点引用属性的候选来源。
   *
   * @remarks
   * 由宿主从页面 Store 派生（见 `useComposePageCatalog` 与 `useNodeEditorPort`）；未提供时
   * node 字段呈现无候选状态但仍可清空。
   */
  readonly nodeEditPort?: ComposeNodeEditPort
  /** 当前页面实例的 setup 返回作用域；用于 Stage value 绑定与 Inspector 候选。 */
  readonly scriptScope?: ComposePageScriptScope
}

/**
 * controller dispatch 漏斗的可安装改写层。
 *
 * @remarks
 * 画布手势、Inspector 与命令面板的所有命令都经过 controller 的 `dispatch`；改写层在
 * 实例路由之前运行。返回 `null` 表示不拦截，原命令照常派发；返回命令数组时按序派发
 * 它们**替代**原命令。动画模式的自动记录用它把属性编辑改写为关键帧命令。
 *
 * @public
 */
export type ComposeEditorCommandRewrite = (
  document: ComposeDocument,
  command: EditorCommand,
) => readonly EditorCommand[] | null

/**
 * `ComposeEditor` 默认工作区消费的受控组合结果。
 *
 * @public
 */
export interface ComposeEditorController {
  /** 当前正式文档；直接来自 runtime 快照。 */
  readonly document: ComposeDocument
  /** controller 使用的事务运行时，同时驱动默认 ComposeHistoryPanel。 */
  readonly runtime: TransactionRuntime
  /** controller 使用的 Entity 注册表。 */
  readonly registry: ComposeEntityRegistry
  /** Controller 与组件工作区共享的项目组件 Store。 */
  readonly componentStore?: ComposeComponentStore
  /** 宿主注入的当前页面 setup 作用域；Inspector 绑定候选与动画检查器共用。 */
  readonly scriptScope?: ComposePageScriptScope
  /** 结构兼容 `ComposeHistoryNavigationController` 的事务历史。 */
  readonly history: ComposeHistoryNavigationController
  /** 当前有效且可见的选择。 */
  readonly selectedIds: readonly string[]
  /** 当前有效容器展开项。 */
  readonly expandedIds: readonly string[]
  /**
   * 当前 Stage 视口会话状态。
   *
   * @remarks
   * 读取始终返回最新快照，但视口是外部状态源：读取它的组件不会因为平移或缩放自动重渲。
   * 需要跟随视口变化重渲的宿主请使用 `useComposeStageViewport`。
   */
  readonly viewport: StageViewport
  /**
   * 订阅视口变化。
   *
   * @param listener - 视口快照变化后的回调。
   * @returns 取消订阅函数。
   */
  readonly subscribeViewport: (listener: () => void) => () => void
  /** 当前选择或平移工具。 */
  readonly tool: ComposeStageTool
  /** 当前实例 Palette 与 Stage 共享的无 UI 交互控制器。 */
  readonly interactionController: StageInteractionController
  /** 替换当前选择。 */
  readonly setSelectedIds: (ids: readonly string[]) => void
  /** 替换场景树展开项。 */
  readonly setExpandedIds: (ids: readonly string[]) => void
  /** 替换 Stage 视口。 */
  readonly setViewport: (viewport: StageViewport) => void
  /** 替换 Stage 工具。 */
  readonly setTool: (tool: ComposeStageTool) => void
  /** 向同一 runtime 派发结构化命令。 */
  readonly dispatch: (command: EditorCommand) => CommandDispatchResult
  /** 安装或卸载 dispatch 改写层（传 `null` 卸载）；同一时刻只有一个改写层生效。 */
  readonly setCommandRewrite: (rewrite: ComposeEditorCommandRewrite | null) => void
  /** 把当前规范化选区保存为组件资源，并在资源成功后原子替换为关联实例。 */
  readonly createComponentFromSelection: (
    input: ComposeCreateComponentFromSelectionInput,
  ) => Promise<ComposeCreateComponentFromSelectionResult>
  /** 最近一次来自 Stage、Scene Tree 或命令目录的“创建组件”命名请求。 */
  readonly createComponentRequest: ComposeCreateComponentRequest | null
  /** 场景树普通行拖向其他面板时的当前受控外部拖拽事件。 */
  readonly sceneExternalDragEvent: ComposeSceneTreeExternalDragEvent | null
  /** 默认 ComposeSceneTree 的完整受控属性。 */
  readonly sceneTreeProps: ComposeSceneTreeProps
  /** 默认 Stage 的完整受控属性。 */
  readonly stageProps: ComposeStageProps
  /** 默认 Entity Preset Library 内容。 */
  readonly componentLibraryPanel: ReactNode
  /** 默认中央 Stage 内容；等价于不带覆盖的 {@link ComposeEditorController.renderStage}。 */
  readonly stage: ReactNode
  /**
   * 以宿主覆盖渲染默认中央 Stage。
   *
   * @remarks
   * 覆盖按字段合并（`services`、`policy` 各自再合一层），优先级由类型表达而不是由调用顺序
   * 或注释约定。宿主模式应组装一份 `policy` 传入，而不是逐项追加平铺开关。
   */
  readonly renderStage: (overrides?: ComposeEditorStageOverrides) => ReactNode
  /** 默认聚合 Entity Inspector 内容。 */
  readonly inspectorPanel: ReactNode
  /** 当前下钻选中的实例内部实体；未下钻时为 null。 */
  readonly instanceInnerSelection: ComposeInstanceInnerSelection | null
  /** 选中实例本身时的组件根编辑入口；非实例选区为 null。 */
  readonly instanceRootSelection: ComposeInstanceInnerSelection | null
  /** 选中实例本身时组件根属性的 Inspector 节点；非实例选区为 null。 */
  readonly instanceRootInspector: ReactNode
  /** 默认 ComposeCommandPanel 内容。 */
  readonly commandPanel: ReactNode
  /** 默认 Stage 工具栏内容。 */
  readonly stageToolbar: ReactNode
}

/** 创建组件命名请求；sequence 使重复请求也可被宿主观察。 @public */
export interface ComposeCreateComponentRequest {
  readonly sequence: number
  readonly entityIds: readonly string[]
}

/** 从当前场景选区创建项目组件的输入。 @public */
export interface ComposeCreateComponentFromSelectionInput {
  /** 组件显示名；Store 会补齐 `.component.json` 后缀。 */
  readonly name: string
  /** 目标资源目录；null 表示 Provider 根目录。 @defaultValue null */
  readonly parentId?: string | null
  /** 覆盖当前选择的规范化来源；用于场景树跨面板拖拽结束时冻结起始选区。 */
  readonly entityIds?: readonly string[]
  readonly signal?: AbortSignal
}

/** 场景选区创建项目组件的失败安全结果。 @public */
export type ComposeCreateComponentFromSelectionResult =
  | {
      readonly status: 'committed'
      readonly component: ComposeComponentSnapshot
      readonly instanceId: string
    }
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'failed'; readonly error: Error }
  | {
      readonly status: 'saved-not-instantiated'
      readonly component: ComposeComponentSnapshot
      readonly reason: string
    }

function invokeObserver(
  observer: UseComposeEditorControllerOptions['onTransaction'],
  event: ComposeEditorTransactionEvent,
) {
  if (!observer) return
  try {
    const pending = observer(event)
    if (pending && typeof pending.then === 'function') void pending.catch(() => undefined)
  }
  catch {
    // 宿主审计是已提交事务后的副作用；同步异常也不能影响文档与历史。
  }
}

/**
 * 订阅 controller 的 Stage 视口。
 *
 * @remarks
 * 视口是编辑器会话状态中变化最频繁的一项：一次平移手势每帧都会更新它。为了让平移不牵动
 * 场景树、Inspector 等无关面板，它被存放在外部状态源里，只有订阅方会随之重渲。默认工作区的
 * Stage 与工具栏已经内建订阅；只有自己渲染 `ComposeStage` 或要显示缩放读数的宿主需要这个 Hook。
 *
 * @param controller - `useComposeEditorController` 返回的 controller。
 * @returns 当前视口快照，并在视口变化时触发重渲。
 * @example
 * ```tsx
 * const viewport = useComposeStageViewport(controller)
 * return <ComposeStage {...controller.stageProps} viewport={viewport} />
 * ```
 * @public
 */
export function useComposeStageViewport(controller: ComposeEditorController): StageViewport {
  const getSnapshot = useCallback(() => controller.viewport, [controller])
  return useSyncExternalStore(controller.subscribeViewport, getSnapshot, getSnapshot)
}

/**
 * 把 runtime、registry 与编辑器会话状态组合成默认工作区 controller。
 *
 * @remarks
 * Hook 不复制 ComposeDocument。文档变更始终先进入 runtime，再由所有派生视图读取同一个快照。
 *
 * @param options - 正式运行时、注册表、会话默认值和可选审计 observer。
 * @returns 可直接传给 `ComposeEditor` 的 controller。
 * @public
 */
export function useComposeEditorController({
  runtime,
  registry,
  componentStore,
  initialSelection = [],
  initialExpandedIds = [],
  initialViewport = { x: 80, y: 64, zoom: 1 },
  autoFitActiveFrame = true,
  initialTool = 'select',
  commandPresets,
  containerPresetId = 'container',
  onTransaction,
  idFactory = defaultIdFactory,
  nodeEditPort,
  scriptScope,
}: UseComposeEditorControllerOptions): ComposeEditorController {
  // Layout 订阅先于文档订阅建立，保证同一次事务的 document/Snapshot 成对发布。
  const layoutSession = useComposeEditorLayout(runtime)
  const layoutState = layoutSession.state
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const document = snapshot.document
  const [selectedIds, setSelectedIdsState] = useState<readonly string[]>(() =>
    validSelection(document, initialSelection))
  // Inspector 目标完全由选择决定：v7 没有"不进入文档的 output 检查目标"这一说。
  const [, setInspectionTarget] = useState<InspectionTarget>(() =>
    validSelection(document, initialSelection).length > 0 ? 'entities' : null)
  const [expandedIds, setExpandedIdsState] = useState<readonly string[]>(() =>
    validExpanded(document, withExpandedRootFrames(document, initialExpandedIds)))
  const [viewportStore] = useState(() => createViewportStore(initialViewport))
  const setViewport = viewportStore.setViewport
  const [tool, setToolState] = useState<ComposeStageTool>(initialTool)
  const [lastShapeTool, setLastShapeTool] = useState<ShapeDrawingTool>(
    () => isShapeDrawingTool(initialTool) ? initialTool : 'draw-rectangle',
  )
  // 框选判定模式是会话偏好而非文档数据，事实来源留在编辑器，Stage 只接收受控值。
  const [marqueeMode, setMarqueeMode] = useState<ComposeStageMarqueeMode>('intersect')
  const setTool = useCallback((nextTool: ComposeStageTool) => {
    if (isShapeDrawingTool(nextTool)) setLastShapeTool(nextTool)
    setToolState(nextTool)
  }, [])
  const [surfaceSize, setSurfaceSize] = useState<{
    readonly width: number
    readonly height: number
  } | null>(null)
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false)
  // 网格显示是 Stage 会话偏好；只影响视觉，不进入文档与撤销历史。
  const [gridVisible, setGridVisible] = useState(true)
  const [snapRestore, setSnapRestore] = useState({
    grid: document.canvas.grid.snapEnabled,
    nodes: document.canvas.smartSnap.nodes,
    guides: document.canvas.smartSnap.guides,
  })
  // Paint 编辑与图层取色都是 Editor 会话状态：它们只协调 Inspector 和 Stage，
  // 不进入 ComposeDocument、事务历史或 operation log。
  const [paintEditing, setPaintEditing] = useState<StagePaintEditing | null>(null)
  const [paintSampling, setPaintSampling] = useState<StagePaintSampling | null>(null)
  const [sceneExternalDragEvent, setSceneExternalDragEvent] = useState<
    ComposeSceneTreeExternalDragEvent | null
  >(null)
  const [createComponentRequest, setCreateComponentRequest] = useState<
    ComposeCreateComponentRequest | null
  >(null)
  const createComponentRequestSequence = useRef(0)
  const [interactionController] = useState(createStageInteractionController)
  const transactionById = useRef(new Map<string, EditorTransaction>())
  const observerRef = useRef(onTransaction)
  const idFactoryRef = useRef(idFactory)
  const [observedRuntime, setObservedRuntime] = useState(runtime)

  // 会话状态是文档作用域的：选择、检视目标、展开集合与视口都以实体 ID 或该文档的坐标表达。
  // 宿主换用另一个 runtime（例如切换到另一个页面）时必须立即重置，否则会残留指向上一份
  // 文档的选择与视口。这里用「prop 变化时在渲染期调整 state」的标准模式，而不是 Effect，
  // 避免先用陈旧会话状态渲染一帧。
  if (runtime !== observedRuntime) {
    setObservedRuntime(runtime)
    const nextDocument = runtime.getState().document
    setSelectedIdsState(validSelection(nextDocument, []))
    setInspectionTarget(null)
    setExpandedIdsState(validExpanded(nextDocument, withExpandedRootFrames(nextDocument, [])))
    // 视口在外部状态源里，这里是渲染期写外部 store。该分支对同一个 runtime 只会写入同一个
    // initialViewport，重复执行（StrictMode 重放）结果一致，且订阅方随后就会读到新快照。
    // 必须走渲染期专用入口：同步通知订阅者等于在本组件渲染中途更新另一个组件。
    viewportStore.resetViewportDuringRender(initialViewport)
    setPaintEditing(null)
    setPaintSampling(null)
    setSceneExternalDragEvent(null)
    setGridVisible(true)
    setSnapRestore({
      grid: nextDocument.canvas.grid.snapEnabled,
      nodes: nextDocument.canvas.smartSnap.nodes,
      guides: nextDocument.canvas.smartSnap.guides,
    })
    // 进行中的手势属于上一份文档，必须取消而不是让它落到新文档的实体上；
    // Pointer 与外部拖入是两条独立的进行中状态，各自都要终止。
    interactionController.send({ type: 'pointer.cancel' })
    interactionController.send({ type: 'external.cancel' })
  }

  useEffect(() => {
    observerRef.current = onTransaction
  }, [onTransaction])
  useEffect(() => {
    idFactoryRef.current = idFactory
  }, [idFactory])
  useFinalControllerDisposal(interactionController)

  useEffect(() => {
    const cleanupSession = (nextDocument: ComposeDocument) => {
      setSelectedIdsState((current) => validSelection(nextDocument, current))
      setExpandedIdsState((current) => validExpanded(nextDocument, current))
    }
    return runtime.subscribeEvents((event) => {
      if (event.type === 'committed') {
        cleanupSession(runtime.document)
        transactionById.current.set(event.transaction.id, event.transaction)
        invokeObserver(observerRef.current, {
          direction: 'commit',
          transaction: event.transaction,
          transactionIds: [event.transaction.id],
          source: event.transaction.source ?? event.command.meta?.source ?? 'runtime',
          targets: unique(event.transaction.targetIds),
        })
        return
      }
      if (event.type === 'history-navigation') {
        cleanupSession(event.document)
        const transactions = event.transactionIds
          .map((id) => transactionById.current.get(id))
          .filter((item): item is EditorTransaction => item !== undefined)
        invokeObserver(observerRef.current, {
          direction: event.direction,
          transaction: transactions[0] ?? null,
          transactionIds: event.transactionIds,
          source: 'history',
          targets: unique(transactions.flatMap((transaction) => transaction.targetIds)),
        })
        return
      }
      if (event.type === 'reset') {
        transactionById.current.clear()
        cleanupSession(event.document)
      }
    })
  }, [runtime])

  // 不在这里按 document 过滤：刚提交的创建事务尚未进入闭包捕获的 document，
  // 过滤会把合法的新实体选区误杀。归一化只发生在文档变化时。
  const setSelectedIds = useCallback((ids: readonly string[]) => {
    const next = unique(ids)
    setSelectedIdsState(next)
    const ancestors = instanceSelectionAncestors(document, next)
    if (ancestors.length > 0) {
      setExpandedIdsState((current) => unique([...current, ...ancestors]))
    }
    setInspectionTarget(next.length > 0 ? 'entities' : null)
    if (next.length !== 1) {
      setPaintEditing(null)
      setPaintSampling(null)
    }
  }, [document])
  const setExpandedIds = useCallback((ids: readonly string[]) => {
    setExpandedIdsState(unique(ids))
  }, [])
  // 改写层放 ref：安装/卸载不重建 dispatch，也不触发下游 memo 失效。
  const commandRewriteRef = useRef<ComposeEditorCommandRewrite | null>(null)
  const setCommandRewrite = useCallback((rewrite: ComposeEditorCommandRewrite | null) => {
    commandRewriteRef.current = rewrite
  }, [])
  const dispatch = useCallback(
    (command: EditorCommand) => {
      // 改写层先于实例路由：改写返回 null 的命令（如实例 Resize）仍会落到实例路由。
      const rewritten = commandRewriteRef.current?.(runtime.document, command)
      if (rewritten && rewritten.length > 0) {
        let result: CommandDispatchResult = { status: 'noop', command, reason: '改写层未派发命令' }
        for (const next of rewritten) result = runtime.dispatch(next)
        return result
      }
      // 实例的 Resize 必须落到组件根，否则外框变了而内部嵌套 Runtime 不动。
      if (routeInstanceResize(runtime, runtime.document, command)) {
        return { status: 'committed' } as CommandDispatchResult
      }
      // Inspector 尺寸字段同理：宿主 LayoutItem 尺寸改写为根覆盖。
      if (routeInstanceLayoutItemSize(runtime, runtime.document, command)) {
        return { status: 'committed' } as CommandDispatchResult
      }
      return runtime.dispatch(command)
    },
    [runtime],
  )
  const nextId = useCallback(() => idFactoryRef.current(), [])

  const createComponentFromSelection = useCallback(async (
    input: ComposeCreateComponentFromSelectionInput,
  ): Promise<ComposeCreateComponentFromSelectionResult> => {
    if (!componentStore) {
      return { status: 'unavailable', reason: '未配置 Component Store' }
    }
    const started = runtime.getState()
    if (layoutState.status !== 'ready' || layoutState.document !== started.document) {
      return { status: 'unavailable', reason: '布局尚未就绪' }
    }
    const componentId = nextId()
    const extraction = createComponentExtractionPlan({
      document: started.document,
      layoutSnapshot: layoutState.snapshot,
      selectedIds: input.entityIds ?? selectedIds,
      groupId: nextId(),
      name: input.name.trim(),
    })
    if (extraction.status !== 'ready') {
      return { status: 'unavailable', reason: extraction.reason }
    }
    const asset: ComposeBaseComponentAsset = {
      schemaVersion: COMPOSE_COMPONENT_SCHEMA_VERSION,
      kind: 'base',
      componentId,
      name: input.name.trim(),
      document: extraction.componentDocument,
    }
    let component: ComposeComponentSnapshot
    try {
      component = await componentStore.createComponent({
        parentId: input.parentId ?? null,
        fileName: input.name,
        asset,
        signal: input.signal,
      })
    }
    catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
    // 资源写入是不可回滚的外部副作用；等待期间场景变化时保留资源并停止实例化。
    if (runtime.getState().revision !== started.revision) {
      return {
        status: 'saved-not-instantiated',
        component,
        reason: '资源已保存，但文档在创建期间发生变化',
      }
    }
    const instanceId = nextId()
    const created = createComposeComponentInstanceEntity({
      registry,
      id: instanceId,
      asset: component.asset,
      reference: componentStore.createReference(component.assetKey),
      revision: component.revision,
    })
    if (!created.ok) {
      return {
        status: 'saved-not-instantiated',
        component,
        reason: created.reason,
      }
    }
    const dispatched = runtime.dispatch(createReplaceSelectionWithEntityCommand({
      document: started.document,
      plan: extraction,
      entity: created.entity,
      commandId: nextId(),
      deleteCommandId: nextId(),
      createCommandId: nextId(),
    }))
    if (dispatched.status !== 'committed') {
      return {
        status: 'saved-not-instantiated',
        component,
        reason: dispatched.status === 'rejected'
          ? dispatched.issues.map(({ message }) => message).join('；')
          : dispatched.reason ?? '场景事务未提交',
      }
    }
    setSelectedIds([instanceId])
    return { status: 'committed', component, instanceId }
  }, [componentStore, layoutState, nextId, registry, runtime, selectedIds, setSelectedIds])

  const libraryDragItem = useCallback((item: ComposeComponentLibraryItem) => (
    item.kind === 'preset'
      ? { kind: 'preset' as const, presetId: item.presetId }
      : {
          kind: 'assets' as const,
          items: [{
            providerId: item.descriptor.reference.providerId,
            assetKey: item.descriptor.reference.assetKey,
            scope: item.descriptor.reference.scope,
            name: item.descriptor.displayName,
            mediaType: 'application/vnd.compose-ui.component+json',
          }],
        }
  ), [])
  const paintEditPort = useMemo<ComposePaintEditPort>(() => ({
    open: ({ entityId }) => {
      if (!document.entities[entityId]) return
      setPaintSampling(null)
      setPaintEditing({ entityId })
    },
    close: () => {
      setPaintSampling(null)
      setPaintEditing(null)
    },
    sample: (target) => {
      if (!document.entities[target.entityId]) return
      setPaintSampling(target)
    },
  }), [document.entities])

  // 选择变化无需在 effect 中再写一次状态；Stage 只接收与当前单选目标一致的会话，
  // 因而不兼容的 Paint 手势会由 engine 立即取消，也避免 React 产生级联渲染。
  const activePaintEditing = selectedIds.length === 1 && paintEditing?.entityId === selectedIds[0]
    ? paintEditing
    : null
  const activePaintSampling = selectedIds.length === 1 && paintSampling?.entityId === selectedIds[0]
    ? paintSampling
    : null

  const onSceneOperation = useCallback((operation: ComposeSceneTreeOperation) => {
    // 目标含实例内部复合地址时改走实例覆盖；内部子树是封闭编辑域，越界一律整体拒绝。
    const touched = sceneOperationNodeIds(operation)
    const innerHosts = new Set(
      touched.filter((id) => isComposeInstancePath(id)).map((id) => composeInstancePathHostId(id)),
    )
    if (innerHosts.size > 0) {
      if (innerHosts.size > 1) return
      const instanceId = [...innerHosts][0]!
      const host = document.entities[instanceId]
      const facts = host ? readComposeComponentInstance(host) : null
      if (!host || !facts) return
      const resolved = resolveComposeInstanceOverrides({
        document: facts.snapshot.document,
        overrides: facts.overrides,
      })
      if (!resolved.ok) return
      const commands = planInstanceInnerSceneOperation(operation, instanceId)
      if (!commands) return
      applyInstanceInnerCommands(
        runtime,
        host,
        facts,
        resolved.document,
        commands,
        `Edit inside ${host.name}`,
      )
      return
    }
    const result = planSceneOperation(operation, {
      document,
      layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : null,
      registry,
      containerPresetId,
      nextId,
    })
    if (result.status === 'unavailable') {
      // 宿主配置缺失时静默失败会让入口看起来“坏了”却无从排查。
      console.warn(`[compose-editor] ${result.reason}`)
      return
    }
    if (result.status === 'skipped') return
    const dispatched = runtime.dispatch(result.plan.command)
    if (dispatched.status === 'committed' && result.plan.nextSelection) {
      setSelectedIds(result.plan.nextSelection)
    }
  }, [containerPresetId, document, layoutState, nextId, registry, runtime, setSelectedIds])

  const requestCreateComponent = useCallback((entityIds: readonly string[] = selectedIds) => {
    const normalized = validSelection(document, entityIds)
    if (!componentStore || normalized.length === 0) return
    setCreateComponentRequest({
      sequence: ++createComponentRequestSequence.current,
      entityIds: normalized,
    })
  }, [componentStore, document, selectedIds])

  const sceneTreeNodes = useMemo(
    () => deriveSceneEntities(document, registry, expandedIds),
    [document, registry, expandedIds],
  )
  // 画布容器标签与场景树共用同一条 rename 操作，因此两处重命名的事务标签与 Undo 语义一致。
  const renameEntity = useCallback((entityId: string, name: string) => {
    onSceneOperation({ type: 'rename', nodeId: entityId, label: name })
  }, [onSceneOperation])

  const sceneTreeCommands = useComposeSceneTreeCommands({
    nodes: sceneTreeNodes,
    selectedIds,
    onOperation: onSceneOperation,
  })
  const sceneTreeProps = useMemo<ComposeSceneTreeProps>(() => ({
    nodes: sceneTreeNodes,
    selectedIds,
    expandedIds,
    commands: sceneTreeCommands,
    onSelectionChange: setSelectedIds,
    onExpandedChange: setExpandedIds,
    onOperation: onSceneOperation,
    onExternalDrag: setSceneExternalDragEvent,
    onCreateComponentIntent: componentStore ? requestCreateComponent : undefined,
  }), [
    sceneTreeNodes,
    sceneTreeCommands,
    selectedIds,
    expandedIds,
    setSelectedIds,
    setExpandedIds,
    onSceneOperation,
    componentStore,
    requestCreateComponent,
  ])

  // 动作上下文依赖后面才定义的 fit/zoom 回调，而 stageProps 必须先构建。用 ref 转发可以避免
  // 为了顺序重排整段控制器；回调只在 commit 之后的键盘事件里被读取，因此在 layout effect 中更新。
  const actionContextRef = useRef<ComposeEditorActionHandlerContext | null>(null)
  const runShortcutAction = useCallback((action: ComposeStageDelegatableAction) => {
    const context = actionContextRef.current
    if (!context) return false
    // 执行层在按键时才构建：既避开渲染期读取 ref，也保证拿到的是最新选区与文档。
    const handler = createComposeEditorActionHandlers(context)[action]
    // 不可用动作也算已接管：此时执行层是空操作，回退到 Stage 内建实现反而会产生不一致行为。
    handler.run()
    return true
  }, [])

  // 端口与策略各自记忆化，而不是跟着 stageProps 每次文档编辑重建：Stage 虽然按字段消费
  // 二者，但分开构建让「端口变了」与「模式变了」在依赖数组上就是两件事，宿主自己也更难
  // 把一个模式开关误挂到端口上。
  const stageServices = useMemo<ComposeStageServices>(() => ({
    dispatch,
    registry,
    layoutRuntime: layoutSession.runtime,
    clipboard: sceneTreeCommands.clipboard
      ? {
          kind: sceneTreeCommands.clipboard.kind,
          entityIds: sceneTreeCommands.clipboard.nodeIds,
        }
      : null,
  }), [dispatch, registry, layoutSession.runtime, sceneTreeCommands.clipboard])

  const stagePolicy = useMemo<ComposeStagePolicy>(
    () => ({ gridVisible, marqueeMode }),
    [gridVisible, marqueeMode],
  )

  const stageProps = useMemo<ComposeStageProps>(() => ({
    document,
    layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : undefined,
    // resize 实时布局的预览结果只进场景渲染，交互 context 仍用上面的提交态 Snapshot。
    layoutPreviewSnapshot: layoutSession.previewSnapshot ?? undefined,
    layoutError: layoutState.status === 'error' ? layoutState.error.message : undefined,
    scriptScope,
    services: stageServices,
    policy: stagePolicy,
    // 视口不参与 memo 依赖：它是外部状态源，读取时取当前快照，订阅由渲染 Stage 的组件负责。
    // 宿主如果自己渲染 ComposeStage，需要用 useComposeStageViewport 订阅才能随平移重渲。
    get viewport() {
      return viewportStore.getSnapshot()
    },
    onViewportChange: setViewport,
    tool,
    onToolChange: setTool,
    onShortcutAction: runShortcutAction,
    selectedIds,
    onSelectedIdsChange: setSelectedIds,
    onEntityRename: renameEntity,
    onCreateComponentIntent: componentStore ? requestCreateComponent : undefined,
    // 宿主有页面会话时会用页面的激活场景覆盖它；没有页面系统时回退第一个根 Frame。
    activeFrameId: document.rootIds[0] ?? null,
    autoFitActiveFrame,
    onSurfaceSizeChange: setSurfaceSize,
    interactionController,
    paintEditing: activePaintEditing,
    paintSampling: activePaintSampling,
    onPaintSamplingComplete: () => setPaintSampling(null),
    idFactory: nextId,
  }), [
    document,
    layoutState,
    layoutSession.previewSnapshot,
    scriptScope,
    stageServices,
    stagePolicy,
    viewportStore,
    setViewport,
    autoFitActiveFrame,
    tool,
    setTool,
    selectedIds,
    setSelectedIds,
    renameEntity,
    interactionController,
    nextId,
    activePaintEditing,
    activePaintSampling,
    runShortcutAction,
    componentStore,
    requestCreateComponent,
  ])

  // 默认 Stage 元素直接构造而不是回调调用一次：在渲染期调用 useCallback 会被 React 规则
  // 判定为渲染期读 ref。带覆盖的调用才走 renderStage。
  const stageElement = useMemo(() => (
    <ViewportBoundStage
      stageProps={stageProps}
      store={viewportStore}
      surfaceSize={surfaceSize}
    />
  ), [stageProps, viewportStore, surfaceSize])

  const renderStage = useCallback((overrides?: ComposeEditorStageOverrides) => (
    overrides
      ? (
          <ViewportBoundStage
            stageProps={composeEditorStageProps(stageProps, overrides)}
            store={viewportStore}
            surfaceSize={surfaceSize}
          />
        )
      : stageElement
  ), [stageElement, stageProps, viewportStore, surfaceSize])

  const fitBounds = useCallback((ids: readonly string[]) => {
    if (!surfaceSize || layoutState.status !== 'ready') return
    const bounds = unionRects(
      ids
        .filter((id) => document.entities[id] !== undefined)
        .map((id) => getEntityWorldBounds(document, layoutState.snapshot, id)),
    )
    if (!bounds) return
    const { width, height } = surfaceSize
    const zoom = Math.min(
      8,
      Math.max(0.1, Math.min((width - 128) / bounds.width, (height - 128) / bounds.height)),
    )
    setViewport({
      x: width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: height / 2 - (bounds.y + bounds.height / 2) * zoom,
      zoom,
    })
  }, [document, layoutState, setViewport, surfaceSize])
  const sceneIndex = useMemo(
    () => layoutState.status === 'ready'
      ? createStageSceneIndex(document, layoutState.snapshot)
      : null,
    [document, layoutState],
  )
  const fitContainer = useCallback(() => {
    const selectedContainerId = selectedIds.length === 1
      && document.entities[selectedIds[0]!]
      && getComposeHierarchy(document.entities[selectedIds[0]!]!)
      ? selectedIds[0]!
      : sceneIndex?.commonContainerForSelection(selectedIds)
    if (selectedContainerId) fitBounds([selectedContainerId])
  }, [document.entities, fitBounds, sceneIndex, selectedIds])
  const fitSelection = useCallback(() => fitBounds(selectedIds), [fitBounds, selectedIds])
  // 命令目录只需要「按倍率缩放」这一个入口；视口数学留在控制器，与工具栏和键盘保持同一实现。
  const zoomByFactor = useCallback((factor: number) => {
    if (!surfaceSize) return
    const center = { x: surfaceSize.width / 2, y: surfaceSize.height / 2 }
    const current = viewportStore.getSnapshot()
    setViewport(zoomViewportAt(current, center, current.zoom * factor))
  }, [setViewport, surfaceSize, viewportStore])
  const zoomReset = useCallback(() => {
    if (!surfaceSize) return
    const center = { x: surfaceSize.width / 2, y: surfaceSize.height / 2 }
    setViewport(zoomViewportAt(viewportStore.getSnapshot(), center, 1))
  }, [setViewport, surfaceSize, viewportStore])

  const selectedEntity = selectedIds.length === 1
    ? document.entities[selectedIds[0]!]
    : undefined
  const smartSnapEnabled = document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  const configureCanvas = useCallback((
    gridSnapEnabled: boolean,
    smartEnabled: boolean,
    label: string,
  ) => dispatch({
    id: nextId(),
    type: BUILTIN_COMMAND_TYPES.configureCanvas,
    payload: {
      grid: {
        ...document.canvas.grid,
        snapEnabled: gridSnapEnabled,
      },
      smartSnap: {
        nodes: smartEnabled,
        guides: smartEnabled,
      },
    },
    meta: { label, source: 'stage-toolbar' },
  }), [dispatch, document.canvas.grid, nextId])
  const setGridSize = useCallback((size: number) => {
    dispatch({
      id: nextId(),
      type: BUILTIN_COMMAND_TYPES.configureCanvas,
      payload: {
        grid: {
          ...document.canvas.grid,
          stepX: size,
          stepY: size,
        },
        smartSnap: document.canvas.smartSnap,
      },
      meta: { label: `Set grid size ${size}`, source: 'stage-toolbar' },
    })
  }, [dispatch, document.canvas, nextId])
  const toggleSnap = useCallback(() => {
    const current = {
      grid: document.canvas.grid.snapEnabled,
      nodes: document.canvas.smartSnap.nodes,
      guides: document.canvas.smartSnap.guides,
    }
    const active = current.grid || current.nodes || current.guides
    if (active) setSnapRestore(current)
    const next = active
      ? { grid: false, nodes: false, guides: false }
      : snapRestore
    dispatch({
      id: nextId(),
      type: BUILTIN_COMMAND_TYPES.configureCanvas,
      payload: {
        grid: { ...document.canvas.grid, snapEnabled: next.grid },
        smartSnap: { nodes: next.nodes, guides: next.guides },
      },
      meta: { label: active ? 'Disable canvas snapping' : 'Restore canvas snapping', source: 'stage-toolbar' },
    })
  }, [dispatch, document.canvas, nextId, snapRestore])

  // 命令面板与 Stage 快捷键共用同一份上下文，同一个动作从哪个入口触发结果都一致。
  const actionContext = useMemo<ComposeEditorActionHandlerContext>(() => ({
    canRedo: snapshot.canRedo,
    canUndo: snapshot.canUndo,
    dispatch,
    document,
    fitContainer,
    fitSelection,
    createComponent: componentStore ? () => { requestCreateComponent() } : undefined,
    idFactory: nextId,
    layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : null,
    redo: runtime.redo,
    selectedIds,
    setSelectedIds,
    setTool,
    toggleGridSnap: () => configureCanvas(
      !document.canvas.grid.snapEnabled,
      smartSnapEnabled,
      'Toggle grid snap',
    ),
    toggleSmartSnap: () => configureCanvas(
      document.canvas.grid.snapEnabled,
      !smartSnapEnabled,
      'Toggle smart snap',
    ),
    canCopy: sceneTreeCommands.isEnabled('copy'),
    canCut: sceneTreeCommands.isEnabled('cut'),
    canPaste: sceneTreeCommands.isEnabled('paste-suggested'),
    copySelection: () => { sceneTreeCommands.execute('copy') },
    cutSelection: () => { sceneTreeCommands.execute('cut') },
    pasteSelection: () => { sceneTreeCommands.execute('paste-suggested') },
    undo: runtime.undo,
    zoomBy: zoomByFactor,
    zoomReset,
  }), [
    dispatch,
    document,
    fitContainer,
    fitSelection,
    componentStore,
    requestCreateComponent,
    layoutState,
    nextId,
    runtime,
    selectedIds,
    setSelectedIds,
    setTool,
    sceneTreeCommands,
    configureCanvas,
    smartSnapEnabled,
    snapshot.canRedo,
    snapshot.canUndo,
    zoomByFactor,
    zoomReset,
  ])
  useLayoutEffect(() => {
    actionContextRef.current = actionContext
  }, [actionContext])
  // Inspector 目标只有画布输出、单选 Entity 和空态三种；三者互斥且由会话状态决定。
  /**
   * 解析当前下钻选中的实例内部实体。
   *
   * @remarks
   * 内部实体不在宿主文档里，必须按 Base → Variant 链 → 实例覆盖解析后才能取到。
   */
  /** 下钻选中的实例内部实体。 */
  const instanceInnerSelection = useMemo<ComposeInstanceInnerSelection | null>(() => {
    if (selectedIds.length !== 1) return null
    const address = selectedIds[0]!
    if (!isComposeInstancePath(address)) return null
    const decoded = decodeComposeInstancePath(address)
    if (!decoded.ok) return null
    const [instanceId, innerId] = decoded.segments
    if (!instanceId || !innerId) return null
    return resolveInstanceEditTarget(runtime, document, instanceId, innerId)
  }, [document, runtime, selectedIds])

  /**
   * 选中实例本身时的组件根编辑入口。
   *
   * @remarks
   * 实例的最外层就是组件根，其尺寸、外观、裁剪与 Auto Layout 都应可编辑，编辑写入实例覆盖。
   */
  const instanceRootSelection = useMemo<ComposeInstanceInnerSelection | null>(() => {
    if (selectedIds.length !== 1) return null
    const id = selectedIds[0]!
    if (isComposeInstancePath(id)) return null
    return resolveInstanceEditTarget(runtime, document, id)
  }, [document, runtime, selectedIds])

  /**
   * 选中实例本身时，组件根属性分组（无独立外壳）。
   *
   * @remarks
   * 默认已并入 `inspectorPanel`；保留导出供自定义宿主在同一 PropertyPanel 内拼装。
   * 根侧隐藏名称、位置与尺寸，避免与宿主实例字段重复且取值矛盾。
   */
  const instanceRootInspector = instanceRootSelection === null ? null : (
    <EntityInspector
      chrome="sections"
      dispatch={instanceRootSelection.dispatch}
      document={instanceRootSelection.document}
      entity={instanceRootSelection.entity}
      // 名称/位置由宿主提供；可见性与锁定也以页面实例层为准，避免同一分组出现两次。
      hiddenComponentKeys={['Transform', 'LayoutItem', 'Visibility', 'Lock']}
      hideIdentity
      idFactory={nextId}
      // 按实例重挂载：切换实例时局部会话状态不得残留。
      key={`${instanceRootSelection.instanceId}:root`}
      registry={registry}
    />
  )

  // Frame 是普通容器：它走和其它 Entity 完全一样的 Inspector，场景专有属性由 Registry 的
  // Frame Component Definition 提供。页面脚本与动画不在这里——它们属于页面配置面板。
  const inspectorPanel = instanceInnerSelection ? (
    <EntityInspector
      dispatch={instanceInnerSelection.dispatch}
      document={instanceInnerSelection.document}
      entity={instanceInnerSelection.entity}
      idFactory={nextId}
      // 按复合地址重挂载：切换内部目标时局部会话状态不得残留。
      key={selectedIds[0]}
      registry={registry}
      renameDisabled
    />
  ) : selectedEntity && instanceRootSelection ? (
    // 宿主身份/位置 + 组件根视觉属性合并为单一面板，避免两个搜索栏与重复标题。
    <EntityInspector
      dispatch={dispatch}
      document={document}
      entity={selectedEntity}
      // 尺寸、外观、裁剪、Auto Layout 与容器结构以组件根为事实来源。
      hiddenComponentKeys={[
        'Appearance',
        'Clip',
        'GeometryConstraints',
        'Hierarchy',
        'Layout',
      ]}
      extraSections={instanceRootInspector}
      idFactory={nextId}
      key={selectedEntity.id}
      layoutSnapshot={layoutState.status === 'ready' ? layoutState.snapshot : undefined}
      nodeEditPort={nodeEditPort}
      paintEditPort={paintEditPort}
      registry={registry}
      scriptScope={scriptScope}
    />
  ) : selectedEntity ? (
    <EntityInspector
      dispatch={dispatch}
      document={document}
      entity={selectedEntity}
      idFactory={nextId}
      layoutSnapshot={layoutState.status === 'ready' ? layoutState.snapshot : undefined}
      // 按 Entity 重挂载：能力移除确认等局部会话状态不得跨选中目标残留。
      key={selectedEntity.id}
      nodeEditPort={nodeEditPort}
      paintEditPort={paintEditPort}
      registry={registry}
      scriptScope={scriptScope}
    />
  ) : selectedIds.length > 1 ? (
    // 多选下「页面配置」没有确定含义，且会让"点空白工作区"这个唯一入口变得不确定。
    <DefaultEmptyInspector multiple />
  ) : (
    <PageInspector document={document} />
  )

  return {
    document,
    runtime,
    registry,
    componentStore,
    scriptScope,
    history: runtime,
    selectedIds,
    expandedIds,
    // 读取取当前快照，不把视口带回渲染依赖；订阅由 useComposeStageViewport 提供。
    get viewport() {
      return viewportStore.getSnapshot()
    },
    subscribeViewport: viewportStore.subscribe,
    tool,
    interactionController,
    setSelectedIds,
    setExpandedIds,
    setViewport,
    setTool,
    dispatch,
    setCommandRewrite,
    createComponentFromSelection,
    createComponentRequest,
    sceneExternalDragEvent,
    sceneTreeProps,
    stageProps,
    componentLibraryPanel: componentStore ? (
      <ComposeComponentLibraryPanel
        registry={registry}
        store={componentStore}
        onCreateIntent={(item) => {
          interactionController.send({ type: 'external.add', item: libraryDragItem(item) })
        }}
        onItemDragStart={({ item, clientPoint }) => {
          interactionController.send({
            type: 'external.begin',
            item: libraryDragItem(item),
            clientPoint,
          })
        }}
        onItemDragMove={({ clientPoint }) => {
          interactionController.send({ type: 'external.move', clientPoint })
        }}
        onItemDragEnd={({ clientPoint }) => {
          interactionController.send({ type: 'external.end', clientPoint })
        }}
        onItemDragCancel={() => {
          interactionController.send({ type: 'external.cancel' })
        }}
      />
    ) : (
      <ComposeComponentPalette
        interactionController={interactionController}
        registry={registry}
      />
    ),
    stage: stageElement,
    renderStage,
    inspectorPanel,
    instanceInnerSelection,
    instanceRootSelection,
    instanceRootInspector,
    commandPanel: (
      <CommandPanelWithActions
        actionContext={actionContext}
        presets={commandPresets}
        runtime={runtime}
      />
    ),
    stageToolbar: (
      <DefaultStageToolbar
        canvasSettingsOpen={canvasSettingsOpen}
        dispatch={dispatch}
        document={document}
        gridVisible={gridVisible}
        nextId={nextId}
        setCanvasSettingsOpen={setCanvasSettingsOpen}
        setGridSize={setGridSize}
        setGridVisible={setGridVisible}
        lastShapeTool={lastShapeTool}
        marqueeMode={marqueeMode}
        setMarqueeMode={setMarqueeMode}
        setTool={setTool}
        toggleSnap={toggleSnap}
        tool={tool}
      />
    ),
  }
}
