import { ComposeButton } from '@compose-ui/components'
import type {
  ComposeComponentInstanceOverrides,
  ComposeEntity,
} from '@compose-ui/core'
import { readComposeComponentInstance } from '../instance-operations'
import type { ComposeComponentInstanceUpdateResult } from '../instance-operations'
import {
  IconApply,
  IconComponent,
  IconRefresh,
  IconRevert,
  IconVariant,
  OverridesIconButton,
  OverridesOperationsList,
  OverridesStatusBanner,
} from '../overrides-chrome'
import { useState, type ReactNode } from 'react'
import './styles.css'

/** {@link ComposeComponentInstanceOverridesPanel} 属性。 @public */
export interface ComposeComponentInstanceOverridesPanelProps {
  readonly entity: ComposeEntity
  /** 写回完整实例覆盖。 */
  readonly onChange: (overrides: ComposeComponentInstanceOverrides) => void
  /** Apply 指定结构操作到直接父源；省略参数表示全部。 */
  readonly onApply: (operationIds?: readonly string[]) => void
  readonly onCreateVariant: () => void
  readonly onUpdate: (discardConflicts?: boolean) => Promise<ComposeComponentInstanceUpdateResult>
  /**
   * 呈现方式。
   *
   * - `dock`：独立底部区块（兼容自定义宿主）。
   * - `inspector`：拆成可挂到 EntityInspector 头部的片段，由 children render props 消费。
   *
   * @defaultValue 'dock'
   */
  readonly layout?: 'dock' | 'inspector'
  /**
   * `layout="inspector"` 时必填：把 leading / subtitle / trailing / banner 拼进属性面板。
   */
  readonly children?: (parts: ComposeInstanceInspectorChromeParts) => ReactNode
}

/** 挂到 EntityInspector 的实例铬件。 @public */
export type ComposeInstanceInspectorChromeParts = {
  /** 标题左侧组件菱形图标。 */
  readonly leading: ReactNode
  /** 名称下方状态行（实例徽章 / 覆盖数 / 与源同步）。 */
  readonly subtitle: ReactNode
  /** 标题行右侧工具栏（检查更新、变体、Apply/Revert 全部）。 */
  readonly trailing: ReactNode
  /**
   * 搜索工具带上方状态（更新反馈等），注入 PropertyPanel statusSlot。
   * 无消息时为 null。
   */
  readonly statusSlot: ReactNode
  /** 标题与属性区之间：本层覆盖列表 / 冲突确认。无内容时为 null。 */
  readonly banner: ReactNode
}

function useInstanceOverridesModel({
  entity,
  onChange,
  onApply,
  onCreateVariant,
  onUpdate,
}: Omit<ComposeComponentInstanceOverridesPanelProps, 'layout' | 'children'>) {
  const [updating, setUpdating] = useState(false)
  const [updateConflict, setUpdateConflict] = useState<readonly string[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const facts = readComposeComponentInstance(entity)

  const operations = facts?.overrides.operations ?? []
  const hasOverrides = operations.length > 0
  const revert = (id: string) => {
    onChange({ operations: operations.filter((operation) => operation.id !== id) })
  }
  const revertAll = () => {
    onChange({ operations: [] })
  }
  const update = async (discardConflicts = false) => {
    setUpdating(true)
    try {
      const result = await onUpdate(discardConflicts)
      if (result.status === 'conflict') {
        setUpdateConflict(result.operationIds)
        setMessage(result.messages.join('；'))
      }
      else {
        setUpdateConflict(null)
        setMessage(result.discardedOperationIds.length > 0
          ? `已更新，并丢弃 ${result.discardedOperationIds.length} 项失效覆盖`
          : '实例已更新到来源最新 revision')
      }
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
    finally {
      setUpdating(false)
    }
  }

  return {
    facts,
    operations,
    hasOverrides,
    updating,
    updateConflict,
    message,
    setMessage,
    revert,
    revertAll,
    update,
    onApply,
    onCreateVariant,
  }
}

function InstanceToolbar({
  hasOverrides,
  updating,
  onApply,
  onCreateVariant,
  onUpdate,
  onRevertAll,
}: {
  readonly hasOverrides: boolean
  readonly updating: boolean
  readonly onApply: () => void
  readonly onCreateVariant: () => void
  readonly onUpdate: () => void
  readonly onRevertAll: () => void
}) {
  return (
    <div
      aria-label="实例操作"
      className="compose-instance-overrides__actions"
      role="toolbar"
    >
      <OverridesIconButton disabled={updating} label="检查更新" onClick={onUpdate}>
        <IconRefresh />
      </OverridesIconButton>
      <OverridesIconButton label="创建变体" onClick={onCreateVariant}>
        <IconVariant />
      </OverridesIconButton>
      <span aria-hidden="true" className="compose-instance-overrides__sep" />
      <OverridesIconButton
        disabled={!hasOverrides}
        label="Apply 全部实例覆盖"
        tone="accent"
        onClick={onApply}
      >
        <IconApply />
      </OverridesIconButton>
      <OverridesIconButton
        disabled={!hasOverrides}
        label="Revert 全部实例覆盖"
        tone="danger"
        onClick={onRevertAll}
      >
        <IconRevert />
      </OverridesIconButton>
    </div>
  )
}

/**
 * 关联实例当前层覆盖的 Apply/Revert 与创建 Variant 控制。
 *
 * @remarks
 * - `dock`：独立区块（标题 + 工具栏 + 列表/空态）。
 * - `inspector`：拆成 EntityInspector 头部铬件，无覆盖时不占底部大块。
 *
 * @public
 */
export function ComposeComponentInstanceOverridesPanel({
  entity,
  onChange,
  onApply,
  onCreateVariant,
  onUpdate,
  layout = 'dock',
  children,
}: ComposeComponentInstanceOverridesPanelProps) {
  const model = useInstanceOverridesModel({
    entity,
    onChange,
    onApply,
    onCreateVariant,
    onUpdate,
  })

  if (!model.facts) {
    const invalid = <p role="alert">组件实例快照无效</p>
    if (layout === 'inspector') {
      return children?.({
        leading: null,
        subtitle: null,
        trailing: null,
        statusSlot: invalid,
        banner: null,
      }) ?? invalid
    }
    return invalid
  }

  const {
    operations,
    hasOverrides,
    updating,
    updateConflict,
    message,
    revert,
    revertAll,
    update,
  } = model

  const dismissMessage = () => {
    model.setMessage(null)
  }

  const leading = (
    <span aria-hidden="true" className="compose-instance-overrides__badge">
      <IconComponent />
    </span>
  )

  const subtitle = hasOverrides ? (
    <span className="compose-instance-overrides__pill">
      {`${operations.length} 项本层覆盖`}
    </span>
  ) : (
    <span className="compose-instance-overrides__status-text">实例 · 与源同步</span>
  )

  const trailing = (
    <InstanceToolbar
      hasOverrides={hasOverrides}
      updating={updating}
      onApply={() => onApply()}
      onCreateVariant={onCreateVariant}
      onRevertAll={revertAll}
      onUpdate={() => { void update() }}
    />
  )

  // 成功文案用 ok 色；失败/未提交类警告。
  const statusTone = message !== null && /已更新|成功/.test(message) ? 'ok' as const : 'warn' as const
  const statusSlot = message === null
    ? null
    : (
        <OverridesStatusBanner
          message={message}
          tone={statusTone}
          onDismiss={dismissMessage}
        />
      )

  const bannerParts = (
    <>
      {hasOverrides ? (
        <div className="compose-instance-overrides__body compose-instance-overrides__body--strip">
          <OverridesOperationsList
            operations={operations}
            onApply={(id) => onApply([id])}
            onRevert={revert}
          />
        </div>
      ) : null}
      {updateConflict ? (
        <div className="compose-instance-overrides__conflict">
          <ComposeButton
            disabled={updating}
            size="sm"
            variant="destructive"
            onClick={() => { void update(true) }}
          >
            {`丢弃 ${updateConflict.length} 项失效覆盖并更新`}
          </ComposeButton>
        </div>
      ) : null}
    </>
  )

  const banner = hasOverrides || updateConflict
    ? (
        <div
          aria-label="组件实例覆盖"
          className="compose-instance-overrides compose-instance-overrides--banner"
        >
          {bannerParts}
        </div>
      )
    : null

  if (layout === 'inspector') {
    return children?.({
      leading,
      subtitle,
      trailing,
      statusSlot,
      banner,
    }) ?? null
  }

  // dock：保留完整独立区块（自定义宿主 / 测试）
  return (
    <section aria-label="组件实例覆盖" className="compose-instance-overrides">
      <header className="compose-instance-overrides__header">
        <div className="compose-instance-overrides__identity">
          {leading}
          <div className="compose-instance-overrides__title">
            <strong>组件实例</strong>
            <span className="compose-instance-overrides__status">
              {hasOverrides ? (
                <span className="compose-instance-overrides__pill">
                  {`${operations.length} 项本层覆盖`}
                </span>
              ) : (
                '与源同步 · 无本地覆盖'
              )}
            </span>
          </div>
        </div>
        {trailing}
      </header>
      {message === null ? null : (
        <p className="compose-instance-overrides__message" role="status">{message}</p>
      )}
      <div className="compose-instance-overrides__body">
        {hasOverrides ? (
          <>
            <OverridesOperationsList
              operations={operations}
              onApply={(id) => onApply([id])}
              onRevert={revert}
            />
            <p className="compose-instance-overrides__hint">
              Apply 将覆盖写入组件源；Revert 丢弃本层修改。日常改属性不必依赖此列表。
            </p>
          </>
        ) : (
          <div className="compose-instance-overrides__empty">
            实例与组件源一致，尚无本层覆盖
          </div>
        )}
      </div>
      {updateConflict ? (
        <div className="compose-instance-overrides__conflict">
          <ComposeButton
            disabled={updating}
            size="sm"
            variant="destructive"
            onClick={() => { void update(true) }}
          >
            {`丢弃 ${updateConflict.length} 项失效覆盖并更新`}
          </ComposeButton>
        </div>
      ) : null}
    </section>
  )
}
