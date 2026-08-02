# ui-context Specification

## Purpose
TBD - created by archiving change add-editor-preferences-shortcuts. Update Purpose after archive.
## Requirements
### Requirement: 共享 UI Context 包
The UI Context package MUST expose only compose-prefixed providers, hooks and types, and first-party UI MUST use
that Context rather than per-component locale compatibility props.

#### Scenario: Context-only localization
- **WHEN** an independently rendered first-party component needs a locale
- **THEN** it resolves language through `ComposeI18nProvider` or its inherited default and has no locale prop

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

