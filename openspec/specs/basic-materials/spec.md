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

Materials MUST 发布 Container、Rectangle、Text、Image、SVG、Line、Arrow 与 Circle Entity Presets。Container
MUST 组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；Rectangle、Text、Image、SVG 与形状
Renderer Presets MUST 组合 Transform、Visibility、Lock、Appearance、Renderer。Line、Arrow 与 Circle MUST 使用
第一方结构化 Shape Renderer props，不得依赖外部 SVG asset 或 Stage 专属数据。

已经拥有专用创建入口的 Preset MUST 默认隐藏于 Palette，避免同一个创建动作出现两个入口：
Text、Line、Arrow 与 Circle 由 Stage 工具栏绘制工具提供入口，Page Slot 由资源面板的页面拖入
提供入口。默认隐藏 MUST 只影响 Palette 呈现，MUST NOT 影响 Registry 注册、拖入、键盘新增、
资源拖放或文档反序列化；宿主 MUST 能够通过物料 options 覆盖该默认。

#### Scenario: 创建五种 ECS 物料

- **WHEN** Registry 从所有内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset、基础 Component Keys 与 Shape Renderer 类型

#### Scenario: 默认 Palette 不重复工具栏入口

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** Text、Line、Arrow、Circle 与 Page Slot 不出现在 Palette 中
- **AND** 这些 Preset 仍可由工具栏、资源拖入与 Registry API 正常创建

#### Scenario: 形状跨入口一致渲染

- **WHEN** Stage 或 Preview 渲染 Line、Arrow 或 Circle Entity
- **THEN** 两个入口基于同一 Renderer props 输出相同形状与方向
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
Hierarchy 与 TransformConstraints 提供符合 Registry Inspector 协议的编辑 UI；Lock Inspector
MUST 在 readOnly 上下文中仍可解除锁定；Clip 的开关由 Hierarchy Inspector 呈现。

#### Scenario: Registry 协议驱动内建分组

- **WHEN** 宿主使用 createComposeBasicMaterials 构建 Registry
- **THEN** 编辑器无需硬编码即可按定义顺序渲染全部内建 Component 分组

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

### Requirement: Page Slot 基础物料

基础物料包 MUST 提供 Page Slot 物料，其含唯一的节点引用属性用于指向一个页面。Page Slot
MUST 通过渲染上下文的页面文档加载端口加载被引用页面，并 MUST 递归渲染该页面的根实体。
Page Slot MUST 在编辑模式下使嵌套内容整体不参与命中测试。未设置引用或未注入加载端口时
MUST 呈现可访问的占位状态。

#### Scenario: 渲染被引用页面

- **WHEN** Page Slot 的引用指向一个含内容的页面且加载端口已注入
- **THEN** 该页面的每个根实体都在 Page Slot 内渲染，并各自按其几何绝对定位
- **AND** 容器实体递归渲染其 `Hierarchy` 子节点
- **AND** 不可见实体及其子树不渲染
- **AND** 预览与编辑画布中呈现的实体逐个一致

#### Scenario: 编辑态不抢命中测试

- **WHEN** Page Slot 在编辑模式下渲染嵌套内容，用户在其区域内按下指针
- **THEN** 命中的是 Page Slot 实体本身
- **AND** 嵌套内容不接收指针事件

#### Scenario: 未设置引用

- **WHEN** Page Slot 的引用为空，或未注入加载端口
- **THEN** 呈现可访问的占位状态
- **AND** 不发起任何加载

### Requirement: Page Slot 加载状态与嵌套护栏

Page Slot MUST 覆盖加载中、加载失败、目标页面为空与加载成功四种状态，加载失败 MUST 提供重试入口
并以警示语义呈现。Page Slot MUST 依据祖先页面链与深度上限阻断循环引用与超出深度的嵌套，被阻断时
MUST 以警示语义呈现且 MUST NOT 发起加载。引用变化或组件卸载后的迟到结果 MUST 被丢弃。

#### Scenario: 加载中与加载成功

- **WHEN** Page Slot 开始加载被引用页面
- **THEN** 先呈现具备忙碌语义的加载状态
- **AND** 加载完成后替换为页面内容

#### Scenario: 加载失败可重试

- **WHEN** 页面文档加载失败
- **THEN** 以警示语义呈现失败状态并提供重试入口
- **AND** 重试重新发起加载

#### Scenario: 目标页面为空

- **WHEN** 被引用页面不含任何根实体
- **THEN** 呈现可访问的空状态

#### Scenario: 阻断循环引用

- **WHEN** Page Slot 直接或间接引用了祖先链中已存在的页面
- **THEN** 以警示语义呈现循环引用状态
- **AND** 不发起加载且不进入无限递归

#### Scenario: 阻断超出深度

- **WHEN** 嵌套深度达到深度上限
- **THEN** 以警示语义呈现超出深度状态
- **AND** 不再向下加载

#### Scenario: 丢弃迟到结果

- **WHEN** 组件在加载完成前卸载，或引用在加载期间变化
- **THEN** 迟到结果被丢弃
- **AND** 不产生卸载后的状态更新

### Requirement: 页面拖入画布创建 Page Slot

基础物料包 MUST 允许把页面文件从资源面板拖入画布以创建 Page Slot 实体。创建的实体 MUST 携带指向
该页面的引用；能够读取被引用页面的输出尺寸时 MUST 以该尺寸作为初始尺寸，否则 MUST 使用默认尺寸。
非页面文件 MUST NOT 被 Page Slot 接受。

#### Scenario: 拖入页面创建实体

- **WHEN** 用户把一个页面文件拖入画布空白处并放置
- **THEN** 创建一个引用该页面的 Page Slot 实体
- **AND** 其初始尺寸取被引用页面的输出尺寸

#### Scenario: 拒绝非页面文件

- **WHEN** 拖入的文件不是页面文件
- **THEN** Page Slot 不接受该拖入
- **AND** 既有的图片等物料拖入行为不受影响

### Requirement: Container 物料与容器能力

Container Preset 与容器能力 MUST 为 v6 创建 Hierarchy、Layout、Clip、LayoutItem、rotation-only
Transform 和 Appearance。Layout Inspector MUST 编辑明确 Flex 值、padding 与双轴 gap；LayoutItem
Inspector MUST 编辑 Fixed sizing、Flow/Absolute、offset、margin 与 alignSelf。

#### Scenario: 把既有子项转换为 Flow
- **WHEN** 用户在 Layout Inspector 对含 Absolute 直接子项的 Container 执行转换
- **THEN** 一个 batch 按 Hierarchy 顺序把全部直接子项设为 Flow
- **AND** Undo 一次恢复全部原 LayoutItem，后代和未知 Component 不变

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

### Requirement: Image、SVG 与 Page Slot 物料

Image、SVG 与 Page Slot MUST 分别使用 resolved asset natural size、SVG intrinsic box 与目标页面 output
size 作为 Hug measurement，并在各自 subscription revision 变化时失效。

#### Scenario: 异步资源驱动 Hug
- **WHEN** Hug Image、SVG 或 Page Slot 的资源从 loading 变为 ready 或发布新 revision
- **THEN** 首帧使用 LayoutItem fallback，ready 后使用新的 intrinsic size 重排
- **AND** 失败状态保持 fallback 与可访问占位，不修改文档

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

新建 Container 与“容器”能力 MUST 默认创建自由 Hierarchy 而不创建 Layout。拥有 Hierarchy 且缺少
Layout 的 Inspector MUST 提供“布局 +”菜单；菜单当前 MUST 只包含 Auto Layout，不得显示 Grid。

#### Scenario: 创建默认自由 Container

- **WHEN** Registry 从 Container Preset 创建 Entity，或给 Renderer 添加“容器”能力
- **THEN** Entity 拥有 Hierarchy 与 Clip 但不拥有 Layout
- **AND** 直接子项只能使用 Absolute

#### Scenario: 添加 Auto Layout

- **WHEN** 用户从“布局 +”菜单选择 Auto Layout
- **THEN** 系统在一个事务中添加默认 Flex Layout 并按 childIds 将全部直接子项转为 Flow
- **AND** 子项顺序、尺寸意图、margin、alignSelf 与旧 offset 保持不变

#### Scenario: 展开未启用布局引导

- **WHEN** 拥有 Hierarchy 且缺少 Layout 的 Entity 展开“布局”分组
- **THEN** Inspector 紧凑显示 Auto Layout 图示、“使用自动布局”、用途说明、“添加自动布局”操作
  和“添加后可随时移除”辅助文案
- **AND** 标题栏加号继续打开布局类型菜单，正文添加操作直接启用 Auto Layout
- **AND** 两个入口使用同一原子添加规划，锁定或缺少文档时均保持禁用

#### Scenario: 锁定目标阻止添加

- **WHEN** 容器或任一需要转为 Flow 的直接子项已锁定
- **THEN** Auto Layout 添加入口禁用并提供可读原因
- **AND** 文档、历史与 Operation Log 均不变化

#### Scenario: 移除 Auto Layout 保持视觉

- **WHEN** 用户移除一个 Snapshot 完整的 Auto Layout
- **THEN** 直接 Flow 子项按当前 local box 烘焙为 Absolute，Fill 轴转为 Fixed
- **AND** 容器自身 Hug 轴转为 Fixed，Absolute 子项与嵌套 Layout 保持不变
- **AND** 整个操作只提交一个事务

#### Scenario: 无可靠 Snapshot 时禁止移除

- **WHEN** LayoutSnapshot 未就绪或缺少容器或 Flow 子项的必要 box
- **THEN** 移除入口禁用并说明需要等待布局计算
- **AND** 系统不使用旧 offset 或 fallback 尺寸降级

#### Scenario: 旧基础 Layout 主动解除归属

- **WHEN** 旧 v6 Entity 的 Composition.baseComponentKeys 仍包含 Layout 且用户主动移除布局
- **THEN** 同一事务先解除 Layout 的基础归属再移除 Component
- **AND** 加载旧文档本身不会修改任何 JSON

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

### Requirement: Line 与 Arrow 的常用描边属性

Line 与 Arrow MUST 在其结构化 Shape Renderer props 中持久化 `stroke`、`strokeWidth`、
`strokeLinecap`、`strokeDasharray`、`markerStart` 与 `markerEnd`。Inspector MUST 提供颜色、粗细、
平头/圆头/方头、实线/虚线/点线以及起点/终点箭头；不为单根直线提供 fill、line join、marker mid 或
dash offset。Line 默认没有 marker，Arrow 默认终点 marker 为箭头；缺少新 props 的旧 Arrow 仍必须显示终点箭头。

#### Scenario: 编辑线条外观

- **WHEN** 用户在 Inspector 编辑 Line 或 Arrow 的线条属性
- **THEN** Stage 与 Preview 使用同一 Shape Renderer 立即显示对应描边、端点和箭头
- **AND** Renderer props 之外的 authored fields 保持不变

#### Scenario: 水平或垂直线

- **WHEN** 用户绘制或编辑水平、垂直的 Line 或 Arrow
- **THEN** `direction` 可以使用零轴表达重合坐标
- **AND** 为 LayoutItem 保留的最小 1px 尺寸不产生可见的斜线偏移

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

#### Scenario: Rectangle 改色不被 Material CSS 盖住

- **WHEN** Rectangle Entity 的 Appearance.backgroundPaint 为非默认 solid 色且 borderRadius 非 0
- **AND** Stage、Preview 或 component-instance 嵌套路径渲染该 Entity
- **THEN** 可见填色与 computed 背景反映 Appearance 色值
- **AND** Material 根节点不绘制与 Appearance 冲突的默认蓝底

#### Scenario: Rectangle 默认外观来自 seed Appearance

- **WHEN** Registry 从默认 rectangle Preset 创建 seed
- **THEN** Appearance 含明确的默认 solid 填色与 borderRadius
- **AND** 渲染不依赖 Material CSS 变量提供填色

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

