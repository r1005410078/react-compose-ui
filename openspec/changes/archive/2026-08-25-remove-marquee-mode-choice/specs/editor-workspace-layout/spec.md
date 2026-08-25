## MODIFIED Requirements


### Requirement: 平铺式默认画布工具栏

默认 Stage toolbar MUST 按下列顺序提供：选择、缩放、旋转、吸附、网格及其大小菜单、分割线、
容器绘制、形状及其菜单、文字绘制。

选择 MUST 是一个普通按钮，MUST NOT 带判定模式菜单：框选判定恒由拖拽方向决定，方向本身就是
切换器。形状工具的菜单不受此约束——它的菜单项各自是独立动作（矩形 / 箭头 / 圆），不是同一个
动作的参数。

框选、精确移动与移动画布三个工具位 MUST NOT 出现：它们各自与既有手势完全重复——`select` 在
空白处拖拽即框选、`MOVE` 命令能键入精确位移且严格更强、空格与中键本来就是随时可用的临时平移
覆盖。形状菜单 MUST NOT 包含 Line。

button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前工具与 hover/focus 可以使用低调状态底色，
工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、fit 或单独 canvas settings
图标；宿主 `stageToolbar` slot 不受影响。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 渲染默认工作区
- **THEN** toolbar 按规定顺序显示全部工具与三个 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 不再出现三个重复工具位

- **WHEN** 用户查看默认工具栏
- **THEN** 其中没有框选、精确移动与移动画布三个按钮

#### Scenario: 使用网格与形状菜单

- **WHEN** 用户打开网格或形状的 chevron menu
- **THEN** menu 具有 menu-button ARIA、键盘导航、Escape 关闭和焦点恢复
- **AND** 网格菜单能切换会话级可见性、选择 4/8/16/32 等网格间距或进入更多画布设置
- **AND** 形状菜单能选择 Rectangle、Arrow 或 Circle 绘制工具并显示当前快捷键；主按钮图标 MUST 反映最后选择的形状，并重新激活该形状工具

## REMOVED Requirements

### Requirement: 框选工具与判定模式菜单

**Reason**: 判定模式菜单删除——方向本身就是切换器，一次拖拽即可选定，比开菜单更快且不残留状态。

**Migration**: 无。左→右为包含判定、右→左为相交判定，两种判定都仍然可达。
