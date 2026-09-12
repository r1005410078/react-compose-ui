## ADDED Requirements

### Requirement: 文档级动作进入目录

编辑器动作目录 MUST 包含 `document.save` 与 `document.toggleAnimationMode` 两条文档级动作，
双语标签、可改键位与作用域分组同其它动作。`document.save` 的默认键位 MUST 是 `Cmd/Ctrl+S`，
MUST NOT 再由 `ComposeEditor` 的按键处理硬接——硬接的键既不出现在命令面板、也不能在设置的
键位页里改。`document.toggleAnimationMode` 默认 MUST NOT 绑定键位。

两条动作的可用性 MUST 来自既有判断：没有活动文档时 `document.save` MUST 带不可用原因而不是
静默无反应；宿主未启用页面系统因而没有动画模式入口时，`document.toggleAnimationMode`
MUST 整条省略，MUST NOT 产出调用后无反应的条目。

`document.save` 是「收走一个入口可以，收到只剩一个不可以」的直接后果——文档标签条上的保存
按钮被删掉，它必须先有第二条入口。`document.toggleAnimationMode` 不是：模式切换器不属于
工具栏货架，因此那条规则管不到它；它进目录的理由是一个改变拖动语义的开关不该只有鼠标一条
入口。

#### Scenario: 命令面板能保存

- **WHEN** 用户在有未保存改动的页面文档上打开命令面板并检索「保存」
- **THEN** 「保存文档」列出且可执行，执行后文档保存成功

#### Scenario: 保存键位可改

- **WHEN** 用户在设置的键位页把「保存文档」改绑到另一个键
- **THEN** 新键位生效，`Cmd/Ctrl+S` 不再触发保存

#### Scenario: 没有活动文档时说明原因

- **WHEN** 没有任何文档打开且用户打开命令面板
- **THEN** 「保存文档」带有不可用原因，而不是列出后按下无反应

#### Scenario: 从键盘切换动画模式

- **WHEN** 用户从命令面板执行「切换动画模式」
- **THEN** 编辑器进入动画模式，画布工具栏行尾的切换器同步显示「动画」

#### Scenario: 宿主未启用页面系统

- **WHEN** 宿主未启用页面系统因而不提供动画模式入口
- **THEN** 动作目录里没有「切换动画模式」这一条
