## MODIFIED Requirements

### Requirement: 全视口 Compose Dialog

`@compose-ui/components` MUST 提供 Shadcn/Base UI source-adapted 的 Compose 命名 Dialog 组合部件，
至少包括 Root、Trigger、Portal、Backdrop、Viewport、Content、Header、Footer、Title、Description 和
Close。Root MUST 支持 controlled 与 uncontrolled open；原始 Base UI Dialog 符号不得成为公共 API。
Dialog Portal MUST 默认挂载到 document body，Backdrop 与 Viewport MUST 覆盖完整浏览器 visual viewport，
不得受任一消费组件、Dockview panel 或 Editor root 的尺寸、overflow 和 stacking context 限制。Dialog
内容必须保留可配置尺寸而非强制内容全屏。

Content MUST 提供一档更宽的尺寸供编排类对话框使用，缺省 MUST 仍是既有的窄档——尺寸是**消费者
声明**的，MUST NOT 由内容撑开：撑开会让同一个对话框在不同数据下宽度不同。

#### Scenario: 从裁剪容器打开 Dialog

- **WHEN** 消费者在带 overflow hidden 或 stacking context 的面板内打开 ComposeDialog
- **THEN** Backdrop 覆盖完整浏览器窗口，居中 Content 不被该面板裁剪
- **AND** Escape、Backdrop 按压、modal focus trap 与关闭后的触发元素焦点恢复遵循可访问 Dialog 语义

#### Scenario: 在 Portal 中继承 Compose 外观

- **WHEN** Host 在 Dark、Light 或 token override 的 ComposeThemeProvider 下打开 ComposeDialog
- **THEN** Portal 内容自身携带解析后的 theme、locale 和 token style
- **AND** Header、Content、Close、边框、焦点和 destructive 语义使用 Compose token，且不注入全局 reset

#### Scenario: 声明更宽的一档

- **WHEN** 消费者以更宽的尺寸档渲染 ComposeDialogContent
- **THEN** 对话框按该档的宽度渲染，未声明的对话框宽度不变
