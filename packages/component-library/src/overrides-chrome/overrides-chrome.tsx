/**
 * 实例 / 变体覆盖面板共用的列表铬件与图标。
 *
 * @remarks
 * 样式类名仍用 `compose-instance-overrides__*`（历史命名）；两套面板共享同一套视觉，避免复制。
 *
 * @internal
 */
import { ComposeButton } from '@compose-ui/components'
import type { ComposeComponentOverrideOperation } from '@compose-ui/core'
import type { ReactNode } from 'react'
import { describeInstanceOperation } from './describe-operation'
import '../component-instance-overrides-panel/styles.css'

export function IconRefresh() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M3 8a5 5 0 0 1 8.9-3M13 3v3h-3" />
      <path d="M13 8a5 5 0 0 1-8.9 3M3 13v-3h3" />
    </svg>
  )
}

export function IconApply() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M8 2v8" />
      <path d="m5 7 3 3 3-3" />
      <path d="M3 13h10" />
    </svg>
  )
}

export function IconRevert() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4 6a5 5 0 1 1-1 4" />
      <path d="M4 3v3h3" />
    </svg>
  )
}

export function IconVariant() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4.5 3.5 11 2l4.5 3.5v7L11 14.5 4.5 12.5z" />
      <path d="m4.5 3.5 6.5 3 4.5-3M11 6.5V14.5" />
      <path d="M14 8.5v4M15.5 9.5v2" />
    </svg>
  )
}

export function IconComponent() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="m8 1.5 5.5 3.1v6.8L8 14.5 2.5 11.4V4.6L8 1.5Z" />
      <path d="M8 8.2V14.5M2.5 4.6 8 8.2l5.5-3.6" />
    </svg>
  )
}

export function OverridesIconButton({
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

/** 本层覆盖列表：可读标题 + 行内 Apply/Revert 图标。 */
export function OverridesOperationsList({
  operations,
  listHint = '↑ 推回源 · ↺ 还原',
  disabled,
  onApply,
  onRevert,
}: {
  readonly operations: readonly ComposeComponentOverrideOperation[]
  readonly listHint?: string
  readonly disabled?: boolean
  readonly onApply: (id: string) => void
  readonly onRevert: (id: string) => void
}) {
  return (
    <>
      <div className="compose-instance-overrides__list-label">
        <span>本层覆盖</span>
        <em>{listHint}</em>
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
                <OverridesIconButton
                  disabled={disabled}
                  label="Apply"
                  tone="accent"
                  onClick={() => onApply(operation.id)}
                >
                  <IconApply />
                </OverridesIconButton>
                <OverridesIconButton
                  disabled={disabled}
                  label="Revert"
                  tone="danger"
                  onClick={() => onRevert(operation.id)}
                >
                  <IconRevert />
                </OverridesIconButton>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** 状态条（成功 ok / 警告 warn）。 */
export function OverridesStatusBanner({
  message,
  tone,
  onDismiss,
}: {
  readonly message: string
  readonly tone: 'ok' | 'warn'
  readonly onDismiss: () => void
}) {
  return (
    <div
      className={`compose-instance-status compose-instance-status--${tone}`}
      role="status"
    >
      <span aria-hidden="true" className="compose-instance-status__dot" />
      <span className="compose-instance-status__text">{message}</span>
      <button
        aria-label="关闭状态"
        className="compose-instance-status__dismiss"
        type="button"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
