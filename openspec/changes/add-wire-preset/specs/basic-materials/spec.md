## MODIFIED Requirements

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image、SVG、Curve、Arrow、Circle 与 Wire
Entity Presets。Container MUST 组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；
Rectangle、Text、Image 与 SVG Presets MUST 组合 Transform、Visibility、Lock、Appearance、Renderer。

Curve、Arrow、Circle 与 Wire MUST 是**同一个 `curve` 物料的四个起点**：四者 MUST 在上述 Component
之外组合 `Curve`，差别只在默认几何与默认描边（Arrow 默认终点 marker 为箭头，Circle 默认几何
是扫掠 360 的弧，Wire 默认是一次回路的红色粗实线）。MUST NOT 为它们注册第二个 Renderer 类型——「盒 + 方向」
与「坐标」不得同时存在两种线的表示，用户看不出区别却会得到不同的编辑手感。

Wire Preset 的默认描边 MUST NOT 与其余三个起点共用同一份描边默认。导线与普通几何在文档上是
两种东西——导线带 `Wire`、两端可以绑到端口、符号一移动它就跟着走——而共用描边会让这个差别
在屏幕上**完全不可见**。

这个差别 MUST 同时落在**颜色**与**线宽**上。

**颜色 MUST 是红。**本产品画的是一次接线图，而那里红 = 合闸/带电是变电站监控画面的通行惯例；
储能、光伏这类一次接线图画的是**正常运行**的系统，整条一次回路本来就是带电的，因此实机上通篇
是红。默认取红，与实施工程师画完之后想要的样子一致。

**绿 MUST NOT 作为默认**：它在一次图里表示分闸/停电，与红正好相反。（PCB 原理图工具用绿画导线
是另一个领域的惯例——那张图上颜色是空闲的语义通道，而这里不是。）

颜色**仍然留给数据绑定**：`stroke` 是可绑定的 Renderer prop，项目要做拓扑着色（带电红、停电
绿）时绑它即可；红只是「还没绑」这一档的取值，而它取的正是最常见的那一档。

导线色 MUST 在**编辑画布的深底与发布页面的浅底上都读得出来**（不低于图形元素的 3:1 门槛）：
场景背景默认透明，导线与场景背景一样是「会被发布出去的真实像素」。

**线宽 MUST 更粗**，沿用电气制图的既有读图习惯——一次回路粗实线，二次回路与标注细实线。

Materials MUST NOT 内置电压等级色表——色表因项目而异，内置一份等于替宿主做了一个多半要改的
决定，而改它要动物料默认值。

已经拥有专用创建入口的 Preset MUST 默认隐藏于 Palette，避免同一个创建动作出现两个入口：
Text、Arrow、Circle 与 Wire 由 Stage 工具栏与绘图命令提供入口。Wire 的隐藏还有一条自己的
理由：从 Palette 拖出来的导线**没有任何端口绑定**，而那条红粗线正在宣称它是带电的主回路。默认隐藏 MUST
只影响 Palette 呈现，MUST NOT 影响 Registry 注册、拖入、键盘新增、资源拖放或文档反序列化；
宿主 MUST 能够通过物料 options 覆盖该默认。

#### Scenario: 创建基础 ECS 物料

- **WHEN** Registry 从所有内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset 与基础 Component Keys

#### Scenario: 四个曲线起点共用一个 Renderer

- **WHEN** Registry 从 Curve、Arrow、Circle 与 Wire Preset 各创建一个 seed
- **THEN** 四者的 Renderer 类型相同，且都带 `Curve` Component
- **AND** Registry 中不存在第二个绘制线条的 Renderer 类型

#### Scenario: 导线是红色粗实线

- **WHEN** Registry 从 Curve Preset 与 Wire Preset 各创建一个 seed
- **THEN** Wire 的 `strokeWidth` 大于 Curve 的
- **AND** Wire 的 `stroke` 是红，且与 Curve 的不同
- **AND** 两者的线帽与 marker 相同

#### Scenario: 默认 Palette 不重复工具栏入口

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** Text、Arrow、Circle 与 Wire 不出现在 Palette 中
- **AND** 这些 Preset 仍可由工具栏、绘图命令、资源拖入与 Registry API 正常创建

#### Scenario: 形状跨入口一致渲染

- **WHEN** Stage 或 Preview 渲染 Arrow 或 Circle Entity
- **THEN** 两个入口基于同一 `Curve` 几何输出相同形状与方向
- **AND** 反向拖拽不产生负 LayoutItem 尺寸
