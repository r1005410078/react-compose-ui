import type { ComponentPropsWithoutRef } from 'react'
import type { PropertyPanelRendererBindingTargetState } from '../property-panel/compose-property-panel'
import { usePropertyPanelMessages } from '../property-panel-i18n'

/** 已绑定变量标识的属性。 @public */
export interface ComposePropertyPanelBoundValueProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  /** 当前逻辑输入的绑定状态。 */
  readonly target: PropertyPanelRendererBindingTargetState
}

/**
 * 显示已绑定逻辑输入引用的变量，并提供换绑入口。
 *
 * @remarks
 * 仅在 `target.binding` 存在时使用。解绑属于字段操作轨道的职责，因此本组件只会打开变量选择器，
 * 不会直接修改受控 binding 集合。
 * @public
 */
export function ComposePropertyPanelBoundValue({
  target,
  className,
  ...buttonProps
}: ComposePropertyPanelBoundValueProps) {
  const messages = usePropertyPanelMessages()
  const variableLabel = target.variable?.label ?? target.binding?.variableId ?? messages.unknownVariable
  const preview = formatBindingPreview(target.effectiveValue)
  const invalid = target.status !== 'literal' && target.status !== 'resolved'
  const classes = ['property-panel__bound-value', className].filter(Boolean).join(' ')
  return (
    <button
      {...buttonProps}
      aria-description={target.message ?? preview}
      aria-invalid={invalid ? 'true' : undefined}
      aria-label={messages.changeBinding(target.label, variableLabel)}
      className={classes}
      data-binding-state={invalid ? 'invalid' : 'bound'}
      disabled={target.readOnly || buttonProps.disabled}
      title={target.message ?? `${variableLabel} · ${preview}`}
      type="button"
      onClick={(event) => {
        buttonProps.onClick?.(event)
        if (!event.defaultPrevented) target.openPicker()
      }}
    >
      <VariableIcon />
      <span>{variableLabel}</span>
      <output>{preview}</output>
    </button>
  )
}

function VariableIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M7.8 6.1 6.2 4.5a3 3 0 0 0-4.2 4.2l2.2 2.2a3 3 0 0 0 4.2 0l1.3-1.3M12.2 13.9l1.6 1.6a3 3 0 0 0 4.2-4.2l-2.2-2.2a3 3 0 0 0-4.2 0l-1.3 1.3M7 13l6-6" />
    </svg>
  )
}

function formatBindingPreview(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toLocaleDateString()
  if (value === undefined) return 'undefined'
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return String(value)
    return serialized.length > 48 ? `${serialized.slice(0, 45)}…` : serialized
  } catch {
    return String(value)
  }
}
