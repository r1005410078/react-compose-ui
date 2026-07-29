import {
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore as useReactSyncExternalStore,
} from 'react'

/**
 * Base UI 为兼容 React 17 依赖 CommonJS 版 `use-sync-external-store`。
 * components 的 peer 范围从 React 18 开始，原生 hook 已可用；在库构建阶段
 * 使用这份 ESM bridge，避免把嵌套的 `require("react")` 带到浏览器产物。
 *
 * 此文件是 Vite alias 的私有目标，不属于包公共 API。
 * @internal
 */
export const useSyncExternalStore = useReactSyncExternalStore

/** @internal */
export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  const instRef = useRef<{ hasValue: boolean; value: Selection } | null>(null)

  if (instRef.current === null) {
    instRef.current = { hasValue: false, value: undefined as Selection }
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false
    let memoizedSnapshot: Snapshot
    let memoizedSelection: Selection

    const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
      if (!hasMemo) {
        // eslint-disable-next-line react-hooks/immutability -- 与 React 官方 shim 相同，闭包只缓存本次 useMemo 生命周期内的 snapshot。
        hasMemo = true
        memoizedSnapshot = nextSnapshot
        const nextSelection = selector(nextSnapshot)

        if (isEqual && instRef.current!.hasValue && isEqual(instRef.current!.value, nextSelection)) {
          memoizedSelection = instRef.current!.value
          return memoizedSelection
        }

        memoizedSelection = nextSelection
        return nextSelection
      }

      if (Object.is(memoizedSnapshot, nextSnapshot)) {
        return memoizedSelection
      }

      const nextSelection = selector(nextSnapshot)

      if (isEqual && isEqual(memoizedSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot
        return memoizedSelection
      }

      memoizedSnapshot = nextSnapshot
      memoizedSelection = nextSelection
      return nextSelection
    }

    const getSelectionFromSnapshot = () => memoizedSelector(getSnapshot())
    const getSelectionFromServerSnapshot = getServerSnapshot
      ? () => memoizedSelector(getServerSnapshot())
      : undefined

    return [getSelectionFromSnapshot, getSelectionFromServerSnapshot] as const
  }, [getServerSnapshot, getSnapshot, isEqual, selector])

  const value = useReactSyncExternalStore(subscribe, getSelection, getServerSelection)

  useEffect(() => {
    instRef.current = { hasValue: true, value }
  }, [value])
  useDebugValue(value)

  return value
}
