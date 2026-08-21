import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLock,
  getComposeRenderer,
  getComposeVisibility,
  resolveComposeAppearance,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  applyMatrix,
  describeEntityCreation,
  getEntityWorldMatrix,
  invertMatrix,
  type StageDrawnEntity,
  type StageInteractionController,
  type StageInteractionEffect,
  type StagePoint,
  type StageRect,
  type StageViewport,
  toComposeTransform,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageDispatch,
  ComposeStageEditablePathChange,
  ComposeStageTool,
} from '../types'
import type { getStageMessages } from '../stage-i18n'
import {
  boundsCenter,
  entityFromDrawingSeed,
  entityFromSeed,
  expandClickDrawingBounds,
  seedWorldBounds,
} from './drawing-entity'
import { boundsInParentSpace, resolveRootLanding } from './root-landing'
import { assetSeedCenters, mapWithConcurrency, presetForDrawingTool } from './stage-asset-drop'
import {
  directionAxis,
  lineSegmentForEntity,
  lineSegmentTransform,
} from './stage-preview-document'
import { resolveClientPoint } from './stage-pointer-geometry'

/** 并行解析拖入资源的并发上限；超过之后 Provider 侧的排队收益递减。 */
const ASSET_RESOLVE_CONCURRENCY = 4

/** 效果分派能力的依赖清单。 */
export interface StageEffectDispatchParams {
  readonly controller: StageInteractionController
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly registry: ComposeEntityRegistry
  readonly activeFrameId: string | null | undefined
  readonly assetResolver: ComposeAssetResolver | undefined
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly viewport: StageViewport
  readonly messages: ReturnType<typeof getStageMessages>
  readonly rootRef: RefObject<HTMLDivElement | null>
  readonly surfaceRef: RefObject<HTMLDivElement | null>
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  readonly onPaintSamplingComplete?: () => void
  readonly onEditablePathChange?: (change: ComposeStageEditablePathChange) => void
  readonly onEditablePathVertexToggle?: (vertexId: string) => void
  /** 指针会话能力提供的两个动作；效果分派只负责转交。 */
  readonly capturePointer: (root: HTMLDivElement, pointerId: number) => void
  readonly releasePointer: (pointerId: number) => void
  /** 文字编辑能力提供的两个动作。 */
  readonly enterTextEditing: (entityId: string) => void
  readonly exitTextEditing: () => void
  /** 绘制完成后回灌给内核的「本次创建了谁」。 */
  readonly onDrawn: (drawn: StageDrawnEntity) => void
  /** 绘制提交后切回选择工具；仅点击创建文字时需要。 */
  readonly onToolChange?: (tool: ComposeStageTool) => void
}

/** 效果分派能力的出口。 */
export interface StageEffectDispatch {
  /**
   * 资源拖入的状态播报文本。
   *
   * @remarks
   * 解析是异步的，成功与失败都没有可见的即时反馈，因此必须有一条 live region 供读屏
   * 用户获知结果。空串表示当前无待播报内容。
   */
  readonly assetDropStatus: string
}

/**
 * 「把内核产出的效果落成宿主动作」这条能力。
 *
 * @remarks
 * 内核不碰 DOM、不碰文档，它只产出效果；这里是效果的唯一落地点。绝大多数分支是纯转交，
 * 三类需要真正规划命令：两点图形的端点提交、绘制提交、外部拖入（资源与 Preset 两种）。
 *
 * 依赖逐项接收，内部自持一份「最新值」ref：`connectSurface` 注册的回调必须引用稳定，而
 * 异步的资源解析在 await 之后必须读到当时的最新文档，两者只能靠 ref 同时满足。
 */
export function useStageEffectDispatch(
  params: StageEffectDispatchParams,
): StageEffectDispatch {
  const {
    assetResolver,
    capturePointer,
    controller,
    enterTextEditing,
    exitTextEditing,
    releasePointer,
    rootRef,
    surfaceRef,
  } = params
  const latestRef = useRef(params)
  useLayoutEffect(() => {
    latestRef.current = params
  })
  const [assetDropStatus, setAssetDropStatus] = useState('')
  /** 进行中的资源解析；解析器变更或组件卸载时统一中止，避免迟到结果写进新文档。 */
  const pendingAssetDropsRef = useRef(new Set<AbortController>())

  const createDroppedAssets = useCallback(async (
    effect: Extract<StageInteractionEffect, { readonly type: 'external.drop' }>,
  ) => {
    if (effect.item.kind !== 'assets' || effect.item.items.length === 0) return
    const started = latestRef.current
    const { messages } = started
    const resolver: ComposeAssetResolver | undefined = started.assetResolver
    if (!resolver) {
      setAssetDropStatus(messages.assetDropNoResolver)
      return
    }
    const request = new AbortController()
    pendingAssetDropsRef.current.add(request)
    try {
      const results = await mapWithConcurrency(effect.item.items, ASSET_RESOLVE_CONCURRENCY, async (item) => {
        const reference: ComposeAssetReference = {
          providerId: item.providerId,
          assetKey: item.assetKey,
          scope: item.scope,
        }
        try {
          const resolved: ComposeResolvedAsset = await resolver.resolve({
            reference,
            signal: request.signal,
          })
          const created = await started.registry.createAssetSeed({
            reference,
            resolved,
            name: item.name,
          })
          return created.ok
            ? { ok: true as const, value: { reference, seed: created.seed } }
            : { ok: false as const }
        }
        catch {
          return { ok: false as const }
        }
      })
      if (request.signal.aborted || latestRef.current.assetResolver !== resolver) return
      const successful = results.flatMap((result) => result.ok ? [result.value] : [])
      const failedCount = results.length - successful.length
      if (successful.length === 0) {
        setAssetDropStatus(messages.assetDropAllFailed(failedCount))
        return
      }

      const current = latestRef.current
      const target = effect.parentId
        ? current.document.entities[effect.parentId]
        : undefined
      const parent = target
        && getComposeHierarchy(target)
        && getComposeVisibility(target).visible
        && !getComposeLock(target).locked
        ? target
        : undefined
      const inverseParent = parent
        ? invertMatrix(getEntityWorldMatrix(
            current.document,
            current.layoutSnapshot,
            parent.id,
          ))
        : null
      const offsets = assetSeedCenters(successful)
      const placements = successful.map(({ seed }, index) => {
        const offset = offsets[index]!
        const worldCenter = {
          x: effect.worldPoint.x + offset.x,
          y: effect.worldPoint.y + offset.y,
        }
        const entityId = current.idFactory()
        const build = (center: StagePoint) => entityFromSeed(
          seed,
          entityId,
          center,
          parent ? getComposeLayout(parent) : undefined,
        )
        if (parent) {
          return { entity: build(applyMatrix(inverseParent!, worldCenter)), parentId: parent.id }
        }
        const landing = resolveRootLanding(
          current,
          seedWorldBounds(seed, worldCenter),
          (bounds) => build(boundsCenter(bounds)),
        )
        return landing
          ? { entity: landing.entity, parentId: landing.parentId }
          : { entity: build(worldCenter), parentId: null }
      })
      const entities = placements.map(({ entity }) => entity)
      const commands: EditorCommand[] = placements.map(({ entity, parentId }) => ({
        id: current.idFactory(),
        type: BUILTIN_COMMAND_TYPES.createEntity,
        payload: {
          entity: entity as unknown as JsonValue,
          parentId,
        },
        meta: {
          label: describeEntityCreation(entity),
          source: 'asset-browser',
          targetIds: [entity.id],
        },
      }))
      const result = current.dispatch({
        id: current.idFactory(),
        type: BUILTIN_COMMAND_TYPES.batch,
        payload: {
          commands: commands as unknown as JsonValue,
        },
        meta: {
          label: messages.assetDropCommand(entities.length),
          source: 'asset-browser',
          targetIds: entities.map((entity) => entity.id),
        },
      })
      if (result.status === 'committed') {
        current.onSelectedIdsChange(entities.map((entity) => entity.id))
      }
      else {
        setAssetDropStatus(messages.assetDropAllFailed(results.length))
        return
      }
      setAssetDropStatus(
        failedCount === 0
          ? messages.assetDropAdded(entities.length)
          : messages.assetDropPartial(entities.length, failedCount),
      )
    }
    finally {
      pendingAssetDropsRef.current.delete(request)
    }
  }, [])

  const createDrawing = useCallback((
    effect: Extract<StageInteractionEffect, { readonly type: 'drawing.commit' }>,
  ) => {
    const current = latestRef.current
    const seedResult = current.registry.createSeed(presetForDrawingTool(effect.tool))
    if (!seedResult.ok) return
    const parentCandidate = effect.parentId
      ? current.document.entities[effect.parentId]
      : undefined
    const parent = parentCandidate
      && getComposeHierarchy(parentCandidate)
      && !getComposeLock(parentCandidate).locked
      && getComposeVisibility(parentCandidate).visible
      ? parentCandidate
      : undefined
    const inverseParent = parent
      ? invertMatrix(getEntityWorldMatrix(
          current.document,
          current.layoutSnapshot,
          parent.id,
        ))
      : null
    const drawnBounds = boundsInParentSpace(effect.bounds, inverseParent)
    // 容器单击不拖时落到 Preset 默认尺寸；文字有自己的 Hug 语义，其余图形保持精确 bounds。
    const localBounds = effect.tool === 'draw-container'
      ? expandClickDrawingBounds(seedResult.seed, drawnBounds)
      : drawnBounds
    const entityId = current.idFactory()
    const buildEntity = (bounds: StageRect) => {
      const textClick = effect.tool === 'draw-text' && bounds.width < 1 && bounds.height < 1
      const drawnEntity = entityFromDrawingSeed(
        seedResult.seed,
        entityId,
        bounds,
        effect.tool === 'draw-line' || effect.tool === 'draw-arrow'
          ? {
              x: directionAxis(effect.end.x - effect.start.x),
              y: directionAxis(effect.end.y - effect.start.y),
            }
          : undefined,
        textClick
          ? {
              preserveHugSizing: true,
              // 点击创建即刻进入编辑，占位文案会逼用户先全选删除；Prop 名从 Registry 查，
              // Stage 不认识具体物料类型。
              emptyTextPropName:
                current.registry.getEditableTextPropName({
                  ...seedResult.seed,
                  id: entityId,
                }) ?? undefined,
            }
          : undefined,
      )
      // 组件库中的 Rectangle 可保留其圆角默认值；画布矩形工具遵循设计工具惯例，初始绘制为直角。
      return effect.tool === 'draw-rectangle'
        ? {
            ...drawnEntity,
            components: {
              ...drawnEntity.components,
              Appearance: {
                ...resolveComposeAppearance(drawnEntity),
                borderRadius: 0,
              },
            },
          }
        : drawnEntity
    }
    // 命中容器时照常做子级；落在所有场景之外时按类型分流：容器升格成新场景，其余落进激活场景。
    const landing = parent ? null : resolveRootLanding(current, localBounds, buildEntity)
    const entity = landing?.entity ?? buildEntity(localBounds)
    const result = current.dispatch({
      id: current.idFactory(),
      type: BUILTIN_COMMAND_TYPES.createEntity,
      payload: {
        entity: entity as unknown as JsonValue,
        // 升格分支的 parentId 就是 null（文档根），不能用 ?? 串下去——那会把新场景吞回
        // rootIds[0] 里变成嵌套 Frame。
        parentId: parent ? parent.id : landing ? landing.parentId : null,
      },
      meta: {
        label: describeEntityCreation(entity),
        source: 'stage',
        targetIds: [entity.id],
      },
    })
    if (result.status === 'committed') {
      current.onSelectedIdsChange([entity.id])
      // Controller 发 drawing.commit 时并不铸 ID，拿不到新 Entity；回灌后它才能判断
      // 「这次点击创建的是文字，应当立刻进入编辑」。按 entityId 去重由 Controller 负责。
      latestRef.current.onDrawn({ entityId: entity.id, tool: effect.tool })
      // 单次绘制结束即回到选择模式，避免下一次点击意外继续创建同类图形。
      latestRef.current.onToolChange?.('select')
    }
  }, [])

  const commitSegment = useCallback((
    effect: Extract<StageInteractionEffect, { readonly type: 'segment.commit' }>,
  ) => {
    const current = latestRef.current
    const entity = current.document.entities[effect.entityId]
    const renderer = entity ? getComposeRenderer(entity) : null
    const currentSegment = lineSegmentForEntity(
      current.document,
      current.layoutSnapshot,
      effect.entityId,
    )
    const next = lineSegmentTransform(
      current.document,
      current.layoutSnapshot,
      effect,
    )
    if (
      !entity
      || !renderer
      || renderer.type !== 'shape'
      || !currentSegment
      || !next
      || getComposeLock(entity).locked
      || (
        currentSegment.start.x === effect.start.x
        && currentSegment.start.y === effect.start.y
        && currentSegment.end.x === effect.end.x
        && currentSegment.end.y === effect.end.y
      )
    ) return
    current.dispatch({
      id: current.idFactory(),
      type: 'transaction.batch',
      payload: {
        commands: [
          {
            id: current.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setTransform,
            payload: {
              operation: 'resize',
              updates: [{
                entityId: entity.id,
                transform: toComposeTransform(next.transform),
              }],
            },
          },
          {
            id: current.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setRendererProps,
            payload: {
              entityId: entity.id,
              props: {
                ...renderer.props,
                direction: next.direction,
              },
            },
          },
        ] as unknown as JsonValue,
      },
      meta: {
        label: `Resize ${entity.name} endpoints`,
        mergeKey: `stage:segment:${entity.id}`,
        source: 'stage',
        targetIds: [entity.id],
      },
    })
  }, [])

  useEffect(() => controller.connectSurface({
    resolveClientPoint(point) {
      const surface = surfaceRef.current
      return surface ? resolveClientPoint(point, surface) : null
    },
    applyEffects(effects: readonly StageInteractionEffect[]) {
      const current = latestRef.current
      effects.forEach((effect) => {
        if (effect.type === 'pointer.capture') {
          const root = rootRef.current
          if (root) capturePointer(root, effect.pointerId)
          return
        }
        if (effect.type === 'pointer.release') {
          releasePointer(effect.pointerId)
          return
        }
        if (effect.type === 'viewport.change') {
          current.onViewportChange(effect.viewport)
          return
        }
        if (effect.type === 'selection.change') {
          current.onSelectedIdsChange(effect.selectedIds)
          return
        }
        if (effect.type === 'paint.sample.complete') {
          current.onPaintSamplingComplete?.()
          return
        }
        if (effect.type === 'path.change') {
          current.onEditablePathChange?.({
            vertexId: effect.vertexId,
            handle: effect.handle,
            phase: effect.phase,
            worldPoint: effect.worldPoint,
            modifiers: effect.modifiers,
          })
          return
        }
        if (effect.type === 'path.vertex-toggle') {
          current.onEditablePathVertexToggle?.(effect.vertexId)
          return
        }
        if (effect.type === 'command.dispatch') {
          current.dispatch(effect.command)
          return
        }
        if (effect.type === 'segment.commit') {
          commitSegment(effect)
          return
        }
        if (effect.type === 'drawing.commit') {
          createDrawing(effect)
          return
        }
        if (effect.type === 'text-editing.enter') {
          enterTextEditing(effect.entityId)
          return
        }
        if (effect.type === 'text-editing.exit') {
          exitTextEditing()
          return
        }
        if (effect.item.kind === 'assets') {
          void createDroppedAssets(effect)
          return
        }
        const entityId = current.idFactory()
        const seed = current.registry.createSeed(effect.item.presetId)
        if (!seed.ok) return
        const parent = effect.parentId
          ? current.document.entities[effect.parentId]
          : undefined
        const validParent = parent
          && getComposeHierarchy(parent)
          && !getComposeLock(parent).locked
          && getComposeVisibility(parent).visible
          ? parent
          : undefined
        const buildEntity = (center: StagePoint) => entityFromSeed(
          seed.seed,
          entityId,
          center,
          validParent ? getComposeLayout(validParent) : undefined,
        )
        // 命中容器时照常做子级；落在所有场景之外时按类型分流，与绘制工具同一条规则。
        const landing = validParent
          ? null
          : resolveRootLanding(
              current,
              seedWorldBounds(seed.seed, effect.worldPoint),
              (bounds) => buildEntity(boundsCenter(bounds)),
            )
        const entity = landing?.entity ?? buildEntity(validParent
          ? applyMatrix(
              invertMatrix(getEntityWorldMatrix(
                current.document,
                current.layoutSnapshot,
                validParent.id,
              )),
              effect.worldPoint,
            )
          : effect.worldPoint)
        const result = current.dispatch({
          id: current.idFactory(),
          type: BUILTIN_COMMAND_TYPES.createEntity,
          payload: {
            entity: entity as unknown as JsonValue,
            // 升格分支的 parentId 是 null（文档根），不能用 ?? 串下去。
            parentId: validParent ? validParent.id : landing ? landing.parentId : null,
          },
          meta: {
            label: describeEntityCreation(entity),
            source: 'component-palette',
            targetIds: [entityId],
          },
        })
        if (result.status === 'committed') {
          current.onSelectedIdsChange([entityId])
        }
      })
    },
  }), [
    capturePointer,
    commitSegment,
    controller,
    createDrawing,
    rootRef,
    surfaceRef,
    createDroppedAssets,
    enterTextEditing,
    exitTextEditing,
    releasePointer,
  ])

  useEffect(() => {
    const pending = pendingAssetDropsRef.current
    return () => {
      pending.forEach((request) => request.abort())
      pending.clear()
    }
  }, [assetResolver])

  return { assetDropStatus }
}
