## ADDED Requirements

### Requirement: 受控工具模式与专属选区反馈

Stage MUST 支持受控的 `select`、`move`、`scale`、`rotate`、`pan`、`draw-container`、
`draw-rectangle`、`draw-line`、`draw-arrow`、`draw-circle` 与 `draw-text` 工具，并通过既有
`onToolChange` 请求切换。`select` MUST 保持普通选择箭头、四角缩放和本体移动；`move` 激活时才显示
红 X/绿 Y 移动 gizmo；`scale` 与 `rotate` MUST 只暴露各自变换命中。

#### Scenario: 选择工具显示四角与边缘缩放

- **WHEN** 可 resize 的 Entity 在 select 工具中被选中
- **THEN** Overlay 只渲染四个角上的小方块
- **AND** 选择框边缘的 hover 提供对应方向 resize cursor，而不显示中点方块

#### Scenario: 精确移动工具显示轴 gizmo

- **WHEN** move 工具激活且存在可移动的选择
- **THEN** Overlay 在选择的左上显示向右的红 X 与向下的绿 Y gizmo
- **AND** 拖动任一轴只修改相应坐标轴，切换到其他工具后 gizmo 消失

#### Scenario: 旋转与缩放工具隔离命中

- **WHEN** 用户分别激活 scale 或 rotate 工具
- **THEN** 前者只能启动 resize，后者只能启动 rotate
- **AND** select 与 pan 的既有选择和视口行为不被拦截

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、line、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在
拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击或拖拽绘制文字

- **WHEN** 用户使用 text 工具点击或拖拽 surface
- **THEN** click 使用 Text Preset 默认尺寸插入，drag 使用拖拽 bounds 创建 text box
- **AND** Escape、pointercancel 或无效 geometry 不创建 Entity

### Requirement: 两点 Shape 的端点选区

当且仅当单选可编辑的 Shape Renderer Line 或 Arrow 时，Stage MUST 使用其真实首尾世界坐标绘制蓝色线段、
两个白底蓝边端点控制点及 `长度 × 0` 浮标。它 MUST 不渲染通用矩形 selection bounds、边缘 hit area 或四角
缩放点；普通 Entity 继续使用通用选区。

#### Scenario: 单选 Line 或 Arrow

- **WHEN** 用户在 select、scale、move 或 rotate 工具中单选 Line 或 Arrow
- **THEN** 选区始终沿真实线段显示，且没有矩形选框
- **AND** 仅 select/scale 工具中的首尾控制点可启动 resize，move/rotate 保留各自专属手势

#### Scenario: 拖拽端点并越过另一端

- **WHEN** 用户拖动首端或尾端，并把它越过另一端
- **THEN** 未拖动端保持固定，预览持续跟随指针和 snap
- **AND** 松手以一个可撤销 batch 更新空间几何与 Shape `direction`，marker 始终附着在对应语义端点

## MODIFIED Requirements

### Requirement: 直接移动缩放与旋转

Stage MUST 只允许当前工具暴露的 move、resize 或 rotate 手势；每种变换 MUST 在拖动或方向键移动 Flow 时把它
转换为 Absolute 后移动，不得在 Stage 重排 Flow。Resize Fill axis MUST 转为 Fixed；Rotation MUST 保持 Flow
与 sizing。全部操作 MUST 使用开始 Snapshot 并维持现有 preview/cancel/一次提交保证。

#### Scenario: 拖动 Flow 转为 Absolute

- **WHEN** 用户在允许移动的 Stage 工具中拖动一个或多个 Flow Entity 并正常松手
- **THEN** preview 保持开始世界几何并跟随指针，提交后目标为 Absolute final offset
- **AND** Hierarchy.childIds 顺序不因 Stage 拖动改变

#### Scenario: Flow 结构操作禁用

- **WHEN** 当前 Group/Ungroup 目标包含 Flow Entity
- **THEN** 菜单和快捷键使用相同 availability 禁用该操作并提供可读原因
- **AND** Delete、Lock、Visibility 与 Rotation 仍按各自能力执行
