# 编辑器工作区规范增量

## MODIFIED Requirements

### Requirement: 平铺式默认画布工具栏

默认 Stage toolbar MUST 按下列顺序提供：选择、缩放、旋转、吸附、网格及其大小菜单、分割线、
容器绘制、文字绘制、分割线、**绘图命令组**。

绘图命令组 MUST 为 `LINE`、`PLINE`、`RECTANGLE`、`CIRCLE`、`ARC`、`ARROW`、`WIRE` 各提供一个
按钮，按下 MUST 启动与在命令行敲下该名字**完全相同**的会话。

**形状 split button MUST NOT 存在**，`draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值
MUST 一并删除。制图几何只有命令一套入口：留着绘制工具会让同一件事有两套机制，还会让取点插件
与绘制插件的优先级冲突用鼠标就能触发（见 stage 的工具集 Requirement）。

选择 MUST 是一个普通按钮，MUST NOT 带判定模式菜单：框选判定恒由拖拽方向决定，方向本身就是
切换器。

框选、精确移动与移动画布三个工具位 MUST NOT 出现：它们各自与既有手势完全重复——`select` 在
空白处拖拽即框选、`MOVE` 命令能键入精确位移且严格更强、空格与中键本来就是随时可用的临时平移
覆盖。

绘图命令按钮的按下态 MUST 来自 Stage 上报的**当前会话命令 id**，MUST NOT 由工具栏自己记
「刚点了哪个」——命令会被 `Escape`、被并发文档变化、被另一条命令取代而结束，工具栏记的那一份
会停在过去。

button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前工具与 hover/focus 可以使用低调状态底色，
工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、fit 或单独 canvas settings
图标；宿主 `stageToolbar` slot 不受影响。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 渲染默认工作区
- **THEN** toolbar 按规定顺序显示全部工具、绘图命令组与网格 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 不再出现三个重复工具位

- **WHEN** 用户查看默认工具栏
- **THEN** 其中没有框选、精确移动与移动画布三个按钮

#### Scenario: 形状 split button 已删除

- **WHEN** 用户查看默认工具栏
- **THEN** 其中没有形状 split button，也没有它的 chevron menu

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
