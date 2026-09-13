## ADDED Requirements

### Requirement: 十字光标样式是编辑器偏好

`ComposeEditorPreferences` MUST 包含 `crosshairStyle: 'fade' | 'halo'`，默认 `fade`。
规范化时字段缺席或取值不在这两者之内 MUST 回落 `fade`，MUST NOT 让整份偏好无效。

它 MUST 是用户偏好而不是工作区会话开关：跨工作区、跨文档生效，切换工作区 MUST NOT 改变它，
另存工作区 MUST NOT 把它抄进工作区定义。它 MUST NOT 写文档、MUST NOT 进撤销历史。

编辑器 MUST 把当前样式交给 Stage（经 controller 的 `crosshairStyle` / `setCrosshairStyle`）；
宿主传入的 controller 缺 `setCrosshairStyle` 时编辑器 MUST 跳过同步而不是报错。臂长
（`crosshairSize`）仍是工作区会话开关，本偏好 MUST NOT 改动它。

#### Scenario: 默认渐隐

- **WHEN** 宿主不提供受控 preferences 并挂载 ComposeEditor
- **THEN** `crosshairStyle` 为 `fade`，Stage 画渐隐十字线

#### Scenario: 旧偏好缺这一段

- **WHEN** 宿主回传的 preferences 没有 `crosshairStyle`，或它的值不是 `fade` / `halo`
- **THEN** 规范化后为 `fade`，不报错

#### Scenario: 切成晕圈

- **WHEN** 用户在设置里选择「晕圈」
- **THEN** onPreferencesChange 收到 `crosshairStyle: 'halo'` 的完整规范化偏好
- **AND** controller 的 `crosshairStyle` 变为 `halo`，Stage 随之画晕圈
- **AND** 不产生文档事务、会话历史或操作日志

## MODIFIED Requirements

### Requirement: 设置模态弹框

编辑器 MUST 通过左下角真实 button 打开使用 `@compose-ui/components` ComposeDialog 的全视口设置模态。
弹框 MUST 提供顶部全局搜索、左侧外观/语言/画布/键盘快捷方式分类、右侧设置内容和关闭按钮。设置按钮
MUST 提供 aria-haspopup、aria-expanded 与 aria-controls；弹框 MUST 管理焦点陷阱且不得重建 Dockview。

「画布」分类 MUST 含「十字光标」一节：两张单选卡（渐隐 · 默认 / 晕圈）与一段说明。单选卡
MUST 沿用外观那一行的样式并即时生效，MUST NOT 另设「应用」按钮。搜索 MUST 能以「画布」
「十字光标」「渐隐」「晕圈」命中这一节；搜索框占位文案 MUST 提到画布。

#### Scenario: 打开和关闭设置

- **WHEN** 用户点击齿轮、按 primary+Comma 或再次执行当前设置快捷键
- **THEN** 模态弹框打开或关闭，按钮 expanded 状态同步且 Dockview 在打开期间 inert
- **AND** 打开时焦点进入搜索框并限制在弹框内，关闭时焦点恢复到齿轮

#### Scenario: 使用 Escape 关闭设置

- **WHEN** 设置弹框打开且用户按 Escape、点击遮罩或关闭按钮
- **THEN** 弹框关闭且 Dockview 尺寸与活动面板保持不变
- **AND** 快捷键捕获期间 Escape 只取消捕获并保持弹框打开

#### Scenario: 搜索设置

- **WHEN** 用户输入匹配动作、外观、语言或画布名称的检索词
- **THEN** 右侧改为跨分类结果并只显示匹配项
- **AND** 点击左侧分类会清空检索并只显示该分类，重新打开默认显示外观

#### Scenario: 从画布分类切换十字光标样式

- **WHEN** 用户点击左侧「画布」并选择「晕圈」
- **THEN** 右侧只显示画布分类，「晕圈」单选卡为选中态
- **AND** 偏好里的 `crosshairStyle` 变为 `halo`
