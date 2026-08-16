## ADDED Requirements

### Requirement: 双主题可读的动画面板

动画面板 MUST 只通过 `@compose-ui/ui-context` 的语义 token 表达颜色，在 light 与 dark 两种解析
主题下都保持正文、标尺、关键帧与曲线的可读对比度；包内 MUST NOT 硬编码第一方 chrome 前景色。

#### Scenario: 浅色主题下渲染时间线

- **WHEN** 宿主以 `theme="light"` 渲染时间线与属性面板
- **THEN** 标尺文字、属性行文字、曲线路径与片段条均相对背景可读
- **AND** 组件不出现浅色背景配浅色前景的组合

### Requirement: 片段与轨道的显式归属

`ComposeAnimationClip` MUST 通过必填 `trackId` 声明所属对象轨道。时间线 MUST 只在对应轨道行渲染
其片段，选择片段与选择轨道的联动 MUST NOT 依赖 label 文本或 ID 前缀匹配。

#### Scenario: 多轨道各自显示自己的片段

- **WHEN** 会话包含两条对象轨道，且每条各有一个片段
- **THEN** 每个片段只渲染在自己 `trackId` 对应的轨道行
- **AND** 选择任一片段会选中同 `trackId` 的对象轨道

### Requirement: 由宿主提供的轨道文案

包 MUST NOT 内置任何按 ID 匹配的演示文案映射。轨道与属性的显示名 MUST 直接来自会话数据的
`label`，宿主负责按自身语言提供。

#### Scenario: 自定义轨道在英文环境下显示宿主文案

- **WHEN** 宿主以 `en-US` 渲染并提供 label 为 `Opacity` 的属性轨道
- **THEN** 左侧名称列与关键帧可访问名称都显示 `Opacity`
- **AND** 组件不把它替换成任何内置文案

### Requirement: 复用共享交互组件

时间线与属性面板的按钮、数值输入与颜色字段 MUST 使用 `@compose-ui/components` 的 Primitive，
不得在包内维护第二套基础控件实现。

#### Scenario: 颜色字段使用共享取色器

- **WHEN** 用户在属性面板编辑关键帧颜色
- **THEN** 使用与其他第一方面板一致的 `ComposeColorPicker` 交互
- **AND** 键盘与焦点行为与其他面板保持一致

### Requirement: 轨道名与关键帧轨道的滚动对齐

轨道名列表与关键帧轨道 MUST 共用同一条垂直滚动，任意滚动位置与任意轨道数量下，左右两侧的同一
轨道 MUST 保持在同一行。

#### Scenario: 多轨道滚动后仍然对齐

- **WHEN** 会话包含超出可视高度的轨道并向下滚动
- **THEN** 左侧轨道名与右侧关键帧轨道保持逐行对应
- **AND** 右侧出现横向滚动条时不产生额外的纵向偏移
