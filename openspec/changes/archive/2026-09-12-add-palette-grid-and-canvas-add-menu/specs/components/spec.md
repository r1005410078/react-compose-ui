## MODIFIED Requirements

### Requirement: 共享 ContextMenu 与运行时右键 Hook

`@compose-ui/components` MUST 提供 Shadcn/Base UI 源码适配的 Compose 命名 ContextMenu 组合部件，
包括 Root、Trigger、Content、Item、Separator、Group、Label、Checkbox、Radio、Shortcut 与 Submenu。
包 MUST 同时导出 `useComposeContextMenu<T>`，让虚拟化或委托事件可以用右键事件或显式屏幕坐标打开
受控菜单，并保留当前 payload。原始 Base UI ContextMenu 符号不得成为公共 API。

**菜单的字号 MUST 与编辑器 chrome 同一档**：菜单项 13px、行高 28px，快捷键与分组标题 12px。
Shadcn 默认的 `text-sm`（14px）与 32px 行高是为独立页面定的，而这块界面比它密一档——场景树行
13px、命令行 13px、物料行与面板标签 12px，菜单按默认值就是界面上最大的一号字。图标 MUST 仍是
16px：字缩一档而图标是形状，跟着缩只会更难认。行高比行内列表宽一档，是因为菜单项是**指针
目标**，而树行还有键盘导航兜底。

#### Scenario: 用声明式 Trigger 打开共享菜单

- **WHEN** 消费者使用 `ComposeContextMenu`、`ComposeContextMenuTrigger` 与 Content 组合右键区域
- **THEN** 浏览器原生右键菜单被抑制，菜单在指针附近通过 Portal 打开
- **AND** Escape、菜单外按压、菜单项执行和 roving focus 遵循可访问菜单语义

#### Scenario: 用 Hook 在动态目标处打开菜单

- **WHEN** 消费者调用 `useComposeContextMenu<T>()` 返回的 `openAt`，并传入 React/DOM 右键事件或
  `{ x, y }` 与 payload
- **THEN** Hook 暴露的 `rootProps`、`open`、`anchorPoint` 与 `payload` 反映该次调用
- **AND** 新调用替换旧 payload，关闭时清除 payload 与锚点，并在可行时恢复触发元素焦点

#### Scenario: 在 Portal 中继承 Compose 外观

- **WHEN** Host 在 Dark、Light 或 token override 的 `ComposeThemeProvider` 下打开 ContextMenu
- **THEN** Portal 菜单自身携带解析后的 theme、locale 和 token style
- **AND** 普通、禁用和 destructive 项使用 Compose 语义色，且样式不引入全局 reset 或第二套主题状态

#### Scenario: 菜单字号与周围 chrome 一致

- **WHEN** 用户在编辑器里打开任意共享右键菜单
- **THEN** 菜单项是 13px / 28px 行高，快捷键 12px，图标仍是 16px

#### Scenario: 深色画布上浮层读得出分界

- **WHEN** 在 Dark 主题的画布上打开菜单
- **THEN** 浮层带自己的投影，与图面之间读得出一条分界，而不是贴在画布上
