# compose-preview Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: Preview 配置与兼容
ComposePreview MUST require a document and registry, render a complete document or explicit Frame target, and MUST
NOT offer a legacy children container mode.

#### Scenario: Required document configuration
- **WHEN** a consumer renders ComposePreview with a document, registry and optional target
- **THEN** it renders the requested output using the existing output and clipping rules

### Requirement: Preview 资源解析

ComposePreview MUST 接受可选 assetResolver，并把它传给文档或 Frame target 内所有 Component
renderer；资源 chrome MUST NOT 出现在输出中。

#### Scenario: 预览资源组件

- **WHEN** 文档包含 Image/SVG 节点且 resolver 可用
- **THEN** document 与 frame target 都渲染最新资源
- **AND** 缺失 resolver 时只显示节点内可访问占位而不卸载 Preview

### Requirement: Preview 输出背景 Paint

ComposePreview MUST 在固定输出边界渲染 `output.backgroundPaint` 的 Solid、Linear、Radial 与 Angular
描述，并保持其位于所有 Entity 之后。Preview 不得渲染渐变编辑控制柄或其它 Editor chrome。

#### Scenario: 预览渐变输出背景

- **WHEN** v5 document output 使用任一合法 Gradient Paint
- **THEN** Preview 显示与 Stage 输出边界一致的渐变背景
- **AND** Entity Appearance、Hierarchy 和 Clip 渲染顺序保持不变

### Requirement: 图片背景渲染

Stage 与 Preview MUST 通过 ComposeAssetResolver 解析 Image Paint 的稳定引用，并按图片显示模式、透明度与叠色渲染。资源缺失或解析失败时 MUST 安全降级且继续渲染场景。

#### Scenario: 预览图片背景

- **WHEN** 文档输出或 Entity Appearance 使用可解析的 Image Paint
- **THEN** Preview 显示对应图片背景和颜色叠加
- **AND** 资源读取失败不会阻止其它实体显示

### Requirement: Preview 页面文档加载注入

Preview MUST 接受可选的页面文档加载端口并将其注入 Registry 渲染上下文，使引用了页面的实体在预览
中递归渲染被引用页面的内容。Preview MUST NOT 自行实现页面加载或嵌套渲染逻辑，也 MUST NOT 因此
依赖 `editor`、`stage` 或页面 Store 实现包。未注入端口时预览 MUST 正常渲染且相关实体呈现占位状态。

#### Scenario: 预览中递归渲染页面

- **WHEN** 宿主向 Preview 注入页面文档加载端口，文档中存在引用页面的实体
- **THEN** 预览递归渲染被引用页面的内容
- **AND** 循环引用与超出深度的嵌套被阻断并以警示语义呈现

#### Scenario: 未注入端口

- **WHEN** 宿主未注入页面文档加载端口
- **THEN** 预览正常渲染其余内容
- **AND** 引用页面的实体呈现可访问的占位状态

### Requirement: 独立只读 Preview

ComposePreview MUST 创建或接受 Layout Runtime，并把 Registry measurement adapter 接入该 Runtime。
Hug 内容完成异步准备后 MUST 使用新 Snapshot 重渲染；loading/error/fallback 状态 MUST 可访问且不依赖
Editor 或 Stage。

#### Scenario: Preview 独立解析 Hug
- **WHEN** 独立 Preview 渲染包含 Text、Image、SVG 或 Page Slot Hug 的 v6 文档
- **THEN** 它使用与 Stage 相同 measurement definition 和 Layout 语义得到 local boxes
- **AND** 卸载会取消全部 prepare、订阅、离屏 host 与 Layout Runtime

### Requirement: 完整文档与指定 Container 预览

Container target 的 viewport MUST 使用目标 Entity 的 resolved width/height，而不是读取旧 Transform
size；目标缺失、不是 Hierarchy 或布局 Runtime error 时 MUST 显示明确 alert。

#### Scenario: 预览 Auto Layout Container
- **WHEN** target 指向尺寸由 Layout Snapshot 解析的 Container
- **THEN** Preview 以其 resolved border box 建立相对 viewport 并渲染后代
- **AND** 不把目标在父级中的 offset 重复应用到 viewport

### Requirement: Preview 页面 setup 运行

Preview MUST 能够接受聚合页面与 Script Runtime 配置，创建当前页面实例的 setup scope，并用解析后的
value/method runtime Props 渲染。独立只传 ComposeDocument 的既有 Preview MUST 保持纯字面渲染，除非
宿主显式注入 scope。卸载 MUST dispose setup、Effect、订阅、方法 wrapper 与迟到异步结果。

#### Scenario: 点击方法更新绑定值

- **WHEN** Preview 页面把 Text.text 绑定到 State `num`、Button.onClick 绑定到方法 `onAdd`
- **THEN** 点击 Button 调用同一页面实例的方法并让 Text 显示递增后的 num
- **AND** 文档、事务历史和 authored Props 保持不变

#### Scenario: 独立文档 Preview 保持兼容

- **WHEN** 宿主只向 ComposePreview 传入 ComposeDocument 与 Registry
- **THEN** Preview 使用 authored Props 正常渲染
- **AND** 不猜测、搜索或执行任何页面脚本

### Requirement: 嵌套页面脚本实例隔离

Preview 递归渲染 Page Slot 时 MUST 为每个 Slot 页面创建独立 setup scope，并继续应用既有循环与深度
护栏。一个嵌套脚本失败 MUST 只降级对应 Slot；Slot 卸载或页面引用变化 MUST dispose 旧 scope。

#### Scenario: 两个 Page Slot 引用同一计数页面

- **WHEN** 两个 Slot 同时渲染同一页面且用户只点击其中一个实例的方法
- **THEN** 只有该 Slot 内的绑定值更新
- **AND** 两个实例分别拥有 Effect cleanup 与 diagnostic 生命周期

### Requirement: 组件实例预览

Preview MUST 从实例保存的 resolvedSnapshot 递归渲染组件内容，按实例结构操作与属性覆盖解析 Renderer
props，保留内部真实预览交互，并且不依赖实时 Component Store。Preview MUST 与 Stage 共享八层嵌套、
循环检测、错误占位和 dispose 行为，但 MUST NOT 暴露编辑期的内部选中、下钻或结构编辑能力。
嵌套实体的 Appearance 与 overflow/clip 语义 MUST 与 Stage 及组件文档路径一致，使预览中的填色与
圆角可复现编辑结果。

#### Scenario: 预览在线与离线组件实例

- **WHEN** 文档包含合法 component-instance，且 Provider 在线或离线
- **THEN** Preview 均按保存快照、结构操作与属性覆盖渲染相同输出
- **AND** 内部预览事件保持可用

#### Scenario: 预览不暴露编辑期能力

- **WHEN** 实例含实例层结构操作且 Preview 渲染该实例
- **THEN** 输出反映解析后的结构，但不提供内部节点选区、下钻手势或编辑命中

#### Scenario: 拒绝非法嵌套

- **WHEN** 保存快照递归引用自身或超过八层
- **THEN** Preview 只在该实例位置显示可访问错误，不中断文档其余内容

#### Scenario: 预览圆角与填色与源一致

- **WHEN** 实例快照中叶子 Entity 含非默认 solid 填色与非零 borderRadius
- **THEN** Preview 中该实体呈现相同填色与圆角裁剪行为
- **AND** 不出现 Material 默认底色盖住 Appearance 的结果

### Requirement: Preview 只渲染 WidgetSwitcher 的活动子项

Preview MUST 跳过 core 派生的隐藏集合中的 Entity，只渲染每个 WidgetSwitcher 的活动子项。Preview
MUST NOT 应用任何编辑期预览覆盖——运行期只认 `activeIndex`。嵌套文档 Runtime（Component Instance
与 Page Slot）MUST 遵守同一规则。

#### Scenario: 运行期只显示活动子项

- **WHEN** Preview 渲染含三个子项、`activeIndex` 为 1 的 WidgetSwitcher
- **THEN** 只有第二个子项及其后代出现在输出中

#### Scenario: 嵌套文档中的 switcher

- **WHEN** Component Instance 或 Page Slot 的内部文档含 WidgetSwitcher
- **THEN** 嵌套 Runtime 同样只渲染其活动子项

### Requirement: 预览对话框动画播放

文档包含动画时，`ComposePreviewDialog` MUST 提供播放控件，按动画的 `playbackMode` 推进播放头
并把当前时刻的采样文档交给 `ComposePreview` 渲染。`ComposePreview` 组件自身 MUST NOT 获得动画
语义，仍然只接受已经采样好的文档。对话框关闭时 MUST 停止播放并释放计时资源。

#### Scenario: 播放文档动画

- **WHEN** 用户在包含动画的文档上打开预览对话框并点击播放
- **THEN** 预览内容按动画随时间变化

#### Scenario: 无动画时不显示播放控件

- **WHEN** 文档没有任何动画
- **THEN** 预览对话框不显示播放控件

#### Scenario: 关闭对话框停止播放

- **WHEN** 播放过程中用户关闭预览对话框
- **THEN** 播放停止且不再有计时回调触发

### Requirement: 预览按脚本绑定驱动动画

`ComposePreview` 在拥有页面作用域时 MUST 按文档动画的播放控制绑定驱动动画，并把当前时刻的
采样文档用于渲染。没有任何播放控制绑定的动画 MUST NOT 自动播放。`play-once` 动画到达末尾时
MUST 停止推进循环，MUST NOT 空转。组件卸载或作用域释放时 MUST 取消订阅并停止推进。

#### Scenario: 绑定驱动预览播放

- **WHEN** 页面 setup 导出的布尔成员变为 `true`，预览正在渲染该页面
- **THEN** 预览中的动画从头开始播放

#### Scenario: 无绑定不自动播放

- **WHEN** 文档中的动画没有任何播放控制绑定
- **THEN** 预览显示动画在 `0` ms 的采样结果，且不推进

#### Scenario: 播放一次结束后停止推进

- **WHEN** 一条 `play-once` 动画在预览中播放到末尾
- **THEN** 推进循环停止，不再产生逐帧回调

#### Scenario: 卸载释放资源

- **WHEN** 预览在动画播放期间被卸载
- **THEN** 导出订阅被取消，推进循环停止，不再有回调触发

### Requirement: 编辑期播放头不被脚本抢占

编辑器画布的播放头 MUST 由用户的手动拖动与播放控件控制，MUST NOT 被页面脚本的播放控制绑定驱动。
用户验证脚本驱动效果的入口是预览。

#### Scenario: 编辑期手动播放头不受脚本影响

- **WHEN** 页面 setup 导出的绑定布尔为 `true`，用户同时在编辑器里拖动播放头
- **THEN** 画布跟随用户拖动的位置，不被脚本改写

### Requirement: 受控 Preview Dialog

`@compose-ui/preview` MUST 提供受控 `ComposePreviewDialog`，接受与 `ComposePreview` 相同的文档、Registry、资源 Resolver 与页面加载端口，并由宿主通过 `open` 和关闭回调控制可见性。该组件不得依赖 Editor 或 Stage。

#### Scenario: 打开完整文档预览

- **WHEN** 宿主以 `open=true` 渲染带 document 与 registry 的 ComposePreviewDialog
- **THEN** 组件以模态对话框呈现完整文档预览
- **AND** 关闭控件、Esc 与遮罩操作请求宿主关闭对话框并恢复触发焦点

#### Scenario: 切换指定 Container 预览

- **WHEN** 宿主提供有效的 Container entity ID 并在对话框中选择该范围
- **THEN** 对话框使用该 ID 作为 ComposePreview 的 Container target
- **AND** 没有有效 Container 时该切换控件不可用

### Requirement: Preview Dialog 视图控制

ComposePreviewDialog MUST 提供不改变文档的预览缩放与全屏控制；缩放只影响对话框中的画板呈现，不能改变 ComposePreview 的输出语义。

#### Scenario: 调整预览缩放

- **WHEN** 用户选择一个支持的缩放比例
- **THEN** 画板在预览舞台中按该比例呈现
- **AND** document、target 与渲染内容不被修改

### Requirement: Preview 原生 Container 滚动

Preview MUST 在真实递归 DOM 层级上把规范化分轴策略映射为原生 overflow，并让滚动位置保持为
非持久化的浏览器会话状态。

#### Scenario: 纵向内容真实滚动

- **WHEN** 容器纵向配置为 `scroll` 且子内容超过容器高度
- **THEN** Preview 出现原生纵向滚动范围并允许用户滚动，而文档保持不变

#### Scenario: 滚动范围保留末端内边距

- **WHEN** Auto Layout 容器带有底部或右侧内边距且内容溢出
- **THEN** Preview 的原生滚动范围在最后一个子项之后保留对应末端内边距

