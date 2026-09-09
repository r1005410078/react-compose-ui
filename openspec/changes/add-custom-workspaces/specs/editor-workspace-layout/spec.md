## REMOVED Requirements

### Requirement: 四区编辑器工作区

**Reason**: 四区从不变量降为内建 `page` 工作区的 builder 摆出的初始布局；面板可拖之后「左侧
Scene Graph、右侧 Inspector」只是初始状态。由「工作区定义与注入」「内建工作区」取代。

### Requirement: 固定中央画布

**Reason**: 画布面板改为可搬不可关，由「面板拖拽与硬约束」取代。

### Requirement: 临时布局状态

**Reason**: 布局快照进偏好（对宿主不透明、失配即回退），由「工作区布局快照」取代。

### Requirement: 场景下方工具分栏

**Reason**: 场景图与工具组的摆法成为 builder 的初值，分栏高度进快照；历史面板的加入规则并入
「内建工作区」。

### Requirement: Dockview 场景工具布局

**Reason**: 60%/40% 与最小高度成为 builder 的初值与面板约束，状态由快照持有。

### Requirement: 边缘面板按文档类型记忆展开状态

**Reason**: 记忆的键从「文档类型」细到「文档」，值从折叠状态扩到整份布局，由「按文档记忆
工作区」与「工作区布局快照」取代。

## MODIFIED Requirements

### Requirement: 文档标签条

文档（页面文档、组件文档、资源文件文档）MUST 是编辑器会话而 MUST NOT 是 Dockview panel。编辑器
顶部 MUST 有一条横贯全宽、位于 Dockview 之外的文档标签条，实现 `tablist` 可访问语义：方向键在
文档间移动，`Delete` 不关闭；标签 MUST 显示名称、未保存圆点与关闭按钮，样式沿用既有标签（活动
`surface-active` 底 + `text-strong`，无 accent 条，无图标）。标签条右端 MUST 依次是工作区切换器、
管理菜单与设置按钮；切换器 MUST NOT 是标签，MUST NOT 吃标签的活动 / 非活动样式。

文档 MUST 由 `provider.id + assetKey（缺失时 entry.id）` 唯一标识，重复打开 MUST 激活现有标签
而非创建副本；资源文件文档 MUST 保留未保存 Monaco 草稿。关闭 dirty 文档或改动已打开资源的条目时，
系统 MUST 提供保存、放弃或取消决策，并只在保存成功或放弃后关闭；取消、保存失败或 revision
conflict 不执行关闭或对应 Provider 操作。中央画布组 MUST 只承载画布，画布 MUST 跟随活动文档。
文档 MUST NOT 参与 Dockview 拖放、浮动、布局持久化、ComposeDocument、History 或 Operation Log。

#### Scenario: 标签条通栏

- **WHEN** 编辑器挂载并打开两个页面
- **THEN** 文档标签条的宽度等于编辑器宽度，两个标签在左、切换器与设置按钮在右
- **AND** 中央画布组的头没有任何标签

#### Scenario: 键盘在文档间移动

- **WHEN** 焦点在活动文档标签上按右方向键
- **THEN** 下一个文档激活，画布、场景图与属性面板跟随

#### Scenario: 从默认资源浏览器打开资源

- **WHEN** 默认 Asset Browser 发出文件打开意图
- **THEN** 标签条打开或激活对应资源文档标签
- **AND** 切走再切回时未保存的 Monaco 草稿仍在

#### Scenario: 关闭 dirty 文档

- **WHEN** 用户关闭 dirty 文档标签，或重命名、移动、删除包含 dirty 已打开资源的条目
- **THEN** 系统提供保存、放弃或取消决策，并只在保存成功或放弃后关闭
- **AND** 取消、保存失败或 revision conflict 不执行关闭或对应 Provider 操作

### Requirement: 设计与动画模式切换器

页面文档与组件文档活动时，文档标签条右端 MUST 在保存入口旁提供「设计 / 动画」**两段**模式
切换器，作为动画模式的唯一入口；MUST NOT 提供绘图段——绘图能力恒开，不属于任何模式。底部组
MUST NOT 默认包含动画标签。切到动画模式时，编辑器 MUST 在底部组中动态加入并激活时间线面板，
并展开底部组；切回设计模式时 MUST 移除时间线面板、恢复切换前的活动标签与折叠状态。
切换器 MUST 实现 radiogroup 可访问语义，方向键 MUST 按索引循环。未启用页面系统的宿主本期仍不
提供动画模式入口。

**时间线面板 MUST NOT 进入工作区布局快照**：它是模式叠加在任一布局上的面板。动画模式开着时
切换工作区，MUST 在新布局应用之后把时间线面板加回底部组并展开。

切到动画模式 MUST NOT 关闭任何绘图能力。组件文档下动画作用域 MUST 解析到组件根 Frame，动画
命令 MUST 走组件文档自己的事务运行时，撤销与重做 MUST 只作用于组件文档的历史。

#### Scenario: 底部组默认标签

- **WHEN** Dockview 工作区完成初始化
- **THEN** 底部组只包含 资源、命令 与 Transaction Log 标签，不包含动画标签

#### Scenario: 切换器只有两段

- **WHEN** 用户查看文档标签条右端的模式切换器
- **THEN** 只有「设计」与「动画」两段，没有「绘图」

#### Scenario: 切换到动画模式

- **WHEN** 用户在页面文档工具栏把模式切换到「动画」
- **THEN** 底部组加入并激活时间线面板，且底部组展开
- **AND** 编辑器进入动画模式

#### Scenario: 动画模式下切换工作区

- **WHEN** 动画模式开着时用户切换工作区
- **THEN** 新布局应用之后时间线面板仍在底部组且底部组展开
- **AND** 该工作区记下的快照里没有时间线面板

#### Scenario: 切回设计模式恢复布局

- **WHEN** 用户在动画模式下把模式切换回「设计」，且进入动画模式前底部组处于折叠状态
- **THEN** 时间线面板从底部组移除，资源标签恢复活动
- **AND** 底部组恢复折叠状态，编辑器退出动画模式

#### Scenario: 组件文档进入动画模式

- **WHEN** 用户打开一个组件文档并把模式切换到「动画」
- **THEN** 时间线面板出现，动画作用域是该组件的根 Frame
- **AND** 在其中打的关键帧写进组件文档，撤销只回退组件文档

#### Scenario: 点击其它底部标签退出动画模式

- **WHEN** 动画模式下用户激活底部组的资源、命令或 Transaction Log 标签
- **THEN** 编辑器退出动画模式，时间线面板被移除，模式切换器同步显示「设计」

#### Scenario: 动画模式不关掉绘图能力

- **WHEN** 用户切到动画模式
- **THEN** 命令行仍可见并接受命令名
- **AND** 一条绘图命令可以正常启动并完成

## ADDED Requirements

### Requirement: 工作区定义与注入

`@compose-ui/editor` MUST 导出 `ComposeEditorWorkspaceDefinition` 与 `COMPOSE_DEFAULT_WORKSPACES`。
一个工作区定义 MUST 包含：稳定 `id`（不本地化）、已本地化 `title`、可选 `icon` 与 `description`、
`layout`（用面板名描述的 `preset`——画布左右两侧各一列上下堆叠的组、底部一条边缘组；或不透明
快照）、`session`（角度约束、增量角、网格可见、十字光标臂长、变换 Gizmo）。定义 MUST NOT 暴露
Dockview 成员（没有 builder 函数），MUST NOT 存在能改变命令集、按钮含义或快捷键的字段。

`ComposeEditor` MUST 接受 `workspaces` prop 替换内建列表；`id` 重名 MUST 抛错而 MUST NOT 静默
丢弃。宿主注入的工作区与用户另存的工作区 MUST 是同一种定义，差别只在谁给了初始布局。

#### Scenario: 宿主注入工作区

- **WHEN** 宿主传入 `[...COMPOSE_DEFAULT_WORKSPACES, substation]`
- **THEN** 切换器出现对应的段，激活时应用宿主给的布局与会话默认值

#### Scenario: 重名抛错

- **WHEN** 宿主传入两个 `id` 相同的工作区
- **THEN** 挂载抛出错误而不是静默丢弃其中一个

#### Scenario: 定义里没有改含义的字段

- **WHEN** 宿主注入任意工作区
- **THEN** 命令行词汇表、快捷键与动作目录与不注入时逐项相同

### Requirement: 内建工作区

`COMPOSE_DEFAULT_WORKSPACES` MUST 包含 `page`（标题「页面」）：其 builder MUST 摆出四区结构——
左侧场景图在上、工具组（基础组件、可选历史）在下按 60%/40% 分栏（场景内容至少 160px、工具
内容至少 120px），中央画布组，右侧属性面板，底部资源 / 命令 / 日志边缘组，左右两侧展开、底部折叠，底部活动
标签为资源，工具组活动标签为基础组件。宿主提供 `history` 或显式 `historyPanel` 时，历史 MUST
作为工具组的第二个标签加入，未提供时 MUST NOT 显示空历史标签。

#### Scenario: 默认工作区

- **WHEN** 宿主不传 `workspaces`
- **THEN** 切换器有「页面」段且按下
- **AND** 布局与本变更之前的默认布局逐像素一致

#### Scenario: 历史面板加入工具组

- **WHEN** 宿主提供 HistoryNavigationController
- **THEN** 工具组显示基础组件与历史两个标签，基础组件保持活动

### Requirement: 面板拖拽与硬约束

面板 MUST 可拖拽到任一组（含底部边缘组），MUST NOT 设置 `locked` 或 `disableDnd`。三条约束 MUST 由代码
保证：画布面板的标签 MUST NOT 有关闭按钮且 `removePanel` MUST 拒绝它；每种面板 MUST 至多一个
（拖是搬不是复制）；时间线面板 MUST NOT 进入快照。浮动组与弹出窗口 MUST 关闭。

拖拽移动 MUST NOT 重建面板内容（Dockview 的 `skipDispose` 路径），画布在拖拽期间 MUST 保持
同一 React 实例。

#### Scenario: 把基础组件面板拖到右栏

- **WHEN** 用户把工具组里的基础组件面板拖到右栏、放在属性面板上方
- **THEN** 基础组件面板出现在右栏，左栏只剩场景图
- **AND** 画布内容没有重新挂载

#### Scenario: 画布不可关闭

- **WHEN** 用户查看画布面板的标签或尝试以任何方式移除它
- **THEN** 标签上没有关闭按钮，画布仍在
- **AND** 工作区不会进入没有画布的状态

#### Scenario: 不能拖出浮动组

- **WHEN** 用户把一个面板拖到组的外面
- **THEN** 没有浮动组或弹出窗口产生

### Requirement: 工作区布局快照

用户改动布局（拖面板、调分栏、折叠、换活动标签）后，系统 MUST 把 Dockview `toJSON` 结果记入
偏好 `workspace.layouts[当前工作区 id]`（可防抖），并经 `onPreferencesChange` 通知宿主。快照
MUST 对宿主不透明：带 Dockview 版本号的 opaque 值，MUST NOT 暴露 `SerializedDockview` 类型。
快照 MUST NOT 进入文档、事务历史或操作日志。

激活工作区时：有快照 MUST 先校验（版本号一致、面板 id 全部已知、画布面板存在），通过则
`fromJSON`；不通过 MUST 丢弃该快照回到定义里的 `layout`（preset 重新摆出，快照则再校验一次），MUST NOT
报错或阻塞打开文档。定义只有快照且它也不成时 MUST 从列表删掉并提示。「重置布局」MUST 删除
快照。

#### Scenario: 拖过的布局随工作区记住

- **WHEN** 用户在自定义工作区里把基础组件面板拖到右栏，切到页面再切回
- **THEN** 基础组件面板仍在右栏
- **AND** 页面工作区的布局不受影响

#### Scenario: 快照失配回退

- **WHEN** 偏好里某个工作区的快照引用了一个宿主已关闭的面板
- **THEN** 该工作区按定义里的 preset 摆出默认布局，且偏好里该快照被清除
- **AND** 没有错误提示阻塞

#### Scenario: 快照不进事务

- **WHEN** 用户拖动面板之后按撤销
- **THEN** 撤销的是拖动之前的那一次文档变更，面板位置不变

### Requirement: 切换不打断画布

画布、场景图与属性面板的内容 MUST 各自渲染进一个在编辑器实例生命周期内稳定存在的宿主元素；
Dockview 面板挂载时 MUST 把该元素放进自己的容器，卸载时 MUST NOT 销毁它。工作区切换经
`fromJSON` 重建面板之后，MUST 把同一个元素放进新面板，MUST NOT 重新挂载其中的 React 组件。

#### Scenario: 命令会话跨切换存活

- **WHEN** `LINE` 已取到一个点，用户切换工作区
- **THEN** 命令行提示仍是「指定下一点」，键入到一半的坐标还在命令行里，下一次点击落地成一段
- **AND** 选择集与视口不变

#### Scenario: Strict Mode 下宿主元素唯一

- **WHEN** React Strict Mode 重放挂载
- **THEN** 画布只有一个宿主元素与一个 React 实例

### Requirement: 工作区切换

切换器 MUST 是 `radiogroup`，方向键按索引循环；hover / focus 时 MUST 提示该工作区会换的东西。
切换 MUST 依次：应用目标工作区的布局（快照或 builder）、会话开关（角度约束、增量角、网格可见、
十字光标臂长、Gizmo）；记入 `workspace.lastUsed` 与当前文档的 `workspace.byDocument`。切换
MUST NOT 改变活动文档、选择集、视口、当前工具、动画开关，MUST NOT 产生事务或撤销条目，
MUST NOT 打断正在取点的命令。会话开关的改动 MUST 记入当前工作区，切回时恢复；网格步长是文档
字段，切换 MUST NOT 碰它。

#### Scenario: 切换不产生事务

- **WHEN** 用户从一个工作区切到另一个
- **THEN** 事务日志没有新行，撤销栈长度不变

#### Scenario: 会话开关随工作区记住

- **WHEN** 用户在自定义工作区里关掉网格显示，切到页面再切回
- **THEN** 自定义工作区里网格仍是关的，页面里网格仍是开的

#### Scenario: 方向键按索引循环

- **WHEN** 有三个工作区且焦点在最后一段按右方向键
- **THEN** 第一段被选中

### Requirement: 按文档记忆工作区

激活一个文档标签时，若偏好 `workspace.byDocument[文档 key]` 记着的工作区与当前不同，系统 MUST
切换到它；没记过 MUST NOT 切换。用户点切换器 MUST 记成当前文档的新记忆；新建文档 MUST 继承当前
工作区。记忆 MUST 存在偏好里，MUST NOT 写进页面文件或文档。记忆里的 id 不在当前工作区列表时
MUST 依次回退到 `lastUsed`、列表第一个。

#### Scenario: 文档回到自己的工作区

- **WHEN** A 页上次在自定义工作区里编辑、B 页在页面里，用户 A→B→A
- **THEN** 激活 A 时回到自定义工作区，激活 B 时回到页面
- **AND** 两次切换都没有事务

#### Scenario: 未打开过的文档不切换

- **WHEN** 当前在页面工作区，用户首次打开 C 页
- **THEN** 工作区仍是页面，C 页从此记为页面

#### Scenario: 记忆失效回退

- **WHEN** 文档记着的工作区已被删除
- **THEN** 激活该文档时切到 `lastUsed`，该文档的记忆改为 `lastUsed`

### Requirement: 工作区管理

切换器右端 MUST 有管理菜单：另存为工作区…、重命名、重置布局、删除、只看画布。**保存 MUST NOT
有按钮**——改动即记入。面板挪位后切换器该段 MUST 显示修改点表示「与基线不同」（基线是定义
自带的 `layout`：内建与宿主注入的是 preset，自定义的是创建时的快照）；分栏尺寸、折叠、活动标签
的改动 MUST 记入但 MUST NOT 点亮修改点；重置后修改点 MUST 消失。布局改动 MUST NOT 进入编辑器
撤销历史。

另存为 MUST 复制当前布局快照与会话默认值，只询问名称并列出复制的内容；显示名重复 MUST 自动加
序号而 MUST NOT 拒绝；创建后 MUST 立即切换过去并记入当前文档；来源工作区 MUST 原样保留。
自定义工作区 MUST 存入偏好 `workspace.custom`。删除 MUST 确认，确认框 MUST 写明记着它的文档数
与回退去处；回退去处是 `lastUsed`，删的就是 `lastUsed` 时是列表第一个；删除后 MUST 切到回退去处，
指向它的文档记忆 MUST 改为回退去处。内建与宿主
注入的工作区 MUST NOT 可删、MUST NOT 可重命名，但 MUST 可重置；菜单项 MUST 灰掉并标明原因而
MUST NOT 隐藏。

#### Scenario: 另存为

- **WHEN** 用户拖过面板后选择「另存为工作区…」并输入「变电站」
- **THEN** 切换器多出「变电站」段并处于按下态，当前文档记为变电站
- **AND** 来源工作区的修改点仍在，布局未变

#### Scenario: 修改点与重置

- **WHEN** 用户把一个面板拖到别的组
- **THEN** 当前段出现修改点；选择「重置布局」后布局回到基线且修改点消失

#### Scenario: 删除自定义工作区

- **WHEN** 用户在「变电站」里删除它并确认
- **THEN** 切换器切到回退去处（列表第一个「页面」），记着变电站的文档改为它

#### Scenario: 内建不可删

- **WHEN** 当前是「页面」且用户打开管理菜单
- **THEN** 「删除」与「重命名」灰掉并标明「内建」，仍可见；「重置布局」可用

### Requirement: 只看画布

管理菜单与动作目录 MUST 提供「只看画布」：开启时 MUST 调用 Dockview `maximizeGroup` 最大化
画布组，再次触发 MUST `exitMaximizedGroup`。状态 MUST 按工作区记忆，MUST NOT 进入文档或事务。

#### Scenario: 只看画布

- **WHEN** 用户触发「只看画布」
- **THEN** 画布组占满编辑器，工具栏行与命令行仍可见
- **AND** 再次触发后布局回到之前的样子
