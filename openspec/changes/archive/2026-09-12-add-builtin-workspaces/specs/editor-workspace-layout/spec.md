## MODIFIED Requirements

### Requirement: 工作区定义与注入

`@compose-ui/editor` MUST 导出 `ComposeEditorWorkspaceDefinition` 与 `COMPOSE_DEFAULT_WORKSPACES`。
一个工作区定义 MUST 包含：稳定 `id`（不本地化）、已本地化 `title`、可选 `icon`、`layout`
（面板名 preset 或不透明快照）、`palette`（标题、搜索、货架 `sections`）、`session`（角度约束、
增量角、网格可见、十字光标臂长、变换 Gizmo）、`seeds`（新建文档的网格步长、网格吸附与对齐
吸附）。定义里 MUST NOT 存在能改变命令集、按钮含义或快捷键的字段。

`ComposeEditor` MUST 接受 `workspaces` prop 替换内建列表；`id` 重名 MUST 抛错而 MUST NOT 静默
丢弃。宿主注入的工作区与用户另存的工作区 MUST 是同一种定义，差别只在谁给了初始布局。

#### Scenario: 宿主注入工作区

- **WHEN** 宿主传入 `[...COMPOSE_DEFAULT_WORKSPACES, substation]`，其 `palette` 只含
  `Symbols / 变电站` 一段
- **THEN** 切换器出现第三段，激活时应用宿主给的布局、货架与会话默认值

#### Scenario: 重名抛错

- **WHEN** 宿主传入两个 `id` 相同的工作区
- **THEN** 挂载抛出错误而不是静默丢弃其中一个

#### Scenario: 定义里没有改含义的字段

- **WHEN** 宿主注入任意工作区
- **THEN** 命令行词汇表、快捷键与动作目录与不注入时逐项相同

### Requirement: 内建工作区

`COMPOSE_DEFAULT_WORKSPACES` MUST 恰好两个：`page`（页面）与 `drawing`（绘图）。两者的 preset
MUST 摆出同一套四区结构（左侧场景图在上、工具组在下，中央画布，右侧属性，底部资源 / 命令 /
日志）：页面 = 工具组标题「基础组件」、场景 / 工具 60%/40%（场景内容至少 160px、工具内容至少
120px）、左右两侧展开、底部折叠、底部活动标签为资源；绘图 = 工具组标题「符号库」、活动、分栏拉高、
底部边缘组折叠、其余相同。

`session` MUST 只在十字光标臂长上不同（页面 5 / 绘图 100）：角度约束、增量角、网格可见与变换
指示器两边 MUST 同值——会话开关本来就按工作区各记一份并在切回时恢复，默认值再分叉一次只会
让「我上次把它关了」与「这个工作区本来就是关的」在屏幕上分不开。

`seeds` MUST 在两处不同：网格步长页面 8 / 绘图 10，**对齐吸附页面开、绘图关**；网格吸附两边
都开。工具栏货架两边是否相同 MUST NOT 由本能力回答——它由「工具栏货架」承载。页面的
`palette` MUST 是基础组件 + `components` 平铺、无搜索；绘图的 `palette` MUST 是 `Symbols` 按子
文件夹分组 + `components` + 基础组件折叠，标题「符号库」，带搜索。宿主提供 `history` 或显式
`historyPanel` 时，历史 MUST 作为工具组的第二个标签加入，未提供时 MUST NOT 显示空历史标签。

#### Scenario: 默认两个工作区

- **WHEN** 宿主不传 `workspaces`
- **THEN** 切换器有「页面」「绘图」两段，「页面」按下
- **AND** 页面的布局与之前的默认布局逐像素一致

#### Scenario: 绘图的初始布局

- **WHEN** 用户首次切到绘图
- **THEN** 工具组标签叫「符号库」且活动、分栏高于页面工作区、底部边缘组折叠、十字光标贯穿图面
- **AND** 事务日志没有新行，撤销栈长度不变

#### Scenario: 历史面板加入工具组

- **WHEN** 宿主提供 HistoryNavigationController
- **THEN** 两个工作区的工具组都显示历史标签，页面的活动标签仍是基础组件、绘图的仍是符号库

### Requirement: 工作区切换

切换器 MUST 是 `radiogroup`，方向键按索引循环；hover / focus 时 MUST 提示该工作区会换的东西。
切换 MUST 依次：应用目标工作区的布局（快照或 preset）、物料货架、会话开关（角度约束、增量角、
网格可见、十字光标臂长、Gizmo）；记入 `workspace.lastUsed` 与当前文档的 `workspace.byDocument`。
切换 MUST NOT 改变活动文档、选择集、视口、当前工具、动画开关，MUST NOT 产生事务或撤销条目，
MUST NOT 打断正在取点的命令。会话开关的改动 MUST 记入当前工作区，切回时恢复；网格步长与
对齐吸附是**文档**字段，切换 MUST NOT 碰它们——它们只由新建时的种子给初值。

#### Scenario: 切换不产生事务

- **WHEN** 用户从页面切到绘图
- **THEN** 事务日志没有新行，撤销栈长度不变，`document.canvas.grid` 与 `smartSnap` 不变

#### Scenario: 会话开关随工作区记住

- **WHEN** 用户在绘图里关掉网格显示，切到页面再切回绘图
- **THEN** 绘图里网格仍是关的，页面里网格仍是开的

#### Scenario: 货架跟着切

- **WHEN** 用户从页面切到绘图
- **THEN** 工具组标签变成「符号库」，面板按文件夹分组并出现搜索框

#### Scenario: 方向键按索引循环

- **WHEN** 有三个工作区且焦点在最后一段按右方向键
- **THEN** 第一段被选中

### Requirement: 工作区管理

切换器右端 MUST 有管理菜单：另存为工作区…、重命名、重置布局、删除、只看画布。**保存 MUST NOT
有按钮**——改动即记入。面板挪位后切换器该段 MUST 显示修改点表示「与基线不同」（内建与宿主注入
的基线是定义自带的 `layout`，自定义的基线是创建时的快照）；分栏尺寸、折叠、活动标签
的改动 MUST 记入但 MUST NOT 点亮修改点；重置后修改点 MUST 消失。布局改动 MUST NOT 进入编辑器
撤销历史。

另存为 MUST 复制当前布局快照、物料货架、会话默认值与新建种子，只询问名称并列出复制的内容；
显示名重复 MUST 自动加序号而 MUST NOT 拒绝；创建后 MUST 立即切换过去并记入当前文档；来源工作区
MUST 原样保留。自定义工作区 MUST 存入偏好 `workspace.custom`。删除 MUST 确认，确认框 MUST 写明
记着它的文档数与回退去处；删除后 MUST 切到 `lastUsed`，指向它的文档记忆 MUST 改为 `lastUsed`。
内建与宿主注入的工作区 MUST NOT 可删、MUST NOT 可重命名，但 MUST 可重置；菜单项 MUST 灰掉并
标明原因而 MUST NOT 隐藏。

#### Scenario: 另存为

- **WHEN** 用户在绘图里拖过面板后选择「另存为工作区…」并输入「变电站」
- **THEN** 对话框列出复制的面板布局、物料货架、画布默认值与新建种子；切换器多出「变电站」段并
  处于按下态，当前文档记为变电站
- **AND** 绘图的修改点仍在，绘图的布局未变

#### Scenario: 修改点与重置

- **WHEN** 用户把一个面板拖到别的组
- **THEN** 当前段出现修改点；选择「重置布局」后布局回到基线且修改点消失

#### Scenario: 删除自定义工作区

- **WHEN** 用户删除「变电站」并确认
- **THEN** 切换器切到 `lastUsed`，记着变电站的文档改为 `lastUsed`

#### Scenario: 内建不可删

- **WHEN** 当前是「页面」且用户打开管理菜单
- **THEN** 「删除」与「重命名」灰掉并标明「内建」，仍可见；「重置布局」可用

## ADDED Requirements

### Requirement: 新建文档种子

在某个工作区里新建页面文档时，新文档 MUST 从该工作区的 `seeds` 取 `document.canvas.grid` 的
网格步长与网格吸附，以及 `document.canvas.smartSnap`。种子 MUST 只在新建时落地：切换工作区
MUST NOT 改写已有文档的这两个字段，也 MUST NOT 产生事务。新场景尺寸 MUST NOT 属于种子
（两个内建都是 1920×1080）。

对齐吸附与特征点捕捉 MUST NOT 在绘图工作区里同时默认生效：两者是姐妹查询——前者给出
`{axis, value}` 的参考线、后者给出落在端点上的二维点，同时开着会在同一次取点里给出互相
拉扯的答案，而特征点候选**刻意不出盒的角点**正是为了避开对齐吸附的语义。因此绘图种子的
对齐吸附 MUST 关。这只是**默认值**：已经打开的文档 MUST NOT 被工作区改写，用户仍可用工具栏
的吸附按钮开关它，那本来就是一次进撤销历史的文档编辑。

#### Scenario: 绘图里新建页面

- **WHEN** 当前是绘图工作区，用户新建一个页面
- **THEN** 画布设置里网格步长读 10 / 10 且吸附开

#### Scenario: 绘图里新建的页面不开对齐吸附

- **WHEN** 当前是绘图工作区，用户新建一个页面并画一条线经过另一个对象的包围盒边缘
- **THEN** 画布设置里对齐吸附是关的，落点不被对齐参考线改写
- **AND** 端点、中点与端口的特征点捕捉照常生效

#### Scenario: 切换不改已有文档

- **WHEN** 一个步长为 8、对齐吸附开着的页面打开着，用户切到绘图
- **THEN** 该页面的步长仍是 8、对齐吸附仍是开的，事务日志没有新行
