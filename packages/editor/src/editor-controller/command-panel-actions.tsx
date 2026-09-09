import { useMemo } from 'react'
import { ComposeCommandPanel } from '@compose-ui/command-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComposeCommandPreset } from '@compose-ui/command-panel'
import type { TransactionRuntime } from '@compose-ui/core'
import { createComposeEditorActions } from './action-catalog'
import { createDefaultComposeEditorPreferences } from '../editor-preferences'
import type { ComposeEditorActionContext } from './action-catalog'
import type { ComposeEditorPreferences } from '../editor-preferences'

/** 模块级常量，避免每次渲染都产生新的默认键位对象而击穿记忆化。 */
const DEFAULT_SHORTCUTS = createDefaultComposeEditorPreferences().shortcuts

/** 由控制器提供的部分；语言与键位在挂载处补齐。 */
type ActionContextInput = Omit<
  ComposeEditorActionContext,
  | 'locale'
  | 'formatMessage'
  | 'shortcuts'
  | 'openSettings'
  | 'saveDocument'
  | 'canSaveDocument'
  | 'toggleAnimationMode'
  | 'animationTimelineMissing'
>

interface CommandPanelWithActionsProps {
  readonly actionContext: ActionContextInput
  readonly presets?: readonly ComposeCommandPreset[]
  readonly runtime: TransactionRuntime
  /**
   * 由 ComposeEditor 注入的当前键位；控制器不持有偏好。
   *
   * @remarks
   * 缺省时回退到默认键位，使脱离 ComposeEditor 单独使用控制器时展示仍然合理。
   */
  readonly shortcuts?: ComposeEditorPreferences['shortcuts']
  /** 由 ComposeEditor 注入的设置入口；缺省时目录不产出该动作。 */
  readonly onOpenSettings?: () => void
  /**
   * 由 ComposeEditor 注入的文档级动作；控制器不认识文档会话。
   *
   * @remarks
   * 保存与模式切换住在编辑器那一层（页面 / 组件 / 资源三种标签是它的东西），与 `openSettings`
   * 是同一条理由。缺省时目录整条省略它们，而不是列出按下去没反应的条目。
   */
  readonly onSaveDocument?: () => void
  readonly canSaveDocument?: boolean
  readonly onToggleAnimationMode?: () => void
  /** 当前布局里没有时间线：「动画编辑」列出但不可用。 */
  readonly animationTimelineMissing?: boolean
}

/**
 * 在命令面板挂载位置解析界面语言并装配动作目录。
 *
 * @remarks
 * 控制器由宿主在 `ComposeUIProvider` 之外创建，无法直接读取 I18n Context；而它创建的
 * 元素是在 Provider 内部渲染的。因此动作目录必须在组件里装配，才能拿到正确的语言。
 */
export function CommandPanelWithActions({
  actionContext,
  presets,
  runtime,
  shortcuts,
  onOpenSettings,
  onSaveDocument,
  canSaveDocument,
  onToggleAnimationMode,
  animationTimelineMissing,
}: CommandPanelWithActionsProps) {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const formatMessage = i18n?.formatMessage
  const resolvedShortcuts = shortcuts ?? DEFAULT_SHORTCUTS
  const actions = useMemo(
    () => createComposeEditorActions({
      ...actionContext,
      formatMessage,
      locale,
      openSettings: onOpenSettings,
      shortcuts: resolvedShortcuts,
      saveDocument: onSaveDocument,
      canSaveDocument,
      toggleAnimationMode: onToggleAnimationMode,
      animationTimelineMissing,
    }),
    [
      actionContext,
      animationTimelineMissing,
      canSaveDocument,
      formatMessage,
      locale,
      onOpenSettings,
      onSaveDocument,
      onToggleAnimationMode,
      resolvedShortcuts,
    ],
  )
  return <ComposeCommandPanel actions={actions} presets={presets} runtime={runtime} />
}
