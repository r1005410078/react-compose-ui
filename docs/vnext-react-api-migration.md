# vNext React API Migration

vNext 是一次有意的 major 升级：第一方 React 包不再提供旧名称、兼容入口或运行时迁移层。

## 命名

- 视觉组件、Provider、属性和事件类型统一以 `Compose` 开头，例如 `ComposeStage`、`ComposeTreeProps`。
- Hook 使用 `useCompose*`，工厂使用 `createCompose*`。
- 主题与语言只由 `ComposeUIProvider`、`ComposeThemeProvider` 或 `ComposeI18nProvider` 注入；独立组件不再接受 `locale`。

## 编辑器与预览

`ComposeEditor` 把可替换面板收敛到 `slots`，默认面板配置放在具名领域属性中。旧的平铺 `*Panel`、`*Props`、`canvasToolbar` 和 children 画布覆盖已删除。

`ComposePreview` 始终需要 `document` 与 `registry`。它不再是可随意承载 children 的容器。

## 资源

资源协议从 `@compose-ui/assets` 导入。`@compose-ui/asset-browser` 只提供浏览器 UI 和本地目录适配器，且不会再转导 Provider、resolver 或引用类型。

## 样式与 Storybook

每个视觉包仍只从 `@compose-ui/<package>/styles.css` 暴露样式。各公开视觉组件的稳定示例位于实现功能目录内的 `*.stories.tsx`，可在 `apps/storybook` 中查看。
