import type { CSSProperties, ReactNode } from 'react'
import { createComposeThemeStyle, useComposeThemeContext } from '@compose-ui/ui-context'

/**
 * 把主题 token 发到 DOM 上，并画出面板底色。
 *
 * @remarks
 * `ComposeUIProvider` 只提供 React Context，**不发任何 CSS 变量**——发变量的是
 * `ComposeEditor`（它把 `createComposeThemeStyle` 挂在自己的根元素上）。因此 Storybook 里
 * 每个组件此前读到的都是样式表里那份硬编码兜底值，而不是当前主题；a11y 与目视检查量的是一个
 * 产品里根本不存在的组合。
 *
 * 底色同样必须由这层给：Storybook 的画布是白的，而多数组件自己画底所以看不出来。面板类组件
 * （物料面板挂在 Dockview 的面板底上）不画底，于是深色主题的文字合成在白底上，对比度掉到
 * 1.17——那不是组件的缺陷，是夹具把它摆错了地方。
 */
export function ComposeStorybookSurface({ children }: { readonly children: ReactNode }) {
  const theme = useComposeThemeContext()
  return (
    <div
      data-compose-theme={theme?.resolvedTheme}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        background: 'var(--compose-panel-bg)',
        color: 'var(--compose-text)',
        minHeight: 240,
        padding: 16,
      } as CSSProperties}
    >
      {children}
    </div>
  )
}
