## ADDED Requirements

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

## MODIFIED Requirements

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
