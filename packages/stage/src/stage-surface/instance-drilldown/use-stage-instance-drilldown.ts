import { useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  encodeComposeInstancePath,
  getComposeRenderer,
  isComposeInstancePath,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import type {
  StageInteractionHit,
  StageRect,
  StageViewport,
} from '@compose-ui/stage-engine'
import type { ComposeStageTool } from '../../types'
import { nextInstanceDrillDownTarget, resolveInstanceDrillDownPath } from './instance-drilldown'
import { instanceSelectionScreenBounds } from './instance-selection-bounds'

/** 判断 Entity 是否为关联组件实例。 */
function isComponentInstanceEntity(entity: ComposeEntity) {
  return getComposeRenderer(entity)?.type === 'component-instance'
}

/** 实例下钻能力的依赖清单。 */
export interface StageInstanceDrilldownParams {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly viewport: StageViewport
  /** 宿主给出的原始选区；复合地址只出现在这里。 */
  readonly selectedIds: readonly string[]
  readonly tool: ComposeStageTool
  readonly surfaceRef: RefObject<HTMLDivElement | null>
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  /** 指针会话能力提供的两个动作。 */
  readonly beginInteraction: (hit: StageInteractionHit, event: ReactPointerEvent<Element>) => void
  readonly peekClickCount: (event: ReactPointerEvent<HTMLDivElement>) => number
}

/** 实例下钻能力的出口。 */
export interface StageInstanceDrilldown {
  /**
   * 实例内部选中框的 surface 相对矩形。
   *
   * @remarks
   * 内部几何由嵌套 Runtime 决定，宿主既没有 `LayoutItem` 也没有场景索引条目，只能在提交后
   * 从 DOM 测量。视口与文档变化都会改变屏幕矩形，因此都要重新测。
   */
  readonly instanceSelectionBounds: StageRect | null
  /** Scene 里 Entity 的 pointerdown 入口。 */
  readonly beginEntity: (entity: ComposeEntity, event: ReactPointerEvent<HTMLDivElement>) => void
  /** 容器标题标签的 pointerdown 入口。 */
  readonly beginContainerLabel: (entityId: string, event: ReactPointerEvent<HTMLElement>) => void
}

/**
 * 「双击逐层进入组件实例内部」这条能力。
 *
 * @remarks
 * 下钻上下文放在 ref 而不是从选区推导：一次双击由两个 pointerdown 组成，第一个计数为奇数、
 * 不触发下钻，它会先把选区重置回实例本身——若从选区推导，随后的偶数 pointerdown 就再也看不到
 * 当前层级，下钻永远停在第一层。
 */
export function useStageInstanceDrilldown(
  params: StageInstanceDrilldownParams,
): StageInstanceDrilldown {
  const {
    beginInteraction,
    document,
    layoutSnapshot,
    onSelectedIdsChange,
    peekClickCount,
    selectedIds,
    surfaceRef,
    tool,
    viewport,
  } = params
  const [instanceSelectionBounds, setInstanceSelectionBounds] = useState<StageRect | null>(null)
  /** 当前已下钻到的实例内部层级。 */
  const drillContextRef = useRef<{
    readonly instanceId: string
    readonly innerId: string
  } | null>(null)

  // 内部实体几何由嵌套 Runtime 决定，宿主既无 LayoutItem 也无场景索引条目，只能在提交后测量。
  // viewport 与 document 变化都会改变屏幕矩形，因此都要重新测量。
  const instanceSelectionAddress = selectedIds.length === 1 && isComposeInstancePath(selectedIds[0]!)
    ? selectedIds[0]!
    : null
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface || instanceSelectionAddress === null) {
      setInstanceSelectionBounds(null)
      return
    }
    setInstanceSelectionBounds(instanceSelectionScreenBounds(surface, instanceSelectionAddress))
  }, [instanceSelectionAddress, viewport, document, layoutSnapshot, surfaceRef])

  const beginEntity = (entity: ComposeEntity, event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    // 下钻上下文不能从选区推导：一次双击的第一个 pointerdown 计数为奇数、不触发下钻，
    // 它会先把选区重置回实例本身，随后的偶数 pointerdown 就再也看不到当前层级。
    if (drillContextRef.current && drillContextRef.current.instanceId !== entity.id) {
      drillContextRef.current = null
    }
    // 双击关联组件实例逐层下钻到内部实体。内部内容 pointer-events 关闭且几何不在场景索引里，
    // 因此命中读 DOM；命中失败时不拦截，落回实例整体的普通选择。
    if (
      tool === 'select'
      && isComponentInstanceEntity(entity)
      // 一次双击由两个 pointerdown 组成，只在偶数计数上下钻，保证一次双击恰好前进一层；
      // 用 >= 2 会让 count 2 和 3 各触发一次，一次双击直接跳两层。
      && peekClickCount(event) % 2 === 0
    ) {
      const path = resolveInstanceDrillDownPath(
        event.currentTarget,
        { x: event.clientX, y: event.clientY },
      )
      const context = drillContextRef.current
      const innerId = nextInstanceDrillDownTarget(
        path,
        context?.instanceId === entity.id ? context.innerId : null,
      )
      if (innerId !== null) {
        drillContextRef.current = { instanceId: entity.id, innerId }
        onSelectedIdsChange([encodeComposeInstancePath([entity.id, innerId])])
        return
      }
    }
    beginInteraction({ kind: 'entity', entityId: entity.id }, event)
  }

  // 标签命中不参与非空容器的框选收敛：它是这类容器唯一的选中入口。
  const beginContainerLabel = (entityId: string, event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    beginInteraction({ kind: 'entity', entityId, source: 'label' }, event)
  }

  return { instanceSelectionBounds, beginEntity, beginContainerLabel }
}
