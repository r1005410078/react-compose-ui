## MODIFIED Requirements

### Requirement: 设置模态弹框

编辑器 MUST 通过左下角真实 button 打开使用 `@compose-ui/components` ComposeDialog 的全视口设置模态。
弹框 MUST 提供顶部全局搜索、左侧外观/语言/键盘快捷方式分类、右侧设置内容和关闭按钮。设置按钮
MUST 提供 aria-haspopup、aria-expanded 与 aria-controls；弹框 MUST 管理焦点陷阱且不得重建 Dockview。

#### Scenario: 打开和关闭设置

- **WHEN** 用户点击齿轮、按 primary+Comma 或再次执行当前设置快捷键
- **THEN** 模态弹框打开或关闭，按钮 expanded 状态同步且 Dockview 在打开期间 inert
- **AND** 打开时焦点进入搜索框并限制在弹框内，关闭时焦点恢复到齿轮

#### Scenario: 使用 Escape 关闭设置

- **WHEN** 设置弹框打开且用户按 Escape、点击遮罩或关闭按钮
- **THEN** 弹框关闭且 Dockview 尺寸与活动面板保持不变
- **AND** 快捷键捕获期间 Escape 只取消捕获并保持弹框打开

#### Scenario: 搜索设置

- **WHEN** 用户输入匹配动作、外观或语言名称的检索词
- **THEN** 右侧改为跨分类结果并只显示匹配项
- **AND** 点击左侧分类会清空检索并只显示该分类，重新打开默认显示外观
