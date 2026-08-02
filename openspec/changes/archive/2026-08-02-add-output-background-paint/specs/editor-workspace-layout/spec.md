## MODIFIED Requirements

### Requirement: 隐式 Canvas Inspector

Editor MUST 把 output inspection 作为不进入文档的会话目标，并在右侧 Properties 面板显示输出
宽度、高度和结构化背景 Paint。节点选择、SceneTree 选择与输出检查 MUST 互斥；Canvas 不得出现在
SceneTree 或 selectedIds。Canvas 背景 MUST 使用既有 `paint` 属性编辑器，但不得连接实体的渐变画布
控制柄或图层取色会话。

#### Scenario: 点击输出并编辑背景 Paint

- **WHEN** 用户点击 Stage 输出区域，并把背景从 Solid 改为任一合法 Gradient
- **THEN** 右侧显示 Canvas Inspector，且每次确认只提交一个可逆 `output.configure` 事务
- **AND** Undo/Redo 更新 Inspector 值并保持 output inspection 激活

#### Scenario: 使用常见桌面尺寸

- **WHEN** 用户选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Inspector 一次更新宽高并提交一个 output.configure 事务
- **AND** 用户仍可输入任意合法自定义尺寸

#### Scenario: 分离输出与编辑辅助设置

- **WHEN** 用户打开工具栏画布设置
- **THEN** 弹层只显示网格、吸附和辅助线设置
- **AND** 输出尺寸与背景只在 Canvas Inspector 编辑
