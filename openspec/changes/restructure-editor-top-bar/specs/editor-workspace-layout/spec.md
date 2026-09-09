## MODIFIED Requirements

### Requirement: 边缘工具区

系统 MUST 在同一个 Dockview 实例里承载左、右、底三个边缘区：左侧是场景图与工具组上下分栏的
两个普通组，右侧是承载 Component Inspector 的普通组，底部是原生 Edge Group，承载资源、Command
与 Transaction Log。**左右 MUST NOT 是 Edge Group**：Dockview 的边缘组包着中间那一列而底部边缘组
住在那一列里，左右做成边缘组会把底部夹在中间。底部 Edge Group MUST 横跨整个编辑器宽度，与两侧
折叠 / 展开状态无关。

两侧 MUST NOT 渲染竖向图标轨。**折叠入口 MUST 只有应用顶栏右端的布局开关一处**：组头上
MUST NOT 再有折叠按钮，编辑器边缘 MUST NOT 再留把手。收起 MUST 把那一侧的组整个藏掉（左侧两个
组一起），展开 MUST 恢复收起前的尺寸且内容 MUST NOT 重新挂载。画布组 MUST 隐藏组头（它只有一个
面板）——画布列的头由文档标签条承担，见「文档标签条」。底部 Edge Group 折叠后 MUST 只剩它的
标签条。

#### Scenario: 检查默认边缘区

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 与 `getEdgeGroup('right')` 都为空；场景图与工具组是左侧上下
  分栏的两个普通组，Component 面板是右侧的普通组
- **AND** `getEdgeGroup('bottom')` 返回同时包含资源、命令与 Transaction Log 的组

#### Scenario: 组头上没有折叠按钮

- **WHEN** 用户查看场景图组头与属性组头
- **THEN** 两个头上都没有折叠按钮
- **AND** 编辑器左右边缘没有把手

#### Scenario: 收起再展开

- **WHEN** 用户点击应用顶栏右端的右栏开关，再点一次
- **THEN** 属性面板连头一起收起，再展开时恢复收起前的尺寸
- **AND** 面板内容不重新挂载

#### Scenario: 左栏一起收起

- **WHEN** 用户点击左栏开关
- **THEN** 场景图与工具组一起收起

#### Scenario: 底部工具区不受两侧折叠影响

- **WHEN** 用户折叠或展开左右任意一个或两个 Edge Group
- **THEN** 底部 Edge Group 的宽度与横向位置保持不变
- **AND** 底部工具区内容不重新挂载

### Requirement: 文档标签条

文档（页面文档、组件文档、资源文件文档）MUST 是编辑器会话而 MUST NOT 是 Dockview panel。

文档标签条 MUST 位于**画布列自己的头上**——画布面板内容的第一行，高 30px，因此与左右两栏的
Dockview 面板头**同高且顶边落在同一条线上**。它 MUST NOT 再横贯编辑器全宽，MUST NOT 住在应用
顶栏里，也 MUST NOT 与 36px 的画布工具栏合成一行：标签数量没有上界而工具栏货架从尾部溢出，
同行会让多开一个文件就吃掉一颗工具按钮。

标签 MUST 是圆角标签，并 MUST 遵循「chrome 的选中画法」：活动的一格是一块柔和的圆角底加
`text-strong`，静息只有文字。标签 MUST NOT 贴满整格、MUST NOT 用竖线相互分隔、MUST NOT 用下划线
或 accent 条表示活动。标签 MUST 显示文档类型图标、名称、未保存圆点与关闭按钮；关闭按钮 MUST 只在
hover / focus 时显出自己的底。

标签条 MUST 实现 `tablist` 可访问语义：方向键在文档间移动并激活，`Home` / `End` 到两端，
`Delete` MUST NOT 关闭。标签条上 MUST NOT 有保存按钮、布局开关、工作区切换器、设置入口或
「设计 / 动画」模式切换器——前三者住应用顶栏，模式切换器住画布工具栏，保存 MUST 仍可从
`document.save` 动作与它的键位执行。

文档 MUST 由 `provider.id + assetKey（缺失时 entry.id）` 唯一标识，重复打开 MUST 激活现有标签
而非创建副本；资源文件文档 MUST 保留未保存 Monaco 草稿。关闭 dirty 文档或改动已打开资源的条目时，
系统 MUST 提供保存、放弃或取消决策，并只在保存成功或放弃后关闭；取消、保存失败或 revision
conflict 不执行关闭或对应 Provider 操作。中央画布组 MUST 只承载画布，画布 MUST 跟随活动文档。
文档 MUST NOT 参与 Dockview 拖放、浮动、布局持久化、ComposeDocument、History 或 Operation Log。

#### Scenario: 标签条与左右面板头齐平

- **WHEN** 编辑器挂载并打开两个页面
- **THEN** 文档标签条只占画布那一列的宽度，不横贯编辑器
- **AND** 它的顶边 y 与左栏场景图组头、右栏属性组头的顶边 y 相同，高度都是 30px

#### Scenario: 活动标签是圆角底而不是下划线

- **WHEN** 用户查看活动文档标签
- **THEN** 它有一块圆角底且文字更亮
- **AND** 它没有下划线、没有 accent 条，与相邻标签之间没有竖线

#### Scenario: 画布上方多了一条头部行

- **WHEN** 编辑器挂载
- **THEN** 画布内容的顶边距编辑器顶边 97px（应用顶栏 30 + 头部行 30 + 工具栏 37，
  工具栏那 37 是既有的 36px 行高加它自己的 1px 下边框）

#### Scenario: 键盘在文档间移动

- **WHEN** 焦点在活动文档标签上按右方向键
- **THEN** 下一个文档激活，画布、场景图与属性面板跟随

#### Scenario: 从默认资源浏览器打开资源

- **WHEN** 默认 Asset Browser 发出文件打开意图
- **THEN** 标签条打开或激活对应资源文档标签
- **AND** 切走再切回时未保存的 Monaco 草稿仍在

#### Scenario: 删掉按钮之后仍能保存

- **WHEN** 用户在有未保存改动的页面文档上按 `Cmd/Ctrl+S`，或从命令面板执行「保存文档」
- **THEN** 文档保存成功，标签上的未保存圆点消失

#### Scenario: 关闭 dirty 文档

- **WHEN** 用户关闭 dirty 文档标签，或重命名、移动、删除包含 dirty 已打开资源的条目
- **THEN** 系统提供保存、放弃或取消决策，并只在保存成功或放弃后关闭
- **AND** 取消、保存失败或 revision conflict 不执行关闭或对应 Provider 操作

### Requirement: 工作区切换

切换器 MUST 住在应用顶栏、紧接标志之后。它 MUST 是 `radiogroup`，方向键按索引循环；
MUST NOT 改成 `tablist`——它的形状是一组 pill 而不是标签，语义 MUST 跟着形状走。hover / focus 时
MUST 提示该工作区会换的东西。

每一格 MUST 是圆角标签并遵循「chrome 的选中画法」：活动的一格是一块柔和的圆角底加 `text-strong`，
其余只有文字。切换器 MUST NOT 有外框盒、MUST NOT 用竖线与相邻段隔开、MUST NOT 用下划线或
accent 条，每一格 MUST NOT 带图标——顶栏最左已经有一个实心标志，再排一列小图标会把那颗把手淹掉。

**管理菜单 MUST 是活动格上的一个 `▾`，MUST NOT 是切换器旁边一颗独立按钮**：它管的永远是当前
那个工作区，因此它属于被按下的那一格。`▾` MUST NOT 参与 radiogroup 的方向键序列。

最后一格之后 MUST 有一颗 `＋`，它 MUST 在 `radiogroup` 之外（它不是一个可被方向键走到的工作区），
并 MUST 打开与管理菜单「另存为」**同一条流程**（复制当前工作区并要一个名字）；它 MUST NOT 是
第二份实现。

切换 MUST 依次：应用目标工作区的布局（快照或 preset）、物料货架、工具栏货架、会话开关
（角度约束、增量角、网格可见、十字光标臂长、Gizmo）；记入 `workspace.lastUsed` 与当前文档的
`workspace.byDocument`。切换 MUST NOT 改变活动文档、选择集、视口、当前工具、动画开关，
MUST NOT 产生事务或撤销条目，MUST NOT 打断正在取点的命令。会话开关的改动 MUST 记入当前工作区，
切回时恢复；网格步长与对齐吸附是**文档**字段，切换 MUST NOT 碰它们——它们只由新建时的种子
给初值。

#### Scenario: 活动格是圆角底且没有外框

- **WHEN** 用户查看应用顶栏的工作区切换器
- **THEN** 活动的一格有一块圆角底，其余只有文字
- **AND** 切换器周围没有外框盒，格与格之间没有竖线，活动格下方没有横线

#### Scenario: hover 不上底

- **WHEN** 指针悬停在一个未选中的工作区格上
- **THEN** 它的文字变亮，但没有出现底

#### Scenario: 管理菜单在活动格上

- **WHEN** 用户查看应用顶栏的工作区切换器
- **THEN** 活动格上有一个 `▾`，点击打开工作区管理菜单
- **AND** 切换器旁边没有第二颗管理按钮

#### Scenario: 加号复制当前工作区

- **WHEN** 用户点击切换器末尾的 `＋`
- **THEN** 打开的对话框与管理菜单里的「另存为」完全一致
- **AND** 确认后新工作区出现在切换器里并被选中

#### Scenario: 方向键跳过管理箭头与加号

- **WHEN** 焦点在活动格上按方向键
- **THEN** 焦点移到相邻的工作区格，不会落在 `▾` 或 `＋` 上

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

### Requirement: 顶栏布局开关

应用顶栏右端 MUST 常驻左 / 底 / 右三个布局开关，它们 MUST 是折叠与展开对应面板的**唯一**
入口。实心 MUST 表示展开、描边 MUST 表示收起，两种状态都 MUST 渲染——只在其中一态出现的
指示器无法让用户确认另一态。开关 MUST 是可切换按钮并携带 `aria-pressed`，MUST NOT 因对应
面板被收起而移动或消失：位置不随面板存亡而变，正是它取代边缘把手的全部理由。

开关这一段与左侧的工作区之间 MUST NOT 画竖线，MUST 只靠间距与「钉在最右」的位置分段。

底栏 MUST 与左右两栏一样有开关；此前它只能靠工作区 preset 折叠，没有任何显式入口。

开关 MUST NOT 产生事务或撤销条目。折叠状态 MUST 随工作区布局快照走，与既有的布局记忆一致。

本期 MUST 只有三颗：第四个候选「只看画布」在工作区管理菜单里已有入口，再给一个会违反本变更
据以删掉边缘把手的那条规则。

#### Scenario: 三颗开关常驻

- **WHEN** 编辑器挂载
- **THEN** 应用顶栏右端有左、底、右三个开关，各自反映对应面板此刻是展开还是收起
- **AND** 它们与左侧的工作区之间没有竖线

#### Scenario: 收起之后开关不动

- **WHEN** 用户收起右栏
- **THEN** 右栏开关变成描边态，位置不变
- **AND** 再点它一次右栏恢复到收起前的尺寸

#### Scenario: 底栏第一次有显式入口

- **WHEN** 用户点击底栏开关
- **THEN** 底部 Edge Group 折叠，只剩标签条

#### Scenario: 折叠不进历史

- **WHEN** 用户连续切换三个开关
- **THEN** 事务日志没有新行，撤销栈长度不变

### Requirement: 设置入口保持布局独立

设置入口 MUST 是**应用菜单里的一项**（见「应用标志与应用菜单」）；应用顶栏与文档标签条上
MUST NOT 再有独立的设置齿轮按钮。设置 MUST 仍可从 `editor.settings` 动作与它的键位执行——
菜单 MUST NOT 成为它的唯一入口。

设置模态 MUST 使用 `@compose-ui/components` 的 ComposeDialog，通过全视口 Portal 覆盖当前浏览器
窗口；它 MUST NOT 成为 Dockview 面板，也 MUST NOT 被任一组、画布或宿主 Editor root 的尺寸、
overflow 或 stacking context 裁剪。设置模态 MUST NOT 改变 Dockview 布局或活动面板。

#### Scenario: 从应用菜单打开设置

- **WHEN** 用户点开顶栏最左的标志菜单并选择「设置」
- **THEN** 全视口遮罩上显示居中的设置弹框，且弹框内容使用 Compose Theme/I18n
- **AND** 当前各组、画布与其他面板保持挂载和原尺寸

#### Scenario: 顶栏上没有齿轮

- **WHEN** 用户查看应用顶栏
- **THEN** 右端只有三个布局开关，没有设置按钮

#### Scenario: 更新设置期间保持布局

- **WHEN** 用户切换主题、语言或修改快捷键
- **THEN** Dockview group 和 panel 实例不被重建
- **AND** 用户已调整的尺寸、折叠状态与活动标签保持不变

## ADDED Requirements

### Requirement: 应用顶栏

编辑器顶部 MUST 有一条高 30px、横贯全宽、位于 Dockview **之外**的应用顶栏。它从左到右
MUST 恰好是三段：**标志 ▾**、**工作区切换器**、**三个布局开关**。

段与段之间 MUST 只有间距，MUST NOT 画竖线：标志钉在最左、开关钉在最右，位置本身已经分好段，
而竖线是把「我数得清有几段」画出来，那件事本来不需要用户去数。

顶栏 MUST NOT 承载文档标签、保存按钮或「设计 / 动画」模式切换器——它们分别住画布列头、
`document.save` 动作与画布工具栏。顶栏上的任何操作 MUST NOT 产生事务或撤销条目。

#### Scenario: 顶栏恰好三段

- **WHEN** 编辑器挂载
- **THEN** 顶栏从左到右是标志加 `▾`、工作区切换器、三个布局开关
- **AND** 顶栏上没有文档标签、没有保存按钮、没有模式切换器

#### Scenario: 段之间没有竖线

- **WHEN** 用户查看应用顶栏
- **THEN** 三段之间只有间距，没有任何竖向分隔线

#### Scenario: 顶栏不进历史

- **WHEN** 用户在顶栏切换工作区并连续切换布局开关
- **THEN** 事务日志没有新行，撤销栈长度不变

### Requirement: 应用标志与应用菜单

应用顶栏最左 MUST 是标志加一个 `▾`，整体是**一颗按钮**并携带 `aria-haspopup="menu"`；
点击 MUST 打开应用作用域的菜单，`Escape` 与点击外部 MUST 关闭并把焦点还给它。

标志 MUST 是**实心**图形，MUST NOT 用描边圆角矩形——顶栏右端那三个布局开关就是描边圆角矩形，
两者相距不到一屏，同形会让它们读成一家人。标志 MUST NOT 带文字标记：30px 一行里的字母会挤掉
紧邻的工作区，而标志的职责是那颗把手，不是署名。

菜单本期 MUST 恰好两项：**设置**与**命令面板**。两项 MUST 都不是各自能力的唯一入口——
`editor.settings` 与命令面板的既有动作、键位 MUST 保持可用。

#### Scenario: 标志打开应用菜单

- **WHEN** 用户点击顶栏最左的标志
- **THEN** 展开一个 `role="menu"`，含「设置」与「命令面板」两项
- **AND** 按 `Escape` 关闭，焦点回到标志按钮

#### Scenario: 键盘可达

- **WHEN** 焦点落在标志按钮上按下方向键
- **THEN** 菜单展开且焦点落在第一项

#### Scenario: 菜单不是唯一入口

- **WHEN** 用户不打开菜单，直接执行 `editor.settings` 的键位
- **THEN** 设置弹框照常打开

### Requirement: chrome 的选中画法

表示「选中 / 活动」的画法 MUST 只有一种：**一块柔和的圆角底**加 `text-strong`。它作用于
应用顶栏与头部行——头部行指左栏面板头、画布列的文档标签条与右栏面板头。这三处 MUST NOT 用
下划线或 accent 条、
MUST NOT 贴满整格、MUST NOT 用竖线分段。hover MUST 只改文字颜色而 MUST NOT 上底——底是「选中」
的专用通道，hover 也上底会让「指着」与「选中」同形，而两者可以同时成立。

画布工具栏的按下态 MUST 保持既有的 `surface-selected` 底，MUST NOT 跟着改成灰底：顶栏与头部行
回答**你在看哪一个**（导航，一组里恰好一个有底），工具栏回答**哪个开着**（状态，可以同时开
好几个）；同一块灰底放进「可以同时为真」的一组里，读不出还剩几个开着。

活动格的底色 MUST 由端到端用例断**计算后的值**而不是只断 class：本仓库已经有过一次样式靠层叠
静默失效（无层规则压过 `@layer components`），只断 class 的用例挡不住它。

#### Scenario: 三处长一个样

- **WHEN** 用户查看工作区切换器、文档标签条与左右面板头
- **THEN** 三处的活动项都是圆角底加更亮的文字
- **AND** 三处都没有下划线、没有 accent 条、没有竖线分隔

#### Scenario: hover 与选中可分

- **WHEN** 指针悬停在一个未选中的文档标签上
- **THEN** 它的文字变亮而没有底
- **AND** 活动标签的底不变

#### Scenario: 工具栏按下态不跟着变

- **WHEN** 用户查看画布工具栏里被按下的选择工具
- **THEN** 它的底仍是 `surface-selected`，与顶栏活动格的灰底不同色
