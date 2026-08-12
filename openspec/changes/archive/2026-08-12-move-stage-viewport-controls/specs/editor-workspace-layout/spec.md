## ADDED Requirements

### Requirement: 画布内视口控件

默认 `ComposeEditor` 的 Stage MUST 在可视 surface 左上角提供屏幕固定的视口控件：居中视图、缩小、当前
缩放百分比与放大。控件 MUST 位于 ruler 与 scrollbar 所围成的可交互画布区域，呈现为无 Card/胶囊外框的
行内图标与文字，且在 viewport 平移或缩放时不随世界坐标移动。它 MUST 使用受控 viewport store，不能写入
文档、产生 History 事务或使未订阅 viewport 的工作区面板重新渲染。

#### Scenario: 在画布内缩放与居中

- **WHEN** 用户点击画布内的缩小或放大按钮
- **THEN** viewport 按现有 1.2 倍规则围绕 surface 中心缩放，并继续限制在 10% 至 800%
- **AND** 百分比读数更新，文档和事务历史不变
- **WHEN** 用户点击居中视图
- **THEN** viewport 缩放为 100%，世界原点位于 surface 几何中心
- **AND** 文档和事务历史不变

#### Scenario: 浮层保持屏幕固定并可访问

- **WHEN** 用户平移、滚轮缩放或使用快捷键更新 viewport
- **THEN** 控件保持在 surface 左上角而不随场景内容移动
- **AND** 所有 button 具有本地化 accessible name、tooltip 与可见焦点状态

### Requirement: 平铺式默认画布工具栏

默认 Stage toolbar MUST 按下列顺序提供：选择/变换、精确移动、缩放、旋转、移动画布、吸附、网格及其大小
菜单、分割线、容器绘制、形状及其菜单、文字绘制。button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前
工具与 hover/focus 可以使用低调状态底色，工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、
fit 或单独 canvas settings 图标；宿主 `stageToolbar` slot 不受影响。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 渲染默认工作区
- **THEN** toolbar 按规定顺序显示全部工具与两个 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 使用网格与形状菜单

- **WHEN** 用户打开网格或形状的 chevron menu
- **THEN** menu 具有 menu-button ARIA、键盘导航、Escape 关闭和焦点恢复
- **AND** 网格菜单能切换会话级可见性、选择 4/8/16/32 等网格间距或进入更多画布设置
- **AND** 形状菜单能选择 Rectangle、Line、Arrow 或 Circle 绘制工具并显示当前快捷键；主按钮图标 MUST 反映最后选择的形状，并重新激活该形状工具

## MODIFIED Requirements

### Requirement: 视口更新的渲染范围

Controller MUST 把 viewport 作为可订阅的会话状态持有，使 viewport 更新只重渲订阅了 viewport 的
组件。与 viewport 无关的工作区面板 MUST NOT 因为纯 viewport 更新而重渲。`controller.viewport`
读取 MUST 返回当前快照，`setViewport` 的签名与受控 Stage 契约 MUST 保持不变。

#### Scenario: 平移不重渲无关面板

- **WHEN** 用户平移画布，只有 viewport 发生变化
- **THEN** 场景树、Inspector 与命令面板不重新渲染
- **AND** Stage 与画布内视口控件读取到新的 viewport 快照

#### Scenario: 宿主读取视口

- **WHEN** 宿主读取 `controller.viewport`
- **THEN** 返回当前 viewport 快照
- **AND** 需要跟随 viewport 变化重渲的宿主通过订阅入口获得通知

#### Scenario: 切换文档重置视口

- **WHEN** 宿主换用另一个 runtime
- **THEN** viewport 重置为初始值
- **AND** 订阅方收到重置后的快照
