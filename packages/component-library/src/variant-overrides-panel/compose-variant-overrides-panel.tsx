import { ComposeButton } from '@compose-ui/components'
import type {
  ComposeComponentResolveResult,
  ComposeVariantComponentAsset,
} from '@compose-ui/core'
import { useCallback, useEffect, useState } from 'react'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '../component-store'
import {
  applyComposeVariantOverrides,
  revertComposeVariantOverrides,
  updateComposeVariantFromParent,
} from '../variant-operations'
import './styles.css'

/** Variant 操作后交给工作区更新运行时的完整事实。 @public */
export interface ComposeVariantOverridesChange {
  readonly source: ComposeComponentSnapshot
  readonly resolved: Exclude<ComposeComponentResolveResult, { readonly status: 'invalid' }>
}

/** {@link ComposeVariantOverridesPanel} 属性。 @public */
export interface ComposeVariantOverridesPanelProps {
  readonly assetKey: string
  readonly store: ComposeComponentStore
  readonly onChange?: (change: ComposeVariantOverridesChange) => void
}

/** Variant 当前层覆盖的 Apply、Revert 与显式更新控制面板。 @public */
export function ComposeVariantOverridesPanel({
  assetKey,
  store,
  onChange,
}: ComposeVariantOverridesPanelProps) {
  const [asset, setAsset] = useState<ComposeVariantComponentAsset | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState<readonly string[] | null>(null)
  const [updateConflicts, setUpdateConflicts] = useState<readonly string[] | null>(null)

  const refresh = useCallback(async () => {
    const source = await store.readComponent(assetKey)
    if (source.asset.kind !== 'variant') throw new Error('当前资源不是 Variant')
    const resolved = await store.resolveComponent(store.createReference(assetKey))
    if (resolved.status === 'invalid') {
      throw new Error(resolved.issues.map(({ message: issue }) => issue).join('；'))
    }
    setAsset(source.asset)
    onChange?.({ source, resolved })
  }, [assetKey, onChange, store])

  useEffect(() => {
    let cancelled = false
    let loadSequence = 0
    const load = () => {
      const sequence = ++loadSequence
      void store.readComponent(assetKey).then((source) => {
        if (!cancelled && sequence === loadSequence && source.asset.kind === 'variant') {
          setAsset(source.asset)
        }
      }, (error: unknown) => {
        if (!cancelled && sequence === loadSequence) {
          setMessage(error instanceof Error ? error.message : String(error))
        }
      })
    }
    load()
    const unsubscribe = store.subscribe((event) => {
      if (event.type === 'catalog-changed'
        || (event.type === 'component-changed' && event.assetKey === assetKey)) {
        load()
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [assetKey, store])

  const run = async (operation: () => Promise<string | null>) => {
    setBusy(true)
    try {
      const resultMessage = await operation()
      setMessage(resultMessage)
      await refresh()
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
    finally {
      setBusy(false)
    }
  }
  const apply = (operationIds?: readonly string[]) => run(async () => {
    const result = await applyComposeVariantOverrides({ store, assetKey, operationIds })
    if (result.status === 'failed') throw result.error
    if (result.status === 'partial-success') {
      return `父源已保存，但当前 Variant 尚未同步：${result.error.message}`
    }
    return '覆盖已 Apply 到直接父源'
  })
  const revert = (operationIds: readonly string[], confirmed = false) => run(async () => {
    const result = await revertComposeVariantOverrides({
      store,
      assetKey,
      operationIds,
      confirmDependencies: confirmed,
    })
    if (result.status === 'failed') throw result.error
    if (result.status === 'confirmation-required') {
      setConfirmRevert([...operationIds, ...result.dependentOperationIds])
      return '撤销新增子树会同时移除依赖覆盖，请确认'
    }
    setConfirmRevert(null)
    return '当前层覆盖已 Revert'
  })
  const update = (discardConflicts = false) => run(async () => {
    const result = await updateComposeVariantFromParent({
      store,
      assetKey,
      discardConflicts,
    })
    if (result.status === 'failed') throw result.error
    if (result.status === 'conflict') {
      setUpdateConflicts(result.operationIds)
      return `更新冲突：${result.messages.join('；')}`
    }
    setUpdateConflicts(null)
    return result.discardedOperationIds.length > 0
      ? `已更新并丢弃 ${result.discardedOperationIds.length} 项冲突`
      : '已采用直接父源的最新快照'
  })

  if (!asset) return <p role="status">正在读取 Variant 覆盖…</p>
  return (
    <section aria-label="Variant 覆盖" className="compose-variant-overrides">
      <header>
        <strong>Variant 覆盖 ({asset.overrides.length})</strong>
        <ComposeButton disabled={busy} size="sm" variant="outline" onClick={() => void update()}>
          检查更新
        </ComposeButton>
      </header>
      {asset.overrides.length === 0 ? <p>当前层没有覆盖</p> : (
        <ul>
          {asset.overrides.map((operation) => (
            <li key={operation.id}>
              <code>{operation.kind}</code>
              <span>{operation.id}</span>
              <ComposeButton disabled={busy} size="sm" variant="ghost" onClick={() => void apply([operation.id])}>
                Apply
              </ComposeButton>
              <ComposeButton disabled={busy} size="sm" variant="ghost" onClick={() => void revert([operation.id])}>
                Revert
              </ComposeButton>
            </li>
          ))}
        </ul>
      )}
      {asset.overrides.length > 0 ? (
        <div className="compose-variant-overrides__all">
          <ComposeButton disabled={busy} size="sm" onClick={() => void apply()}>Apply 全部</ComposeButton>
          <ComposeButton
            disabled={busy}
            size="sm"
            variant="outline"
            onClick={() => void revert(asset.overrides.map(({ id }) => id))}
          >Revert 全部</ComposeButton>
        </div>
      ) : null}
      {confirmRevert ? (
        <ComposeButton disabled={busy} variant="destructive" onClick={() => void revert(confirmRevert, true)}>
          确认移除依赖覆盖
        </ComposeButton>
      ) : null}
      {updateConflicts ? (
        <ComposeButton disabled={busy} variant="destructive" onClick={() => void update(true)}>
          {`丢弃 ${updateConflicts.length} 项冲突并更新`}
        </ComposeButton>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  )
}
