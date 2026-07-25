## ADDED Requirements

### Requirement: 设置入口保持布局独立

默认工作区左侧活动栏底部 MUST 提供可聚焦设置按钮。设置模态 MUST 作为 editor root 内的
sibling 渲染并只覆盖当前 Editor，不得成为 Dockview 面板、portal 到宿主页面或改变左侧
Edge Group 的展开尺寸。

#### Scenario: 从活动栏打开设置

- **WHEN** 用户通过鼠标或键盘激活左下角设置按钮
- **THEN** 编辑器范围内显示居中模态弹框与遮罩
- **AND** 当前 Edge Group、中央 Canvas 与其他面板保持挂载和原尺寸

#### Scenario: 更新设置期间保持布局

- **WHEN** 用户切换主题、语言或修改快捷键
- **THEN** Dockview group 和 panel 实例不被重建
- **AND** 用户已调整的尺寸、折叠状态与活动标签保持不变

### Requirement: 工作区主题 token

共享 UI Context 样式入口 MUST 定义可继承的 dark 与 light 工作区 token，并让 Editor、Stage、
SceneTree、History、CommandPanel、PropertyPanel、OperationLog 与基础材料 Inspector 的默认
surface、border、text、hover、selected、focus 和 scrollbar 使用这些 token。Dark MUST 保持
既有视觉层级，editor 不得依赖逐包浅色祖先覆盖。

#### Scenario: 显示浅色默认工作区

- **WHEN** ComposeEditor 解析主题为 light 并使用全部默认面板
- **THEN** 所有工作区区域使用完整浅色层级且文本、选中态与焦点态清晰可辨
- **AND** 不出现只适合深色背景的孤立内建区域或浏览器默认滚动条

#### Scenario: 保持深色视觉

- **WHEN** ComposeEditor 使用默认 dark 主题
- **THEN** 既有 Stage、Dockview 和内建面板颜色层级不发生非预期改变
- **AND** 主题 token 不重置 editor 外的宿主全局样式
