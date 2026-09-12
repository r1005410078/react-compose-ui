## REMOVED Requirements

### Requirement: 中央 Canvas Group 承载资源文档

**Reason**: 文档（页面、组件、资源文件）不再是 Dockview panel，由「文档标签条」取代；资源文档
的唯一标识、重复打开激活、未保存草稿保留与 dirty 关闭流程原样搬进那条要求。

## MODIFIED Requirements

### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph（下方为基础组件与
可选历史工具组）、中间 Canvas 与 Stage Toolbar、右侧 Component Inspector、底部资源、Command 与
Transaction Log 工具组。中央 Canvas MUST 获得扣除三个边缘区后的主要可用空间。四个区域 MUST 全部
住在**同一个** Dockview 实例里，MUST NOT 嵌套第二个 Dockview。

#### Scenario: 首次挂载编辑器

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph、默认选中的基础组件工具区，以及标题为「资源」「命令」「日志」的底部标签
- **AND** Stage Toolbar 显示在 Canvas 内容区域顶部，Canvas 内容显示在中央主要区域
- **AND** 只存在一个 Dockview 实例

#### Scenario: Strict Mode 重放初始化

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 左、右、底部各只存在一个 Edge Group
- **AND** 每个默认面板各只存在一个实例

### Requirement: 边缘工具区

系统 MUST 在同一个 Dockview 实例里承载左、右、底三个边缘区：左侧是场景图与工具组上下分栏的
两个普通组，右侧是承载 Component Inspector 的普通组，底部是原生 Edge Group，承载资源、Command
与 Transaction Log。**左右 MUST NOT 是 Edge Group**：Dockview 的边缘组包着中间那一列而底部边缘组
住在那一列里，左右做成边缘组会把底部夹在中间。底部 Edge Group MUST 横跨整个编辑器宽度，与两侧
折叠 / 展开状态无关。

两侧 MUST NOT 渲染竖向图标轨；折叠入口 MUST 是场景组与属性组头上的按钮，收起 MUST 把那一侧
的组整个藏掉（左侧两个组一起），并沿编辑器边缘留下一条可点击的把手用于展开。画布组 MUST 隐藏
组头（它只有一个面板）。面板头高度 MUST 为 30px；底部 Edge Group 折叠后 MUST 只剩它的标签条。

#### Scenario: 检查默认边缘区

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 与 `getEdgeGroup('right')` 都为空；场景图与工具组是左侧上下
  分栏的两个普通组，Component 面板是右侧的普通组
- **AND** `getEdgeGroup('bottom')` 返回同时包含资源、命令与 Transaction Log 的组，资源是底部
  初始活动面板

#### Scenario: 调整边缘区尺寸

- **WHEN** 用户拖动任一 Edge Group 与中央 Canvas 之间的分隔边界
- **THEN** 对应 Edge Group 尺寸随拖动变化，Canvas 使用剩余空间重新布局
- **AND** 各区域内容保持挂载并可继续操作

#### Scenario: 收起再展开

- **WHEN** 用户点击右侧属性面板头上的折叠按钮，再点击留下的把手
- **THEN** 属性面板连头一起收起，编辑器右缘只剩一条 8px 把手，再展开时恢复收起前的尺寸
- **AND** 面板内容不重新挂载，左右两侧没有竖向图标轨

#### Scenario: 左栏一起收起

- **WHEN** 用户点击场景图头上的折叠按钮
- **THEN** 场景图与工具组一起收起，编辑器左缘留一条把手

#### Scenario: 底部工具区不受两侧折叠影响

- **WHEN** 用户折叠或展开左右任意一个或两个 Edge Group
- **THEN** 底部 Edge Group 的宽度与横向位置保持不变
- **AND** 底部工具区内容不重新挂载

### Requirement: 场景下方工具分栏

系统 MUST 把场景图与工具组摆成左侧上下分栏的两个普通 Dockview 组：场景内容在上，
基础组件在下。宿主提供 `history` 或显式提供 `historyPanel` 时，History MUST 作为工具组的同组
标签加入；未提供时系统 MUST NOT 显示空 History 标签。基础组件 MUST 是工具组的初始活动面板。

#### Scenario: 使用默认历史面板

- **WHEN** 宿主向 ComposeEditor 提供 HistoryNavigationController
- **THEN** 工具组显示基础组件与 `@compose-ui/history` 的 HistoryPanel 标签，基础组件保持活动
- **AND** history 控制器驱动编辑器焦点范围内的撤销重做快捷键

#### Scenario: 覆盖历史面板

- **WHEN** 宿主显式提供 historyPanel，包括 null
- **THEN** History 标签使用该值完整覆盖默认 HistoryPanel
- **AND** 同时提供的 history 控制器仍然驱动编辑器快捷键

#### Scenario: 不启用历史

- **WHEN** 宿主没有提供 history 且没有显式提供 historyPanel
- **THEN** 左栏仍显示场景内容和下方基础组件
- **AND** 工具组不显示 History 标签，且编辑器不拦截历史快捷键

### Requirement: Dockview 场景工具布局

系统 MUST 使用 Dockview 原生垂直布局和 sash 分配场景组与工具组，默认 60%/40%，并保持场景内容
至少 160px、工具内容至少 120px。分栏状态 MUST 只存活于当前编辑器实例，MUST NOT 进入页面文档或
持久化存储。

#### Scenario: 调整下方工具高度

- **WHEN** 用户拖动 Dockview 原生 sash
- **THEN** 场景内容和工具组按约束调整高度
- **AND** 两侧内容保持挂载并可继续操作

#### Scenario: 编辑器内容更新

- **WHEN** 宿主更新场景、基础组件、历史控制器或其他插槽
- **THEN** 对应面板显示最新内容
- **AND** 用户调整后的布局不被重建

### Requirement: 临时布局状态

系统 MUST 将 Dockview 布局与页面文档状态分离。本版本 MUST NOT 自动读取或写入 localStorage、
远端存储或页面文档，也 MUST NOT 把 Dockview 序列化数据暴露为公共属性或事件。

#### Scenario: 当前实例内调整布局

- **WHEN** 用户在一个已挂载的编辑器实例中调整 Edge Group 尺寸、折叠状态、分栏或活动标签
- **THEN** 调整后的布局保持到该实例卸载

#### Scenario: 重新挂载编辑器

- **WHEN** 宿主卸载后重新挂载 `ComposeEditor`
- **THEN** 系统重新建立默认的左、右、底 Edge Groups 和中央画布组
- **AND** 不尝试恢复上一个实例的 Dockview JSON

### Requirement: 设置入口保持布局独立

顶部文档标签条右端 MUST 提供可聚焦设置按钮。设置模态 MUST 使用 `@compose-ui/components` 的
ComposeDialog，通过全视口 Portal 覆盖当前浏览器窗口；它 MUST NOT 成为 Dockview 面板，也 MUST NOT
被任一组、画布或宿主 Editor root 的尺寸、overflow 或 stacking context 裁剪。设置模态 MUST NOT
改变 Dockview 布局或活动面板。

#### Scenario: 从标签条打开设置

- **WHEN** 用户通过鼠标或键盘激活标签条右端的设置按钮
- **THEN** 全视口遮罩上显示居中的设置弹框，且弹框内容使用 Compose Theme/I18n
- **AND** 当前各组、画布与其他面板保持挂载和原尺寸

#### Scenario: 更新设置期间保持布局

- **WHEN** 用户切换主题、语言或修改快捷键
- **THEN** Dockview group 和 panel 实例不被重建
- **AND** 用户已调整的尺寸、折叠状态与活动标签保持不变

### Requirement: 设计与动画模式切换器

页面文档与组件文档活动时，文档标签条右端 MUST 在保存入口旁提供「设计 / 动画」**两段**模式
切换器，作为动画模式的唯一入口；MUST NOT 提供绘图段——绘图能力恒开，不属于任何模式。底部工具组
MUST NOT 再默认包含动画标签。切到动画模式时，编辑器 MUST 在底部 Dockview 工具组中动态加入并
激活时间线面板，并展开底部组；切回设计模式时 MUST 移除时间线面板、恢复 资源/命令/日志 标签与
切换前的折叠状态。切换器 MUST 实现 radiogroup 可访问语义，方向键 MUST 按索引循环而不是
「另一个就是对面那个」——后者在段数变化时会静默退化。未启用页面系统的宿主本期仍不提供动画
模式入口。

切到动画模式 MUST NOT 关闭任何绘图能力：动画改变的是「拖动的结果落在哪里」，与「用什么方式
输入」是两根正交的轴。

组件文档下动画作用域 MUST 解析到组件根 Frame，动画命令 MUST 走组件文档自己的事务运行时，
因此撤销与重做 MUST 只作用于组件文档的历史。

#### Scenario: 底部工具组默认标签

- **WHEN** Dockview 工作区完成初始化
- **THEN** 底部工具组只包含 资源、命令 与 Transaction Log 标签，不包含动画标签

#### Scenario: 切换器住在标签条右端

- **WHEN** 用户打开一个页面文档
- **THEN** 文档标签条右端出现「设计」「动画」两段与保存按钮，画布工具栏行里没有它们

#### Scenario: 切换到动画模式

- **WHEN** 用户把模式切换到「动画」
- **THEN** 底部工具组加入并激活时间线面板，且底部组展开
- **AND** 编辑器进入动画模式

#### Scenario: 组件文档进入动画模式

- **WHEN** 用户打开一个组件文档并把模式切换到「动画」
- **THEN** 时间线面板出现，动画作用域是该组件的根 Frame
- **AND** 在其中打的关键帧写进组件文档，撤销只回退组件文档

#### Scenario: 切回设计模式恢复布局

- **WHEN** 用户在动画模式下把模式切换回「设计」，且进入动画模式前底部组处于折叠状态
- **THEN** 时间线面板从底部工具组移除，资源标签恢复活动
- **AND** 底部组恢复折叠状态，编辑器退出动画模式

#### Scenario: 点击其它底部标签退出动画模式

- **WHEN** 动画模式下用户激活底部工具组的资源、命令或 Transaction Log 标签
- **THEN** 编辑器退出动画模式，时间线面板被移除，模式切换器同步显示「设计」

### Requirement: 平铺式默认画布工具栏

默认 Stage toolbar MUST 按下列顺序提供：选择、缩放、旋转、吸附、正交、极轴及其增量角菜单、
网格及其大小菜单、分割线、容器绘制、文字绘制、分割线、**绘图命令组**。

绘图命令组 MUST 为 `LINE`、`PLINE`、`RECTANGLE`、`POLYGON`、`CIRCLE`、`ARC`、`ARROW` 各提供一个
按钮，按下 MUST 启动与在命令行敲下该名字**完全相同**的会话。

**形状 split button MUST NOT 存在**，`draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值
MUST 一并删除。选择 MUST 是一个普通按钮，MUST NOT 带判定模式菜单。框选、精确移动与移动画布
三个工具位 MUST NOT 出现。

绘图命令按钮的按下态 MUST 来自 Stage 上报的**当前会话命令 id**，MUST NOT 由工具栏自己记
「刚点了哪个」。

按钮 MUST 为 30px 见方、组内 1px、组间 4px：默认三栏（1280 宽、画布列 600px）下整条工具栏
MUST 放得下。宽度不足以放下整条工具栏时，MUST 按顺序从尾部把放不下的按钮收进一个「更多」菜单，
MUST NOT 裁掉；菜单里的每一项与原按钮同名同图标。「设计 / 动画」模式切换器与保存按钮 MUST NOT
在这一行——它们住在文档标签条右端。

button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前工具与 hover/focus 可以使用低调状态底色，
工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、fit 或单独 canvas settings
图标；宿主 `stageToolbar` slot 不受影响。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 渲染
- **THEN** toolbar 按规定顺序显示全部工具、绘图命令组与网格 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 默认窗口放得下

- **WHEN** 1280 宽的默认三栏下渲染页面文档
- **THEN** 工具栏没有「更多」，八条绘图命令都在栏上

#### Scenario: 窄窗口收进更多

- **WHEN** 工具栏行的宽度放不下整条工具栏
- **THEN** 尾部放不下的按钮进入「更多」菜单，菜单里的每一项与原按钮同名同图标，点它启动同一条命令
- **AND** 「设计 / 动画」与保存仍在文档标签条右端可见

#### Scenario: 按钮启动命令会话

- **WHEN** 用户点击绘图命令组里的 `RECTANGLE` 按钮
- **THEN** 命令行进入与敲 `RECTANGLE` 后完全一致的提示状态
- **AND** 该按钮呈按下态

#### Scenario: 取消命令后按钮不再按下

- **WHEN** 上述会话中按下 `Escape`
- **THEN** 该按钮不再呈按下态

#### Scenario: 使用网格菜单

- **WHEN** 用户打开网格的 chevron menu
- **THEN** menu 具有 menu-button ARIA、键盘导航、Escape 关闭和焦点恢复
- **AND** 网格菜单能切换会话级可见性、选择 4/8/16/32 等网格间距或进入更多画布设置

## ADDED Requirements

### Requirement: 单一 Dockview 实例

`ComposeEditor` MUST 只创建**一个** Dockview 实例：左栏场景图与工具组两个普通组上下分栏，
右栏属性一个普通组，中央画布组，底部一个原生边缘组。MUST NOT 嵌套第二个 Dockview。可访问
landmark MUST 只有一份。

#### Scenario: 只有一个 Dockview

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** DOM 中只存在一个 Dockview 根，底部一个边缘组横跨全宽，中央一个画布组

#### Scenario: Strict Mode 下唯一

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 每个组与每个面板各只存在一个实例

### Requirement: 文档标签条

文档（页面文档、组件文档、资源文件文档）MUST 是编辑器会话而 MUST NOT 是 Dockview panel。编辑器
顶部 MUST 有一条横贯全宽、位于 Dockview 之外的文档标签条，实现 `tablist` 可访问语义：方向键在
文档间移动，`Delete` 不关闭；标签 MUST 显示名称、未保存圆点与关闭按钮，样式沿用既有标签（活动
`surface-active` 底 + `text-strong`，无 accent 条，无图标）。标签条右端 MUST 依次是「设计 / 动画」
模式切换器与保存按钮（活动文档是页面或组件时）、设置按钮。未启用页面系统时固定画布 MUST 是
第一个、不可关闭的标签。

文档 MUST 由 `provider.id + assetKey（缺失时 entry.id）` 唯一标识，重复打开 MUST 激活现有标签
而非创建副本；资源文件文档 MUST 保留未保存 Monaco 草稿。关闭 dirty 文档或改动已打开资源的条目时，
系统 MUST 提供保存、放弃或取消决策，并只在保存成功或放弃后关闭；取消、保存失败或 revision
conflict 不执行关闭或对应 Provider 操作。中央画布组 MUST 只承载画布，画布 MUST 跟随活动文档。
文档 MUST NOT 参与 Dockview 拖放、浮动、布局持久化、ComposeDocument、History 或 Operation Log。

#### Scenario: 标签条通栏

- **WHEN** 编辑器挂载并打开两个页面
- **THEN** 文档标签条的宽度等于编辑器宽度，两个标签在左、设置按钮在右
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
