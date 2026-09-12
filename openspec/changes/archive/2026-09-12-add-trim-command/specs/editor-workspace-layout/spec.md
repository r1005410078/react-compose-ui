## MODIFIED Requirements

### Requirement: 平铺式默认画布工具栏

两个内建工作区 MUST 各有自己的默认货架，MUST NOT 共用一条：

- **页面**：选择、变换指示器、分割线、吸附、网格及其大小菜单、分割线、容器绘制、文字绘制、
  分割线、`RECTANGLE`、`ARROW`。
- **绘图**：选择、变换指示器、分割线、吸附、正交、极轴及其增量角菜单、网格及其大小菜单、
  分割线、`LINE`、`PLINE`、`RECTANGLE`、`POLYGON`、`CIRCLE`、`ARC`、`ARROW`、`WIRE`、`TRIM`、
  分割线、文字绘制。

`TRIM` MUST 在目录里（第二条入口是命令行的 `TRIM` / `TR`），页面货架 MUST NOT 含它——大屏页面
上的矩形与箭头不需要修剪，而命令行照常可用。

绘图命令 MUST 各有一个按钮，按下 MUST 启动与在命令行敲下该名字**完全相同**的会话。某个工作区
的货架不含某条命令时，该命令 MUST 仍可从命令行、快捷键与命令面板启动——货架收走的是入口，
MUST NOT 是能力。

**形状 split button MUST NOT 存在**，`draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值
MUST 一并删除。选择 MUST 是一个普通按钮，MUST NOT 带判定模式菜单。框选、精确移动与移动画布
三个工具位 MUST NOT 出现。

绘图命令按钮的按下态 MUST 来自 Stage 上报的**当前会话命令 id**，MUST NOT 由工具栏自己记
「刚点了哪个」。

「设计 / 动画」模式切换器与保存按钮住在文档标签条右端，MUST NOT 属于货架。宽度不足以放下
整条货架时，MUST 按顺序从尾部把放不下的按钮收进一个「更多」菜单，MUST NOT 裁掉。

button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前工具与 hover/focus 可以使用低调状态底色，
工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、fit 或单独 canvas settings
图标；宿主 `stageToolbar` slot 不受影响。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 在未自定义的工作区里渲染
- **THEN** toolbar 按规定顺序显示全部工具、绘图命令组与网格 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 绘图货架上的 TRIM 按钮启动同一条会话

- **WHEN** 在绘图工作区按下工具栏上的 `TRIM`
- **THEN** 命令行进入与敲 `TRIM` 完全相同的会话，按钮呈按下态
- **AND** 在页面工作区里货架上没有它，但命令行敲 `TRIM` 仍能启动
