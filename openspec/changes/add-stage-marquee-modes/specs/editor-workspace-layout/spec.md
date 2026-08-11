## ADDED Requirements

### Requirement: 框选工具与判定模式菜单

默认舞台工具栏 MUST 在交互工具分组内提供框选工具入口：主按钮切换到 marquee 工具，紧邻的
chevron 触发器打开判定模式菜单。模式菜单 MUST 提供相交、包含与方向决定三项，且 MUST 复用现有
形状工具 split button 的 ARIA 与键盘结构——触发器使用 `aria-haspopup="menu"` 与
`aria-expanded`，菜单项使用 `menuitemradio` 并通过 `aria-pressed` 表达当前模式，方向键在菜单项
之间移动焦点，Escape 关闭菜单并把焦点还给触发器。模式 MUST 由编辑器持有并作为受控值传给
Stage，选择模式本身 MUST NOT 切换当前工具，也 MUST NOT 产生文档事务。主按钮图标 MUST 反映当前
模式，使用户不展开菜单也能看出生效判定。

#### Scenario: 切换到框选工具

- **WHEN** 用户点击框选主按钮
- **THEN** Stage 工具变为 marquee 且按钮呈现选中态
- **AND** 当前判定模式保持不变

#### Scenario: 从菜单切换判定模式

- **WHEN** 用户展开模式菜单并选择包含
- **THEN** Stage 收到的受控模式变为包含
- **AND** 菜单关闭、焦点回到触发器、当前工具保持不变
- **AND** 主按钮图标切换为包含模式图标

#### Scenario: 键盘操作模式菜单

- **WHEN** 焦点位于 chevron 触发器且用户按下方向键下
- **THEN** 菜单展开并把焦点移到第一项
- **AND** 按 Escape 关闭菜单并把焦点还给触发器

#### Scenario: 模式在选择工具下同样生效

- **WHEN** 判定模式为包含且用户切回 select 工具从空白拖出 marquee
- **THEN** 框选按包含判定命中节点
