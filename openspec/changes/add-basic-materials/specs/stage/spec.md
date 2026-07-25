## ADDED Requirements

### Requirement: Frame Palette 拖入

ComponentPalette MUST 可以在 registry components 前显示 Frame presets。StageDragController MUST
以附加 API 支持 Frame Pointer 与键盘新增，同时保持既有 componentType API；Frame drop MUST
创建真正的根级 Frame。

#### Scenario: Pointer 居中创建根 Frame

- **WHEN** 用户把 Frame preset 拖到任意 Stage 屏幕位置
- **THEN** Stage 在对应世界点居中创建根级 Frame并追加到 rootIds
- **AND** 新 Frame 被选中并成为 activeFrame，不会嵌套进已有 Frame

#### Scenario: 键盘新增 Frame

- **WHEN** 键盘用户激活 Frame Palette 项
- **THEN** Frame 在当前 viewport 世界中心创建
- **AND** 只产生一个 frame.create 事务

#### Scenario: 保持 Component 拖入兼容

- **WHEN** 旧宿主继续调用 StageDragController 的 start/add componentType 方法
- **THEN** Component 仍只允许创建在有效未锁定 Frame 内
- **AND** Frame presets 不改变旧 drop target 方法签名

### Requirement: Stage 统一节点样式

Stage MUST 对 Frame、Group 与 Component wrapper 应用 resolved node style。Style border MUST NOT
改变文档几何；Frame/Component MUST 保持裁剪，Group MUST 保持可见子节点的原溢出语义。

#### Scenario: 渲染通用节点样式

- **WHEN** 三种节点包含背景、边框、圆角、透明度或 shadow
- **THEN** Stage 在对应节点边界渲染样式
- **AND** 选区、手柄、吸附和世界坐标不因边框宽度改变
