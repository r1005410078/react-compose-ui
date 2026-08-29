## ADDED Requirements

### Requirement: 命令行上报正在键入的文本与字段推进

`ComposeCommandLine` MUST 提供可选的 `onTextChange`，在缓冲变化时上报当前文本；宿主据此把
它渲染到别处（例如光标旁的数值框）。组件仍 MUST 持有那一个缓冲，MUST NOT 变成受控输入——
受控会让每一次按键都跨包往返一趟。

`ComposeCommandLine` MUST 提供可选的 `onFieldAdvance`。给出它时，`Tab` MUST 被接管：上报当前
文本、清空缓冲，且 MUST NOT 移动焦点。不给出时 `Tab` MUST 走浏览器默认行为——它是键盘用户的
焦点导航键，无条件劫持会把人困在输入框里。

本组件仍 MUST NOT 认识数值字段、参数化或任何具体命令：它只知道「有人要接管 `Tab`」。

#### Scenario: 上报正在键入的文本

- **WHEN** 用户在命令行里键入字符
- **THEN** `onTextChange` 收到当前完整文本

#### Scenario: 接管 Tab

- **WHEN** 传入 `onFieldAdvance`，用户键入 `260` 后按 `Tab`
- **THEN** `onFieldAdvance` 收到 `260`，输入框清空，焦点不动

#### Scenario: 未接管时 Tab 照常

- **WHEN** 没有传入 `onFieldAdvance`，用户按 `Tab`
- **THEN** 组件不阻止默认行为
