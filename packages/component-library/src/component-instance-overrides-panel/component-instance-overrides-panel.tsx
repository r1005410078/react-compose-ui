import { ComposeButton } from '@compose-ui/components'
import type {
  ComposeComponentInstanceOverrides,
  ComposeComponentOverrideOperation,
  ComposeEntity,
} from '@compose-ui/core'
import { readComposeComponentInstance } from '../instance-operations'
import type { ComposeComponentInstanceUpdateResult } from '../instance-operations'
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
  /** 标题与属性区之间：状态消息、覆盖列表、冲突确认。无内容时为 null。 */
  readonly banner: ReactNode
}

/** 字段路径末段的可读标签。 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  backgroundPaint: '背景填充',
  borderColor: '边框颜色',
  borderWidth: '边框宽度',
  borderRadius: '圆角',
  opacity: '透明度',
  shadow: '阴影',
  width: '宽度',
  height: '高度',
  offset: '位置',
  rotation: '旋转',
  visible: '可见',
  locked: '锁定',
  childIds: '子项',
  text: '文本',
}

function fieldLabel(path: readonly string[] | undefined): string {
  if (!path || path.length === 0) return '属性'
  const last = path[path.length - 1]!
  return FIELD_LABELS[last] ?? last
}

/**
 * 把结构操作拆成人话主标题 + 次要说明，供列表行展示。
 *
 * @public
 */
export function describeInstanceOperation(operation: ComposeComponentOverrideOperation): {
  readonly title: string
  readonly detail: string
} {
  switch (operation.kind) {
    case 'set-field':
      return {
        title: fieldLabel(operation.fieldPath),
        detail: `${operation.entityId} · ${operation.fieldPath.join('.') || '字段'}`,
      }
    case 'remove-field':
      return {
        title: `移除 ${fieldLabel(operation.fieldPath)}`,
        detail: `${operation.entityId} · ${operation.fieldPath.join('.') || '字段'}`,
      }
    case 'add-component':
      return {
        title: '新增能力',
        detail: `${operation.entityId} · ${operation.componentKey}`,
      }
    case 'remove-component':
      return {
        title: '移除能力',
        detail: `${operation.entityId} · ${operation.componentKey}`,
      }
    case 'add-entity':
      return {
        title: '新增子树',
        detail: operation.rootEntityId,
      }
    case 'remove-entity':
      return { title: '删除实体', detail: operation.entityId }
    case 'move-entity':
      return { title: '移动实体', detail: operation.entityId }
    default: {
      const exhaustive: never = operation
      return { title: '未知操作', detail: String(exhaustive) }
    }
  }
}

function IconRefresh() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M3 8a5 5 0 0 1 8.9-3M13 3v3h-3" />
      <path d="M13 8a5 5 0 0 1-8.9 3M3 13v-3h3" />
    </svg>
  )
}

function IconVariant() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4 3h5l3 3v7H4V3Z" />
      <path d="M9 3v3h3" />
      <path d="M6.5 9.5h3M8 8v3" />
    </svg>
  )
}

function IconApply() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M8 2v8" />
      <path d="m5 7 3 3 3-3" />
      <path d="M3 13h10" />
    </svg>
  )
}

function IconRevert() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4 6a5 5 0 1 1-1 4" />
      <path d="M4 3v3h3" />
    </svg>
  )
}

function IconComponent() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="m8 1.5 5.5 3.1v6.8L8 14.5 2.5 11.4V4.6L8 1.5Z" />
      <path d="M8 8.2V14.5M2.5 4.6 8 8.2l5.5-3.6" />
    </svg>
  )
}

function IconButton({
  label,
  disabled,
  tone,
  onClick,
  children,
}: {
  readonly label: string
  readonly disabled?: boolean
  readonly tone?: 'accent' | 'danger'
  readonly onClick: () => void
  readonly children: ReactNode
}) {
  const toneClass = tone === 'accent'
    ? ' compose-instance-overrides__icon-btn--accent'
    : tone === 'danger'
      ? ' compose-instance-overrides__icon-btn--danger'
      : ''
  return (
    <ComposeButton
      aria-label={label}
      className={`compose-instance-overrides__icon-btn${toneClass}`}
      disabled={disabled}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </ComposeButton>
  )
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
      <IconButton disabled={updating} label="检查更新" onClick={onUpdate}>
        <IconRefresh />
      </IconButton>
      <IconButton label="创建变体" onClick={onCreateVariant}>
        <IconVariant />
      </IconButton>
      <span aria-hidden="true" className="compose-instance-overrides__sep" />
      <IconButton
        disabled={!hasOverrides}
        label="Apply 全部实例覆盖"
        tone="accent"
        onClick={onApply}
      >
        <IconApply />
      </IconButton>
      <IconButton
        disabled={!hasOverrides}
        label="Revert 全部实例覆盖"
        tone="danger"
        onClick={onRevertAll}
      >
        <IconRevert />
      </IconButton>
    </div>
  )
}

function OverridesList({
  operations,
  onApply,
  onRevert,
}: {
  readonly operations: readonly ComposeComponentOverrideOperation[]
  readonly onApply: (id: string) => void
  readonly onRevert: (id: string) => void
}) {
  return (
    <>
      <div className="compose-instance-overrides__list-label">
        <span>本层覆盖</span>
        <em>↑ 推回源 · ↺ 还原</em>
      </div>
      <ul className="compose-instance-overrides__list">
        {operations.map((operation) => {
          const { title, detail } = describeInstanceOperation(operation)
          return (
            <li className="compose-instance-overrides__row" key={operation.id}>
              <div className="compose-instance-overrides__row-meta">
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
              <div className="compose-instance-overrides__row-ops">
                <IconButton
                  label="Apply"
                  tone="accent"
                  onClick={() => onApply(operation.id)}
                >
                  <IconApply />
                </IconButton>
                <IconButton
                  label="Revert"
                  tone="danger"
                  onClick={() => onRevert(operation.id)}
                >
                  <IconRevert />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
    </>
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
        banner: invalid,
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

  const bannerInner = (
    <>
      {message === null ? null : (
        <p className="compose-instance-overrides__message" role="status">{message}</p>
      )}
      {hasOverrides ? (
        <div className="compose-instance-overrides__body compose-instance-overrides__body--strip">
          <OverridesList
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

  const bannerHasContent = message !== null || hasOverrides || updateConflict !== null
  const banner = bannerHasContent
    ? (
        <div
          aria-label="组件实例覆盖"
          className="compose-instance-overrides compose-instance-overrides--banner"
        >
          {bannerInner}
        </div>
      )
    : null

  if (layout === 'inspector') {
    return children?.({
      leading,
      subtitle,
      trailing,
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
            <OverridesList
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
