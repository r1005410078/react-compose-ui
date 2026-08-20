## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 受控 Preview Dialog

`@compose-ui/preview` MUST 提供受控 `ComposePreviewDialog`,接受与 `ComposePreview` 相同的文档、Registry、资源 Resolver 与页面加载端口,并由宿主通过 `open` 和关闭回调控制可见性。该组件不得依赖 Editor 或 Stage。对话框 MUST 以**场景选择器**表达预览目标:列出文档中的全部根 Frame,默认选中宿主给出的激活场景;预览目标任何时刻 MUST 恰好是一个 Frame。对话框 MUST NOT 再提供「完整文档 / 指定 Container」的二选一,也 MUST NOT 在解析目标时绕过宿主给出的默认值直接取第一个根 Frame;动画播放宿主 MUST 跟随当前解析出的目标 Frame。

宿主额外提供导航端口时,对话框 MUST 切换为**页面预览**:内容由 `ComposePageHost` 承载,
`Interaction` 的跳转在对话框内真实生效,场景选择器 MUST 只列出**当前页面**的根 Frame 并在
跳转后跟随新页面重置。宿主未提供导航端口时对话框 MUST 保持上述文档预览行为不变。

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

#### Scenario: 未提供导航端口保持兼容

- **WHEN** 宿主只传入 document 与 registry
- **THEN** 对话框行为与本变更前完全一致
- **AND** `Interaction` 在其中不产生跳转
