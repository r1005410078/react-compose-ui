# editor-workspace-layout 增量

## ADDED Requirements

### Requirement: 绘图模式的画布工具栏

默认 Stage toolbar MUST 跟随编辑器模式：绘图模式下 MUST 列出绘图命令，MUST NOT 继续显示设计
模式的工具组。两套工具同时摆着会承诺一件不存在的事——绘图模式下 tool 根本不参与命令派发，
点了「选择」再敲 `L` 照常进 `LINE`。

绘图工具栏 MUST 至少提供 `LINE`、`ARC`、`CIRCLE`、`RECTANGLE`、`PLINE` 五条绘制命令与
`MOVE`、`COPY`、`ERASE` 三条编辑命令，两组之间 MUST 用细分割线分隔——前者产出新几何、后者
作用于既有对象，这是用户脑子里本来就有的那一刀。

每个按钮 MUST 具有本地化 accessible name 与可见焦点状态，MUST 通过 Stage 的绘图命令入口启动
命令，并 MUST 按 Stage 上报的当前活动命令表达按下态。

宿主提供的 `stageToolbar` slot MUST NOT 受影响。

#### Scenario: 切到绘图模式换掉工具组

- **WHEN** 用户把编辑器切到绘图模式
- **THEN** toolbar 显示八条绘图命令，设计模式的选择/变换/形状工具不再出现
- **AND** 切回设计模式后原工具组原样恢复

#### Scenario: 点按钮启动命令

- **WHEN** 用户在绘图模式点「圆」
- **THEN** 命令行进入 `CIRCLE` 的第一个提示
- **AND** 该按钮呈按下态

#### Scenario: 命令结束后按下态消失

- **WHEN** 一条命令提交或被中止
- **THEN** 所有绘图工具按钮都不是按下态

## MODIFIED Requirements

### Requirement: 平铺式默认画布工具栏

默认 Stage toolbar MUST 按下列顺序提供：选择/变换、精确移动、缩放、旋转、移动画布、吸附、网格及其大小
菜单、分割线、容器绘制、形状及其菜单、文字绘制。button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前
工具与 hover/focus 可以使用低调状态底色，工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、
fit 或单独 canvas settings 图标；宿主 `stageToolbar` slot 不受影响。

以上描述的是**设计模式**的工具栏；绘图模式另有自己的工具组。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 渲染默认工作区
- **THEN** toolbar 按规定顺序显示全部工具与两个 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 使用网格与形状菜单

- **WHEN** 用户打开网格或形状的 chevron menu
- **THEN** menu 具有 menu-button ARIA、键盘导航、Escape 关闭和焦点恢复
- **AND** 网格菜单能切换会话级可见性、选择 4/8/16/32 等网格间距或进入更多画布设置
- **AND** 形状菜单能选择 Rectangle、Arrow 或 Circle 绘制工具并显示当前快捷键；主按钮图标 MUST 反映最后选择的形状，并重新激活该形状工具

#### Scenario: 形状菜单不再提供线

- **WHEN** 用户打开形状菜单
- **THEN** 菜单里没有「线」条目
- **AND** 画线的入口是绘图模式的 `LINE` 命令
