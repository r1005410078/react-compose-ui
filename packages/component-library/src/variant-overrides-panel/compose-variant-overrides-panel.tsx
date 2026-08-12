import { ComposeButton } from '@compose-ui/components'
import type {
  ComposeComponentResolveResult,
  ComposeVariantComponentAsset,
} from '@compose-ui/core'
import { useCallback, useEffect, useState } from 'react'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '../component-store'
import {
  IconApply,
  IconRefresh,
  IconRevert,
  IconVariant,
  OverridesIconButton,
  OverridesOperationsList,
  OverridesStatusBanner,
} from '../overrides-chrome'
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

/**
 * 变体当前层覆盖的 Apply / Revert / 检查更新面板。
 *
 * @remarks
 * 铬件与列表行复用 `overrides-chrome`；业务只负责变体 Store 读写。
 *
 * @public
 */
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
    if (source.asset.kind !== 'variant') throw new Error('当前资源不是变体')
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
      return `父源已保存，但当前变体尚未同步：${result.error.message}`
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

  if (!asset) {
    return (
      <p className="compose-instance-overrides__empty" role="status">
        正在读取变体覆盖…
      </p>
    )
  }

  const operations = asset.overrides
  const hasOverrides = operations.length > 0
  const statusTone = message !== null
    && /已更新|已 Apply|已 Revert|成功|已采用/.test(message)
    ? 'ok' as const
    : 'warn' as const

  return (
    <section
      aria-label="变体覆盖"
      className="compose-instance-overrides compose-variant-overrides"
    >
      <header className="compose-instance-overrides__header">
        <div className="compose-instance-overrides__identity">
          <span aria-hidden="true" className="compose-instance-overrides__badge">
            <IconVariant />
          </span>
          <div className="compose-instance-overrides__title">
            <strong>变体覆盖</strong>
            <span className="compose-instance-overrides__status">
              {hasOverrides ? (
                <span className="compose-instance-overrides__pill">
                  {`${operations.length} 项本层覆盖`}
                </span>
              ) : (
                '与父源同步 · 无本地覆盖'
              )}
            </span>
          </div>
        </div>
        <div
          aria-label="变体操作"
          className="compose-instance-overrides__actions"
          role="toolbar"
        >
          <OverridesIconButton
            disabled={busy}
            label="检查更新"
            onClick={() => { void update() }}
          >
            <IconRefresh />
          </OverridesIconButton>
          <span aria-hidden="true" className="compose-instance-overrides__sep" />
          <OverridesIconButton
            disabled={busy || !hasOverrides}
            label="Apply 全部变体覆盖"
            tone="accent"
            onClick={() => { void apply() }}
          >
            <IconApply />
          </OverridesIconButton>
          <OverridesIconButton
            disabled={busy || !hasOverrides}
            label="Revert 全部变体覆盖"
            tone="danger"
            onClick={() => { void revert(operations.map(({ id }) => id)) }}
          >
            <IconRevert />
          </OverridesIconButton>
        </div>
      </header>

      {message === null ? null : (
        <OverridesStatusBanner
          message={message}
          tone={statusTone}
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="compose-instance-overrides__body">
        {hasOverrides ? (
          <>
            <OverridesOperationsList
              disabled={busy}
              listHint="↑ 推回父源 · ↺ 还原"
              operations={operations}
              onApply={(id) => { void apply([id]) }}
              onRevert={(id) => { void revert([id]) }}
            />
            <p className="compose-instance-overrides__hint">
              Apply 将本层覆盖写入直接父源；Revert 丢弃本层修改。日常在画布改属性会自动记入列表。
            </p>
          </>
        ) : (
          <div className="compose-instance-overrides__empty">
            变体与直接父源一致，尚无本层覆盖
          </div>
        )}
      </div>

      {confirmRevert ? (
        <div className="compose-instance-overrides__conflict">
          <ComposeButton
            disabled={busy}
            size="sm"
            variant="destructive"
            onClick={() => { void revert(confirmRevert, true) }}
          >
            确认移除依赖覆盖
          </ComposeButton>
        </div>
      ) : null}
      {updateConflicts ? (
        <div className="compose-instance-overrides__conflict">
          <ComposeButton
            disabled={busy}
            size="sm"
            variant="destructive"
            onClick={() => { void update(true) }}
          >
            {`丢弃 ${updateConflicts.length} 项冲突并更新`}
          </ComposeButton>
        </div>
      ) : null}
    </section>
  )
}
