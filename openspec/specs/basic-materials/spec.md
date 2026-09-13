# basic-materials Specification

## Purpose
TBD - created by archiving change add-basic-materials. Update Purpose after archive.
## Requirements
### Requirement: 基础材料 Inspector 共享 UI 环境

Frame、Group、Rectangle 与 Text 的第一方 Inspector MUST 消费共享 Theme/I18n Context，并为内建
字段、分组、帮助文案和操作提供 zh-CN/en-US 文案与语义主题 token。宿主扩展 definition、
registry label、自定义 Inspector 和自定义 Schema metadata MUST 保持原文。

#### Scenario: 使用英文基础材料 Inspector

- **WHEN** 基础材料 Inspector 位于 en-US Provider
- **THEN** 第一方字段和操作显示英文
- **AND** 宿主扩展物料的标签和业务字段保持宿主提供的内容

#### Scenario: 切换 Inspector 主题

- **WHEN** Provider 从 dark 切换为 light
- **THEN** Inspector surface、输入、边框、文本和焦点态使用浅色 token
- **AND** Inspector 不重新创建 registry 或修改节点文档

### Requirement: Image 基础物料

materials MUST 发布默认隐藏于 Palette 的 Image Entity Preset。Image MUST 使用资源引用、alt 与
object-fit Renderer props，以 Blob URL 渲染并在失效或卸载时回收 URL。

#### Scenario: 渲染并更新图片

- **WHEN** Image Entity 拥有可解析资源，且 Provider 后续发布内容更新
- **THEN** renderer 使用最新图片并保持 Renderer props 不变
- **AND** 旧 Blob URL 被回收

### Requirement: 安全可改色 SVG 基础物料

materials MUST 发布默认隐藏于 Palette 的 SVG Entity Preset。SVG MUST 在内联前净化可执行内容、
嵌入样式、动画与外部 URL，并支持独立填充和描边覆盖。

#### Scenario: 净化恶意 SVG

- **WHEN** SVG 包含 script、foreignObject、事件属性、动画或外部 href/url
- **THEN** 这些内容不会进入渲染 DOM
- **AND** fragment 引用、几何与安全渐变定义可以保留

#### Scenario: 覆盖填充与描边

- **WHEN** 用户分别启用填充或描边覆盖
- **THEN** 非 none 填充使用目标颜色
- **AND** 只有原本存在且非 none 的描边被替换

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

#### Scenario: 三个曲线起点共用一个 Renderer

- **WHEN** Registry 从 Curve、Arrow 与 Circle Preset 各创建一个 seed
- **THEN** 三者的 Renderer 类型相同，且都带 `Curve` Component
- **AND** Registry 中不存在第二个绘制线条的 Renderer 类型

#### Scenario: 导线是第四个起点，同一个 Renderer

- **WHEN** Registry 从 Wire Preset 创建一个 seed
- **THEN** 它的 Renderer 类型与其余三个起点相同，且带 `Curve` Component

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

### Requirement: 语义 Component Inspector

基础材料 MUST 以 v5 Appearance.backgroundPaint 表达背景，默认值为明确的 Solid Paint。Appearance Inspector MUST 将背景作为 Paint editor，边框和 Renderer 文本/SVG 颜色继续使用 Solid Color editor，并把 Paint edit port 传给背景字段。

#### Scenario: 从 Inspector 创建渐变背景

- **WHEN** 用户编辑单个基础材料的背景并选择渐变
- **THEN** Materials 只更新该 Entity 的 Appearance.backgroundPaint
- **AND** 不向边框、文字、SVG 或 Shadow 写入 Gradient

### Requirement: 保持基础物料视觉与数据

Rectangle、Text、Image、SVG 的现有 props、资源引用和视觉默认值 MUST 迁移到 Renderer 与
Appearance Components。系统 MUST 删除旧 kind 默认 style 和 Rectangle legacy fallback。

#### Scenario: 渲染 v4 基础物料

- **WHEN** Stage 与 Preview 渲染五种默认 Preset
- **THEN** 尺寸、文字、颜色、图片/SVG 资源和裁剪视觉与迁移前一致

### Requirement: 内建能力

Materials MUST 注册“容器”和“几何限制”能力。“容器”默认创建空 Hierarchy 与开启的 Clip；
“几何限制”创建允许全部操作、最小 1×1、无最大尺寸的 TransformConstraints。

#### Scenario: 给 Rectangle 添加容器能力

- **WHEN** 用户向 Rectangle 添加容器能力并放入子项
- **THEN** Rectangle 同时渲染自身和子项
- **AND** 含子项时能力不可移除

### Requirement: 内建 Component 定义自带 Inspector

createComposeBuiltinComponentDefinitions MUST 为 Transform、Visibility、Lock、Appearance、
Hierarchy、TransformConstraints 与 `Frame` 提供符合 Registry Inspector 协议的编辑 UI；Lock Inspector
MUST 在 readOnly 上下文中仍可解除锁定；Clip 的开关由 Hierarchy Inspector 呈现。
`Frame` Inspector MUST 呈现常见尺寸预设与该 Frame 的辅助线，MUST NOT 重复呈现尺寸数值本身
（尺寸由几何分组的唯一尺寸字段编辑），也 MUST NOT 呈现背景（背景属于 Appearance 分组）。
`Frame` Inspector MUST 只依赖 core 的公共命令与读取函数，MUST NOT 依赖 Editor。

#### Scenario: Registry 协议驱动内建分组

- **WHEN** 宿主使用 createComposeBasicMaterials 构建 Registry
- **THEN** 编辑器无需硬编码即可按定义顺序渲染全部内建 Component 分组

#### Scenario: Frame 分组编辑预设与辅助线

- **WHEN** 用户选中一个拥有 `Frame` 的 Entity
- **THEN** Frame 分组显示常见尺寸预设与该 Frame 的辅助线列表
- **AND** 选择一个预设以一次可逆事务更新该 Frame 的尺寸

### Requirement: Renderer Inspector 保留 schema 之外的 props

内容 Inspector 提交 setRendererProps 时 MUST 合并当前 Renderer props，
不得丢弃 schema 未覆盖的宿主字段。

#### Scenario: 编辑 Text 内容保留宿主扩展字段

- **WHEN** Text Renderer props 含 schema 之外的宿主字段且用户修改文本
- **THEN** 派发的 props 同时包含新文本与原有宿主字段

### Requirement: Feature-local basic materials
Basic materials MUST retain a separate feature directory for each material and a purpose-named shared inspector kit;
their public factories and definitions MUST use compose-prefixed names.

#### Scenario: Render material definition
- **WHEN** a host registers a vNext basic material definition
- **THEN** Frame, Rectangle, Text, Image and SVG rendering and inspector behaviour remain unchanged

### Requirement: 基础物料使用共享语义 Inspector

Frame、Rectangle、Text、Image 和 SVG 的 Inspector MUST 使用 `@compose-ui/property-panel` 的语义 editor：position 使用 Vector2，size 使用 Size，rotation 使用 Angle，适用颜色使用来自 `@compose-ui/components` 的共享 Color Picker，透明度、边框宽度和圆角使用对应数值 editor，阴影偏移使用 Vector2。Materials MUST 直接依赖并加载 `@compose-ui/components` 样式。五种物料 MUST 显示 Visibility 并以既有 `node.set-visibility` 命令提交。Alignment 只作为可用的基础 editor，不得因此新增文档字段。

#### Scenario: 编辑物料复合几何与样式
- **WHEN** 用户在任一基础物料 Inspector 修改语义 position、size、rotation 或适用样式字段
- **THEN** Inspector 适配为与此前相同的 transform、style 或 props command payload
- **AND** 所有相关变化继续使用单次原子 batch、既有事务标签和完整 Schema 校验

#### Scenario: 切换物料可见性
- **WHEN** 用户在 Frame、Rectangle、Text、Image 或 SVG Inspector 修改 Visibility
- **THEN** 系统派发既有 `node.set-visibility` 命令
- **AND** 该节点的现有 props、style 和 transform 不被改变

#### Scenario: 保留 Rectangle 兼容样式
- **WHEN** 旧 Rectangle 节点只在 style 中保留背景、边框或阴影等表现字段
- **THEN** 语义 Inspector 读取并更新这些既有 style 值
- **AND** 不会把兼容 style 字段迁移为新的 document props

### Requirement: 节点引用属性 Schema 工厂

基础物料包 MUST 导出用于声明节点引用属性的同步 Schema 工厂，其产出的 Schema MUST 允许空值、
MUST 校验页面引用的完整形状，并 MUST 通过 metadata 指定 `node` 基础 editor。该工厂 MUST NOT 要求
`core` 依赖 Schema 库。

#### Scenario: 声明节点引用属性

- **WHEN** 物料以该工厂声明一个节点引用属性并渲染 Inspector
- **THEN** 该字段使用 node 基础 editor
- **AND** 空值与完整页面引用都通过校验，字段缺失或类型错误的引用不通过校验

### Requirement: Container 物料与容器能力

Container Preset 与容器能力 MUST 为 v6 创建 Hierarchy、Layout、Clip、LayoutItem、rotation-only
Transform 和 Appearance。Layout Inspector MUST 编辑明确 Flex 值、padding 与双轴 gap；LayoutItem
Inspector MUST 编辑 Fixed sizing、Flow/Absolute、offset、margin 与 alignSelf。
Container Preset 的默认尺寸 MUST 为 `320×240`，使拖入或点击创建的容器在默认缩放下不铺满视口；
默认外观 MUST 使用深色背景与深色描边，使新建容器不需要先改一次背景就能与深色大屏一致；
容器物料图标 MUST 使用井号（`#`）字形，以区别于 rectangle 物料。

#### Scenario: 把既有子项转换为 Flow
- **WHEN** 用户在 Layout Inspector 对含 Absolute 直接子项的 Container 执行转换
- **THEN** 一个 batch 按 Hierarchy 顺序把全部直接子项设为 Flow
- **AND** Undo 一次恢复全部原 LayoutItem，后代和未知 Component 不变

#### Scenario: 从物料面板拖入容器
- **WHEN** 用户把 Container 物料拖入画布
- **THEN** 创建的容器尺寸为 `320×240`
- **AND** 默认背景为深色，无需额外改动即可承载深色大屏内容

### Requirement: 内建 Text 物料

Text Renderer MUST 提供与其可见样式一致的 Hug measurement，支持 Explicit/AtMost/Undefined 约束、
换行、font readiness 与 baseline，且 MUST 使用隔离测量 host 而不是 Scene Entity DOM。

Text MUST 声明原地文字编辑契约，把 `text` prop 标记为可原地编辑的纯文本，使 Stage 无需识别物料类型
即可提供画布内编辑。Text Renderer MUST 在编辑态以原地可编辑方式渲染该 prop，并保持字号、字重、颜色、
行高与对齐与非编辑态完全一致；MUST NOT 在编辑态改用与最终排版不一致的输入控件。

原地编辑 MUST 只承载纯文本，MUST NOT 接受富文本、区段样式或粘贴带来的 HTML 标记。

内容为空时 Text measurement MUST 仍量出该排版下的真实行高并保留一个光标宽度，MUST NOT 返回无效
尺寸——点击创建的文字以空内容进入编辑，测量失败会让 Hug 拿不到高度、光标无处落脚，并在画布上留下
测量诊断。

Text measurement MUST 声明内容高度随可用宽度重排。文字换行意味着拖窄后行数增加、内容变高；未声明
时缩放会把 Hug 高度一并钉成 Fixed，长出来的部分被自己的框裁掉。声明后八向手柄照常保留，且 Stage
resize 预览 MUST 按拖动的具体手柄区分两种行为：拖宽度或对角手柄时高度继续保持 Hug、随重排自适应；
拖顶部或底部纯高度手柄时 MUST 应用拖拽产生的高度并把 `LayoutItem.height.mode` 写成 `fixed`，与
Figma 的 Auto Height 文字拖动高度手柄自动转 Fixed Size 一致。

#### Scenario: 字体完成后更新 Text Hug
- **WHEN** Text 首次用 fallback 字体测量后目标字体完成加载
- **THEN** measurement revision 使 Text 与其 Auto Layout 祖先重新布局
- **AND** 不产生文档事务或读取 Stage/Preview Entity DOM

#### Scenario: 编辑态保持排版一致

- **WHEN** 一段设置了字号、字重、颜色与居中对齐的 Text 进入原地编辑
- **THEN** 编辑中的文字仍以同一套排版样式呈现
- **AND** 退出编辑后视觉不发生跳变

#### Scenario: 缩窄文字框时高度跟随内容

- **WHEN** 用户拖动角手柄把一段多词文字的框收窄
- **THEN** 文字重新换行，框的高度随之增加，内容始终完整可见
- **AND** 八向手柄照常显示，宽度变为 Fixed 而高度保持 Hug

#### Scenario: 拖动纯高度手柄转为 Fixed

- **WHEN** 用户拖动一段 Hug 高度 Text 的顶部或底部手柄
- **THEN** 框的高度按拖拽结果改变，不再被丢弃回退
- **AND** 提交后 `LayoutItem.height.mode` 变为 `fixed`，值等于拖拽后的高度
- **AND** 同一手势中若之后改拖宽度或对角手柄，高度不再跟随变化（已是 Fixed）

#### Scenario: 空内容仍量出行高

- **WHEN** 一段 Text 的内容为空且宽高均为 Hug
- **THEN** measurement 返回该排版下的行高与一个光标宽度，而不是无效尺寸
- **AND** 画布上不出现内容测量诊断

#### Scenario: 粘贴富文本只保留纯文本

- **WHEN** 用户在原地编辑中粘贴带样式的富文本内容
- **THEN** 只有纯文本进入 `text` prop
- **AND** 文档中不出现 HTML 标记

### Requirement: 紧凑 Auto Layout Inspector

Materials MUST 根据 LayoutItem 当前语义隐藏无效字段，把 Identity、Transform 与 LayoutItem 作为
单列“基础”分组呈现，并在约 400px Inspector 中以三行 Flex 控件和紧凑盒模型预览编辑布局。
基础分组 MUST 不显示 CSS 副标题；Auto Layout 分组的图标数量、语义顺序、键盘与 ARIA MUST 与
浏览器 Flex 控件一致。

#### Scenario: 按定位和尺寸模式显示字段

- **WHEN** LayoutItem 在 Absolute/Flow 或 Fixed/Fill/Hug 之间切换
- **THEN** Inspector 不显示 Flow/Absolute 定位模式，Absolute 显示位置且隐藏自身对齐，Flow 执行相反规则
- **AND** 名称、位置或自身对齐、旋转、尺寸、外边距各占一行并位于同一基础分组
- **AND** Absolute 的位置行显示 X/Y，Flow 在对应行显示自身对齐，旋转始终使用独立 Angle 属性行
- **AND** 尺寸行并排显示 W/H，Fixed 只显示可编辑数字，Fill/Hug 分别显示英文 `Fill`/`Hug`
- **AND** 基础分组不显示 position、width、height、inset、margin 或 align-self 等 CSS 副标题

#### Scenario: 编辑宽高智能输入

- **WHEN** 用户聚焦尺寸字段、输入合法数字或英文 Fill/Hug，或从建议列表选择模式
- **THEN** 数字输入原子写入 Fixed，英文模式输入或建议选择原子写入对应模式
- **AND** 每个轴只显示 W/H 前缀与一个输入框，不常驻显示 Fixed 文案、尾部 select 或模式箭头
- **AND** 聚焦时出现的建议列表只包含当前上下文允许的 `Fill`/`Hug`，中文界面也不得翻译这些模式名
- **AND** 模式文本匹配大小写不敏感，最终显示规范化为 `Fill`/`Hug`
- **AND** 空白、非法输入或 Escape 不产生事务，Enter 与失焦只提交一次有效值

#### Scenario: 编辑独立位置与角度属性

- **WHEN** 用户编辑 Absolute 的位置、Flow 的自身对齐，或独立旋转属性
- **THEN** Inspector 分别通过现有 LayoutItem 或 Transform 命令更新对应 Component
- **AND** Absolute 位置使用独立 Position 自定义类型、Flow 自身对齐使用独立 picklist、旋转使用内建 angle 语义类型
- **AND** Materials 不把 position、alignSelf 与 rotation 包含在同一个自定义值中
- **AND** 数值草稿只在 Enter 或失焦时提交，Escape、空白与非法值不产生事务

#### Scenario: 展开和联动外边距

- **WHEN** 四边外边距相等或用户展开、分别编辑并重新联动四边
- **THEN** 相等值默认显示单值和展开按钮，非等值保持 T/R/B/L 展开状态
- **AND** 重新联动以 top 统一四边且只提交一次事务

#### Scenario: 编辑统一或分轴 gap

- **WHEN** rowGap 与 columnGap 相等或用户选择分轴编辑
- **THEN** Inspector 分别显示单值 gap 或 row-gap/column-gap
- **AND** 单值提交同步两轴，重新合并时以 rowGap 统一两轴且只提交一次事务

#### Scenario: align-content 始终可配置

- **WHEN** flex-wrap 为 nowrap
- **THEN** align-content 仍显示完整六项并可提前配置
- **AND** Inspector 提示该属性仅在产生多行时影响结果

#### Scenario: 再次点击已选 Flex 选项恢复默认

- **WHEN** 用户再次点击 direction、wrap、align-content、justify-content 或 align-items 中当前已选的非默认选项
- **THEN** Inspector 将该属性恢复为 ComposeDocument 支持的显式 CSS 初始等价值
- **AND** 分别使用 row、nowrap、stretch、flex-start 与 stretch，不写入空值或 normal
- **AND** 当前已是显式默认项时再次点击保持幂等且默认项继续显示为选中
- **AND** 默认项与非默认项的选中态使用同一强调色，不做视觉区分

#### Scenario: 在独立属性中编辑 padding

- **WHEN** 用户在独立内边距属性中编辑单值，或展开后分别修改四边 padding
- **THEN** Layout.padding 通过一次提交更新，且单值、四边展开与联动交互均与基础外边距相同
- **AND** 内边距字段使用与其他 Auto Layout 属性一致的上下结构，显示“内边距”和 `padding` CSS 副标题
- **AND** 四值相等时默认显示单值和展开按钮，非等值保持 T/R/B/L 展开，重新联动时以 top 统一四边
- **AND** 实时预览不包含 padding 输入框、联动按钮或其他可编辑控件

#### Scenario: wrap 预览展示多行对齐

- **WHEN** 用户选择 wrap 或 wrap-reverse 并修改 align-content
- **THEN** 预览以三个模拟子项生成至少两行并实时展示对应多行对齐
- **AND** 预览显式显示随 flex-direction 改变的主轴和交叉轴指示
- **AND** Stage、Preview 和正式 LayoutSnapshot 不读取该 Inspector DOM
- **AND** 三个模拟子项使用无渐变、低对比的扁平样式，与可操作的蓝色选中控件保持清晰层级

#### Scenario: 窄侧栏保持完整可操作

- **WHEN** Inspector 内容宽度约为 365px
- **THEN** direction/wrap、gap/align-content、justify-content/align-items 三行均无横向溢出
- **AND** 两列使用紧凑间距，不产生无用途的中央空白带
- **AND** 基础分组的位置/自身对齐、独立旋转、智能尺寸输入、展开外边距、独立内边距、建议列表、焦点环和英文文案保持可达与可读

### Requirement: Auto Layout 按需启用

Container MUST 支持显式启用与移除 Auto Layout。启用 MUST 在一个事务内添加 Layout 并把直接子项
转为 Flow；移除 MUST 把布局结果烘焙回自由布局所需的持久化几何。

启用时若新建 Layout 的 `alignItems` 为 `stretch`、子项 `alignSelf` 为 `auto` 且其交叉轴尺寸模式为
`fixed`，同一条命令 MUST 把该交叉轴改写为 `fill` 并保留原固定值作为回退。改写 MUST 与转 Flow 在
同一命令内完成，否则子项会先以 fixed 尺寸参与一次布局再跳变。

这次改写 MUST 只发生在启用当刻。此后父级 `flexDirection` 或 `alignItems` 的变化 MUST NOT 级联
改写任何子项的尺寸模式：属性编辑是局部的，一条命令只动它的目标。因此采纳得到的 `fill` 会随方向
翻转落到主轴并按 `flexGrow` 生效——**尺寸模式没有变，变的是它的含义**。这是取舍不是遗漏：回退值
一直保留在 axis sizing 里，切回原方向即复原，而级联改写要让「父级属性变化如何波及子级」本身
成为一套协议。

#### Scenario: 单事务添加 Layout 并把直接子项转为 Flow

- **WHEN** 用户在自由 Container 上启用 Auto Layout
- **THEN** 一个事务内添加 Layout 并把全部直接子项转为 Flow
- **AND** 任一受影响子项锁定时不生成命令

#### Scenario: 固定尺寸子项转 Flow 时交叉轴改为 Fill

- **WHEN** 交叉轴为 `fixed`、`alignSelf` 为 `auto` 的子项随容器启用 Auto Layout 转为 Flow
- **THEN** 该子项的交叉轴尺寸模式变为 `fill`，原固定值保留为回退值
- **AND** 主轴尺寸模式保持不变

#### Scenario: 子项显式对齐时不改写尺寸

- **WHEN** 子项 `alignSelf` 不是 `auto`
- **THEN** 其交叉轴尺寸模式保持原样

#### Scenario: 方向变化不回退采纳时改写的尺寸模式

- **WHEN** 采纳之后用户把父级的 `flexDirection` 从 row 改为 column
- **THEN** 子项的尺寸模式保持不变，采纳得到的 `fill` 落到新的主轴上按 `flexGrow` 生效
- **AND** 该次编辑只写入父级的 Layout，不产生任何子项的 LayoutItem 写入

### Requirement: 物料样式不依赖属性面板内部类名

基础物料的 Inspector 样式 MUST NOT 引用 `property-panel__` 前缀的内部类名，MUST 改用
`data-property-part` 与 `data-property-*` 字段属性定位属性面板结构。

#### Scenario: Auto Layout Inspector 重排属性面板

- **WHEN** Auto Layout Inspector 把属性面板重排为两列紧凑网格并去掉字段外壳
- **THEN** 相关选择器只使用受支持的 data 属性
- **AND** Inspector 的视觉结果与迁移前保持一致

#### Scenario: 护栏阻止再次引入内部类名

- **WHEN** 有人在 materials 样式表里写下 `property-panel__` 前缀选择器
- **THEN** materials 的样式契约测试失败并指出应改用 `data-property-part`

### Requirement: Group 基础物料

materials MUST 注册使用 Core seed 的 `group` Preset，供文档识别、图标和 Inspector 使用，但 MUST 将其
隐藏于基础 Palette。Group MUST 可移动、不可缩放和旋转，并且不提供 Container 的外观、裁剪或布局能力。

#### Scenario: Group 与 Container 分离

- **WHEN** Registry 同时注册 Group 与 Container
- **THEN** Palette 只显示 Container
- **AND** Group 仍能以不同图标和只读结构语义显示在 Scene Tree 与 Inspector

### Requirement: 关联组件实例物料

materials MUST 提供隐藏于基础 Palette 的 `component-instance` Preset；实例保存稳定引用、
appliedLineage、resolvedSnapshot 和 instanceOverrides。实例的 LayoutItem 与 GeometryConstraints
MUST 从组件根派生：根允许 Resize 时实例同样允许，尺寸、外观、裁剪与 Auto Layout 的编辑 MUST 写入
实例覆盖并以组件根为目标，不修改组件源。页面上的宿主 Entity MUST 以透明外观与 Hug 尺寸承载
嵌套文档，MUST NOT 再绘制一层与组件根竞争的可见填色。实例内部 Entity MUST 可在宿主编辑期被
投影、选中并按实例层稳定操作结构编辑，且 MUST 保持在实例子树边界内。component-instance 嵌套
实体的 Appearance、overflow/clip 盒样式语义 MUST 与 Stage / Preview 中同构 Entity 一致，使得
组件文档内编辑的颜色与圆角在实例中可复现。

#### Scenario: 离线渲染已保存快照

- **WHEN** Provider 不可用但实例含合法 resolvedSnapshot
- **THEN** Stage 与 Preview 继续渲染快照并显示离线状态

#### Scenario: 实例暴露组件根属性

- **WHEN** 组件根是允许 Resize 的容器
- **THEN** 实例可被 Resize，且尺寸、外观、裁剪与 Auto Layout 在 Inspector 中可编辑
- **AND** 编辑结果保存为以组件根为目标的实例结构操作

#### Scenario: 实例层结构覆盖

- **WHEN** 用户在实例内部删除、reparent、reorder 实体或增删非基础 Component
- **THEN** 实例只保存与 Variant 同构的稳定结构操作，并按 Base → Variant 链 → 实例结构操作解析

#### Scenario: 拒绝越界结构编辑

- **WHEN** 操作试图删除或 reparent 组件根、删除基础 Component，或把内部实体移出实例子树
- **THEN** 操作被稳定拒绝，实例保持上一个合法状态

#### Scenario: 嵌套组件保护

- **WHEN** 组件嵌套形成循环或超过八层
- **THEN** Renderer 停止递归、释放已创建 Runtime 并呈现可访问错误状态

#### Scenario: 实例嵌套实体圆角与填色一致

- **WHEN** 组件源中某叶子 Entity 的 Appearance 含非零 borderRadius 与非默认 solid 填色
- **AND** 页面上的 component-instance 渲染该快照且无覆盖该字段
- **THEN** 嵌套实体盒应用相同 borderRadius 与填色
- **AND** 叶子盒 overflow 为 hidden，使圆角裁剪内部 Material 层

#### Scenario: 宿主不贡献第二层填色

- **WHEN** 页面渲染合法 component-instance
- **THEN** 用户可见的填色与圆角来自嵌套文档解析结果
- **AND** 宿主 Entity 不以不透明 Appearance 再铺一层盖住或露出第二套色块

### Requirement: WidgetSwitcher 物料与切换能力

Materials MUST 发布 `widget-switcher` Entity Preset：Component 组合与 Container 一致（Transform、
LayoutItem、Visibility、Lock、Hierarchy、Clip、Appearance），并额外携带
`WidgetSwitcher: { activeIndex: 0 }`。该 Preset MUST 出现在默认 Palette 中——它没有其他创建入口。

Materials MUST 注册 `widget-switcher` 内建能力。该能力 MUST 只创建 `WidgetSwitcher` 一个
Component——能力添加会拒绝已存在的 Component Key，连带创建 Hierarchy/Clip 会让「给已有容器追加切换
语义」这一主用法被判为冲突。添加该能力 MUST NOT 改动目标已有的 `childIds`；移除该能力 MUST 只移除
切换语义，子项全部保留。

Materials MUST 为 `WidgetSwitcher` 注册带 Inspector 的 Component 定义，用于编辑活动索引并呈现当前
子项数量。Inspector 一次编辑 MUST 只派发一条 Component 更新命令。

子项 MUST 沿用现有 `LayoutItem` 语义：WidgetSwitcher MUST NOT 引入 switcher 专属的 padding、对齐或
强制填满规则，也 MUST NOT 覆盖用户为子项设置的 Flow/Absolute 与尺寸。

#### Scenario: 创建 WidgetSwitcher

- **WHEN** Registry 从 `widget-switcher` Preset 创建 seed
- **THEN** seed 是合法独立 ComposeEntity，带空 Hierarchy 与 `activeIndex: 0`
- **AND** Composition 记录 `widget-switcher` Preset 与其基础 Component Keys

#### Scenario: 给已有容器追加切换能力

- **WHEN** 用户向一个含子项的 Container 添加切换能力
- **THEN** 该 Container 获得 `WidgetSwitcher` 且 `childIds` 不变
- **AND** 画布上只显示 `activeIndex` 指向的子项

#### Scenario: Inspector 切换活动索引

- **WHEN** 用户在 Inspector 把活动索引从 0 改为 1
- **THEN** 只派发一条更新 `WidgetSwitcher` 的命令
- **AND** Undo 一次即恢复原索引，子项的 LayoutItem 与 Visibility 不变

### Requirement: 容器分轴溢出 Inspector

系统 MUST 让所有具有 Hierarchy 的基础物料通过容器 Inspector 独立配置横向与纵向溢出策略，
且新建容器默认在两个轴裁剪内容。

#### Scenario: 配置纵向滚动

- **WHEN** 用户将容器纵向溢出设置为滚动
- **THEN** Inspector 通过单个 Core 命令写入完整且规范化的横纵轴值

### Requirement: 内建 Inspector 提供重置基线

内建 Component Inspector 与 Renderer Inspector MUST 向 `ComposePropertyPanel` 传入稳定的
`defaultValue`，使属性行的重置动作与“已修改”筛选可用。基线 MUST 由 Component/Renderer
Definition 的默认值派生，MUST 能通过该 Inspector 自身的 schema 校验，且 MUST NOT 依赖当前
受控 value。没有与实例无关默认值的字段（如位置、尺寸）MUST NOT 出现在基线中。

#### Scenario: 修改背景填充后出现重置

- **WHEN** 用户把某个基础物料的 Appearance 背景填充改为与默认 Solid Paint 不同的值
- **THEN** 该属性行的操作列显示重置动作
- **AND** 执行重置后 Appearance 背景恢复为定义中的默认 Solid Paint

#### Scenario: 属性等于默认值时不显示重置

- **WHEN** 某属性的当前值与其基线深度相等且该属性没有后代绑定
- **THEN** 该属性行不显示重置动作

#### Scenario: 位置与尺寸不参与重置

- **WHEN** 用户在几何 Inspector 中修改位置或尺寸
- **THEN** 这两个字段不显示重置动作
- **AND** 同一 Inspector 中的旋转与外边距在偏离默认值时仍显示重置动作

#### Scenario: 重置 Renderer 属性保留 schema 之外的字段

- **WHEN** Renderer props 含 schema 未覆盖的宿主字段且用户重置某个 schema 内属性
- **THEN** 派发的 props 中该属性恢复为 Definition 默认值
- **AND** 宿主扩展字段保持不变

### Requirement: Figma 基线的 Text 默认值与排版

Materials MUST 以 Inter Regular 12px、白色文字填充、自动行高、左对齐、顶部对齐、原始大小写和无文字装饰创建新的 Text Preset。Text Renderer MUST 支持并公开 `textAlign`、`verticalAlign`、`textCase` 与 `textDecoration`，且 Inspector、Stage、Preview、Renderer measurement MUST 使用相同的 Props Contract。颜色 MUST 继续属于 Text 内容分类；字体、对齐、大小写与装饰 MUST 属于排版分类。

#### Scenario: 创建默认 Text

- **WHEN** Registry 从 Text Preset 创建一个新 Entity
- **THEN** Renderer Props 使用白色 Inter 12px 的基础文字样式，且不持久化数值 lineHeight
- **AND** LayoutItem 的宽度和高度均为 `hug`

#### Scenario: 编辑文字排版

- **WHEN** 用户在 Text Inspector 修改对齐、大小写或文字装饰
- **THEN** Stage 与 Preview 立即以相同方式渲染该 Text
- **AND** 影响文字字形的大小写设置同时用于 Hug measurement，schema 外 authored props 保持不变

#### Scenario: 读取旧 Text

- **WHEN** v6 Text 缺少新的排版字段，或缺少颜色字段
- **THEN** 显式既有颜色、字号、字体和行高保持不变
- **AND** 缺失颜色回退为白色，缺失排版字段保持旧的垂直居中、原始大小写和无装饰行为

### Requirement: Text 内容尺寸贴合

Text Preset MUST 为 `hug × hug` 提供不大于默认文字内容的回退尺寸，并使用既有 isolated measurement 收敛到真实文本尺寸；透明 Appearance MUST 不产生文字外框。

#### Scenario: 默认文字选区贴合内容

- **WHEN** 新 Text 的 Layout Runtime 完成 measurement
- **THEN** Layout snapshot 的选区宽高等于 Text Renderer 的内容尺寸
- **AND** 不保留 280×72 的固定默认文本框

### Requirement: 形状类 Material 不得覆盖 Appearance 填色

形状类基础物料（至少包含 Rectangle）的 Renderer 根节点 MUST NOT 使用不透明 CSS 默认背景覆盖 Entity Appearance。填色、圆角与阴影 MUST 由共享 Appearance / Paint 层表达；Material 仅承担内容占位或非填色职责。默认视觉值 MUST 写在 Preset/seed 的 Appearance 上，不得依赖 Material 样式表中的第二套默认色。

**带 `Curve` 的 Entity 是本条唯一的例外**：它的填色由 Material 自己的 SVG `fill` 绘制，
宿主盒与共享 Paint 层 MUST NOT 为它绘制任何背景。盒是矩形而形状不是，让共享层画等于把
一块矩形色块摆在形状后面。判据 MUST 是 `Curve` Component 而不是 Renderer 类型。

#### Scenario: Rectangle 改色不被 Material CSS 盖住

- **WHEN** Rectangle Entity 的 Appearance.backgroundPaint 为非默认 solid 色且 borderRadius 非 0
- **AND** Stage、Preview 或 component-instance 嵌套路径渲染该 Entity
- **THEN** 可见填色与 computed 背景反映 Appearance 色值
- **AND** Material 根节点不绘制与 Appearance 冲突的默认蓝底

#### Scenario: Rectangle 默认外观来自 seed Appearance

- **WHEN** Registry 从默认 rectangle Preset 创建 seed
- **THEN** Appearance 含明确的默认 solid 填色与 borderRadius

#### Scenario: 曲线的填色不落在宿主盒上

- **WHEN** 一个闭合曲线 Entity 的 Appearance.backgroundPaint 为不透明 solid 色
- **THEN** 宿主盒的 computed 背景是透明的
- **AND** 可见色块的轮廓是该几何而不是矩形

### Requirement: 页面实例使用空心组件符号

`component-instance` 在场景树与依赖 Registry preset 图标的呈现中 MUST 使用空心（描边）组件符号，
以表示页面引用而非库内主组件本体。主组件 preset 图标 MUST 为实心同形符号。该规则 MUST 与组件库
中主组件/变体图标体系一致，且 MUST NOT 仅依赖颜色区分。

#### Scenario: 场景树实例图标为空心

- **WHEN** 页面场景树渲染 component-instance 节点
- **THEN** 行图标为空心组件符号
- **AND** 与普通 Rectangle/Container 物料图标可区分

#### Scenario: 主组件库图标为实心

- **WHEN** 组件库展示主组件资源
- **THEN** 图标为实心组件符号

### Requirement: Frame 几何编辑约束

几何分组 MUST 是 Frame 尺寸的唯一入口。拥有 `Frame` 的 Entity MUST 满足两条约束：
尺寸模式 MUST 只提供固定值——`Frame` 禁止 Hug，在 UI 上暴露一个提交必然被文档校验拒绝的
选项没有意义；尺寸提交 MUST 改派 `entity.frame.size.set`，使 `Frame.size` 与布局回退在同一个
事务里保持一致，MUST NOT 只更新 `LayoutItem`——布局求解读的是 `Frame.size`，只写 `LayoutItem`
会让文档变了而画面不动。

#### Scenario: Frame 的尺寸只有一个入口

- **WHEN** 用户选中一个 Frame 并修改几何分组的尺寸
- **THEN** 系统派发 `entity.frame.size.set`，`Frame.size` 与布局回退同时更新
- **AND** 尺寸模式不提供 Hug 选项

#### Scenario: Auto Layout Frame 也不提供 Hug

- **WHEN** 用户为一个 Frame 启用 Auto Layout
- **THEN** 尺寸模式仍然只有固定值

### Requirement: 场景 Entity Preset

基础物料 MUST 注册一个 id 与 Frame Entity 的 `Composition.presetId` 一致的 Entity Preset，
使所有按 presetId 查询 Registry 的位置都能解析到它。该 Preset MUST 使用与 Container Preset
相同的图标，但默认外观 MUST 取自 core 的场景默认外观（透明背景、无边框）而不是 Container
Preset 的默认外观——场景背景是会被发布出去的真实像素，由用户决定；默认 Clip MUST 为不裁剪
——场景是绝对坐标的原点与工作区里的画板，内容越界默认可见，与「新建场景」命令及初始场景的
行为一致；需要裁剪时由用户在溢出属性里显式开启。Preset MUST 标记为面板隐藏——场景由绘制或
具名动作产生，MUST NOT 出现在基础组件面板里供拖拽。

#### Scenario: 场景 Preset 可从 Registry 解析

- **WHEN** 宿主用 Frame Entity 的 `presetId` 查询 Registry
- **THEN** 返回场景 Preset，其图标与 Container Preset 相同且默认 Clip 为不裁剪

#### Scenario: 场景 Preset 背景透明而容器不透明

- **WHEN** 分别用场景 Preset 与 Container Preset 创建 Entity
- **THEN** 场景的 `Appearance.backgroundPaint` 是透明的，容器的仍是深色

#### Scenario: 场景不出现在物料面板

- **WHEN** 基础组件面板列出可拖拽物料
- **THEN** 列表中不含场景，且列表内容不因新增该 Preset 而改变

### Requirement: 忽略 Auto Layout 开关

几何 Inspector MUST 为父级是 Layout 容器的 Entity 提供脱离父级排布的开关，作为
Flow↔Absolute 的唯一显式转换入口；父级不是 Layout 容器时 MUST NOT 显示该开关。
开关文案 MUST 跟随父级的布局类型：父级是 Auto Layout 时是「忽略 Auto Layout」，
父级是网格时是「忽略网格」——一个说 Auto Layout 的开关出现在网格容器的子级上，
用户会以为自己看错了面板。

开启（脱流）MUST 在单条事务内：把 `positioning` 切为 `absolute`，offset 从当前布局 box 反算使
视觉位置不变，并把 fill 轴烘焙为 fixed（值取当前求解尺寸），与 reparent 移出 Flow 的既有烘焙
规则一致。父级是网格时同一条事务 MUST 一并删除该 Entity 的 `GridItem`，并把当前解算尺寸烘焙
为 fixed——网格子级的轴尺寸模式在格中被忽略，脱流后必须有一个确定的尺寸。

关闭（回流）MUST 在单条事务内把 `positioning` 切回 `flow`，保持当前 `childIds` 位置
不变，并按进入 Auto Layout 容器的既有交叉轴采纳规则处理 axis sizing。父级是网格时
MUST 改为按当前视觉位置与尺寸就近落格并写入 `GridItem`，且 MUST 走同一个网格求解器处理
落格产生的碰撞。两个方向 MUST 均可一次 undo 恢复。

#### Scenario: 开启开关脱流且视觉位置不变

- **WHEN** 用户对 Auto Layout 容器内的 Flow 子级开启「忽略 Auto Layout」
- **THEN** 一条事务把该子级切为 Absolute，offset 反算自当前布局 box，fill 轴烘焙为 fixed
- **AND** 切换前后子级在画布上的视觉位置一致，undo 一次恢复

#### Scenario: 关闭开关回流并采纳容器规则

- **WHEN** 用户对已脱流的子级关闭「忽略 Auto Layout」
- **THEN** 一条事务把该子级切回 Flow，`childIds` 位置不变
- **AND** axis sizing 按进入容器的既有采纳规则改写，undo 一次恢复

#### Scenario: 网格子级脱流时删除 GridItem

- **WHEN** 用户对网格容器内的子级开启「忽略网格」
- **THEN** 一条事务把该子级切为 Absolute、删除其 `GridItem`，并把当前解算尺寸烘焙为 fixed
- **AND** 切换前后视觉位置与尺寸一致，undo 一次恢复

#### Scenario: 网格子级回流时就近落格

- **WHEN** 用户对网格容器内已脱流的子级关闭「忽略网格」
- **THEN** 一条事务按其当前视觉位置与尺寸写入最接近的 `GridItem` 并切回 Flow
- **AND** 落格产生的碰撞按网格求解器推挤，undo 一次恢复

#### Scenario: 开关文案跟随父级布局类型

- **WHEN** 选中的 Entity 父级是网格容器
- **THEN** 开关文案是「忽略网格」
- **AND** 父级是 Auto Layout 容器时文案是「忽略 Auto Layout」

#### Scenario: 非 Layout 父级不显示开关

- **WHEN** 选中 Entity 的父级不是 Layout 容器
- **THEN** 几何 Inspector 不渲染该开关
- **AND** 其余几何字段呈现不受影响

### Requirement: Inspector 数值显示精度

物料 Inspector 自有的数值输入（位置、尺寸、边距等）MUST 与 Property Panel 采用同一显示精度：
最多 2 位小数，整数不补零，小数去掉尾随零。Fill/Hug 轴显示模式名而不是数值的行为不变。

显示精度 MUST NOT 改写底层值，也 MUST NOT 因格式化而在用户未编辑时提交。

#### Scenario: 位置与尺寸按 2 位显示

- **WHEN** 一个 Entity 的 LayoutItem 偏移为 `82.96874999999991`、宽度为 `373.3592610597958`
- **THEN** Inspector 的位置 X 显示 `82.97`，尺寸宽度显示 `373.36`

#### Scenario: Fill 轴仍显示模式名

- **WHEN** 宽度轴为 Fill
- **THEN** 尺寸宽度显示 `Fill` 而不是数值

### Requirement: Interaction Component 定义与 Inspector

基础物料包 MUST 为 `Interaction` 注册带 Inspector 的 Component 定义,使用户可以在属性面板中
为**任意** Entity 添加、编辑与移除交互,而不需要该 Entity 是特定物料。Inspector MUST 以
trigger 列表呈现,每行选择事件与动作;动作为 `navigate` 时 MUST 提供页面目标选择,并 MUST
复用既有的 node 属性页面拖入赋值,MUST NOT 另建一套页面选择器。

Inspector MUST 对目标为空、目标页面不存在这两种状态给出明确呈现,并 MUST 允许移除单个
trigger 而不移除整个 `Interaction`。trigger 列表的长度上限 MUST 等于当前支持的事件数量——
文档拒绝重复事件,列表若能加出第二条同事件 trigger,用户只会看到"点了没反应"。
所有编辑 MUST 通过文档命令派发,单次用户操作 MUST 只产生一条可撤销事务;Schema 之外的
字段(如 `action.params`)MUST 在写回时原样保留。

#### Scenario: 给矩形添加跳转

- **WHEN** 用户选中一个 Rectangle 并在属性面板添加 click→navigate 交互
- **THEN** 该 Entity 获得 `Interaction`,`triggers` 含一条 click 条目
- **AND** 撤销一步即回到没有 `Interaction` 的状态

#### Scenario: 拖入页面设置目标

- **WHEN** 用户把资源面板中的页面文件拖到交互行的目标字段
- **THEN** 目标写入该页面的稳定引用
- **AND** 拖入非页面文件时不被接受

#### Scenario: 目标页面缺失

- **WHEN** 已配置的目标页面在当前目录中不存在
- **THEN** Inspector 以明确的错误状态呈现该行
- **AND** 文档中的引用不被自动清空

#### Scenario: 移除 trigger 保留 Component

- **WHEN** 用户移除 Entity 上唯一一条 trigger
- **THEN** 只派发一条命令,`Interaction` 仍然附着且 `triggers` 为空数组
- **AND** 移除整个 `Interaction` 是另一个显式操作

#### Scenario: 不产生重复事件的 trigger

- **WHEN** Entity 已有一条 click trigger,用户再次点击列表的添加入口
- **THEN** 不派发任何命令
- **AND** 文档中的 trigger 数量不变

### Requirement: Image 与 SVG 物料

Image 与 SVG MUST 分别使用 resolved asset natural size 与 SVG intrinsic box 作为 Hug
measurement，并在各自 subscription revision 变化时失效。

#### Scenario: 异步资源驱动 Hug
- **WHEN** Hug Image 或 SVG 的资源从 loading 变为 ready 或发布新 revision
- **THEN** 首帧使用 LayoutItem fallback，ready 后使用新的 intrinsic size 重排
- **AND** 失败状态保持 fallback 与可访问占位，不修改文档

### Requirement: curve 物料渲染并编辑曲线 Entity

`curve` 物料 MUST 提供 Preset、SVG Renderer 与 Component Definition：Renderer MUST 从
`Curve` Component 读取几何并以 `overflow: visible` 渲染，使几何可以贴着退化盒的边绘制；
Definition 的端点编辑 MUST 派发曲线几何写入漏斗命令，MUST NOT 直接写文档。

描边（颜色、线宽、线型）MUST 作为 Renderer props 承载，复用 Inspector、数据绑定与外观
轨道的既有机制。仓库中 MUST NOT 再存在第二个绘制线条的物料——「盒 + 方向」与「坐标」是同一件
事的两种表示，留下的是坐标那一种。

Renderer MUST 按 `kind` 分派 SVG 元素：`line` 与 `polyline` 各用**一个**元素（闭合多段线用
`polygon`），弧用 `path`，**整圆用 `circle`**——SVG 的 `A` 命令在起终点重合时画不出东西。
`path` MUST 用**一个** `<path>`：全部子路径写进同一个 `d`，闭合的子路径以 `Z` 收尾。
拆成多个元素会让填充规则失效——洞与实心的区别正是同一个 `d` 内多条子路径共同决定的。
`path` 的 `fill-rule` 属性 MUST 由 `Curve.fillRule` 推出，缺席时 MUST NOT 写出该属性。

未填充时命中 MUST 继续由透明加宽 stroke 承担，MUST NOT 因 `kind` 变化而改用盒判定。

命中层的宽度 MUST 由 `COMPOSE_CURVE_PICK_TOLERANCE` 推出（两倍容差，与视觉线宽取较大者），
MUST NOT 在本包另写一个数——它同时是 Stage 拾取框的来源，各写一份必然漂移。命中层的
`stroke-linecap` MUST 为 `butt`，MUST NOT 为 `round`：后者让命中区从两端各伸出半个带宽，
成为包围盒的超集。这一条只作用于两个自由端，多段线拐角仍由 `stroke-linejoin` 覆盖。

Inspector MUST 按 `kind` 呈现对应的几何字段，全部写入 MUST 走同一条漏斗命令。
`path` MUST NOT 呈现逐控制点的几何字段：一条导入来的路径有几十个控制点，逐点列出的面板既读
不懂也点不动，而它的几何编辑入口在画布上（顶点方块与控制手柄）。描边、填充与变换字段照常呈现。

#### Scenario: 渲染跟随几何

- **WHEN** 通过漏斗命令修改线的端点
- **THEN** 画布与预览中的线立即按新几何渲染

#### Scenario: Inspector 编辑端点

- **WHEN** 在属性面板修改端点坐标
- **THEN** 派发漏斗命令，撤销一步回到原几何

#### Scenario: 描边经由 Renderer props

- **WHEN** 在属性面板修改描边颜色或线宽
- **THEN** 变更写入 Renderer props 并即时渲染，可参与数据绑定

#### Scenario: 带洞的路径渲染成一个元素

- **WHEN** 渲染一条含两条子路径、`fillRule` 为 `evenodd` 的 `path`
- **THEN** 页面里是**一个** `<path>`，`fill-rule` 为 `evenodd`，洞是透的

#### Scenario: 缺席的 fillRule 不写属性

- **WHEN** 渲染一条 `fillRule` 缺席的 `path`
- **THEN** 元素上没有 `fill-rule` 属性

#### Scenario: path 的 Inspector 不列控制点

- **WHEN** 选中一条 `path` 曲线
- **THEN** 属性面板呈现描边与填充分组，不呈现任何逐点几何字段

### Requirement: 几何 Inspector 提供旋转基点

几何分组 MUST 提供「旋转基点」字段，v1 MUST 以九个锚点（四角、四边中点、中心）呈现。

文档字段 MUST 保持自由二维点：UI 的取值约束 MUST NOT 上升为协议的约束，将来补自定义数值
输入或画布手柄时 MUST NOT 需要改动协议。

基点写入 MUST 走通用的 Component 更新命令，MUST NOT 塞进承载位置/尺寸/旋转的几何变换命令
——后者的载荷是 Stage 几何编辑的合成值，本来就没有基点的位置。

#### Scenario: 选择锚点写入基点

- **WHEN** 在几何分组把旋转基点选为左边中点
- **THEN** 该 Entity 的 `Transform.pivot` 为左边中点，且可撤销

#### Scenario: 未设基点时显示为中心

- **WHEN** 选中一个没有设置基点的 Entity
- **THEN** 旋转基点显示为中心

### Requirement: 组件实例的动画播放头

`component-instance` Renderer MUST 声明两条可绑定的 value Prop Contract：`animation`
（组件根 Frame 动画清单中的动画 id，允许 `null`）与 `animationTime`（播放头毫秒）。
Renderer MUST 在解析完实例覆盖之后、把文档交给嵌套 Layout Runtime 之前，按这两个值对嵌套
文档采样一次；采样结果 MUST NOT 被写回文档、覆盖或任何持久化位置。

`animationTime` MUST 被钳制到所选动画的 `[0, durationMs]`。`animation` 缺席或为 `null` 时
MUST NOT 采样，且 MUST NOT 回退到清单中的第一条动画。`animation` 指向清单中不存在的 id 时
MUST NOT 采样，MUST 保留该值不被静默清空，且 Inspector MUST 把它呈现为失效——「还没配」与
「配错了」必须可区分。

Renderer MUST 提供 Inspector，用组件根 Frame 清单构建动画下拉，并让两条 Prop 都可通过既有
Renderer 绑定入口绑定到页面导出。采样在 `editor` 与 `preview` 两种模式下 MUST 行为一致。

#### Scenario: 播放头驱动实例内部姿态

- **WHEN** 实例引用的组件含一条旋转动画，`animation` 选中它且 `animationTime` 从 0 改到轨道终点
- **THEN** 实例内部对应 Entity 的呈现按该时刻的采样值变化
- **AND** 实例覆盖与组件源均未被修改

#### Scenario: 未选择动画时逐像素不变

- **WHEN** 实例的 `animation` 缺席
- **THEN** 嵌套文档不被采样，渲染结果与不带这两个 Prop 时逐像素相同
- **AND** 不因此触发一次多余的嵌套布局重解

#### Scenario: 失效动画 id 可判别

- **WHEN** 实例的 `animation` 指向组件清单中已不存在的 id
- **THEN** 实例不采样且保留该值
- **AND** Inspector 把该项呈现为失效，而不是显示为「未选择」

#### Scenario: 播放头超出时长被钳制

- **WHEN** 绑定的导出给出大于动画时长的毫秒值或负值
- **THEN** 实例按 `[0, durationMs]` 内的端点采样
- **AND** 不产生错误状态

#### Scenario: 编辑期与预览一致

- **WHEN** 同一实例在 Stage（`editor`）与 Preview（`preview`）中以相同绑定值渲染
- **THEN** 两处呈现同一时刻的姿态

### Requirement: 曲线按 viewBox 跟随盒伸缩

curve 物料 MUST 用 `viewBox` 把几何映射进盒：`viewBox` 等于几何的紧包围盒，
`preserveAspectRatio` MUST 允许非等比拉伸。盒因此可以由 resize 手柄或布局求解独立决定，
而画出来的形状跟着变。

MUST NOT 改成「改盒时顺手重写几何」：那只挡得住手势那一条路径，而布局求解也会改盒且没有
手势可以挂钩子——症状是「手动拖没问题、进容器就错位」。

描边 MUST 中和 viewBox 变换（`vector-effect: non-scaling-stroke`），否则非等比盒会把线宽
一起拉扯成「横细竖粗」，而用户什么都没改。这一条与既有的「线宽反向除掉画布缩放」**不重复**，
两者各中和一段变换：前者管 viewBox 到盒，后者管 Stage Scene 外层 HTML 的整体缩放。实现处
MUST 写明这个区别——既有注释里「`non-scaling-stroke` 在这里不管用」说的是外层 HTML 变换，
不写清楚会让下一个人把本能力的 `vector-effect` 当成无效代码删掉。

描边的**全部**几何量都被这一条中和，虚线间隔也在内：SVG 没有只中和线宽而不中和虚线的开关。
因此规则是「**几何参与 viewBox 变换，描边不参与**」——一句话，没有例外，比逐项列举更不容易
被后来者改坏。

曲线 MUST NOT 再关闭盒缩放：它当初关掉的理由是「盒缩放该不该等比缩放几何点还没定」，而本
能力给出了答案——盒自由，几何按比例呈现。曲线 MUST 与其他 Entity 一样显示四角手柄。

#### Scenario: 曲线有盒手柄

- **WHEN** 选中一条曲线
- **THEN** 四角缩放手柄可见可拖

#### Scenario: 拖盒手柄时形状跟着变

- **WHEN** 把一条弧的盒拉宽到两倍
- **THEN** 画出来的弧也宽了两倍

#### Scenario: 非等比盒里线宽保持均匀

- **WHEN** 把一个曲线的盒拉成宽扁形状
- **THEN** 竖直笔画与水平笔画的视觉宽度相同

#### Scenario: 画布缩放仍不改变线宽

- **WHEN** 在非 100% 画布缩放下渲染同一条曲线
- **THEN** 描边的实际触达宽度与 100% 时相同

#### Scenario: 虚线间隔不被盒拉伸

- **WHEN** 把一条虚线曲线的盒拉宽
- **THEN** 虚线的间隔与拉宽前相同

#### Scenario: 退化轴不塌陷

- **WHEN** 渲染一条水平线
- **THEN** 它按盒的宽度伸缩，且没有出现除零导致的空白

### Requirement: 曲线承载填充与端点 marker

`curve` 物料 MUST 支持填充与端点 marker，两者合起来是 `shape` 物料相对它仅有的差额。

**填充 MUST 复用 `Appearance.backgroundPaint`**，MUST NOT 新增 Renderer prop：填充要参与
命中，而命中路径读的字段 MUST 是文档级契约。复用还让外观 Inspector、数据绑定与外观动画
轨道一样都不用做。v1 MUST 只绘制 `solid`；非纯色 Paint 在曲线上不填充。

填充 MUST 按 SVG 自身的规则作用于几何，MUST NOT 前置判断 `closed`：开放几何按隐式闭合填充，
渲染与命中因此自动一致。

**端点 marker MUST 作为 Renderer props 承载**（`markerStart` / `markerEnd`，取值至少含
`none` 与 `arrow`）：只有渲染与 Inspector 读它。默认无 marker，Arrow Preset 默认终点为箭头。

marker MUST 参与 `viewBox` 变换——它是画在端点上的一小片形状，属于「几何参与变换，描边不
参与」里的几何那一半。MUST NOT 为它开例外：整个图形被非等比盒拉扁时，箭头不跟着扁才是错的。

#### Scenario: 填充跟随形状而不是盒

- **WHEN** 把一个整圆曲线的 Appearance 背景设成不透明纯色
- **THEN** SVG 的几何元素以该颜色填充
- **AND** 宿主盒不绘制背景

#### Scenario: 默认曲线不填充

- **WHEN** 从默认 Curve Preset 创建 Entity 并渲染
- **THEN** 几何不被填充，渲染结果与本能力之前逐像素相同

#### Scenario: 箭头附着在终点

- **WHEN** 渲染一个 `markerEnd` 为箭头的两点直线
- **THEN** 箭头画在几何的终点上并朝向线的方向

#### Scenario: 箭头跟随非等比盒变形

- **WHEN** 把带箭头的直线的盒拉成宽扁形状
- **THEN** 箭头按与线相同的比例变形

### Requirement: Ports Component Inspector

`Ports` MUST 自带内建 Component Inspector，能增删端口项并编辑 id 与位置，写回 MUST 走既有的
Component 更新命令，MUST NOT 为端口新增命令——端口是一个普通 Component 的普通字段。

Inspector MUST 列出当前全部端口。它是端口的**编辑**入口；查看则不再限于此——端口在命令取点
期间会在图面上按符号整组显现（见 `stage`）。Inspector 因此 MUST NOT 依赖「图面上什么都不画」
这个前提来论证自己的存在，它的理由是编辑：改 id、改位置、增删项在图面上都做不了。

#### Scenario: 增删端口各产生一条命令

- **WHEN** 用户在 Inspector 里添加一个端口，再删掉一个
- **THEN** 各派发一条 Component 更新命令，撤销一步各自回退

#### Scenario: 列出全部端口

- **WHEN** 选中一个带两个端口的 Entity
- **THEN** Inspector 列出这两个端口的 id 与位置

### Requirement: Wire Inspector 显示两端的绑定状态

`Wire` MUST 自带内建 Component Inspector，为两端各显示三种状态之一：自由、已绑到某个端口、
**失效**（绑定指向的实体或端口不存在）。

失效 MUST 与自由可区分。两者的几何都来自作者文档，屏幕上看不出差别，而含义完全不同——一个是
作者本来就没接，另一个是接过的东西没了。这与实例动画把失效的清单引用标出来是同一条判断。

**已绑定与失效的那一端 MUST 提供解除入口**，写入走 `entity.component.update`。合并 `WIRE`
进 `LINE` 之后，「端点落在端口上」与「绑定」不再可分，画布上因此没有任何手势能只解除绑定而
不动几何——拖开端点会连位置一起改。没有这个入口，用户能进入这个状态却出不来。

两端都解除后整个 `Wire` MUST 删除：不带任何绑定的 `Wire` 读不出意图，与曲线外观「三项全清
就整个删掉」是同一条判断。

解除 MUST NOT 出现在自由端上：那里没有可解除的东西，一个恒为禁用的按钮只会让人以为它坏了。

#### Scenario: 三种状态各自可读

- **WHEN** 一条导线一端自由、一端绑定，另一条导线的绑定目标已被删除
- **THEN** Inspector 分别显示自由、已绑定与失效

#### Scenario: 解除一端

- **WHEN** 在一条两端都绑定的导线上解除起点
- **THEN** 起点变成自由端、终点的绑定不变，且几何一个像素都不动

#### Scenario: 解除最后一端即删掉 Wire

- **WHEN** 解除一条只剩一端绑定的导线的那一端
- **THEN** 该 Entity 不再带 `Wire`

#### Scenario: 自由端没有解除入口

- **WHEN** 查看一条两端都自由的曲线
- **THEN** Inspector 上没有解除按钮

### Requirement: 曲线的虚线偏移

Curve Renderer MUST 提供 `strokeDashoffset` 数值 prop，默认 `0`，缺席时 MUST NOT 产生任何
偏移——不写该 prop 的曲线渲染输出 MUST 与引入本属性之前逐像素一致。

该属性 MUST 走 Renderer props 而不是 `Curve` Component：它只有渲染与 Inspector 读，因此
沿用既有描边属性的归属，白拿数据绑定与外观关键帧轨道。轨道路径
`['Renderer','props','strokeDashoffset']` MUST NOT 需要动画引擎或文档协议的任何改动——
采样器按 `[componentKey, ...rest]` 写值。

本属性是「让导线看起来在流动」的**唯一**机制：系统 MUST NOT 为此引入命令或预设动画。
自动算出一个完整虚线周期需要 dash pattern 的世界长度，而当前的 `strokeDasharray` 是由线宽
推出的 picklist，正处于已立项的单位错配之中；把周期算进命令语义会把该缺陷固化。

打点入口 MUST 与其他可动画属性一致：Renderer 分组的字段 MUST 能拿到关键帧装饰，自动记录
MUST 认得 Renderer props 的编辑并改写成播放头处的关键帧。缺任一处，该属性就是一个用户永远
打不了点的属性——**「加了一个属性」与「加了一个能力」之间隔着 UI 的三段接线**。

Renderer props 是**开放**记录（每个物料自定义），因此自动记录 MUST 按白名单逐条放行，
MUST NOT 采用 `Appearance` 那条「除了这几个字段之外都不许变」的规则——那会把每一次普通的
props 编辑都判成不可改写。

#### Scenario: 缺席即不偏移

- **WHEN** 一条曲线的 Renderer props 不含 `strokeDashoffset`
- **THEN** 渲染输出不含该属性，与引入前一致

#### Scenario: 偏移随关键帧变化

- **WHEN** 为一条虚线曲线的 `['Renderer','props','strokeDashoffset']` 打两个关键帧并播放
- **THEN** 虚线图案沿线移动，中间时刻取到的是插值出来的第三个值
- **AND** 几何、命中与捕捉都不受影响

#### Scenario: 动画模式下改值进关键帧而不是静态值

- **WHEN** 动画模式开着自动记录，用户在属性面板把虚线偏移改成另一个值
- **THEN** 播放头处产生一个关键帧
- **AND** 同一次编辑里若还改了不可动画的 Renderer prop，则整条命令原样放行，不做部分改写

### Requirement: 圆角多段线渲染成 path

曲线 Renderer MUST 在 `cornerRadius` 在场时把多段线画成 `<path>`，每个角一段圆弧、每条边
一段按切点缩短的直线；闭合时以 `Z` 收尾。缺席时 MUST 仍然是 `<polyline>` / `<polygon>`——
那一档一个字节不变，圆角只是多一条支路。

`d` MUST 由 core 求出来的那**一列**轮廓片段翻译而来，MUST NOT 在渲染层另算一遍圆角：命中与
框选读的是同一列，两处各算一遍会让「看得见的形状」与「点得中的形状」慢慢分家。

角弧的 large-arc 标志 MUST 恒为 0：内切圆角按定义不超过 180°。

曲线 Inspector MUST 提供「圆角」数值字段，与画布上的手柄是同一个值的两个入口。面板上的 0
MUST 写成**删掉这个字段**而不是写 0。

#### Scenario: 圆角在场时换成 path

- **WHEN** 渲染一条带 `cornerRadius` 的闭合四顶点多段线
- **THEN** 描边元素是 `<path>`，`d` 里有四段 `A` 与四段 `L`，以 `Z` 收尾

#### Scenario: 缺席时仍是 polygon

- **WHEN** 同一条多段线没有 `cornerRadius`
- **THEN** 描边元素仍然是 `<polygon>`

### Requirement: 矩形只指一件东西

物料面板里的「矩形」与 `RECTANGLE` 命令 MUST 落地**同一个** Preset（`rect`）：闭合四顶点
多段线、`curve` Renderer。同一个词指两件行为不同的东西，是用户自己发现不了、只能靠试出来的
一类缺陷。

`rect` MUST **与其他曲线一样默认空心**：这个产品里的矩形是设备外框、柜体轮廓与分区框，套在
符号外面，默认填色会把里面的符号整片盖住，而那发生在每一次画外框。默认空心的代价是盒内部不
命中，它由两处承担——选中之后边缘的缩放命中带整条让到盒外（描边连同它的容差归**移动**），
以及**盒内双击**进几何编辑。默认描边 MUST 保留：它是空心矩形在画布上唯一可拖的那几个像素，
去掉描边等于「让它消失」。填充与否 MUST NOT 影响顶点编辑——双击进几何编辑只问有没有 `Curve`。

带背景、边框与圆角的那个盒物料 MUST 从物料面板**退役**（`paletteHidden`）：两个长得一样的
条目是用户自己发现不了的那类缺陷，而新建入口归 `rect`。它的 Preset 与 Renderer MUST 保留且
协议 id（都是 `rectangle`）MUST NOT 改——既有文档里的每一个盒都靠它找到渲染器，退役的是新建
入口而不是渲染能力。它剩下的独占能力（渐变/图片背景、`Appearance` 边框）由**容器**承担：
容器有全套 Appearance 且能装子级，盒物料本来就是它去掉子级的版本。

`rect` MUST 出现在物料面板上，这是对「工具栏已提供入口的 Preset 默认不进面板」的一处**有意
偏离**：物料面板是新手唯一的发现面，而矩形是最先被找的那一个。

引擎 MUST 在效果上显式说出「这一步产出的是矩形」，MUST NOT 由宿主按 `kind` 反推——`PLINE`
画四个点按 `C` 同样得到闭合四顶点折线，而那时用户要的确实是折线。

#### Scenario: 两条入口产出同一种东西

- **WHEN** 分别用物料面板的「矩形」和 `RECTANGLE` 命令各造一个
- **THEN** 两者使用同一个 Preset，都带闭合四顶点 `Curve`，场景树里都叫 Rectangle

#### Scenario: 默认空心因此内部不命中

- **WHEN** 画一个矩形并点它的内部
- **THEN** 它不被选中——命中由描边承担
- **AND** 在内部双击仍然进入几何编辑

#### Scenario: 盒物料退役但 id 不变

- **WHEN** 查阅物料面板与盒物料的 Preset
- **THEN** 面板上没有它的条目，而 Preset id 与 Renderer type 仍是 `rectangle`

### Requirement: junction Preset 是接线节点

Materials MUST 发布 `junction` Entity Preset，作为 `curve` 物料的**第五个起点**：它 MUST 组合
`Curve`（四顶点的闭合多段线，即填满盒的方块）、填实的 `Appearance.backgroundPaint`，以及一个
`Ports`——单个端口，位置在盒心。

**方块而不是圆点是一条画法上的决定**：圆点是 KiCad 与多数原理图工具的画法，方块是端子类符号的
画法。判据在领域里而不在代码里，因此这里只记结果。代价记在明处：`vertex` 夹点也是方块——两者不会
落在同一个对象上（接线点进不了几何编辑会话），且一个是墨、一个是 chrome，但这是一处同形。换回圆
则会与取点期间显现的**端口记号**（实心小圆）同形，而接线点自己的端口就在它的盒心。没有一种形状
是白拿的。

MUST NOT 为它注册第二个 Renderer 类型。整圆是扫掠 360 的弧、矩形是四顶点的闭合多段线，这是同一
条判断的第三次应用：另立类型会让归一化、平移、距离、特征点、渲染与校验六条路径各多一支逐字相同
的实现。**这条判断同时说明换形状不欠这六条路径任何东西**——两种形状都在它的允许集里。

**身份 MUST 由 `Composition.presetId` 承担，MUST NOT 按几何反推**：一个被填实的小方块与用户自己
画的一个实心小矩形在几何上一模一样，而后者要的确实是一个矩形。这与圆角手柄的判据同源。推论：
MUST NOT 按**渲染出来的元素标签**认接线点——那是几何的派生物，不是身份。

默认边长 MUST 由导线线宽推出（约 3 倍），MUST NOT 是一个与线宽无关的绝对值：线粗了而点没跟着粗，
点就被线盖住。

**尺寸因此不是作者的意图，接线点 MUST 声明 `GeometryConstraints`**：`resize: 'none'`、
`rotatable: false`、`movable: true`。一个由别处推出来的量不该配八个手柄——鼠标动得了却没有意义的
控件比没有更糟。**转它同样不该给**：形状与尺寸同源，都不是作者写下的；而一个转过 45° 的接线点在
图上读作菱形，那是另一个符号。挪 MUST 保留：挪接头是接线图上的常规操作。

这条 MUST NOT 被读成「曲线又关掉 resize 了」。曲线的盒自由是已经定下来的决定（几何按 `viewBox`
与盒的比例呈现），其余四个起点一个字节不变。接线点不同的地方有两处：它的尺寸由导线线宽推出而不是
由用户写下，以及改它会**静默**弄坏绑定的落点（见下一条）。

**接线点的端口 MUST 恒在盒心。**这条不变量由「盒改不了」推出而不是另外声明：`Ports.position` 是
Entity 局部坐标、建出来时写成 `{size/2, size/2}`，而端口读取不按盒缩放——盒一旦被改，方块的视觉
中心就与三条支路汇聚的那个点分家，而两者在屏幕上逐像素相同，直到用户挪一下符号才现形。放开
`resize` 的人 MUST 同时回答端口怎么跟。

默认填色 MUST 取自接入时那条导线的 `stroke`，因此红色一次回路上是红方块。这是接入那一刻的一份
**快照**，此后 MUST NOT 跟随导线改变——做成跟随会让同一份事实有两处来源，而节点可能连着颜色各不
相同的支路。

`junction` MUST 默认隐藏于 Palette：从 Palette 拖出来的节点不连着任何导线，而一个不表达任何连接的
实心块读不出意图。默认隐藏 MUST 只影响 Palette 呈现，MUST NOT 影响 Registry 注册、接入命令产出或
文档反序列化。

#### Scenario: 节点与导线共用同一个 Renderer

- **WHEN** Registry 从 Wire Preset 与 junction Preset 各创建一个 seed
- **THEN** 两者的 Renderer 类型相同，且都带 `Curve` Component
- **AND** Registry 中不存在专为节点注册的 Renderer 类型

#### Scenario: 节点是填实的方块并带一个端口

- **WHEN** Registry 从 junction Preset 创建一个 seed
- **THEN** 它的 `Curve` 是闭合的四顶点多段线，四个顶点就是盒的四个角
- **AND** 它的 `Appearance.backgroundPaint` 是不透明填色
- **AND** 它的 `Ports.items` 恰好有一项，位置在盒心

#### Scenario: 接线点改不了尺寸也转不了

- **WHEN** 选中一个接线点并尝试改它的尺寸或旋转
- **THEN** 操作被拒绝，几何不变
- **AND** 移动它照常生效

#### Scenario: 其余四个曲线起点照旧自由

- **WHEN** 选中一条普通曲线、箭头、圆或矩形并改尺寸
- **THEN** 照常生效——本条只作用于接线点

#### Scenario: 边长跟着线宽

- **WHEN** 以两种不同线宽的导线各接出一个节点
- **THEN** 线宽大的那个节点边长更大

#### Scenario: 默认不出现在 Palette

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** junction 不出现在 Palette 中
- **AND** 它仍可由接入命令与 Registry API 正常创建

### Requirement: 网格按需启用

Container MUST 支持显式启用、移除网格，以及在网格与 Auto Layout 之间切换。启用 MUST 在一个
事务内添加 `type: 'grid'` 的 Layout、把直接子项转为 Flow，并按每个子项**当前的视觉位置与
尺寸**就近写入 `GridItem`；落格产生的碰撞 MUST 由网格求解器一并解开。任一受影响子项锁定时
MUST NOT 生成命令。

移除网格 MUST 把布局结果烘焙回自由布局所需的持久化几何，并删除全部 `GridItem`，与移除
Auto Layout 的既有规则一致。

布局类型之间的切换 MUST 是一条事务且一次 undo 恢复。切换 MUST 在入口处明示代价——切到网格
丢弃 `alignSelf`，切回 Auto Layout 丢弃格坐标；这两样都无法从对侧推导回来，静默丢弃会让
用户在撤销之后才发现。

缺席 Layout 时的 `+` 菜单 MUST 同时列出两种布局，引导卡 MUST 同时介绍两者并提供二选一的
两个动作——只讲其中一种会让另一种在这个入口上不可发现。

#### Scenario: 单事务启用网格并就近落格

- **WHEN** 用户在自由 Container 上启用网格
- **THEN** 一个事务内添加 grid Layout、把全部直接子项转为 Flow 并写入就近的 `GridItem`
- **AND** 落格碰撞按求解器推挤，一次 undo 恢复

#### Scenario: 子项锁定时不生成命令

- **WHEN** 容器内任一直接子项被锁定
- **THEN** 启用网格不产生任何命令

#### Scenario: 缺席 Layout 时两种布局都可发现

- **WHEN** 选中一个还没有 Layout 的 Container
- **THEN** `+` 菜单同时列出 Auto Layout 与网格，引导卡提供两个动作
- **AND** 引导卡的标题与正文不只描述其中一种

#### Scenario: 切换布局类型明示代价

- **WHEN** 用户把网格容器切换为 Auto Layout
- **THEN** 入口上写明格坐标会被丢弃
- **AND** 切换是一条事务，一次 undo 恢复全部格坐标

### Requirement: 紧凑网格 Inspector

网格容器的「布局」分组 MUST 提供列数、行高、两轴项间距、四边内边距与重力开关，并 MUST 与
Auto Layout 分组共用同一个分组标题栏结构：一个说明当前布局类型的状态标记、一个在值等于默认值
时禁用的整体重置，以及一个承载移除与切换的菜单。状态标记 MUST 渲染——两种布局共用一个分组
标题，不印出来就分不出当前是哪一种。

项间距与内边距 MUST 复用 Auto Layout 分组已有的 editor：两者都不含任何 flex 语义
（一个是两轴数值对，一个是四边数值），各写一份会让"间距"在两种布局里长得不一样。

列数 MUST 附带一条按当前列数分段的内联指示条。网格分组 MUST NOT 渲染 Auto Layout 那样的
三节点实时预览——网格的字段全是数字而画布本身就是结果，再画一个小的等于同一句话说两遍。

网格分组 MUST NOT 出现方向、换行或任何对齐字段：位置由格坐标直接给出，没有可对齐的余量。

#### Scenario: 网格分组的字段集合

- **WHEN** 选中一个网格容器
- **THEN** 布局分组显示列数、行高、项间距、内边距与重力开关
- **AND** 不显示方向、换行、主轴、交叉轴或多行对齐

#### Scenario: 分组标题栏标明当前布局类型

- **WHEN** 分别选中网格容器与 Auto Layout 容器
- **THEN** 两者的布局分组标题栏各自标出自己的类型
- **AND** 值等于默认值时重置按钮禁用

#### Scenario: 列数指示条跟随列数

- **WHEN** 用户把列数从 12 改为 8
- **THEN** 列数字段下的指示条变为 8 段

### Requirement: 几何 Inspector 的网格档

几何 Inspector MUST 按 Entity 的排布方式切换首个字段：Absolute 显示位置、Flow 显示自身对齐，
**父级是网格容器的 Flow 子级** MUST 改为显示格位置（列、行）与格跨度（宽、高），
并 MUST NOT 显示自身对齐——网格里没有主轴与交叉轴，自身对齐没有可作用的余量。

这四个数 MUST 可键入，键入产生的碰撞 MUST 走与画布拖动同一个网格求解器：画布与面板是同一份
事实的两个入口，分开求解会让键入与拖动给出不同结果。

「尺寸」行 MUST 降为只读并呈现当前求解结果，MUST NOT 隐藏——盒就是格矩形，三种尺寸模式一个
都用不上，但"它现在到底多少像素"仍是正当问题。「外边距」行 MUST 隐藏：间距归容器，每张卡再
各带一份会让"两张卡之间多远"有两个来源。旋转与旋转基点 MUST 照常显示——它们来自 `Transform`，
与布局正交。

格位置与格跨度 MUST 写进 `GridItem`，MUST NOT 写进 `LayoutItem.offset` 或 `Transform`。

#### Scenario: 网格子级显示格坐标而不是位置

- **WHEN** 选中网格容器内的一张卡
- **THEN** 几何 Inspector 显示格位置与格跨度，各自两个整数字段
- **AND** 不显示位置 X/Y，也不显示自身对齐

#### Scenario: 键入格坐标与拖动结果一致

- **WHEN** 用户在面板里把格位置从 `(8, 0)` 改为 `(0, 2)`，该处已有另一张卡
- **THEN** 被压住的卡按求解器下移，结果与在画布上拖到同一格一致
- **AND** 写入的是 `GridItem`，`LayoutItem.offset` 不变

#### Scenario: 尺寸只读而外边距隐藏

- **WHEN** 选中网格容器内的一张卡
- **THEN** 尺寸行呈现当前求解出的像素值且不可编辑
- **AND** 不渲染外边距行，旋转与旋转基点照常渲染

### Requirement: 组件实例的内容缩放

组件实例 MUST 提供 Renderer prop `contentFit`，取值 `'layout'` 或 `'scale'`，**默认
`'layout'`**——它是既有行为，因此不含该 prop 的既有文档渲染 MUST 逐像素不变。

`'layout'` 下实例 resize MUST 保持既有机制：把尺寸写进嵌套根 Frame，Auto Layout 的 `fill`
子级随之重排。`'scale'` 下 MUST NOT 改写嵌套根 Frame 的尺寸，而是按盒与组件根尺寸的比值把
嵌套内容整体缩放。两支 MUST NOT 同时改写同一份尺寸数据：那会让「这个实例多大」在两处读出不同
答案，症状是拖一次角手柄图形跳两次。

`'scale'` 的缩放 MUST 按两轴**各自**的比值，MUST NOT 强行等比后留白——曲线按 `viewBox` 跟随
自己的盒时就是两轴各算各的，符号被拉扁时它的每一条线也该跟着扁。需要等比时用户按住既有的
resize 约束修饰键，MUST NOT 在此另造一个开关。

它 MUST 是 Renderer prop 而不是新的 Component：只有渲染与 Inspector 读它，不参与命中判定或
布局求解，落在 props 上还白拿数据绑定与外观关键帧轨道。

#### Scenario: 默认行为不变

- **WHEN** 渲染一个不声明 `contentFit` 的既有实例并拖角手柄
- **THEN** 行为与本变更前逐像素一致，Auto Layout 子级照常重排

#### Scenario: scale 下绝对定位子级跟着放大

- **WHEN** 一个 `contentFit` 为 `'scale'`、内部全是绝对定位几何的实例被拖成两倍宽高
- **THEN** 内部图形整体放大两倍，嵌套根 Frame 的尺寸没有被改写

#### Scenario: 非等比拖动两轴各自缩放

- **WHEN** 把 `'scale'` 实例只拖宽一倍
- **THEN** 内容横向拉伸一倍，纵向不变

#### Scenario: 下钻选中框跟随缩放

- **WHEN** 在放大后的 `'scale'` 实例内部下钻选中一个 Entity
- **THEN** 选中框与屏幕上放大后的图形对齐

### Requirement: 基础物料的面板显示名是中文

内建 Preset 的**面板显示名**（`label`）MUST 是中文：容器、组件切换器、曲线、圆、矩形、图表。
界面其余部分本来就是中文，这六个名字是仅剩的英文。

**新建实体的默认名**（`defaultName`）MUST 保持英文，两者 MUST 是各自独立的字段：`defaultName`
写进**文档**，改它会动到既有页面、端到端用例以及用户已经命名过的对象，而本条要解决的问题只是
面板上的显示。

本条 MUST NOT 为此引入 locale 参数：`materials` 已经无条件输出中文界面串（属性面板分组
「描边」「动画」「内容」），中文 `label` 与该包既有做法一致。宿主仍 MUST 能通过 Preset 选项
覆盖这两个字段。

#### Scenario: 面板显示中文名

- **WHEN** 用户查看物料面板的基础组件段
- **THEN** 六个物料显示为容器、组件切换器、曲线、圆、矩形、图表

#### Scenario: 新建对象仍是英文名

- **WHEN** 用户从面板添加一个容器
- **THEN** 场景树里新建的对象名仍是 `Container`

### Requirement: 组件实例的翻转

组件实例 MUST 提供 Renderer prop `flip`，取值 `'none' | 'x' | 'y' | 'xy'`，**默认 `'none'`**
——不声明该 prop 的既有实例渲染 MUST 逐像素不变。

翻转 MUST 作用于实例的呈现，MUST NOT 改写组件定义：定义是共享的，改它会波及每一个实例。
它 MUST 与既有的 `Transform.rotation` 组合表达任意轴的反射——绕角 θ 的反射等于 `flipX` 之后
旋转 `2θ`，因此不需要为镜像新增任何协议字段。

翻转 MUST 绕实例盒的中心发生，MUST NOT 读 `Transform.pivot`：`pivot` 回答的是「绕哪一点旋转」，
把它借给翻转会让改基点的用户看到图形整个跳走。

下钻选中与命中沿用既有的 DOM 测量，因此翻转对它们透明。

#### Scenario: 默认不翻转

- **WHEN** 渲染一个不声明 `flip` 的既有实例
- **THEN** 渲染结果与本变更前逐像素一致

#### Scenario: 水平翻转不改定义

- **WHEN** 把一个实例的 `flip` 设为 `'x'`
- **THEN** 该实例左右镜像，组件文档与其他实例都没有变化

#### Scenario: 翻转绕盒中心

- **WHEN** 一个 `pivot` 设在左边中点的实例被水平翻转
- **THEN** 图形绕盒中心镜像，位置不跳

### Requirement: 属性面板按几何约束决定只读

`GeometryConstraints` MUST 同时被**属性面板**读到：`resize: 'none'` 时宽高只读，
`rotatable: false` 时旋转只读，`movable: false` 时位置只读。

只有命令层认这个约束是不够的——面板仍然让人改、而命令会拒绝，屏幕上就是「输入框接受了、图上
没变」，而面板没有任何东西说明为什么。这与「敲了没反应与敲错在屏幕上无法区分」是同一条判断，
且比「根本不给改」更难解释：至少那一档用户知道自己动不了它。

只读 MUST 走与锁定同一条既有通道，MUST NOT 为约束另造一套呈现：两者对用户是同一句话——这个字段
现在不归你改。

本条对**任何**声明了约束的 Entity 成立，MUST NOT 写成接线点的特例。

#### Scenario: 尺寸被锁死时宽高只读

- **WHEN** 选中一个 `resize` 为 `none` 的 Entity
- **THEN** 属性面板的宽高只读
- **AND** 旋转按 `rotatable` 决定是否只读

#### Scenario: 没有声明约束的 Entity 照旧可改

- **WHEN** 选中一个不带 `GeometryConstraints` 的 Entity
- **THEN** 宽高、旋转与位置都可改——缺席即自由变换

### Requirement: hatch Preset 是求面产出的填充

`materials` MUST 提供曲线 Renderer 的又一个 Preset `hatch`：**有填充、无描边**。
无描边是因为这块面的边界已经由那些边界对象自己画着了，再画一遍就是同一条线画两遍。

它 MUST `paletteHidden: 'toolbar'`——工具栏已提供入口，与 `arrow`、`circle` 同一条。
从物料面板拖一个「填充」出来读不出意图：它的全部意义来自它是从某块面求出来的。

首次默认色 MUST 是一块低饱和、压得住的深色。判据是**角色**而不是「没有最常见的那一档」：
区域填充垫在符号底下，必须让上面的墨读得出来——这与导线默认红取最常见的那一档是同一条判据的
两个答案。

#### Scenario: 默认无描边

- **WHEN** 从 `hatch` Preset 创建一个 Entity
- **THEN** 它有填充色而描边为无

#### Scenario: 不出现在物料面板

- **WHEN** 物料面板按默认货架列出 Preset
- **THEN** `hatch` 不在其中

### Requirement: 填充的 Inspector 有重新生成与失效标记

选中一个带 `Hatch` 的 Entity 时，Inspector MUST 提供「重新生成」：拿 `seed` 按**当前**边界把
那次求解原样再跑一遍。它 MUST 是 Inspector 上的入口而不是画布手势——画布上「按当前边界重算」
与「新建一块填充」逐字相同，做成两个手势等于给同一件事造第二个入口（与导线的「解除绑定」
是同一条例外理由）。

重算失败（`seed` 处已经没有封闭的面）时 MUST 保留原几何并标为**失效**，
MUST NOT 静默留在原地：所有做了关联的产品里，用户抱怨的都不是「它会断」而是「断了我不知道」。
「还没配」「配错了」「配的东西没了」MUST 可区分，与悬空的导线绑定同一套。

填充色 MUST 走既有的外观分组（`Appearance.backgroundPaint`），MUST NOT 另开一个字段——
外观 Inspector、数据绑定与外观动画轨道因此一行都不用写。

**求解 MUST 由宿主经端口注入**，物料包 MUST NOT 自己跑求面：`materials` 不依赖 `stage-engine`，
而「过期没有」与「再求一遍」两个答案都要跑那套算法。端口 MUST 可缺席——缺席时 Inspector 只
显示 `seed` 且不画那颗按钮，本包因此仍可独立嵌入。这与 Paint 编辑走 `paintEditPort` 是同一条
既有边界的同一次应用。

「过期没有」MUST 只在这块填充**被选中**时求一次：一次是 O(N²) 的两两求交，不进每帧路径。

#### Scenario: 端口缺席时只显示取点

- **WHEN** 宿主没有注入填充求解端口
- **THEN** Inspector 显示 `seed`，且不出现「重新生成」按钮

#### Scenario: 重新生成按当前边界重算

- **WHEN** 边界对象被移动之后，用户对这块填充按「重新生成」
- **THEN** 几何按当前边界重新求出

#### Scenario: 重算失败时标为失效

- **WHEN** `seed` 处已经没有封闭的面
- **THEN** 保留原几何，并在 Inspector 上标为失效

#### Scenario: 改色走既有的外观分组

- **WHEN** 选中一块填充并在外观分组改背景色
- **THEN** 它的填充色改变，与改任何一个曲线 Entity 的背景色是同一条路径

