## ADDED Requirements

### Requirement: SVG 导入产出组件导入计划

系统 MUST 提供无 React、无 DOM 的 `@compose-ui/svg-import`，把一段 SVG 文本映射为一份**导入
计划**：一份 Component Asset v2 的文档、一个待落地的实例位置与诊断。

本包 MUST NOT 依赖 Registry、物料或任何 UI：Entity 的 Preset seed 与 ID 工厂 MUST 由调用方
注入。产出计划而不是直接写盘，因为一次导入落的是**资源**，而资源写入不可回滚；纯函数产出、
宿主写入，测试因此不需要假造 Store。

实现 MUST 分三层——解析（XML 分词）、归一化（样式求值、`transform` 烘焙、路径规范化）、
映射（产出 Entity）。前两层认识的是 SVG 的结构与 CSS，与产出什么文档无关；换目标时被重写的
MUST 只有映射层。

第三方库 MUST NOT 出现在公共 API 的类型里。拍平、紧包围盒与内部判定 MUST 住在 `core`——
命中路径要读它们，而本包不在命中路径上。

#### Scenario: 一份 SVG 产出一份组件文档

- **WHEN** 导入一份含若干图元的 SVG
- **THEN** 计划里有一份根为 Frame 的组件文档，Frame 尺寸取自 `viewBox`
- **AND** 计划里**不含**组件实例 Entity——它需要资源引用与 revision，那要等文件写完才存在

#### Scenario: 不认识 Registry

- **WHEN** 调用方注入一份自定义的 Preset seed
- **THEN** 产出的 Entity 基于该 seed，本包不引用任何物料包

### Requirement: 图元映射到最窄的曲线 kind

`<line>`、`<polyline>`、`<polygon>`、`<rect>`、`<circle>`、`<ellipse>` 与 `<path>` MUST 映射
为带 `Curve` 的 Entity，且 MUST 取能表达该几何的**最窄** kind：

- 只含 `M`/`L`/`H`/`V`/`Z` 的 `<path>`、`<polyline>` 与 `<polygon>` MUST 落成 `polyline`
- `<rect>` MUST 落成四顶点的闭合 `polyline`；`rx`/`ry` MUST 落成既有的 `cornerRadius`，
  MUST NOT 另立圆角矩形类型
- `<circle>` 在等比变换下 MUST 落成 `arc`，整圆是扫掠绝对值为 360 的弧
- `<ellipse>` 与非等比变换下的圆 MUST 落成 `path`（三次贝塞尔），MUST NOT 按某一轴的比例硬算
  成圆——那会画出一个用户从未画过的形状。**也 MUST NOT 拍扁成 `polyline`**：贝塞尔是椭圆的
  精确表示，而多段线只是近似；「非等比就拍扁」那条既有规则的前提是没有能表达曲率的 kind，
  而 `path` 落地之后这个前提不再成立
- `<path>` 里的 `A` MUST 展开成三次贝塞尔（精确转换，形状逐像素不变），MUST NOT 为它反解圆心
  去凑一个 `arc`：端点参数化的弧要反解圆心，那段数学是这条链上最容易写错的一处，而展开之后
  形状没有任何损失
- 只有真的含曲率、或含多条子路径的 `<path>` 才 MUST 落成 `path`

取最窄 kind 是为了让工程符号型 SVG 导进来**一个 `path` 都没有**：那类图纸的用户接下来要做的
正是拖顶点，而 `path` v1 没有夹点。

#### Scenario: 工程符号全部落成可编辑 kind

- **WHEN** 导入一份只含直线、圆、弧与折线的符号 SVG
- **THEN** 产出的每个曲线 Entity 的 `kind` 都是 `line`、`arc` 或 `polyline`

#### Scenario: 圆角矩形复用既有字段

- **WHEN** 导入一个带 `rx` 的 `<rect>`
- **THEN** 产出四顶点闭合多段线且 `cornerRadius` 等于该值

#### Scenario: 椭圆是精确的贝塞尔而不是折线

- **WHEN** 导入一个 `rx` 与 `ry` 不等的 `<ellipse>`
- **THEN** 产出 `kind` 为 `path` 的曲线，紧包围盒等于 `2rx × 2ry`

#### Scenario: 带洞图形保持一条曲线

- **WHEN** 导入一个含两条子路径且 `fill-rule` 为 `evenodd` 的 `<path>`
- **THEN** 产出**一个** `path` 曲线，两条子路径都在其中，`fillRule` 为 `evenodd`
- **AND** 洞的位置在内部判定里为假

### Requirement: transform 在导入期烘进几何

祖先链与元素自身的 `transform` MUST 在导入期烘进几何点，MUST NOT 留到运行期——`Transform`
只有 `rotation` 与 `pivot`，没有 scale、skew 或 matrix，SVG 的变换在文档里无处可放。

烘焙对直线、折线与贝塞尔 MUST 是精确的仿射映射。弧在**非等比**缩放下 MUST 拍扁成多段线，
沿用既有的等比判定，MUST NOT 按某一轴的比例硬算成圆。

**纯旋转 MAY 保留进 `Transform.rotation` 而不烘死**：能不能绕铰点摆动取决于旋转是否还是一个
活的属性，而导入器不知道这个部件接下来要不要转，因此保留旋转、只烘缩放与斜切。

`stroke-width` MUST NOT 参与仿射：非等比缩放下它没有单一正确答案，MUST 取两轴比例的几何平均
并给出诊断。

#### Scenario: 嵌套 transform 被烘进坐标

- **WHEN** 导入一个位于 `<g transform="translate(10,20) scale(2)">` 内的 `<line>`
- **THEN** 产出的几何点是变换之后的坐标，Entity 上没有任何缩放语义

#### Scenario: 非等比缩放下的弧拍扁

- **WHEN** 导入一个位于 `scale(2,1)` 内的 `<circle>`
- **THEN** 产出 `polyline` 而不是 `arc`，并给出诊断

### Requirement: 样式在导入期求值掉

`<style>` 里的 class、内联 `style=`、呈现属性与 `<g>` 继承 MUST 在导入期按 CSS 优先级求值成
每个 Entity 自己的 Renderer props 与 `Appearance`，MUST NOT 在文档里留下任何继承关系——
改一个部件的颜色不该先问它继承自谁。这与 DXF 的 byLayer 颜色在导入期求值进描边是同一条判断。

`<style>` 的选择器 MUST 支持 `tag`、`.class`、`#id` 与它们的逗号组，其余选择器 MUST 跳过并
诊断，MUST NOT 猜。

`fill` MUST 落进 `Appearance.backgroundPaint`（曲线的填充读取入口），`stroke` 系列 MUST 落进
Renderer props。渐变 MUST 降级成中位色标的纯色并诊断——曲线填充 v1 只画 `solid`。
`stroke-dasharray` MUST 取既有 picklist 中最接近的一档并在不精确时诊断。

#### Scenario: class 与内联样式求值

- **WHEN** 导入一个 `<style>.st0{stroke:#f00}</style>` 且元素为 `<path class="st0" style="stroke:#0f0">`
- **THEN** 产出 Entity 的 `stroke` 是 `#0f0`（内联优先），文档里不含 class

#### Scenario: 渐变降级并报告

- **WHEN** 导入一个填充引用 `linearGradient` 的图元
- **THEN** 填充是纯色，诊断中出现渐变降级一项

### Requirement: 结构元素的映射

`<svg>` 根 MUST 映射为组件文档的根 Frame，尺寸取 `viewBox`（缺席时取 `width`/`height`）。
`<g>` MUST 映射为 first-class Group，MUST NOT 映射为 Container——Group 无外观、无裁剪、
不参与 Auto Layout，正是 `<g>` 的语义；映射成 Container 会给每一层凭空加上背景与边框语义。

`<use>` MUST 就地展开（解引用并叠加其 `transform` 与 `x`/`y` 偏移）。`<defs>`、`<symbol>`、
`<title>`、`<desc>`、`<metadata>` MUST NOT 产出 Entity。

元素的 `id` MUST 落成 Entity 名称：导入之后用户在场景树里要能认出哪个是刀、哪个是静触头，
而 `id` 是原作者对这个问题唯一的回答。

#### Scenario: 分组保持层级

- **WHEN** 导入一份含嵌套 `<g>` 的 SVG
- **THEN** 场景树里出现对应层级的 Group，每个 Group 的子级与源文件一致

#### Scenario: id 成为可读名称

- **WHEN** 导入一个 `<path id="blade">`
- **THEN** 该 Entity 的名称是 `blade`

### Requirement: 不能表达的属性降级，元素永不丢弃

`filter`、`mask`、`clip-path`、`pattern` MUST 被忽略但**保留几何**，并给出诊断。它们是外观
修饰，忽略之后用户看到的是一个少了修饰的正确图形——**可见的降级**；而丢掉整个元素是不可见的，
用户拿结果和原图一对，只会认为工具不可靠。

`<script>`、`<foreignObject>`、事件属性、SMIL 动画元素与外部 `href`/`url()` MUST 整个丢弃并
诊断：它们不是几何，且是可执行内容。这与既有 SVG 物料的净化是同一条判断。

诊断 MUST 按同类聚合成 `{ subject, count }`，与 DXF 一致，使宿主能压成一行提示。静默丢弃
MUST NOT 发生。

#### Scenario: 带滤镜的图元照常导入

- **WHEN** 导入一个 `filter="url(#f0)"` 的 `<path>`
- **THEN** 该 Entity 存在且几何正确，诊断中出现滤镜未导入一项

#### Scenario: 可执行内容不进文档

- **WHEN** 导入含 `<script>` 与 `onclick` 的 SVG
- **THEN** 产出的文档里不含任何来自它们的内容，诊断中出现对应项

### Requirement: 文字映射为文字物料

`<text>` MUST 映射为文字物料 Entity，内容取其纯文本。盒 MUST 走 Hug——盒是会被看见的东西，
由布局求解量真实字体；导入期由字号推出的基线与前进宽度比例 MUST 只用于把锚点换算成盒左上角，
它是**那一刻的落点初值**而不是任何契约。

`text-anchor` MUST 映射为左/中/右三种对齐。`<tspan>` 的独立定位与多行 MUST NOT 支持，取其
文本内容并诊断。

#### Scenario: 居中文字换算成盒左上角

- **WHEN** 导入一个 `text-anchor="middle"` 的 `<text>`
- **THEN** Entity 的 offset 是由估算宽度换算出的盒左上角，盒为 Hug

### Requirement: 内嵌图片由计划带出、宿主写盘

`<image>` MUST 映射为图片物料 Entity。内嵌 data URI 的位图 MUST 由导入计划带出成一份**待写
资源**，MUST NOT 由本包写盘——纯函数包不产生外部副作用，这与「计划里不含组件实例 Entity，
因为它需要写完文件才存在的引用与 revision」是同一条次序。宿主 MUST 先写资源、再把引用回填进
Entity。

外链 `href` 已被安全规则丢弃，因此 data URI 是唯一进得来的形式。位图解不出尺寸时 MUST 取
`width`/`height` 属性，两者都没有时跳过该元素并诊断——一个尺寸未知的图片放进绝对布局里，
落点与盒都无从谈起。

#### Scenario: 内嵌位图落成资源并被引用

- **WHEN** 导入一个 `href` 为 data URI 的 `<image>`
- **THEN** 计划里出现一份待写资源，宿主写完后该 Entity 的图片引用指向它

#### Scenario: 外链图片被丢弃并报告

- **WHEN** 导入一个 `href` 指向 `https://` 的 `<image>`
- **THEN** 该元素不进入文档，诊断中出现外部引用一项

### Requirement: 资源浏览器上的导入为组件

编辑器 MUST 在 `.svg` 文件的上下文菜单上提供「导入为组件」，且 MUST NOT 在其他文件上出现——
这一项对别的文件毫无意义，常驻只会让菜单更长。

宿主 MUST 先写内嵌位图、再写组件文件：组件文档里的资源引用要等文件写完才存在。位图写成功而
组件写失败时 MUST NOT 回滚已写的文件：资源写入是不可回滚的外部副作用，删掉刚写的文件比留着
更容易造成损失，这与 DXF 导入与「创建组件」两条既有路径的判断一致。

导入完成后 MUST 打开该组件文档，MUST NOT 顺手在场景里放一个实例：导入之后用户要做的是**改这
个符号**（改色、挂端口、打动画），而那要在组件文档里做；把它摆到图上是另一件事，组件库的拖放
入口已经做了，再造一个等于同一个动作有两条路。

导入完成但有内容没能完整表达时 MUST 提示诊断摘要。

#### Scenario: 导入落一份组件资产并打开它

- **WHEN** 在 `.svg` 上选择「导入为组件」
- **THEN** 资源树中出现一份组件文件，且它的组件文档被打开

#### Scenario: 部分内容未能表达时提示

- **WHEN** 导入的 SVG 含滤镜与渐变
- **THEN** 导入成功，且提示中列出各类诊断与数量

### Requirement: 导入结果可二次编辑

导入产出的每个图元 MUST 是场景树中可独立选中的 Entity，且 MUST 与手工绘制的同类 Entity 走
**完全相同**的编辑路径：Inspector 改色、动画轨道打点、`Ports` 挂端口、导线捕捉，MUST NOT 为
导入产物新增任何专用入口或专用状态。

判据是这条：导入器的产出是普通文档，不是一种新的实体。凡是需要为「导入来的」这三个字加分支的
地方，都说明映射还没做完。

#### Scenario: 改一个部件的颜色

- **WHEN** 选中导入符号内部的一条曲线并在 Inspector 修改描边颜色
- **THEN** 只有该 Entity 变色，走的是既有的 Renderer props 写入

#### Scenario: 给一个部件绑动画

- **WHEN** 给导入符号内部的一条曲线打 `Transform.rotation` 关键帧，并把 `pivot` 设在铰点
- **THEN** 播放时该部件绕铰点摆动，其余部件不动

#### Scenario: 导线接上导入的符号

- **WHEN** 给导入的组件根挂 `Ports` 并用 `LINE` 把端点落在端口上
- **THEN** 导线绑定该端口，移动符号时导线端点跟随
