import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { resolveShelfDropIndex, resolveShelfReorderTarget } from './shelf-drop'
import type { ShelfOrientation, ShelfRect } from './shelf-drop'

/** 抓起来的那一件来自哪一区。 @internal */
export type ShelfReorderOrigin =
  | { readonly zone: 'shelf'; readonly index: number }
  | { readonly zone: 'source'; readonly key: string }

/**
 * 一次进行中的重排。
 *
 * @remarks
 * 指针与键盘写的是**同一份**会话：`origin` 对应按下、`insertBefore` 对应 `pointermove` 算出来
 * 的落点、提交对应 `pointerup`。因此下游的呈现（插入线、影子、落区高亮）与写草稿的纯函数都
 * 只有一套，两条通道不各自分支。
 *
 * `point` 只有指针那条有：键盘抓起时没有光标位置，因此不画跟随副本，只画插入线。
 *
 * @internal
 */
export interface ShelfReorderSession {
  readonly origin: ShelfReorderOrigin
  /** 此刻的落区；`null` 表示指针不在任何一区上，松手落回原处。 */
  readonly zone: 'shelf' | 'source' | null
  /** 落在编排区时「插在第几项之前」；不在编排区上时为 `null`。 */
  readonly insertBefore: number | null
  /** 指针在视口里的位置；键盘那条为 `null`。 */
  readonly point: { readonly x: number; readonly y: number } | null
}

/** @internal */
export interface UseShelfReorderOptions {
  readonly orientation: ShelfOrientation
  /** 编排区此刻有几项；键盘移动的边界与「插到末尾」都读它。 */
  readonly count: number
  /** 这一项能不能抓起来。「选择」固定在首位，因此它恒为 false。 */
  readonly canGrab?: (index: number) => boolean
  /** 编排区内重排；`to` 已经是移动之后的最终下标。 */
  readonly onReorder: (from: number, to: number) => void
  /** 从来源列加进编排区，插在 `insertBefore` 之前。 */
  readonly onAdd: (key: string, insertBefore: number) => void
  /** 从编排区移出。 */
  readonly onRemove: (index: number) => void
  /** 在这一项之后插入分隔；只有工具栏那份给。 */
  readonly onInsertSeparator?: (index: number) => void
  /** 播报用的项名；live region 读它。 */
  readonly describeItem: (index: number) => string
  /** 已本地化的播报模板。 */
  readonly messages: ShelfReorderMessages
}

/** live region 的四句播报；由调用方给已本地化的文案。 @internal */
export interface ShelfReorderMessages {
  readonly grabbed: (name: string, position: number, total: number) => string
  readonly moved: (name: string, position: number, total: number) => string
  readonly dropped: (name: string, position: number, total: number) => string
  readonly cancelled: (name: string) => string
}

function collectRects(container: HTMLElement | null): readonly ShelfRect[] {
  if (!container) return []
  return [...container.querySelectorAll<HTMLElement>('[data-shelf-item]')]
    .map((element) => element.getBoundingClientRect())
}

function inside(element: HTMLElement | null, point: { x: number; y: number }) {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

/**
 * 两个货架对话框共用的重排会话：指针拖动与键盘抓放写同一份草稿。
 *
 * @remarks
 * **拖动在指针离开过按下点之后才开始**，不设位移阈值。这条判据本仓库已经用过一次——画布上的
 * 夹点按下不动是「点亮」、动过才是「拖动」——理由也逐字相同：阈值是别处都不需要的魔法数，
 * 而浏览器在 `pointerup` 之前会补发一次原地 `pointermove`，因此「收没收到 move」当不了判据。
 * 按下不动因此仍然是一次普通的选中。
 *
 * 落点用**含被抓那一件在内**的那组矩形算：原位留影子是刻意的呈现，`resolveShelfReorderTarget`
 * 负责把「插在第几项之前」换算回最终下标。
 *
 * 指针捕获挂在**被按下的那个元素**上：取得捕获之后 `pointermove` 一律重定向到它，因此指针
 * 移出编排区（正是「拖去移出」那一档）仍然收得到移动。
 *
 * @internal
 */
export function useShelfReorder(options: UseShelfReorderOptions) {
  const {
    canGrab, count, describeItem, messages, onAdd, onInsertSeparator, onRemove, onReorder, orientation,
  } = options
  const shelfRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<ShelfReorderSession | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  // 按下点只用来回答「动过没有」，因此不进 state：它每帧都被读，但没有一处呈现读它。
  const pressRef = useRef<{ origin: ShelfReorderOrigin; x: number; y: number } | null>(null)

  /*
   * 项数变了（拖走一格、加进一格）时把焦点收回可用范围，否则键盘会停在一个不存在的下标上。
   * **在读取时钳而不是在 effect 里回写**：回写要多跑一帧，而那一帧里键盘拿到的仍是越界的
   * 下标；钳在读取处则每一处读到的都是同一个可用值。
   */
  const focus = Math.min(focusIndex, Math.max(0, count - 1))

  const grabbable = useCallback(
    (index: number) => canGrab?.(index) ?? true,
    [canGrab],
  )

  const resolveZone = useCallback((point: { x: number; y: number }): ShelfReorderSession => {
    if (inside(sourceRef.current, point)) {
      return { origin: pressRef.current!.origin, zone: 'source', insertBefore: null, point }
    }
    if (inside(shelfRef.current, point)) {
      return {
        origin: pressRef.current!.origin,
        zone: 'shelf',
        insertBefore: resolveShelfDropIndex(collectRects(shelfRef.current), point, orientation),
        point,
      }
    }
    return { origin: pressRef.current!.origin, zone: null, insertBefore: null, point }
  }, [orientation])

  const commit = useCallback((current: ShelfReorderSession) => {
    const { insertBefore, origin, zone } = current
    if (zone === 'shelf' && insertBefore !== null) {
      if (origin.zone === 'source') onAdd(origin.key, insertBefore)
      else {
        const target = resolveShelfReorderTarget(origin.index, insertBefore)
        if (target !== origin.index) onReorder(origin.index, target)
        setFocusIndex(target)
      }
      return
    }
    // 来源列是移出的落区；从来源列拖到来源列什么都不做（它本来就在那儿）。
    if (zone === 'source' && origin.zone === 'shelf') onRemove(origin.index)
  }, [onAdd, onRemove, onReorder])

  const beginPress = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    origin: ShelfReorderOrigin,
  ) => {
    if (event.button !== 0) return
    if (origin.zone === 'shelf' && !grabbable(origin.index)) return
    pressRef.current = { origin, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [grabbable])

  const handleMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    if (!press) return
    const point = { x: event.clientX, y: event.clientY }
    // 「离开过按下点」——原地那一次补发的 move 不算，因此按下不动仍是一次普通的选中。
    if (session === null && point.x === press.x && point.y === press.y) return
    setSession(resolveZone(point))
  }, [resolveZone, session])

  const handleUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const current = session
    pressRef.current = null
    setSession(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (current) commit(current)
  }, [commit, session])

  const handleCancel = useCallback(() => {
    pressRef.current = null
    setSession(null)
  }, [])

  const pointerHandlers = useCallback((origin: ShelfReorderOrigin) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginPress(event, origin),
    onPointerMove: handleMove,
    onPointerUp: handleUp,
    onPointerCancel: handleCancel,
  }), [beginPress, handleCancel, handleMove, handleUp])

  /** 键盘抓起时 `origin.zone` 恒为 `shelf`：来源列那边 `Enter` 一步就上架，没有中间态。 */
  const keyboardGrab = session?.point === null && session?.origin.zone === 'shelf'
    ? session.origin.index
    : null

  const onShelfKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (keyboardGrab !== null) {
      const current = session!
      if (forward || backward) {
        event.preventDefault()
        const at = current.insertBefore ?? keyboardGrab
        const next = Math.max(0, Math.min(count, at + (forward ? 1 : -1)))
        setSession({ ...current, insertBefore: next })
        const position = resolveShelfReorderTarget(keyboardGrab, next) + 1
        setAnnouncement(messages.moved(describeItem(keyboardGrab), position, count))
        return
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        setSession(null)
        const at = current.insertBefore ?? keyboardGrab
        const target = resolveShelfReorderTarget(keyboardGrab, at)
        setAnnouncement(messages.dropped(describeItem(keyboardGrab), target + 1, count))
        if (target !== keyboardGrab) onReorder(keyboardGrab, target)
        setFocusIndex(target)
        return
      }
      if (event.key === 'Escape') {
        // 只放弃抓起，不关对话框：`stopPropagation` 挡住 Dialog 的 Escape。
        event.preventDefault()
        event.stopPropagation()
        setSession(null)
        setAnnouncement(messages.cancelled(describeItem(keyboardGrab)))
      }
      return
    }
    if (forward || backward) {
      event.preventDefault()
      setFocusIndex((index) => Math.max(0, Math.min(count - 1, index + (forward ? 1 : -1))))
      return
    }
    if (event.key === ' ' || event.key === 'Enter') {
      if (!grabbable(focus)) return
      event.preventDefault()
      setSession({
        origin: { zone: 'shelf', index: focus },
        zone: 'shelf',
        insertBefore: focus,
        point: null,
      })
      setAnnouncement(messages.grabbed(describeItem(focus), focus + 1, count))
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!grabbable(focus)) return
      event.preventDefault()
      onRemove(focus)
      return
    }
    if (event.key === '\\' && onInsertSeparator) {
      event.preventDefault()
      onInsertSeparator(focus)
    }
  }, [
    count, describeItem, focus, grabbable, keyboardGrab, messages,
    onInsertSeparator, onRemove, onReorder, session,
  ])

  return {
    announcement,
    focusIndex: focus,
    session,
    setFocusIndex,
    shelfRef,
    sourceRef,
    onShelfKeyDown,
    /** 编排区一格要接的指针事件；`data-shelf-item` 同时是收集矩形的钩子。 */
    itemProps: (index: number) => ({
      'data-shelf-item': index,
      ...pointerHandlers({ zone: 'shelf', index }),
    }),
    /**
     * 只有指针事件的那一半，给**把手与整块分开**的编排区。
     *
     * @remarks
     * 物料的段卡里长着开关，那些要能点，因此卡身必须挡住按下；而整块卡都画着 `grab` 光标时，
     * 「看起来能拖的地方大半拖不动」。按压因此只收在卡头上，`data-shelf-item` 仍留在整块卡上
     * ——落点换算量的是**卡的矩形**，不是把手的。
     */
    itemDragProps: (index: number) => pointerHandlers({ zone: 'shelf', index }),
    /** 来源列一条要接的指针事件。 */
    sourceItemProps: (key: string) => pointerHandlers({ zone: 'source', key }),
  }
}
