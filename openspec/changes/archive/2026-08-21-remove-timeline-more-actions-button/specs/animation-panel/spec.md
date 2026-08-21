# animation-panel 规范增量

## MODIFIED Requirements

### Requirement: 更多操作菜单

对象行与属性行 MUST 通过在行上按下右键打开更多操作菜单，指针入口 MUST 只有右键这一个。行上
MUST NOT 渲染独立的「更多操作」按钮，也 MUST NOT 为这样的按钮保留常驻占位宽度。

键盘 MUST 有等价入口：焦点位于行的命中按钮上时，Shift+F10 与 ContextMenu 键 MUST 打开同一份
菜单。面板 MUST 自己处理这两个按键，MUST NOT 依赖浏览器把它们翻译成 `contextmenu` 事件——
Chromium 只对独立的 ContextMenu 键这么做，而 Mac 键盘上没有该键，仅靠浏览器翻译会让 macOS
用户完全失去键盘路径。键盘触发时菜单的锚点 MUST 由该行的矩形推出，因为键盘事件不携带有意义
的指针坐标。

关键帧车道与单个关键帧上的右键 MUST 额外提供依赖光标时间位置的条目；对象行与属性行标签区域
的右键 MUST NOT 提供这些条目，因为行不表达时间位置。

菜单 MUST 使用 `ComposeContextMenu`，关闭后 MUST 把焦点恢复到打开它的那一行的命中按钮。面板
MUST NOT 在菜单中实现任何文档语义，所有条目 MUST 通过 `onAction` 发出语义动作；删除属性轨道、
删除某个对象的全部轨道，以及在指定时间打点（值由宿主决定）MUST 各有对应的动作类型。

#### Scenario: 行上不存在更多操作按钮

- **WHEN** 用户悬停在某一条对象行或属性行上，或把焦点移入该行
- **THEN** 该行不出现任何「更多操作」按钮
- **AND** 行尾没有为该按钮保留的空位，数值区可以一直排到行的右边界

#### Scenario: 右键打开行菜单并能删除属性轨道

- **WHEN** 用户在一条属性行上按下右键
- **THEN** 菜单打开并包含删除该属性轨道的条目
- **AND** 菜单中不含任何依赖光标时间位置的条目

#### Scenario: 键盘用 Shift+F10 打开同一份菜单

- **WHEN** 用户把焦点移到某一行的命中按钮并按下 Shift+F10 或 ContextMenu 键
- **THEN** 打开的菜单与在该行按下右键得到的菜单条目完全相同
- **AND** 该行为在浏览器不把 Shift+F10 翻译成 `contextmenu` 的平台上同样成立
- **AND** 菜单关闭后焦点回到该行的命中按钮
