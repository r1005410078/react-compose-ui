## ADDED Requirements

### Requirement: 命令行关键字可点

`ComposeCommandLine` MUST 把 `prompt.keywords` 渲染成可点的按钮，点击 MUST 与键入那个字母
上报同一个结果。渲染形式 MUST 保持 `提示或 [闭合(C)/放弃(U)]:` 那一行——括号里的字母本身
就是操作说明，可点只是多给一条路，MUST NOT 换成下拉或工具栏。

按钮 MUST 有可访问名称，MUST NOT 只靠括号里的字母被读屏软件读出。

本组件仍 MUST NOT 认识任何具体命令：它只知道「有这些关键字」，点了哪个由宿主解释。

#### Scenario: 点关键字与键入等价

- **WHEN** 传入带关键字 `C` 的提示，用户点击那个关键字
- **THEN** 组件上报的内容与用户键入 `C` 后回车完全一致

#### Scenario: 没有关键字时不渲染按钮

- **WHEN** 提示不带关键字
- **THEN** 不渲染任何关键字按钮
