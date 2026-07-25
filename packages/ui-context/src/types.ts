import type { ReactNode } from 'react'

/** Compose UI 支持的主题偏好。 */
export type ComposeTheme = 'dark' | 'light' | 'system'

/** 浏览器实际使用的主题。 */
export type ComposeResolvedTheme = 'dark' | 'light'

/** Compose UI 首版内建语言。 */
export type ComposeLocale = 'zh-CN' | 'en-US'

/** 第一方工作区共享的语义主题 token。 */
export interface ComposeThemeTokens {
  /** 编辑器工作区最外层背景。 */
  readonly workspaceBackground: string
  /** Dock、面板和弹框的基础背景。 */
  readonly panelBackground: string
  /** 浮层、菜单和高层级控件表面。 */
  readonly surfaceRaised: string
  /** 画布、输入槽等内凹表面。 */
  readonly surfaceSunken: string
  /** 当前激活区域或选中导航项表面。 */
  readonly surfaceActive: string
  /** 输入框、按钮等常规控件表面。 */
  readonly surfaceControl: string
  /** 可交互元素的悬停表面。 */
  readonly surfaceHover: string
  /** 选中条目或强调区域的表面。 */
  readonly surfaceSelected: string
  /** 常规分隔线和控件边框。 */
  readonly border: string
  /** 需要提高对比度的边框。 */
  readonly borderStrong: string
  /** 默认正文颜色。 */
  readonly text: string
  /** 标题和强调正文颜色。 */
  readonly textStrong: string
  /** 次要说明文字颜色。 */
  readonly textMuted: string
  /** 最低层级辅助文字颜色。 */
  readonly textSubtle: string
  /** 品牌强调、选中和主要操作颜色。 */
  readonly accent: string
  /** 键盘焦点轮廓颜色。 */
  readonly focus: string
  /** 破坏性操作和错误状态颜色。 */
  readonly danger: string
  /** 自定义滚动条滑块颜色。 */
  readonly scrollbar: string
  /** 浮层和弹框阴影。 */
  readonly shadow: string
}

/** 按解析主题分别覆盖语义 token。 */
export type ComposeThemeOverrides = Partial<
  Record<ComposeResolvedTheme, Partial<ComposeThemeTokens>>
>

/** 用稳定 message ID 覆盖单条第一方文案模板。 */
export type ComposeMessageOverrides = Readonly<Record<string, string>>

/** 最近 ThemeProvider 解析出的主题环境。 */
export interface ComposeThemeContextValue {
  /** 当前主题偏好；可能仍为跟随系统。 */
  readonly theme: ComposeTheme
  /** 解析系统偏好后的实际明暗主题。 */
  readonly resolvedTheme: ComposeResolvedTheme
  /** 继承并合并覆盖后的完整语义 token。 */
  readonly tokens: ComposeThemeTokens
}

/** 最近 I18nProvider 解析出的语言环境。 */
export interface ComposeI18nContextValue {
  /** 当前第一方界面语言。 */
  readonly locale: ComposeLocale
  /**
   * 使用稳定 ID 格式化一条第一方界面文案。
   *
   * @param id - 跨包稳定的命名空间消息 ID。
   * @param fallback - 当前包提供的内建语言文案。
   * @param variables - 替换模板中 `{name}` 占位符的值。
   * @returns 合并消息覆盖并完成变量替换后的文案。
   */
  formatMessage(
    id: string,
    fallback: string,
    variables?: Readonly<Record<string, string | number>>,
  ): string
}

/** ThemeProvider 属性。 */
export interface ComposeThemeProviderProps {
  /** 接收主题环境的 React 子树。 */
  readonly children: ReactNode
  /** 当前层主题；省略时继承父 Provider，根层默认使用 dark。 */
  readonly theme?: ComposeTheme
  /** 按实际明暗主题合并到父级 token 上的局部覆盖。 */
  readonly overrides?: ComposeThemeOverrides
}

/** I18nProvider 属性。 */
export interface ComposeI18nProviderProps {
  /** 接收国际化环境的 React 子树。 */
  readonly children: ReactNode
  /** 当前层语言；省略时继承父 Provider，根层默认使用 zh-CN。 */
  readonly locale?: ComposeLocale
  /** 合并到父级消息表上的稳定 ID 文案覆盖。 */
  readonly messages?: ComposeMessageOverrides
}

/** 同时提供主题和语言环境的便捷 Provider 属性。 */
export interface ComposeUIProviderProps extends
  ComposeThemeProviderProps,
  Omit<ComposeI18nProviderProps, 'children'> {}
