import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
  RefObject,
} from 'react'
import type { StageInteractionHit } from '@compose-ui/stage-engine'
import type { ComposeCanvasRulersHandle } from '@compose-ui/canvas-kit'
import { screenPoint } from './stage-pointer-geometry'

/** 根元素事件接线的依赖清单。 */
export interface StageRootHandlersParams {
  readonly rootRef: RefObject<HTMLDivElement | null>
  readonly surfaceRef: RefObject<HTMLDivElement | null>
  readonly rulersRef: RefObject<ComposeCanvasRulersHandle | null>
  /** 已归一化的选区；右键命中选区外的对象时要先改选区。 */
  readonly normalizedSelection: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  /**
   * 把 DOM 命中的 Entity 过一遍 Group 门槛，得到右键真正作用的对象。
   *
   * @remarks
   * 与左键点选读同一份解算（`resolveStageGroupHit`），落在没进入的 Group 的子级上时得到那个
   * Group；不被门着的命中原样返回。
   */
  readonly resolveHitEntity: (entityId: string) => string
  /** 右键菜单的打开入口。 */
  readonly openContextMenu: (event: ReactMouseEvent, payload: string | null) => void
  /**
   * 十字光标的指针跟踪；不需要跟踪时为 `null`。
   *
   * @remarks
   * 它 **MUST** 挂在根元素上而不是图面上：手势会在根元素取得指针捕获，而按 Pointer Events
   * 规范，取得捕获会向原目标链派发 `pointerleave`，此后的 `pointermove` 一律重定向到捕获
   * 元素。挂在图面上时每次拖动都会先被清空一次位置、再也收不到后续移动——症状是**一拖动
   * 十字线就断**，而系统光标此时已经收走，屏幕上一个光标都没有。
   *
   * 传 `null` 表示这一帧不跟踪；标尺游标不受它影响，那是另一条一直都在的跟踪。
   */
  readonly trackPointer: ((event: ReactPointerEvent<HTMLDivElement>) => void) | null
  /** 指针离开整块 Stage 时清空跟踪。 */
  readonly clearPointer: () => void
  /**
   * 一直都在的指针记忆：粘贴落点读它。
   *
   * @remarks
   * 与 `trackPointer` 分开：那条只在需要画十字线时挂上，且它的清与播种是一对；而粘贴要在
   * 用户按下 `Cmd/Ctrl+V` 的那一刻知道指针在哪，那时没有任何会话在跑。它只写一个 ref，
   * 每帧不进 React 状态。传 `null` 表示指针已离开 Stage。
   */
  readonly rememberPointer: (event: ReactPointerEvent<HTMLDivElement> | null) => void
  /**
   * 命令进行中右键即结束。
   *
   * @remarks
   * 传 `null` 表示此刻没有「由词启动、正在等一个点」的命令，右键照旧开菜单。
   *
   * 判据不能只是「在等一个点」：夹点会话的提示同样接受点，而它由**手势**启动、此刻正被指针
   * 拖着或刚点亮，右键在那里不表达「我说完了」；拖动中途提交更会把顶点丢在用户没打算落笔的
   * 地方。这条判断留在调用方，本模块只认「给没给我这个函数」。
   */
  readonly acceptCommand: (() => void) | null
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
  acceptCommand,
  beginInteraction,
  handleLostPointerCapture,
  host,
  keyboardCommand,
  keyboardRelease,
  clearPointer,
  normalizedSelection,
  rememberPointer,
  onSelectedIdsChange,
  openContextMenu,
  resolveHitEntity,
  rootRef,
  rulersRef,
  surfaceRef,
  trackPointer,
}: StageRootHandlersParams): StageRootHandlers {
  return {
    onContextMenu: (event) => {
      host.onContextMenu?.(event)
      // ContextMenu 的 Portal 在 React 事件树中仍会冒泡到 Stage；不能把菜单自身的右键
      // 当作新的画布右键，否则会重置根菜单。
      if (event.defaultPrevented || !rootRef.current?.contains(event.target as Node)) return
      /*
       * 命令正在请求一个点时，右键就是回车——AutoCAD 的既有解法。本地还有一条自己的理由：
       * 那个菜单每一项都在说「对**选中的节点**做什么」，而命令此刻请求的是一个**点**，
       * 既没有选择语义可言，菜单还盖住了用户正要落笔的地方。
       */
      if (acceptCommand) {
        event.preventDefault()
        acceptCommand()
        return
      }
      // 标签用独立属性标记归属：data-entity-id 必须唯一指向 Scene 里的那个节点，
      // 否则任何按实体查询 DOM 的地方都会同时命中标签。
      const target = (event.target as Element)
        .closest<HTMLElement>('[data-entity-id],[data-label-entity-id]')
      /*
       * 落在选中 chrome 上的右键说的就是**当前选中的那个对象**。
       *
       * 空心矩形把这件事从「顺手」变成「必须」：它选中之后八个手柄与四条边缘命中带正好盖住
       * 它的整圈描边，而盒内部按设计不拦截指针——不认这一档的话，一个选中的空心矩形根本没有
       * 任何地方能右键出它自己的菜单。
       *
       * 手柄不带 `data-entity-id`：那个属性必须唯一指向 Scene 里的节点，任何按实体查询 DOM
       * 的地方都会被多出来的那一个搅乱。
       */
      const chrome = (event.target as Element).closest('[data-stage-selection-chrome]')
      // 右键说的也是「点的是谁」，因此与左键过同一道 Group 门槛：落在没进入的 Group 的子级上，
      // 菜单打开的是那个 Group 的。标签与选中 chrome 本来就指向顶层容器或已选中的对象，解算是恒等。
      const rawEntityId = target?.dataset.entityId
        ?? target?.dataset.labelEntityId
        ?? (chrome && normalizedSelection.length === 1 ? normalizedSelection[0]! : null)
      const entityId = rawEntityId === null ? null : resolveHitEntity(rawEntityId)
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
      rememberPointer(event)
      trackPointer?.(event)
      host.onPointerMove?.(event)
    },
    onPointerLeave: () => {
      rulersRef.current?.setCursor(null)
      rememberPointer(null)
      clearPointer()
    },
    onPointerUp: (event) => {
      host.onPointerUp?.(event)
    },
    onWheel: host.onWheel,
  }
}
