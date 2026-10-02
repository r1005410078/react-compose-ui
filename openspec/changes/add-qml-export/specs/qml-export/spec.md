## ADDED Requirements

### Requirement: QML 导出包边界

`@compose-ui/qml-export` MUST 是无 React、无 DOM 的纯函数包，且 MUST 只依赖 `@compose-ui/core`。
它 MUST NOT 执行布局求解、读取文件系统或写盘；产物 MUST 是 QML 文本与诊断列表。

#### Scenario: 边界检查

- **WHEN** 运行架构边界检查
- **THEN** `qml-export` 对 `core` 以外任何 `@compose-ui/*` 包或 React 的依赖都被拒绝

### Requirement: 以求解结果为输入的绝对定位导出

导出 MUST 以「已解算文档 + 布局快照」为输入，并以快照中的盒子为每个导出对象写出绝对的
`x`、`y`、`width`、`height`。导出 MUST NOT 把 Auto Layout、Grid 或 Hug 翻译成 Qt Quick 的布局类型。

#### Scenario: Auto Layout 容器

- **WHEN** 导出一个含三个子项、横向 Auto Layout 且有 gap 的容器
- **THEN** 三个子项在 QML 中各自以快照里的坐标与尺寸定位
- **AND** QML 中不出现 `RowLayout`、`ColumnLayout` 或 `GridLayout`

#### Scenario: 导线端点跟随

- **WHEN** 场景里一条导线的端点绑定在某个符号的端口上
- **THEN** 导出的线段端点等于已解算文档里的端点位置

### Requirement: 场景、容器与 Group 映射

导出 MUST 把目标 Frame 映射为尺寸等于 `Frame.size` 的根 `Item`；带 `Appearance` 的容器与盒物料
MUST 映射为 `Rectangle`，写出底色、边框颜色与宽度、圆角与不透明度；`Clip` 存在且裁剪时 MUST 写出
`clip: true`，缺席时 MUST NOT 裁剪；Group MUST 映射为不绘制任何内容的 `Item`。子级 MUST 按
`Hierarchy` 顺序声明以保持层序。

#### Scenario: 带圆角描边的容器

- **WHEN** 导出一个底色 `#1e293b`、边框 `#334155` 宽 1、圆角 8 的容器
- **THEN** QML 中对应 `Rectangle` 的 `color`、`border.color`、`border.width`、`radius` 分别等于这些值

#### Scenario: 未声明 Clip 的场景

- **WHEN** 场景 Frame 没有 `Clip` Component 且子级超出边界
- **THEN** 根 `Item` 不写 `clip: true`

### Requirement: 曲线映射

带 `Curve` 的 Entity MUST 映射为 `Shape` 与 `ShapePath`，几何 MUST 经 `projectComposeCurveToBox`
投影到盒坐标，带 `cornerRadius` 的多段线 MUST 经 `composePolylineOutline` 展开，填充 MUST 读
`getComposeCurveFill`。`fillRule: 'evenodd'` MUST 映射为奇偶填充，缺席 MUST 映射为非零填充。
虚线长度与偏移 MUST 换算为以线宽为单位；端点箭头 MUST 以额外的填充路径绘出。

#### Scenario: 非等比盒中的弧

- **WHEN** 一段弧所在盒被非等比拉伸
- **THEN** 导出的路径与 `projectComposeCurveToBox` 给出的折线一致

#### Scenario: 虚线换算

- **WHEN** 曲线线宽为 2、`strokeDasharray` 为 `8 4`
- **THEN** QML 中 `dashPattern` 为 `[4, 2]`

#### Scenario: 带洞路径

- **WHEN** 一条 `path` 含两条子路径且 `fillRule` 为 `evenodd`
- **THEN** 两条子路径写在同一个 `ShapePath` 中且使用奇偶填充

#### Scenario: 整圆

- **WHEN** 导出一段扫掠角绝对值为 360 的弧
- **THEN** 路径由两段半圆弧组成，画出完整的圆

### Requirement: 文字映射

文字 MUST 映射为 `Text`，字号 MUST 使用 `font.pixelSize`；盒子 MUST 写死为快照尺寸；Hug 宽度的文字
MUST 不换行，固定宽度的文字 MUST 允许在任意字符处换行；`lineHeight` 有值时 MUST 使用固定行高，
缺席时 MUST 使用引擎默认行高。水平与垂直对齐 MUST 按文字属性映射。

#### Scenario: Hug 文字

- **WHEN** 导出一段宽度为 Hug 的文字
- **THEN** 对应 `Text` 的宽高等于快照里的测量结果且 `wrapMode` 为不换行

#### Scenario: 固定宽度的中文段落

- **WHEN** 导出一段固定宽度、行高 24px 的中文文字
- **THEN** `wrapMode` 允许任意字符换行，`lineHeightMode` 为固定高度且 `lineHeight` 为 24

### Requirement: 旋转与基点

带旋转的 Entity MUST 以 `Rotation` 变换导出，其原点 MUST 等于 `getComposeTransformPivot` 给出的
归一化基点乘以盒尺寸，且 MUST NOT 钳制到盒内。

#### Scenario: 左边中点为基点

- **WHEN** 一个 100 × 40 的矩形旋转 30 度且基点为 `{x: 0, y: 0.5}`
- **THEN** 导出的 `Rotation` 原点为 `(0, 20)`、角度为 30

### Requirement: 组件实例内联展开

组件实例 MUST 以其已解算的嵌套文档内联展开为一棵子树，坐标相对实例盒。宿主未提供某个实例的
嵌套解算结果时，该实例 MUST 导出为同尺寸的占位矩形并产出诊断。

#### Scenario: 缺少嵌套解算结果

- **WHEN** 输入中缺少某个组件实例的嵌套文档
- **THEN** 该位置导出同尺寸占位矩形
- **AND** 诊断中包含该实例的 Entity ID

### Requirement: 不支持内容的降级

无法表达的内容 MUST 降级导出并产出诊断，MUST NOT 静默丢弃元素：渐变取中位色标的纯色；阴影
忽略；图片、SVG、图表与未知 Renderer 导出为同尺寸占位矩形；动画按静态姿态导出；被绑定的
Renderer prop 写入文档中的当前值。

#### Scenario: 渐变背景

- **WHEN** 一个容器的 `backgroundPaint` 是线性渐变
- **THEN** 导出为中位色标的纯色 `Rectangle`
- **AND** 诊断说明该容器的渐变被降级

#### Scenario: 图表物料

- **WHEN** 场景中有一个图表
- **THEN** 该位置导出同尺寸占位矩形并产出诊断，场景中其余对象照常导出

### Requirement: 确定性输出

对同一输入，导出 MUST 产出逐字节相同的 QML。QML `id` MUST 由 Entity ID 确定性推出，`objectName`
MUST 写入原始 Entity ID；数值 MUST 使用核心的几何数值格式化（最多两位小数、整数不补零）。

#### Scenario: 重复导出

- **WHEN** 对同一输入连续导出两次
- **THEN** 两份 QML 文本完全相同

#### Scenario: Entity ID 含非法字符

- **WHEN** 两个 Entity 的 ID 规范化后相同
- **THEN** 两者得到按文档遍历顺序区分的不同 QML `id`，且 `objectName` 保留各自原始 ID

### Requirement: 编辑器导出入口

编辑器 MUST 提供「导出为 QML」动作，可从命令面板与应用菜单触发。该动作 MUST 导出当前激活场景，
MUST 使用与 Preview 相同的文字测量端口对当前（含未保存改动的）文档求解，并以 `.qml` 文件交付
结果，同时向用户呈现诊断。

#### Scenario: 导出含未保存改动的场景

- **WHEN** 用户修改了激活场景但尚未保存，然后执行「导出为 QML」
- **THEN** 导出的 QML 包含这次修改

#### Scenario: 导出时有降级

- **WHEN** 导出产生了诊断
- **THEN** 文件照常交付，且用户能看到诊断条目及其对应的对象

### Requirement: 基础图形的像素验收

仓库 MUST 为每类基础图形（容器、矩形、直线、弧与整圆、多段线与圆角、路径与带洞路径、文字、旋转、
组件实例）各提供一份夹具，其导出 QML 的截图 MUST 与 Preview 截图在 `qt-runtime` 声明的容差内一致。

#### Scenario: CI 验收

- **WHEN** CI 运行 Qt job
- **THEN** 每份基础图形夹具的导出结果都通过像素对比
