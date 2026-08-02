## ADDED Requirements

### Requirement: Flex 布局 Component 与紧凑 Inspector

Materials MUST 注册内建 Layout Component Definition，并让新 Container Preset 与后续附加的“容器”
能力创建浏览器初始语义的 Flex Layout。Layout Inspector MUST 紧跟变换分组，并使用两行三列卡片
依次显示方向、换行、间距、多行、主轴和交叉轴；每张卡片 MUST 在本地化标题下显示对应 CSS 属性名。

#### Scenario: 显示实际面板密度的 Flex 属性

- **WHEN** 用户选择拥有 Layout 的 Container 并展开布局分组
- **THEN** 方向、换行、间距和三个对齐组按两行三列显示
- **AND** 方向与换行保持单排，多行与主轴使用 3×2，交叉轴使用 3+2
- **AND** 所有枚举按钮使用一致大小的浏览器语义图标，并随当前 flex-direction 正确旋转轴向
- **AND** gap 只显示无单位数字输入，不显示变量绑定、链条或单位控件
- **AND** `normal` 对齐值不错误高亮任何非 normal 图标

#### Scenario: 显示状态并重置完整布局

- **WHEN** Layout 使用非默认值且 Entity 可编辑
- **THEN** 布局标题栏显示 `display: flex` 和可用的重置按钮
- **AND** 重置按钮只派发一次包含浏览器初始值的完整 `entity.component.update`
- **AND** 默认状态或只读状态禁用重置按钮

#### Scenario: 可访问地修改 Layout

- **WHEN** 用户通过指针或键盘选择方向、换行或对齐图标，或提交合法 gap
- **THEN** 对应 radiogroup 暴露本地化名称和选中状态
- **AND** 再次激活多行、主轴或交叉轴的当前选项会恢复 `normal` 并清除图标选中状态
- **AND** Inspector 只派发一次完整 Layout 的 `entity.component.update`
- **AND** 锁定、只读、负数和无效草稿不会修改文档

### Requirement: Layout Inspector 轻量预览

Layout Inspector MUST 在属性卡片末尾提供一个全宽实时预览，使用配置摘要、三个编号子节点和
主轴/交叉轴标记反馈当前 Flex 值。该预览 MUST 只属于 Inspector；Stage 与独立 Preview 在本阶段
MUST 忽略 Layout。

#### Scenario: 更新面板预览但不更新场景布局

- **WHEN** 用户修改 Flex Layout
- **THEN** Inspector 的三节点预览按最新值重新排列并显示 direction、wrap 与 gap 摘要
- **AND** 默认 `normal` 使用紧凑节点，只有明确选择 `stretch` 才将节点拉伸到交叉轴
- **AND** 预览保持清晰的主轴与交叉轴标记
- **AND** ComposeDocument 保存最新 Layout
- **AND** Stage 与独立 Preview 中的实际子项位置和尺寸保持原有 Transform 结果
