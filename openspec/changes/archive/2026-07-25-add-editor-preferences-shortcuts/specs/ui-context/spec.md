## ADDED Requirements

### Requirement: 共享 UI Context 包

系统 MUST 提供独立 `@compose-ui/ui-context` React 包，公开 Dark/Light/System 主题、zh-CN/en-US
语言、Theme/I18n Provider、组合 Provider 和读取 Hook。该包 MUST 不依赖 editor、core 或任一
工作区组件，且不得拥有文档、历史或持久化状态。

#### Scenario: 组合共享 UI 环境

- **WHEN** 宿主通过 ComposeUIProvider 包裹 Editor 或独立第一方组件
- **THEN** 子树读取相同 theme、resolvedTheme、tokens、locale 与消息格式化器
- **AND** Context 变化不产生 ComposeDocument、History 或 Operation Log 修改

#### Scenario: 独立组件保持兼容

- **WHEN** 第一方组件在无 Provider 环境挂载，或显式提供旧 locale 属性
- **THEN** 无 Provider 时使用该组件既有默认语言与深色外观
- **AND** 显式 locale 优先于 Context，宿主无需同步迁移

### Requirement: 可嵌套主题环境

ThemeProvider MUST 解析 system、监听系统配色，并按父到子合并 Dark/Light 语义 token 覆盖。
Context MUST 同时保留原始 theme 和 resolvedTheme；组件根节点 MUST 把合并 tokens 转为可继承
CSS variables，显式 style 拥有最终优先级。

#### Scenario: 继承并覆盖主题

- **WHEN** 内层 Provider 只修改 theme 或部分当前主题 token
- **THEN** 未指定值继承外层，指定 token 覆盖同名父值
- **AND** 子组件和宿主插槽使用解析主题且不影响 Provider 外 DOM

#### Scenario: 跟随系统主题

- **WHEN** theme 为 system 且 prefers-color-scheme 改变
- **THEN** resolvedTheme 与对应 token 集合立即更新
- **AND** 原始 theme 仍为 system

### Requirement: 可嵌套消息覆盖

I18nProvider MUST 按父到子合并稳定 message ID 覆盖，并提供
`formatMessage(id, fallback, variables)`。覆盖模板 MUST 支持字符串/数字变量替换；缺失覆盖
MUST 使用调用包提供的内建 fallback。

#### Scenario: 覆盖单条内建消息

- **WHEN** 宿主覆盖一个稳定 message ID 并保留其余消息为空
- **THEN** 对应第一方 chrome 使用覆盖模板和变量
- **AND** 其他内建消息继续使用当前 locale 的完整词典

#### Scenario: 嵌套消息覆盖

- **WHEN** 内层 I18nProvider 修改 locale 并覆盖父级已有或新增 message ID
- **THEN** locale 使用内层值且同名消息使用内层模板
- **AND** 未覆盖的父级消息继续可用
