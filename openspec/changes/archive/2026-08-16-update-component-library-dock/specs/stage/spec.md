## ADDED Requirements

### Requirement: 基础组件分类九宫格

`ComposeComponentPalette` MUST 将所有未隐藏的 Registry Preset 显示在本地化“基础 (N)”可折叠
分类下，并以紧凑的响应式等尺寸网格呈现。网格 MUST 在可用宽度不足时自动将 Tile 排到下一行。每个 Tile MUST 使用与 Preset 类型对应的一致矢量图标、保留
名称、点击新增和拖入 Stage 的既有行为；Palette 不得修改 Registry 顺序、Preset 定义或 ComposeDocument。

#### Scenario: 展示基础组件网格

- **WHEN** Palette 接收到五个可见 Preset
- **THEN** 显示一个名称为“基础 (5)”的可聚焦分类控制项
- **AND** 展开时按 Registry 顺序显示五个 Preset Tile，并根据面板可用宽度自动换行
- **AND** 每个 Tile 占用相同的网格尺寸，图标的视觉尺寸一致
- **AND** 隐藏的 Preset 不计入分类数量，也不显示 Tile

#### Scenario: 折叠基础组件分类

- **WHEN** 用户激活已展开的“基础 (N)”分类控制项
- **THEN** 分类控制项反映折叠状态，且其 Preset Tile 不再可见
- **WHEN** 用户再次激活该控制项
- **THEN** Tile 恢复显示，顺序和可访问名称保持不变

#### Scenario: 从网格新增 Preset

- **WHEN** 用户点击或拖动任一 Preset Tile 到 Stage
- **THEN** 系统沿用既有 `external.add` 或 `external.drop` 流程创建对应 Preset
- **AND** 不产生旧 Frame/Component Node，也不写入 Palette 的展开状态

#### Scenario: 拖动预览跟随指针

- **WHEN** 用户从 Preset Tile 开始拖动，且指针越过既有拖动阈值
- **THEN** Palette 显示不拦截指针的半透明 Preset 占位预览，并跟随最新 client pointer 位置
- **WHEN** 用户取消或结束拖动
- **THEN** 占位预览立即消失，且只有有效 drop 才会改变文档
