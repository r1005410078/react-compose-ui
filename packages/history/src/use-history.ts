import { useCallback, useId, useMemo, useState } from 'react'
import type {
  ComposeHistoryCommitOptions,
  ComposeHistoryController,
  ComposeHistoryEntry,
  ComposeUseHistoryOptions,
} from './types'

interface HistoryRecord<T> extends ComposeHistoryEntry {
  value: T
  mergeKey?: string
  committedAt: number
}

interface HistoryState<T> {
  records: readonly HistoryRecord<T>[]
  cursor: number
  nextId: number
}

const DEFAULT_LIMIT = 100
const DEFAULT_MERGE_WINDOW_MS = 750
const DEFAULT_INITIAL_LABEL = '开始'
const TRUNCATED_LABEL = '较早状态'

function normalizedLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.max(1, Math.floor(value))
}

function normalizedMergeWindow(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_MERGE_WINDOW_MS
  return Math.max(0, value)
}

function createInitialState<T>(
  value: T,
  label: string,
  idPrefix: string,
): HistoryState<T> {
  return {
    records: [{
      id: `${idPrefix}-0`,
      label,
      value,
      committedAt: 0,
    }],
    cursor: 0,
    nextId: 1,
  }
}

function pruneRecords<T>(
  records: readonly HistoryRecord<T>[],
  limit: number,
): readonly HistoryRecord<T>[] {
  if (records.length <= limit + 1) return records
  const overflow = records.length - limit - 1
  const originalBaseline = records[0]
  const promoted = records[overflow]
  if (!originalBaseline || !promoted) return records

  return [{
    id: originalBaseline.id,
    label: TRUNCATED_LABEL,
    value: promoted.value,
    committedAt: 0,
  }, ...records.slice(overflow + 1)]
}

/**
 * 创建当前 React 组件实例内的不可变快照历史。
 *
 * @remarks
 * Hook 不会跟随 `initialValue` 属性变化自动重置；加载另一份文档时应显式调用 `reset`。
 * 更新函数可能由 React 重放，因此必须保持无副作用。快照不会被深拷贝，宿主不得原地修改它们。
 *
 * @param initialValue - 当前会话的初始不可变快照。
 * @param options - 容量、合并窗口、基线名称和值相等策略。
 * @returns 当前值、历史元数据及提交和导航命令。
 * @public
 */
export function useComposeHistory<T>(
  initialValue: T,
  options: ComposeUseHistoryOptions<T> = {},
): ComposeHistoryController<T> {
  const reactId = useId().replace(/:/gu, '')
  const idPrefix = `history-${reactId || 'instance'}`
  const limit = normalizedLimit(options.limit)
  const mergeWindowMs = normalizedMergeWindow(options.mergeWindowMs)
  const initialLabel = options.initialLabel ?? DEFAULT_INITIAL_LABEL
  const isEqual = options.isEqual ?? Object.is
  const [state, setState] = useState(() => createInitialState(
    initialValue,
    initialLabel,
    idPrefix,
  ))

  const commit = useCallback((
    candidate: T | ((current: T) => T),
    commitOptions: ComposeHistoryCommitOptions,
  ) => {
    setState((current) => {
      const currentRecord = current.records[current.cursor]
      if (!currentRecord) return current
      const nextValue = typeof candidate === 'function'
        ? (candidate as (value: T) => T)(currentRecord.value)
        : candidate
      if (isEqual(currentRecord.value, nextValue)) return current

      const now = Date.now()
      const atTip = current.cursor === current.records.length - 1
      const canMerge = atTip
        && current.cursor > 0
        && commitOptions.mergeKey !== undefined
        && currentRecord.mergeKey === commitOptions.mergeKey
        && now - currentRecord.committedAt <= mergeWindowMs

      if (canMerge) {
        const records = [...current.records]
        records[current.cursor] = {
          ...currentRecord,
          label: commitOptions.label,
          value: nextValue,
          committedAt: now,
        }
        return { ...current, records }
      }

      const reachableRecords = current.records.slice(0, current.cursor + 1)
      const records = pruneRecords([
        ...reachableRecords,
        {
          id: `${idPrefix}-${current.nextId}`,
          label: commitOptions.label,
          value: nextValue,
          mergeKey: commitOptions.mergeKey,
          committedAt: now,
        },
      ], limit)

      return {
        records,
        cursor: records.length - 1,
        nextId: current.nextId + 1,
      }
    })
  }, [idPrefix, isEqual, limit, mergeWindowMs])

  const undo = useCallback(() => {
    setState((current) => current.cursor > 0
      ? { ...current, cursor: current.cursor - 1 }
      : current)
  }, [])

  const redo = useCallback(() => {
    setState((current) => current.cursor < current.records.length - 1
      ? { ...current, cursor: current.cursor + 1 }
      : current)
  }, [])

  const navigate = useCallback((entryId: string) => {
    setState((current) => {
      const cursor = current.records.findIndex((record) => record.id === entryId)
      return cursor >= 0 && cursor !== current.cursor ? { ...current, cursor } : current
    })
  }, [])

  const reset = useCallback((value: T, label?: string) => {
    setState((current) => ({
      records: [{
        id: `${idPrefix}-${current.nextId}`,
        label: label ?? initialLabel,
        value,
        committedAt: 0,
      }],
      cursor: 0,
      nextId: current.nextId + 1,
    }))
  }, [idPrefix, initialLabel])

  const entries = useMemo<readonly ComposeHistoryEntry[]>(() => (
    state.records.map(({ id, label }) => ({ id, label }))
  ), [state.records])
  const activeRecord = state.records[state.cursor]

  return useMemo(() => ({
    value: activeRecord?.value ?? initialValue,
    entries,
    activeEntryId: activeRecord?.id ?? null,
    canUndo: state.cursor > 0,
    canRedo: state.cursor < state.records.length - 1,
    commit,
    undo,
    redo,
    navigate,
    reset,
  }), [
    activeRecord,
    commit,
    entries,
    initialValue,
    navigate,
    redo,
    reset,
    state.cursor,
    state.records.length,
    undo,
  ])
}
