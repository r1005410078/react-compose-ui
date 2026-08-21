## ADDED Requirements

### Requirement: 缓动预设与曲线编辑器

包 MUST 导出一个受控的缓动曲线编辑器组件与一张缓动预设表。预设表 MUST 覆盖 Hold、Linear、
Ease in、Ease out、Ease in and out、Ease in back、Ease out back、Ease in and out back，
且每个预设 MUST 只用现有的 `hold`、`linear` 或 `cubic` 判别联合表达，MUST NOT 为此扩展插值
协议。当前插值与任一预设在 1e-6 容差内不匹配时，编辑器 MUST 显示为 Custom bezier。

编辑器 MUST 同时提供三条等价的编辑路径：选择预设、拖拽曲线画布上的两个控制柄、以及提交单行
逗号分隔的控制点数值（形如 `0.5, 0, 0.5, 1`）。拖拽或键盘调节控制柄时，x 分量 MUST 钳制到
`[0, 1]` 以保证时间轴单调，y 分量 MUST 允许越界以表达回弹缓动。数值输入解析失败时 MUST 回滚
到提交前的值。每一次改动 MUST 通过受控回调向宿主报告完整的插值值；组件 MUST NOT 自行保存
除拖拽会话之外的状态，也 MUST NOT 依赖 `@compose-ui/core` 或任何文档协议。

#### Scenario: 选择预设写入对应控制点

- **WHEN** 用户在缓动预设中选择 Ease in and out
- **THEN** 曲线更新为 `cubic-bezier(0.42, 0, 0.58, 1)`，数值行显示 `0.42, 0, 0.58, 1`
- **AND** 宿主收到 `cubic` 插值与该组控制点

#### Scenario: 回弹预设允许 y 越界

- **WHEN** 用户选择 Ease out back
- **THEN** 曲线在段末越过终点值再回落，控制点 y 分量大于 1 时不被钳制

#### Scenario: 拖拽控制柄落到 Custom bezier

- **WHEN** 当前是 Ease in 预设，用户拖动第一个控制柄
- **THEN** x 分量停留在 `[0, 1]` 内，预设显示切换为 Custom bezier
- **AND** 宿主在拖动过程中持续收到更新后的控制点

#### Scenario: 键盘微调控制柄

- **WHEN** 用户聚焦某个控制柄并按方向键，或按住 Shift 再按方向键
- **THEN** 对应分量分别以 0.01 与 0.1 步进调整，且控制柄具有本地化 accessible name

#### Scenario: 非法数值回滚

- **WHEN** 用户把数值行改成 `0.5, 0, abc` 并提交
- **THEN** 数值行恢复提交前的四个控制点，宿主不收到任何插值更新

## MODIFIED Requirements

### Requirement: 关键帧间的插值曲线段

系统 MUST 在同一属性轨道的相邻关键帧之间渲染可交互的插值曲线段。曲线段的中点曲线标识 MUST 在
悬停、键盘聚焦或选中时显示。插值挂在关键帧的**出向段**，因此选择曲线段 MUST 选中该段的**起点**
关键帧，并在右侧属性面板显示该段的时间范围与该起点关键帧的插值；该操作不得移动预览播放头。

#### Scenario: 选择关键帧间的曲线段

- **WHEN** 用户悬停或选择 200 ms 与 300 ms 关键帧之间的曲线段，并点击该段或中点曲线标识
- **THEN** 该段显示曲线标识，右侧属性面板选中 200 ms 关键帧并显示 `200 ms → 300 ms` 曲线区间
- **AND** 缓动编辑区显示 200 ms 关键帧的插值，且播放头保持在点击前的时间

### Requirement: 参考图一致的可访问视觉结构

系统 MUST 使用共享 Theme/I18n token 表达全部颜色，MUST NOT 硬编码第一方 chrome 前景色，
并在 light 与 dark 两种解析主题下都保持正文、标尺、关键帧与曲线的可读对比度。视觉结构
MUST 保持顶部控制栏、固定轨道列表、可横向滚动的标尺、播放头、菱形关键帧、右侧字段和
缓动编辑区。缓动编辑区 MUST NOT 出现协议不支持的编辑器标签（例如弹簧）。可交互控件必须具有
本地化 accessible name、可见焦点和键盘操作。

#### Scenario: 键盘调整播放头

- **WHEN** 用户聚焦播放头并按 ArrowLeft、ArrowRight、Home 或 End
- **THEN** 播放头分别按 10 ms 调整、跳至 0 ms 或跳至当前时长
- **AND** 右侧时间字段和可访问状态文字同步更新

#### Scenario: 浅色主题下渲染时间线

- **WHEN** 宿主以 light 主题渲染时间线与属性面板
- **THEN** 标尺文字、属性行文字、曲线路径与片段条均相对背景可读
- **AND** 组件不出现浅色背景配浅色前景的组合

#### Scenario: 会话不再携带缓动编辑器标签

- **WHEN** 宿主构造面板会话值
- **THEN** 会话值不包含缓动编辑器标签字段，会话上下文也不提供切换该标签的方法

### Requirement: 宿主驱动的关键帧值与插值模型

`ComposeAnimationKeyframe.value` MUST 支持数值、二维向量与颜色字符串；
`ComposeAnimationPropertyTrack` MUST 声明 `valueKind` 以确定该轨道的值语义与展示格式。
`ComposeAnimationKeyframe.interpolation` MUST 是 `hold`、`linear` 或带四元控制点的 `cubic`
判别联合。右侧属性面板 MUST 按 `valueKind` 选择对应的值编辑控件，MUST NOT 把所有值当作颜色处理。
选中关键帧的插值 MUST 通过缓动预设、曲线控制柄或单行控制点数值编辑，改动 MUST 经 `onAction`
报告给宿主。属性面板显示的插值区间 MUST 表达出向语义，即「本帧 → 下一帧」。
包 MUST NOT 因此依赖 `@compose-ui/core`、`@compose-ui/animation` 或任何文档协议。

#### Scenario: 数值轨道显示数值输入

- **WHEN** 宿主提供一条 `valueKind` 为数值的轨道并选中其中一个关键帧
- **THEN** 右侧值字段是数值输入，而不是十六进制颜色输入

#### Scenario: 二维向量轨道显示两个分量

- **WHEN** 宿主提供一条二维向量轨道并选中其中一个关键帧
- **THEN** 右侧同时显示 X 与 Y 两个可编辑分量

#### Scenario: 选择 cubic 插值后可编辑控制点

- **WHEN** 用户把选中关键帧的插值改为 `cubic`
- **THEN** 缓动编辑区出现曲线画布与单行控制点数值，修改后通过 `onAction` 报告给宿主

#### Scenario: 插值区间按出向语义显示

- **WHEN** 用户选中 200 ms 的关键帧，同一属性轨道的下一个关键帧在 300 ms
- **THEN** 属性面板显示的插值区间是 `200 ms → 300 ms`
