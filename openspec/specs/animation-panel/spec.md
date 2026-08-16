# animation-panel Specification

## Purpose
TBD - created by archiving change add-animation-panel-prototype. Update Purpose after archive.
## Requirements
### Requirement: 独立动画编辑器组件

系统 MUST 提供不依赖 `editor`、`core`、`stage`、`preview` 或 DOM 文档协议的
`@compose-ui/animation-panel` 包。包 MUST 从公共入口导出能由同一个 Provider 协调的底部时间线和
右侧关键帧属性组件，并支持受控与非受控会话值。

#### Scenario: 分置嵌入动画区域

- **WHEN** 宿主把 `ComposeAnimationTimeline` 与 `ComposeAnimationInspector` 放在同一
  `ComposeAnimationPanelProvider` 的不同布局区域
- **THEN** 两个区域显示同一播放头、选中关键帧和演示数据
- **AND** 不要求宿主提供 ComposeDocument、Stage 或 editor controller

### Requirement: 默认关键帧演示时间线

系统 MUST 默认显示参考图对应的 300 ms `Fault / 背景填充` 演示轨道，在 0、100、200、300 ms
显示四个关键帧，并默认选中第 3 个 200 ms Linear 红色关键帧。

#### Scenario: 初次渲染动画时间线

- **WHEN** 宿主不传入自定义会话值并渲染时间线和属性面板
- **THEN** 底部显示播放控件、0/100/200/300 标尺、`Fault` 和 `背景填充` 轨道及选中播放头
- **AND** 右侧显示 `3 / 4`、`200 ms`、`#FF6B6B`、`Linear` 和曲线视图

### Requirement: 本地时间线与关键帧交互

系统 MUST 让播放/暂停、播放模式、自动记录开关、播放头拖动或键盘调整、关键帧选择和关键帧字段编辑
只修改 Provider 会话状态；这些操作 MUST NOT 写入画布、页面文档或撤销历史。

#### Scenario: 选择并编辑关键帧

- **WHEN** 用户选择任意关键帧并修改其时间、插值或颜色值
- **THEN** 时间线选中态和右侧字段立即反映该关键帧自己的时间、值和插值会话值
- **AND** 原 200 ms 演示关键帧与外部文档保持不变

#### Scenario: 头部、物体与属性分行对齐

- **WHEN** 时间线初次渲染默认演示数据
- **THEN** 左侧操作栏（播放、当前时间、尾帧时长、播放模式）与右侧时间标尺同一行
- **AND** 物体 `Fault` 与蓝色动画片段同一行并默认选中
- **AND** 属性 `背景填充` 与关键帧轨道同一行

#### Scenario: 选择属性轨道

- **WHEN** 用户点击左侧 `背景填充` 名称或右侧对应关键帧轨道
- **THEN** 名称行与关键帧轨道同时显示选中态，且播放头保持不变
- **AND** 物体 `Fault` 与蓝色动画片段取消选中

#### Scenario: 调整关键帧时间

- **WHEN** 用户在时间线上水平拖动一个关键帧，或聚焦关键帧并按 ArrowLeft/ArrowRight
- **THEN** 关键帧时间在 0～duration 内以 10 ms 吸附调整，右侧时间字段同步到该关键帧
- **AND** 关键帧保持选中，且不得越过边界或与同一属性轨道已有关键帧重叠
- **AND** 预览播放头保持在调整前的当前播放时间

### Requirement: 关键帧间的插值曲线段

系统 MUST 在同一属性轨道的相邻关键帧之间渲染可交互的插值曲线段。曲线段的中点曲线标识 MUST 在
悬停、键盘聚焦或选中时显示。选择曲线段 MUST 选中该段的终点关键帧、切换右侧属性面板到曲线标签，
并显示该段的时间范围和终点关键帧插值；该操作不得移动预览播放头。

#### Scenario: 选择关键帧间的曲线段

- **WHEN** 用户悬停或选择 200 ms 与 300 ms 关键帧之间的曲线段，并点击该段或中点曲线标识
- **THEN** 该段显示曲线标识，右侧属性面板选中 300 ms 关键帧并显示 `200 ms → 300 ms` 曲线区间
- **AND** 右侧“曲线”标签处于激活状态，且播放头保持在点击前的时间

### Requirement: 可编辑尾帧时长

系统 MUST 将时间线控制栏中的尾帧时长作为可编辑数值。修改时长时，标尺、播放范围和位于原尾帧的
关键帧 MUST 同步移动到新时长；时长不得缩短到任一非尾帧之后，避免产生重叠关键帧。

#### Scenario: 延长尾帧

- **WHEN** 用户把默认的 300 ms 尾帧时长修改为 500 ms
- **THEN** 标尺和播放范围扩展到 500 ms
- **AND** 原 300 ms 尾帧移动为 500 ms，其他关键帧保持原位置

#### Scenario: 延长后显示中间主刻度

- **WHEN** 用户把尾帧时长修改为 600 ms
- **THEN** 标尺显示 0、100、200、300、400、500、600 ms 的主刻度标注

### Requirement: 可选择和调整的动画片段

系统 MUST 在片段行渲染可选择的动画片段。用户 MUST 能拖动片段主体平移其时间范围，并能通过起止手柄
调整范围；片段必须保持在时间轴范围内且至少保留 10 ms 时长。片段必须支持键盘 ArrowLeft/ArrowRight
以 10 ms 为步长移动或调整，且所有操作仅更新本地 Provider 会话。

#### Scenario: 选择并收缩动画片段

- **WHEN** 用户点击默认 `Fault` 动画片段并把结束手柄从 300 ms 拖到 250 ms
- **THEN** 片段显示选中态，结束时间更新为 250 ms
- **WHEN** 用户聚焦片段主体并按 ArrowRight
- **THEN** 片段整体移动为 10 ms 至 260 ms，且不改变播放头或页面文档

### Requirement: 三种播放模式

系统 MUST 提供 `play-once`、`loop` 和 `ping-pong` 三种本地播放模式，并在播放时按照当前模式推进
播放头；模式切换必须更新 Provider 会话状态。

#### Scenario: 播放一次与循环

- **WHEN** 用户播放时间线直到播放头到达 300 ms
- **THEN** `play-once` 模式停止在末尾
- **WHEN** 用户选择 `loop` 后再次播放
- **THEN** 播放头从末尾回到 0 ms 并继续推进

#### Scenario: 往返播放

- **WHEN** 用户选择 `ping-pong` 并让播放头越过 300 ms 或 0 ms
- **THEN** 播放头在边界反向并继续播放，而不停止或跳过边界

### Requirement: 参考图一致的可访问视觉结构

系统 MUST 使用共享 Theme/I18n token，重现参考图的深色分层、顶部控制栏、固定轨道列表、可横向滚动的
标尺、蓝色播放头、菱形关键帧、右侧字段和曲线/弹簧标签。可交互控件必须具有本地化 accessible name、
可见焦点和键盘操作。

#### Scenario: 键盘调整播放头

- **WHEN** 用户聚焦播放头并按 ArrowLeft、ArrowRight、Home 或 End
- **THEN** 播放头分别按 10 ms 调整、跳至 0 ms 或跳至 300 ms
- **AND** 右侧时间字段和可访问状态文字同步更新

### Requirement: 编辑器中可见的动画区

`@compose-ui/editor` MUST 在默认底部工具组中提供本地化的“动画”标签，并以
`@compose-ui/animation-panel` 作为纯 UI 依赖挂载时间线。切换动画标签 MUST NOT 改变右侧属性区的
内容：右侧始终显示编辑器原有 Inspector，关键帧属性面板由宿主自行决定是否嵌入。此宿主集成
MUST NOT 把动画操作写入 ComposeDocument、Stage、Preview 或撤销历史。
底部工具组 MUST 横跨整个编辑器底边；场景与属性区应位于其上方的主工作区左右分栏，不能限制底部
工具组的水平宽度。

#### Scenario: 激活动画标签

- **WHEN** 用户在编辑器底部工具组选择“动画”标签
- **THEN** 底部显示动画时间线
- **AND** 右侧属性区继续显示编辑器原有 Inspector 内容

#### Scenario: 动画编辑器占满底边

- **WHEN** 编辑器同时显示场景区、右侧属性区和已展开的底部动画标签
- **THEN** 底部动画编辑器横跨编辑器完整底边宽度
- **AND** 场景区和属性区仅占用底部工具组上方的主工作区

#### Scenario: 切换回常规工具标签

- **WHEN** 用户从“动画”切换到资源、命令或日志标签
- **THEN** 右侧属性区内容保持不变
- **AND** 本地动画会话值不写入页面文档或撤销历史

