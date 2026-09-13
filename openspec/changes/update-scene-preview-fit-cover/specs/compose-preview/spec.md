## MODIFIED Requirements

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
零件,不是那块屏的全部内容）,场景的默认 `fit` MUST 是 `cover`——屏幕比例与场景不同时
`contain` 会在两条边留出台面,而那块屏上本来不会有那两条边。它 MUST 是等比裁切而 MUST NOT
是 `fill` 的两轴各自拉伸:拉伸会改变每一个图形的形状。

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

#### Scenario: 场景铺满那块屏

- **WHEN** 屏幕尺寸与场景尺寸的宽高比不同（例如 1280 × 720 的场景摆进 1675 × 996 的屏）
- **THEN** 场景按两轴比例的**较大者**等比缩放，两条边都不留台面，较松的那一轴等量溢出
- **AND** 溢出的部分被屏幕盒子裁掉，不覆盖画板之外的任何东西
