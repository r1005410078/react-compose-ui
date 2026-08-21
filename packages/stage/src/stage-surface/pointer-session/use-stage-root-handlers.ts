import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
  RefObject,
} from 'react'
import type { StageInteractionHit } from '@compose-ui/stage-engine'
import type { StageRulersHandle } from '../../stage-ruler'
import { screenPoint } from './stage-pointer-geometry'

/** 根元素事件接线的依赖清单。 */
export interface StageRootHandlersParams {
  readonly rootRef: RefObject<HTMLDivElement | null>
  readonly surfaceRef: RefObject<HTMLDivElement | null>
  readonly rulersRef: RefObject<StageRulersHandle | null>
  /** 已归一化的选区；右键命中选区外的对象时要先改选区。 */
  readonly normalizedSelection: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  /** 右键菜单的打开入口。 */
  readonly openContextMenu: (event: ReactMouseEvent, payload: string | null) => void
  /** 指针会话与键盘能力提供的入口。 */
  readonly beginInteraction: (hit: StageInteractionHit, event: ReactPointerEvent<Element>) => void
  readonly handleLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly keyboardCommand: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  readonly keyboardRelease: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  /** 宿主传入的同名 props；每一个都必须先于内部处理被调用。 */
  readonly host: {
    readonly onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void
    readonly onLostPointerCapture?: (event: ReactPointerEvent<HTMLDivElement>) => void
    readonly onPointerCancel?: (event: ReactPointerEvent<HTMLDivElement>) => void
    readonly onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
    readonly onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void
    readonly onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void
    readonly onWheel?: (event: ReactWheelEvent<HTMLDivElement>) => void
  }
}

/**
 * Stage 根元素上的原生事件接线。
 *
 * @remarks
 * 这里只有一条贯穿全部处理器的规则：**宿主的同名 prop 先调用，随后才是内部处理**，且宿主
 * 调用 `preventDefault` 即视为接管，内部处理让路。散在 JSX 里时这条规则要靠六处各自遵守，
 * 集中之后它只有一个地方会被违反。
 *
 * 另有两处判定与 Portal 有关，都不是可以简化的样板：右键菜单自身的 Portal 在 React 事件树里
 * 仍会冒泡回 Stage，把它当作新的画布右键会重置根菜单；子菜单的 pointerdown 同样会冒泡上来，
 * 只有真实画布点击才该夺取焦点，否则触发项失焦会让二级菜单立即关闭。
 */
/** 挂在 Stage 根元素上的事件处理集合。 */
export interface StageRootHandlers {
  readonly onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  readonly onKeyUp: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  readonly onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerLeave: () => void
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onWheel: ((event: ReactWheelEvent<HTMLDivElement>) => void) | undefined
}

export function useStageRootHandlers({
  beginInteraction,
  handleLostPointerCapture,
  host,
  keyboardCommand,
  keyboardRelease,
  normalizedSelection,
  onSelectedIdsChange,
  openContextMenu,
  rootRef,
  rulersRef,
  surfaceRef,
}: StageRootHandlersParams): StageRootHandlers {
  return {
    onContextMenu: (event) => {
      host.onContextMenu?.(event)
      // ContextMenu 的 Portal 在 React 事件树中仍会冒泡到 Stage；不能把菜单自身的右键
      // 当作新的画布右键，否则会重置根菜单。
      if (event.defaultPrevented || !rootRef.current?.contains(event.target as Node)) return
      // 标签用独立属性标记归属：data-entity-id 必须唯一指向 Scene 里的那个节点，
      // 否则任何按实体查询 DOM 的地方都会同时命中标签。
      const target = (event.target as Element)
        .closest<HTMLElement>('[data-entity-id],[data-label-entity-id]')
      const entityId = target?.dataset.entityId ?? target?.dataset.labelEntityId ?? null
      if (entityId && !normalizedSelection.includes(entityId)) {
        onSelectedIdsChange([entityId])
      }
      event.preventDefault()
      openContextMenu(event, entityId)
    },
    onKeyDown: keyboardCommand,
    onKeyUp: keyboardRelease,
    onLostPointerCapture: (event) => {
      host.onLostPointerCapture?.(event)
      handleLostPointerCapture(event)
    },
    onPointerCancel: (event) => {
      host.onPointerCancel?.(event)
    },
    onPointerDown: (event) => {
      host.onPointerDown?.(event)
      const surface = surfaceRef.current
      if (
        event.defaultPrevented
        || !surface
        || (event.target !== surface && event.target !== event.currentTarget)
      ) return
      // Portal 中子菜单的 pointerdown 会沿 React 树冒泡到此处；仅真实画布点击才夺取焦点，
      // 否则触发项失焦会让二级菜单立即关闭。
      event.currentTarget.focus({ preventScroll: true })
      beginInteraction({ kind: 'surface' }, event)
    },
    onPointerMove: (event) => {
      // 指针位置是瞬时视图状态：走命令式接口直接重绘标尺，不进 React state，也不入文档。
      const surface = surfaceRef.current
      if (surface) rulersRef.current?.setCursor(screenPoint(event, surface))
      host.onPointerMove?.(event)
    },
    onPointerLeave: () => { rulersRef.current?.setCursor(null) },
    onPointerUp: (event) => {
      host.onPointerUp?.(event)
    },
    onWheel: host.onWheel,
  }
}
