# @compose-ui/ui-context

跨 Compose UI React 包共享主题与国际化环境，避免独立组件反向依赖 Editor。

```tsx
import {
  ComposeUIProvider,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'

<ComposeUIProvider
  locale="en-US"
  theme="system"
  overrides={{ light: { accent: '#7c3aed' } }}
  messages={{ 'stage.rulerOrigin': 'Coordinate origin' }}
>
  <Workspace />
</ComposeUIProvider>
```

Provider 可嵌套：未提供的 theme/locale 继承父级，dark/light token 和 message 按父级到当前层合并。
`system` 在 Theme Provider 内监听 `prefers-color-scheme`。`formatMessage()` 支持
`{label}` 形式的字符串/数字变量替换；未覆盖消息时由消费包提供当前语言的内建 fallback。

`useComposeThemeContext()` 与 `useComposeI18nContext()` 在 Provider 外返回 `null`，使独立包能够
保留原有默认语言和暗色视觉。消费包构建时必须把 `@compose-ui/ui-context` 外置，确保宿主运行时
只有一个 Context 实例。
