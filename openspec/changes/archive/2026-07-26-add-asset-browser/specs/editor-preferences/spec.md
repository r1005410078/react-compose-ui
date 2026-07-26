## ADDED Requirements

### Requirement: Asset Browser 内建本地化与主题

Asset Browser MUST 直接消费共享 Theme/I18n Context。内建中英文词典 MUST 覆盖工具栏、Tree、
资源网格、预览、确认、冲突、错误和 Monaco 外层 chrome；文件名、Provider label 与宿主内容
不得自动翻译。

#### Scenario: 切换资源面板语言和主题

- **WHEN** 用户把 Editor 切换到 light/en-US 并打开 Assets
- **THEN** Asset Browser 的 surface、border、hover、selected、focus 和 scrollbar 使用浅色 token
- **AND** 全部内建 chrome 与 ARIA 显示英文，真实文件名保持原文

#### Scenario: 独立使用 Asset Browser

- **WHEN** 宿主在无 Provider Context 环境独立挂载 AssetBrowser
- **THEN** Browser 使用 dark 与 zh-CN 默认 chrome
- **AND** 不要求依赖 ComposeEditor 或 ComposeDocument
