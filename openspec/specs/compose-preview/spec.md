# compose-preview Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: Preview 配置与兼容
ComposePreview MUST require a document, a registry and a Frame target, and MUST render exactly one Frame.
When no target is given it MUST render the page's active Frame, falling back to the first root Frame.
The `defaultFrameId` prop MUST stay a pure fallback: it seeds the candidate list only, and an explicitly
supplied `frameId` MUST NOT fall back to it. Hosts typically pass `ComposePageFile.activeFrameId` as
`defaultFrameId`.
ComposePreview MUST accept optional `fit` (`contain | cover | fill | none`) and `alignment` props that
control how the Frame is mapped into the host box; these MUST NOT be read from or written to the document.
`fit` MUST actually scale the rendered Frame together with **all of its descendants**: the Frame's
descendants are absolutely positioned, so clamping the Frame's own box (`max-width`, `width: 100%`) or
setting `object-fit` leaves the content unscaled and is not an implementation of this requirement.
ComposePreview MUST NOT offer a legacy children container mode and MUST NOT keep a separate
whole-document rendering path.

#### Scenario: Required document configuration
- **WHEN** a consumer renders ComposePreview with a document, registry and optional Frame target
- **THEN** it renders that single Frame using the Frame's own size, background paint and clipping rules
- **AND** omitting the target renders the default root Frame

#### Scenario: Host-supplied fit
- **WHEN** a consumer renders the same document with `fit="contain"` and again with `fit="cover"`
- **THEN** the Frame is scaled to fit inside the host box in the first case and to cover it in the second
- **AND** the document is byte-identical in both cases

#### Scenario: fit 缩放整棵子树
- **WHEN** 宿主盒子小于 Frame 自身尺寸且 `fit="contain"`
- **THEN** Frame 与它的全部后代按同一个比例缩小，后代之间的相对位置不变
- **AND** Frame 的布局结果与 `fit="none"` 时一致，只差这一个整体缩放

### Requirement: Preview 资源解析

ComposePreview MUST 接受可选 assetResolver，并把它传给文档或 Frame target 内所有 Component
renderer；资源 chrome MUST NOT 出现在输出中。

#### Scenario: 预览资源组件

- **WHEN** 文档包含 Image/SVG 节点且 resolver 可用
- **THEN** document 与 frame target 都渲染最新资源
- **AND** 缺失 resolver 时只显示节点内可访问占位而不卸载 Preview

### Requirement: 图片背景渲染

Stage 与 Preview MUST 通过 ComposeAssetResolver 解析 Image Paint 的稳定引用，并按图片显示模式、透明度与叠色渲染。资源缺失或解析失败时 MUST 安全降级且继续渲染场景。

#### Scenario: 预览图片背景

- **WHEN** 文档输出或 Entity Appearance 使用可解析的 Image Paint
- **THEN** Preview 显示对应图片背景和颜色叠加
- **AND** 资源读取失败不会阻止其它实体显示

### Requirement: Preview 页面文档加载注入

Preview MUST 接受可选的页面加载端口，供页面导航按页面引用加载目标页面。Preview MUST NOT
自行实现页面加载逻辑，也 MUST NOT 因此依赖 `editor`、`stage` 或页面 Store 实现包——端口
类型来自 `core`，实现来自 `@compose-ui/pages`。未注入端口时 Preview MUST 正常渲染当前文档。

Preview MUST NOT 再把该端口注入 Registry 渲染上下文，也 MUST NOT 递归渲染任何"引用了页面
的实体"——页面嵌套已被删除，端口现在只服务导航。

#### Scenario: 注入端口供导航加载

- **WHEN** 宿主向 Preview 注入页面文档加载端口并发生跳转
- **THEN** 目标页面通过该端口加载
- **AND** Preview 不为文档中的任何实体递归加载其他页面

#### Scenario: 未注入端口

- **WHEN** 宿主未注入页面文档加载端口
- **THEN** Preview 正常渲染当前文档的全部内容
- **AND** 不发起任何页面加载

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
MUST NOT 应用任何编辑期预览覆盖——运行期只认 `activeIndex`。嵌套文档 Runtime（Component Instance）
MUST 遵守同一规则。

#### Scenario: 运行期只显示活动子项

- **WHEN** Preview 渲染含三个子项、`activeIndex` 为 1 的 WidgetSwitcher
- **THEN** 只有第二个子项及其后代出现在输出中

#### Scenario: 嵌套文档中的 switcher

- **WHEN** Component Instance 的内部文档含 WidgetSwitcher
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

`@compose-ui/preview` MUST 提供受控 `ComposePreviewDialog`,接受与 `ComposePreview` 相同的文档、Registry、资源 Resolver 与页面加载端口,并由宿主通过 `open` 和关闭回调控制可见性。该组件不得依赖 Editor 或 Stage。对话框 MUST 以**场景选择器**表达预览目标:列出文档中的全部根 Frame,默认选中宿主给出的激活场景;预览目标任何时刻 MUST 恰好是一个 Frame。对话框 MUST NOT 再提供「完整文档 / 指定 Container」的二选一,也 MUST NOT 在解析目标时绕过宿主给出的默认值直接取第一个根 Frame;动画播放宿主 MUST 跟随当前解析出的目标 Frame。场景选择器列出的名称 MUST 取自**当前正在预览的那份文档**。

宿主额外提供导航端口时,对话框 MUST 切换为**页面预览**:内容由 `ComposePageHost` 承载,
`Interaction` 的跳转在对话框内真实生效,场景选择器 MUST 只列出**当前页面**的根 Frame 并在
跳转后跟随新页面重置。跳转过程中对话框 MUST NOT 把上一页的目标 Frame 当作显式目标传给新
页面——显式目标不回退,那会让新页面 ready 的那一帧呈现「目标不存在」。宿主未提供导航端口时
对话框 MUST 保持上述文档预览行为不变。

页面模式一旦成立就会完全取代传入的 `document`,因此宿主 MUST 只在**画布上正在编辑的就是
那一页**时提供导航端口与 live 页;否则打开组件再预览会呈现上一个页面。

对话框 MUST 接受可选的 `targetKind`（`scene | component`,缺省 `scene`）。它 MUST NOT 从
文档结构反推——一份不带导航端口的页面文档与一份组件文档在结构上完全一样。`targetKind`
决定目标种类相关的默认值与文案,其中组件的默认 `fit` MUST 是 `none`（组件是屏上的一个
零件,不是那块屏的全部内容）,场景的默认 `fit` MUST 是 `contain`。

#### Scenario: 打开完整文档预览

- **WHEN** 宿主以 `open=true` 渲染带 document 与 registry 的 ComposePreviewDialog
- **THEN** 组件以模态对话框呈现激活场景的预览
- **AND** 关闭控件、Esc 与遮罩操作请求宿主关闭对话框并恢复触发焦点

#### Scenario: 切换指定 Container 预览

- **WHEN** 用户在场景选择器中选择另一个根 Frame
- **THEN** 对话框以该 Frame 作为 ComposePreview 的目标
- **AND** 动画播放控制随之切换到该 Frame 的动画清单

#### Scenario: 默认目标来自激活场景

- **WHEN** 宿主传入的激活场景不是文档的第一个根 Frame
- **THEN** 对话框打开时选中的是激活场景而不是第一个根 Frame

#### Scenario: 页面预览内跳转

- **WHEN** 宿主提供导航端口并在对话框中点击带 click→navigate 的 Entity
- **THEN** 对话框内容切换到目标页面的激活场景
- **AND** 场景选择器改为列出目标页面的根 Frame
- **AND** 过程中不出现「目标不存在」的错误态

#### Scenario: 场景名取自当前预览的文档

- **WHEN** 页面预览跳转到另一个页面
- **THEN** 场景选择器列出的名称来自目标页面的文档，而不是宿主正在编辑的那份文档

#### Scenario: 组件目标不被拉伸填满屏幕

- **WHEN** 宿主以 `targetKind="component"` 打开预览，并选择一块大于组件自身尺寸的屏幕
- **THEN** 组件按原大摆在这块屏中央，而不是被放大到填满它

#### Scenario: 未提供导航端口保持兼容

- **WHEN** 宿主只传入 document 与 registry
- **THEN** 对话框行为与本变更前完全一致
- **AND** `Interaction` 在其中不产生跳转

### Requirement: Preview Dialog 视图控制

ComposePreviewDialog MUST 提供不改变文档的**视图缩放**与全屏控制；视图缩放只影响这块屏在
对话框里画多大，MUST NOT 改变屏幕尺寸、`fit` 或 ComposePreview 的输出语义。当前视图缩放
MUST 常驻可读。

「适应窗口」MUST 是一个动作而不是一个缩放档位：它按下时把当前这块屏取景到窗口里，此后
用户仍然停在一个具体的缩放比例上。

#### Scenario: 调整视图缩放

- **WHEN** 用户改变视图缩放
- **THEN** 画板在预览舞台中按该比例呈现，当前比例可读
- **AND** document、target 与屏幕尺寸不被修改

#### Scenario: 适应窗口是一次性动作

- **WHEN** 用户按下「适应窗口」
- **THEN** 视图缩放变成让当前这块屏正好放进窗口的那个具体比例
- **AND** 它 MUST NOT 成为一个可以停留的档位：此后用户仍然停在一个具体比例上，放大缩小照常生效

### Requirement: Preview 原生 Container 滚动

Preview MUST 在真实递归 DOM 层级上把规范化分轴策略映射为原生 overflow，并让滚动位置保持为
非持久化的浏览器会话状态。

#### Scenario: 纵向内容真实滚动

- **WHEN** 容器纵向配置为 `scroll` 且子内容超过容器高度
- **THEN** Preview 出现原生纵向滚动范围并允许用户滚动，而文档保持不变

#### Scenario: 滚动范围保留末端内边距

- **WHEN** Auto Layout 容器带有底部或右侧内边距且内容溢出
- **THEN** Preview 的原生滚动范围在最后一个子项之后保留对应末端内边距

### Requirement: Preview Frame 背景 Paint

ComposePreview MUST 在目标 Frame 的边界内渲染该 Frame `Appearance.backgroundPaint` 的 Solid、
Linear、Radial 与 Angular 描述，并保持其位于该 Frame 全部后代 Entity 之后。嵌套 Frame MUST 各自
渲染自己的背景。Preview 不得渲染渐变编辑控制柄或其它 Editor chrome。

#### Scenario: 预览渐变输出背景

- **WHEN** v7 文档的根 Frame 使用任一合法 Gradient Paint
- **THEN** Preview 显示与 Stage Frame 边界一致的渐变背景
- **AND** Entity Appearance、Hierarchy 和 Clip 渲染顺序保持不变

#### Scenario: 嵌套 Frame 各自的背景

- **WHEN** 目标 Frame 内嵌套一个拥有不同背景 Paint 的子 Frame
- **THEN** 两层背景分别渲染在各自边界内，子 Frame 背景位于其自身后代之后
- **AND** 子 Frame 的裁剪与坐标原点独立于宿主 Frame

### Requirement: Preview 嵌套 Frame 动画播放

ComposePreview MUST 按 Frame 播放动画：每个 Frame 使用自己 `Animations` 清单中的动画和自己的
时间轴。嵌套 Frame（组件实例）MUST 拥有独立播放状态，宿主 MUST 只能通过播放控制
（play/pause/seek/mode）影响嵌套 Frame，MUST NOT 采样或覆写嵌套 Frame 内部 Entity 的属性。

#### Scenario: 组件实例播放自己的动画

- **WHEN** 一个组件根 Frame 定义了动画，其实例被放入宿主 Frame 并预览
- **THEN** 实例按组件自身时间轴播放
- **AND** 宿主 Frame 的播放头不改变实例内部的采样结果

#### Scenario: 宿主控制嵌套播放状态

- **WHEN** 宿主对某个嵌套 Frame 发出 pause 与 seek
- **THEN** 该嵌套 Frame 停在指定时刻
- **AND** 宿主与其它嵌套 Frame 的播放状态不受影响

### Requirement: 动画自动播放

动画清单条目 MUST 支持可选的 `autoplay` 布尔字段：`playing` 未绑定任何脚本导出且
`autoplay` 为 true 时，预览挂载后 MUST 视同 `playing` 恒为 true——首帧触发上升沿从头
播放，播放模式照常生效。`bindings.playing` 存在时脚本绑定 MUST 优先，`autoplay` 被忽略。
编辑器的「播放」属性行在未绑定变量时 MUST 作为手动开关编辑该字段，修改经动画配置命令
写入清单（可撤销）并随页面保存回写动画文件。

#### Scenario: 勾选自动播放无需绑定即播放

- **WHEN** 动画的 `autoplay` 为 true 且 `playing` 没有绑定任何导出
- **THEN** 预览挂载后动画从 0 ms 开始播放，`play-once` 播完停在末尾

#### Scenario: 脚本绑定优先于自动播放

- **WHEN** 动画同时携带 `autoplay: true` 与 `bindings.playing`，且绑定导出为 false
- **THEN** 预览不播放，播放完全由绑定导出驱动

#### Scenario: 手动勾选写入清单

- **WHEN** 用户在「播放」属性行未绑定变量时勾选开关
- **THEN** 动画配置命令把 `autoplay` 写入清单且可撤销；取消勾选后清单不保留该字段

### Requirement: 页面宿主与跳转执行

`@compose-ui/preview` MUST 提供 `ComposePageHost`,接受导航端口、页面 Loader、Registry 与
资源 Resolver,按当前页面加载页面包装并渲染其 `activeFrameId` 指向的 Frame。目标页面有多个
根 Frame 时 MUST 只渲染激活场景,MUST NOT 提供运行期的场景选择。

`ComposePageHost` MUST 为携带 `Interaction` 的 Entity 建立交互:`click` trigger 触发
`navigate` 时 MUST 通过导航端口跳转,触发 `navigate-back` 时 MUST 请求返回。交互处理器
MUST 挂在 Entity 容器层且 MUST NOT 阻止事件继续到达物料自身的交互,避免抢走 Renderer
自己的行为。可交互 Entity MUST 具备可访问名称、键盘可达性与 button 语义。

切换页面时 `ComposePageHost` MUST 释放上一页的 setup scope 再建立新页的 scope,并 MUST
复用既有的页面 setup 作用域 Hook 而不是自建加载与竞态逻辑。加载中与导航失败 MUST 是可被
宿主区分的确定状态。

`ComposePageHost` MUST 接受宿主正在编辑的那一页及其 live 文档。该页与当前页一致时宿主
MUST 直接渲染它而**不经过页面加载端口**，使预览包含尚未保存的改动；否则「配好跳转→预览」
会呈现上次保存的内容，用户会认为交互没有生效。跳转到其他页面 MUST 仍然经过加载端口，
跳回该页时 MUST 重新使用 live 文档。

导航会话**还没有起点**时，`ComposePageHost` MUST 渲染该 live 页而不是空状态，并 MUST 顺带
把会话起点补到该页——用户正在编辑的那一页就在手上，让他看见「未设置首页」是无谓的失败态；
而会话没有起点时跳转记不进返回栈，返回会变成死键。

#### Scenario: 会话没有起点时显示正在编辑的那一页

- **WHEN** 导航会话的当前页为空，而宿主提供了正在编辑的 live 页
- **THEN** 宿主渲染该 live 页，不呈现空状态
- **AND** 会话起点被补到该页，随后的跳转可以正常返回

#### Scenario: 未保存的改动出现在页面预览中

- **WHEN** 宿主传入正在编辑页面的 live 文档，其中含一个尚未保存、带 click→navigate 的 Entity
- **THEN** 预览中出现该 Entity 且它的跳转可用
- **AND** 渲染该页时不发起页面加载

#### Scenario: 点击跳转到另一个页面

- **WHEN** 当前页面中一个带 click→navigate 的 Entity 被点击
- **THEN** 宿主渲染目标页面激活场景的内容
- **AND** 上一页的 setup scope 被 dispose 且其 effect cleanup 被执行

#### Scenario: 只渲染激活场景

- **WHEN** 目标页面含三个根 Frame
- **THEN** 只有 `activeFrameId` 指向的 Frame 被渲染

#### Scenario: 不抢走物料自身交互

- **WHEN** 一个带 `Interaction` 的容器内含声明了 event-handler 的物料,用户点击该物料
- **THEN** 物料绑定的页面方法被调用
- **AND** 容器的跳转同样按冒泡语义生效而不被静默吞掉

#### Scenario: 键盘触发跳转

- **WHEN** 可交互 Entity 获得键盘焦点并被激活键触发
- **THEN** 与指针点击产生相同的跳转
- **AND** 该 Entity 暴露 button 语义与可访问名称

#### Scenario: 跳转失败保留当前页

- **WHEN** 跳转目标不可解析
- **THEN** 宿主继续呈现当前页面内容
- **AND** 失败状态可被宿主读取并提示

### Requirement: 预览屏幕尺寸

`ComposePreviewDialog` MUST 用**屏幕尺寸**表达「被预览的那块屏有多大」，与表达取景的视图
缩放分开。屏幕尺寸的候选清单 MUST 直接读 `COMPOSE_SCENE_SIZE_PRESETS`，MUST NOT 在预览侧
另写一份分辨率列表。

屏幕尺寸选择器 MUST 分两组：第一组恰好一项，是**当前预览目标自身的尺寸**（回到 1:1）；
第二组是清单里的常见屏幕。每一项 MUST 同时呈现分辨率、通名与宽高比；通名来自
`findComposeSceneSizePreset`，查不到时 MUST NOT 伪造一个，而是标为「自定义」。宽高比
MUST 由尺寸算出，MUST NOT 进入文档协议。

对话框 MUST 另提供直接键入宽高的入口，使清单之外的任意尺寸都可达；当前屏幕尺寸不在清单上
时，选择器 MUST 呈现为未选中任何清单项而不是落回第一项。场景目标 MUST 提供横竖互换；
组件目标 MUST NOT 提供它——把 88 × 132 换成 132 × 88 不是任何人会提的请求。

屏幕尺寸 MUST 是预览会话状态：MUST NOT 写入 `ComposeDocument`，也 MUST NOT 从文档读取。
屏幕尺寸与目标 Frame 的尺寸不一致时，MUST 按生效的 `fit` 把目标映射进这块屏。

#### Scenario: 默认屏幕等于目标自身尺寸

- **WHEN** 宿主打开预览对话框
- **THEN** 屏幕尺寸等于当前目标 Frame 的 `Frame.size`，内容按 1:1 呈现
- **AND** 读数写明这是目标的原尺寸

#### Scenario: 选择另一块屏

- **WHEN** 用户在屏幕尺寸菜单中选择一档与目标尺寸不同的分辨率
- **THEN** 画板变成该分辨率，目标按生效的 `fit` 映射进去
- **AND** `ComposeDocument` 不被修改

#### Scenario: 从选择器换屏幕尺寸后重新取景

- **WHEN** 用户在屏幕尺寸选择器中选择另一块屏
- **THEN** 视图按新尺寸重新取景一次
- **AND** 这是一次性的，此后用户改变视图缩放不会被再次覆盖

#### Scenario: 目标尺寸不在清单上时标为自定义

- **WHEN** 目标 Frame 的尺寸不匹配任何 `COMPOSE_SCENE_SIZE_PRESETS` 条目
- **THEN** 菜单第一组那一项不呈现任何通名，而是标为「自定义」
- **AND** 第二组仍然完整列出清单里的常见屏幕

### Requirement: 拖动改屏幕尺寸与吸附

`ComposePreviewDialog` MUST 允许直接拖画板的角改屏幕尺寸，并在拖动中吸附到候选尺寸。
吸附 MUST 由 `@compose-ui/core` 的纯函数给出，`preview` 与 `stage` MUST 共用同一个函数与
同一个容差常量。

吸附 MUST 遵守三条：候选的**优先级严格先于距离**——预览目标自身的尺寸压过清单里的任何
预设，即使某个预设更近；容差 MUST 按**屏幕距离**（尺寸差乘以当前视图缩放）判定，
MUST NOT 直接比较分辨率差；吸附粒度 MUST 是**整份分辨率**，即尺寸空间里的一个二维点，
MUST NOT 退化成两条各自独立的轴。

吸附命中时 MUST 在读数上标出命中了哪一个候选；未命中时 MUST NOT 呈现命中态。
拖动 MUST NOT 改动 `ComposeDocument`——预览里拖的是屏幕而不是场景。

#### Scenario: 拖动吸附到清单里的分辨率

- **WHEN** 用户拖动画板的角，落点落在某个预设分辨率的容差内
- **THEN** 屏幕尺寸吸附到该预设，读数呈现命中态并写出它的通名
- **AND** 松手后屏幕尺寸就是该预设，文档不变

#### Scenario: 目标自身尺寸压过更近的预设

- **WHEN** 拖动落点同时落在目标自身尺寸与某个预设的容差内，且该预设距离更近
- **THEN** 吸附到目标自身尺寸

#### Scenario: 容差随视图缩放折算

- **WHEN** 同一个分辨率差分别发生在 25% 与 100% 的视图缩放下
- **THEN** 只有屏幕距离落在容差内的那一次发生吸附

#### Scenario: 宽命中而高不命中不吸附

- **WHEN** 拖动落点的宽度恰好等于某个预设而高度相差很远
- **THEN** 不吸附到该预设

#### Scenario: 拖动中不重新取景

- **WHEN** 用户拖动画板的角改屏幕尺寸
- **THEN** 视图缩放保持不变——重新取景会让画板在屏幕上纹丝不动，拖了等于没有反馈

### Requirement: 预览画板保真

`ComposePreviewDialog` 的画板 MUST 逐像素呈现目标的真实输出，只允许整体缩放这一种差异。
画板 MUST NOT 为目标补任何文档里没有的底色，MUST NOT 给目标加圆角或裁切它的角，
MUST NOT 在目标边缘加描边。目标背景透明的区域 MUST 以可辨认的透明表示（棋盘）呈现，
MUST NOT 呈现为不透明白色。

视图缩放 MUST 用 `transform` 缩放而不是 CSS `zoom`：后者会在该比例下重新布局，使文字度量
与换行位置在非 100% 时与真实输出不同。视图缩放 MUST 有常驻可读的当前比例，并 MUST 提供
一个「适应窗口」**动作**；它 MUST NOT 是一个可以停留的缩放档位。

#### Scenario: 透明背景不呈现为白色

- **WHEN** 目标 Frame 的 `Appearance.backgroundPaint` 是 `transparent`
- **THEN** 画板在该区域呈现透明表示，而不是不透明白色

#### Scenario: 非 100% 缩放不改变布局

- **WHEN** 同一份文档分别在 100% 与某个更小的视图缩放下预览
- **THEN** 两者的布局结果一致，只差一个整体缩放

#### Scenario: 画板不裁角

- **WHEN** 目标 Frame 的内容延伸到它的四个角
- **THEN** 画板不因为自身的圆角而裁掉这些内容

### Requirement: 两个预览形态共用同一层实现

`@compose-ui/preview` MUST 让模态预览与整屏预览由**同一层实现**产出呈现：目标解析、屏幕尺寸、
视图缩放与播放会话 MUST 只有一份实现，两个形态各自只提供自己的 chrome。该层 MUST NOT 出现在
包的公共入口——它是两个形态的共同实现，不是宿主协议；一旦可被第三方 chrome 绕开，
「两个预览一样」就不再成立。

给定同一份文档、同一个目标场景与同一块屏幕尺寸时，两个形态 MUST 产出相同的画板内容。

#### Scenario: 同一份输入在两个形态里画出同样的内容

- **WHEN** 以同一份文档、同一个目标场景与同一块屏幕尺寸分别渲染模态形态与整屏形态
- **THEN** 两者画板内的 Entity 结构与几何相同
- **AND** 差别只出现在各自的 chrome 上

#### Scenario: 共同实现不出现在公共入口

- **WHEN** 检查 `@compose-ui/preview` 的公共导出
- **THEN** 其中不含这一层的组件或 Hook

### Requirement: 整屏预览形态

`@compose-ui/preview` MUST 提供 `ComposePreviewPage`：预览铺满视口、静息态不画任何 chrome。
它 MUST NOT 卸载宿主的编辑上下文——路由由宿主承担，`ComposePreviewPage` 只渲染。

默认屏幕 MUST 是**实际视口**而不是目标自身尺寸，且视图缩放 MUST 是 1:1，因此默认呈现的就是
真实像素。「实际视口」MUST 跟随窗口尺寸变化，MUST NOT 在进入时量一次后固定下来。用户挑了
别的屏幕尺寸时 MUST 在真实视口里套出那块屏，其余区域留黑。

`ComposePreviewPage` MUST 提供静息后自动隐去的控制条，其中 MUST 含**退出**动作。控制条
MUST 在指针移动时浮出；键盘焦点进入控制条时 MUST 保持可见，且 MUST 可由键盘唤出——只按指针
显隐会让控制条对键盘用户永远不存在。退出 MUST 同时接受控制条上的动作与 `Escape`。

该形态 MUST NOT 提供时间轴刮擦：动画按自身的 `autoplay` 与脚本绑定运行，刮擦是编辑动作。

#### Scenario: 默认呈现真实像素

- **WHEN** 宿主渲染 `ComposePreviewPage`
- **THEN** 屏幕尺寸等于当前视口尺寸，视图缩放是 1:1
- **AND** 读数写明当前屏幕是实际视口

#### Scenario: 实际视口跟随窗口变化

- **WHEN** 处在默认屏幕下，视口尺寸发生变化
- **THEN** 屏幕尺寸随之变化，读数与之一致

#### Scenario: 挑一块比视口小的屏幕

- **WHEN** 用户选择一档小于当前视口的分辨率
- **THEN** 该分辨率的屏幕按 1:1 摆在视口中，其余区域留黑

#### Scenario: 静息后只剩页面本身

- **WHEN** 指针停止移动超过静息时长
- **THEN** 控制条隐去，视口中只剩被预览的内容

#### Scenario: 键盘可以唤出控制条

- **WHEN** 控制条已隐去，用户用键盘把焦点移入控制条
- **THEN** 控制条可见并保持可见直到焦点离开

#### Scenario: 两条退出路径

- **WHEN** 用户按下控制条上的退出动作，或按 `Escape`
- **THEN** 宿主收到退出请求

### Requirement: 预览形态之间的切换

`ComposePreviewDialog` MUST 接受可选的**切换到整屏**动作；宿主提供它时 MUST 呈现对应控件，
不提供时 MUST NOT 呈现。切换 MUST 只是向宿主发出请求——路由归宿主，`@compose-ui/preview`
不认识 URL。

切换请求 MUST 携带当前的目标场景、屏幕尺寸与播放头，使宿主能在返回时把这三样还原；
`@compose-ui/preview` MUST NOT 自行跨形态记忆它们。

整屏形态 MUST 与编辑器处在**同一个浏览上下文**，MUST NOT 以新标签页承载：既有规则要求页面预览
包含尚未保存的改动，而新标签页读不到宿主手上的 live 文档，只能拿到上次保存的那一份。

「在新标签页打开」MUST 作为**次级动作**由宿主提供，`ComposePreviewDialog` 只提供放置它的位置。
宿主提供该动作时 MUST 先落盘，并 MUST 在控件上说明这件事；MUST NOT 静默地呈现上次保存的内容。

#### Scenario: 宿主没有提供切换动作

- **WHEN** 宿主未传入切换到整屏的动作
- **THEN** 对话框不呈现该控件，其余行为与本变更前一致

#### Scenario: 切换请求带着当前状态

- **WHEN** 用户在选定某个场景、改过屏幕尺寸并拖动过播放头之后按下切换
- **THEN** 宿主收到的请求中含这三样的当前值

#### Scenario: 返回后回到原来的状态

- **WHEN** 宿主用收到的那份状态渲染整屏形态，随后退出并重新打开对话框
- **THEN** 对话框回到切换之前的场景、屏幕尺寸与播放头

#### Scenario: 未保存的改动出现在整屏形态里

- **WHEN** 宿主在有未保存改动时切换到整屏形态
- **THEN** 整屏形态呈现含这些改动的内容

