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

导出 MUST 把目标 Frame 映射为尺寸等于 `Frame.size` 的根对象且不写它在工作区上的位置；带底色的
容器与盒物料 MUST 映射为 `Rectangle`，写出底色、圆角与不透明度；边框 MUST 作为压在子级**之上**的
独立覆盖层导出（与预览的边框层同一层序）；`Clip` 存在且裁剪时 MUST 写出 `clip: true`，缺席时
MUST NOT 裁剪；Group MUST 映射为不绘制任何内容的 `Item`；隐藏的对象 MUST NOT 导出。子级 MUST 按
预览渲染的子级顺序声明以保持层序。

#### Scenario: 带圆角描边的容器

- **WHEN** 导出一个底色 `#1e293b`、边框 `#334155` 宽 1、圆角 8 的容器
- **THEN** QML 中对应 `Rectangle` 的 `color` 与 `radius` 等于底色与圆角
- **AND** 边框以 `border.color`、`border.width` 写在排在全部子级之后的覆盖层上

#### Scenario: 未声明 Clip 的场景

- **WHEN** 场景 Frame 没有 `Clip` Component 且子级超出边界
- **THEN** 根 `Item` 不写 `clip: true`

### Requirement: 曲线映射

带 `Curve` 的 Entity MUST 映射为 `Shape` 与 `ShapePath`，几何 MUST 按预览同一个 `viewBox` 到盒的
逐轴仿射映射到盒坐标（因此非等比盒里的弧是两个半径各自缩放的椭圆弧），带 `cornerRadius` 的
多段线 MUST 经 `composePolylineOutline` 展开，填充 MUST 读 `getComposeCurveFill`。
`fillRule: 'evenodd'` MUST 映射为奇偶填充，缺席 MUST 显式映射为非零填充；线帽与斜接 MUST 显式
写出 SVG 的缺省值；虚线长度与偏移 MUST 换算为以线宽为单位；端点箭头 MUST 以额外的填充路径绘出。

#### Scenario: 非等比盒中的弧

- **WHEN** 一段弧所在盒被非等比拉伸
- **THEN** 导出的 `PathArc` 的 `radiusX` 与 `radiusY` 分别按两个轴的比例缩放
- **AND** 像素对比与预览一致

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

文字 MUST 映射为纯文本 `Text`，字号 MUST 使用 `font.pixelSize`；盒子 MUST 写死为快照尺寸；换行
MUST 照搬预览的规则（先在词边界、放不下再在任意字符处断开）。`lineHeight` 有值时 MUST 使用固定
行高，并 MUST 按垂直对齐补偿 CSS 的半行距（顶对齐下移上半份、底对齐上移下半份、居中不补，
取整方式与 Blink 一致）；缺席时 MUST 使用引擎默认行高。水平与垂直对齐 MUST 按文字属性映射。

#### Scenario: Hug 文字

- **WHEN** 导出一段宽度为 Hug 的文字
- **THEN** 对应 `Text` 的宽高等于快照里的测量结果，盒子正好装得下它因此不会被断开

#### Scenario: 固定行高的三种垂直对齐

- **WHEN** 导出行高 24px、分别为顶、居中、底对齐的三段文字
- **THEN** 三段的 `lineHeightMode` 都是固定高度、`lineHeight` 为 24
- **AND** 顶对齐整块下移上半份半行距，底对齐上移下半份，居中不移
- **AND** 像素对比中三段文字的墨迹位置与预览一致

### Requirement: 旋转与基点

带旋转的 Entity MUST 以 `Rotation` 变换导出，其原点 MUST 等于 `getComposeTransformPivot` 给出的
归一化基点乘以盒尺寸，且 MUST NOT 钳制到盒内。

#### Scenario: 左边中点为基点

- **WHEN** 一个 100 × 40 的矩形旋转 30 度且基点为 `{x: 0, y: 0.5}`
- **THEN** 导出的 `Rotation` 原点为 `(0, 20)`、角度为 30

### Requirement: 组件实例第一期导出为占位

第一期组件实例 MUST 导出为同尺寸的占位并产出包含该实例 Entity ID 的诊断。内联展开需要实例覆盖、
动画采样、根尺寸对齐、内容缩放与翻转之后的嵌套解算结果，那条管线目前住在物料包内部；在它被提取
成可复用的入口之前，导出器 MUST NOT 自行复制一份。

#### Scenario: 场景中有组件实例

- **WHEN** 导出一个含组件实例的场景
- **THEN** 实例位置导出同尺寸占位
- **AND** 诊断中包含该实例的 Entity ID，场景中其余对象照常导出

### Requirement: 不支持内容的降级

无法表达的内容 MUST 降级导出并产出诊断，MUST NOT 静默丢弃元素：渐变取最靠近中点的色标的纯色；
阴影忽略；图片、SVG、图表、组件实例与未知 Renderer 导出为同尺寸占位；动画按静态姿态导出；被绑定
的 Renderer prop 写入文档中的当前值；字体栈只写第一个字族。

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
MUST 读编辑器布局 Runtime 交出的「已解算文档 + 快照」（即画布正在渲染的那一对，因此含未保存的
改动），并以 `.qml` 文件交付结果，同时向用户呈现按类聚合的诊断与产物需要的字族。布局尚未求解完
时该动作 MUST 列出但不可用并说明原因。

#### Scenario: 导出含未保存改动的场景

- **WHEN** 用户修改了激活场景但尚未保存，然后执行「导出为 QML」
- **THEN** 导出的 QML 包含这次修改

#### Scenario: 导出时有降级

- **WHEN** 导出产生了诊断
- **THEN** 文件照常交付，且用户能看到诊断条目及其对应的对象

### Requirement: 基础图形的像素验收

仓库 MUST 为每类基础图形（容器与嵌套 Auto Layout、描边圆角、直线、弧与整圆、多段线与圆角、虚线与
点线、端点箭头、路径与带洞路径、文字及其对齐与字重、旋转与基点）提供夹具，其导出 QML 的截图 MUST
与 Preview 截图在 `qt-runtime` 声明的容差内一致。预览一侧与导出一侧 MUST 读同一个布局 Runtime 的
结果。

#### Scenario: CI 验收

- **WHEN** CI 运行 Qt job
- **THEN** 每份基础图形夹具的导出结果都通过像素对比

### Requirement: 导出入口拒绝非法输入

要导出的场景不是文档的根 Frame，或布局快照里没有它的盒子时，导出 MUST 抛出可判别的
`ComposeQmlExportError` 并说明原因，MUST NOT 产出一份不完整的 QML。

#### Scenario: 场景不是根 Frame

- **WHEN** 以一个非根场景的 Entity ID 调用导出
- **THEN** 抛出 `ComposeQmlExportError`，说明它不是文档的根场景

#### Scenario: 快照缺少场景

- **WHEN** 布局快照里没有目标场景的盒子
- **THEN** 抛出 `ComposeQmlExportError`，说明布局快照缺少该场景
