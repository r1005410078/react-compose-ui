import type { ComposeThemeTokens } from './types'

/**
 * 把语义 token 转成可继承的 `--compose-*` CSS variables。
 *
 * @param tokens - Theme Context 合并后的完整 token。
 * @returns 可与组件显式 style 合并的 CSS 变量对象。
 * @public
 */
export function createComposeThemeStyle(tokens: ComposeThemeTokens) {
  return {
    '--compose-workspace-bg': tokens.workspaceBackground,
    '--compose-panel-bg': tokens.panelBackground,
    '--compose-surface-raised': tokens.surfaceRaised,
    '--compose-surface-sunken': tokens.surfaceSunken,
    '--compose-surface-active': tokens.surfaceActive,
    '--compose-surface-control': tokens.surfaceControl,
    '--compose-surface-hover': tokens.surfaceHover,
    '--compose-surface-selected': tokens.surfaceSelected,
    '--compose-border': tokens.border,
    '--compose-border-strong': tokens.borderStrong,
    '--compose-text': tokens.text,
    '--compose-text-strong': tokens.textStrong,
    '--compose-text-muted': tokens.textMuted,
    '--compose-text-subtle': tokens.textSubtle,
    '--compose-accent': tokens.accent,
    '--compose-focus': tokens.focus,
    '--compose-danger': tokens.danger,
    '--compose-scrollbar': tokens.scrollbar,
    '--compose-shadow': tokens.shadow,
  } as const
}
