## MODIFIED Requirements

### Requirement: Controller 驱动的默认组合

默认 Editor controller MUST 派生任意根 SceneTree、Stage 与 Inspector，并不得公开或维护
activeFrameId。Frame 适配目标和新增父级 MUST 从选择及 SceneIndex 推导；删除/历史导航后选择与
展开项继续清理。

#### Scenario: 使用任意根工作区

- **WHEN** 文档根同时包含 Component 与 Frame
- **THEN** SceneTree、Stage、选择和 Inspector 显示相同完整拓扑
- **AND** controller 公共结果不包含 activeFrameId/setActiveFrameId

### Requirement: Frame presets 与结构节点 Inspector

默认 Editor MUST 使用 Frame preset 创建根级或嵌套 Frame，并只把 Frame 交给 Container
Inspector。SceneTree 的根新增和子级新增 MUST 都创建 Frame，不得生成 Group。

#### Scenario: 在根和 Frame 内新增 Frame

- **WHEN** SceneTree 分别请求根新增和 Frame 子级新增
- **THEN** node.create 在对应 parentId 创建带 clipContent 的 Frame
- **AND** 新节点被选择并可继续包含 Frame/Component

### Requirement: Stage 吸附工具栏

默认工具栏的画布设置 MUST 只编辑 canvas 网格、吸附与辅助线草稿；应用多个变化时提交一个
原子事务，取消或校验失败不得修改文档。output MUST 改由隐式 Canvas Inspector 编辑。适配
Frame MUST 从当前选择或最近 Frame 祖先推导。

#### Scenario: 原子修改网格和辅助线

- **WHEN** 用户同时修改网格并清空辅助线后应用
- **THEN** 文档通过一个 batch 事务更新全部设置
- **AND** 一次 undo 恢复应用前状态

## ADDED Requirements

### Requirement: 隐式 Canvas Inspector

Editor MUST 把 output inspection 作为不进入文档的会话目标，并在右侧 Properties 面板显示输出
宽度、高度和背景。节点选择、SceneTree 选择与输出检查 MUST 互斥；Canvas 不得出现在 SceneTree
或 selectedIds。

#### Scenario: 点击输出并编辑属性

- **WHEN** 用户点击 Stage 输出区域并修改合法宽高或背景
- **THEN** 右侧显示 Canvas Inspector，且每次确认只提交一个可逆 output.configure 事务
- **AND** Undo/Redo 更新 Inspector 值并保持 output inspection 激活

#### Scenario: 使用常见桌面尺寸

- **WHEN** 用户选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Inspector 一次更新宽高并提交一个 output.configure 事务
- **AND** 用户仍可输入任意合法自定义尺寸

#### Scenario: 分离输出与编辑辅助设置

- **WHEN** 用户打开工具栏画布设置
- **THEN** 弹层只显示网格、吸附和辅助线设置
- **AND** 输出尺寸与背景只在 Canvas Inspector 编辑
