## MODIFIED Requirements

### Requirement: Frame Inspector

Editor MUST 把选中的 Frame Entity 作为普通 Entity 选择目标，并在右侧 Properties 面板显示该
Frame 的尺寸、结构化背景 Paint、页面脚本与动画绑定。Frame MUST 出现在 SceneTree 与 selectedIds
中；Editor MUST NOT 保留任何不进入文档的 output inspection 会话目标。Frame 背景 MUST 使用既有
`paint` 属性编辑器。

#### Scenario: 选中 Frame 并编辑背景 Paint

- **WHEN** 用户点击 Stage 中某 Frame 的空白区域，并把背景从 Solid 改为任一合法 Gradient
- **THEN** 右侧显示 Frame Inspector，且每次确认只提交一个可逆的 Entity Appearance 事务
- **AND** Undo/Redo 更新 Inspector 值并保持该 Frame 选中

#### Scenario: 使用常见桌面尺寸

- **WHEN** 用户选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Inspector 一次更新该 Frame 的宽高并提交一个事务
- **AND** 用户仍可输入任意合法自定义尺寸

#### Scenario: 分离 Frame 属性与编辑辅助设置

- **WHEN** 用户打开工具栏画布设置
- **THEN** 弹层只显示网格与吸附设置
- **AND** Frame 尺寸、背景与辅助线只在 Frame Inspector 与标尺交互中编辑

#### Scenario: 多画板下的目标切换

- **WHEN** 用户在多个根 Frame 之间切换选择
- **THEN** Inspector 只显示当前选中 Frame 的尺寸、背景、脚本与动画绑定

### Requirement: Frame Map 尺寸与背景 Inspector

Frame Inspector MUST 将 Frame 尺寸显示为 Map 属性：左侧 Key 只能选择“常见尺寸”或“自定义尺寸”；右侧 Value 在“常见尺寸”时显示六个桌面分辨率，在“自定义尺寸”时显示紧凑 Size W/H。Frame 背景 MUST 显示为 Color 属性。Key 是 Inspector 本地瞬时状态，不得写入 ComposeDocument。Frame Inspector MUST 使用与当前受控 value 无关的固定默认 Frame 尺寸作为重置基线，MUST NOT 把当前 value 作为 `defaultValue` 传入 Property Panel。

#### Scenario: 在 Frame Map 的常见尺寸 Value 选择分辨率
- **WHEN** 用户将左列 Key 选择为“常见尺寸”，并在右侧 Value 选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** 该 Frame 的 W/H 同步为该分辨率且不显示自定义 W/H 属性
- **AND** 系统只提交一次可逆事务

#### Scenario: 选择并编辑自定义 Frame Size
- **WHEN** 用户将左列 Key 选择为“自定义尺寸”
- **THEN** 同一 property row 的右侧 Value 显示当前 Frame W/H
- **AND** 系统不派发事务
- **WHEN** 用户提交合法自定义 W/H
- **THEN** 系统只提交一次可逆事务，尺寸匹配常见分辨率时 Key 自动回到“常见尺寸”，否则保持“自定义尺寸”
- **AND** 无效草稿不改写 Frame；Undo/Redo 或宿主外部 W/H 更新后，Inspector 依据当前尺寸重新选择 Key/Value 并保持该 Frame 选中

#### Scenario: 编辑 Frame 背景 Color
- **WHEN** 用户通过 Color Picker 选择 Frame 背景颜色
- **THEN** Color 行不显示 CSS 字符串，并以一次可逆事务提交有效颜色

#### Scenario: 重置 Frame 背景
- **WHEN** 当前 Frame 背景与默认 Frame 背景不同
- **THEN** 背景属性行显示重置动作
- **AND** 执行重置以一次可逆事务把背景恢复为默认值

### Requirement: 动画模式

底部工具组的动画标签成为活动标签时，编辑器 MUST 进入动画模式；切换到其它标签或折叠该组时
MUST 退出。动画模式 MUST 以当前活动 Frame 为作用域：时间线显示该 Frame `Animations` 清单中的
动画，属性面板打点只作用于该 Frame 内的 Entity。组件文档工作区 MUST 同样支持动画模式，作用域
为组件的根 Frame。动画模式下画布、属性面板与预览 MUST 显示当前播放头时刻的采样文档，而所有
编辑命令 MUST 仍然派发到基础文档。播放头、播放状态、自动记录开关与动画选择 MUST 是编辑器会话
状态，MUST NOT 写入文档或撤销历史。

#### Scenario: 进入与退出动画模式

- **WHEN** 用户在底部工具组选择动画标签
- **THEN** 编辑器进入动画模式，时间线显示当前活动 Frame 的动画
- **WHEN** 用户切换到资源标签
- **THEN** 编辑器退出动画模式，画布恢复显示基础文档

#### Scenario: 组件文档的动画模式

- **WHEN** 用户在组件工作区打开动画模式
- **THEN** 时间线显示组件根 Frame 的动画，打点写入该组件文档
- **AND** 宿主页面文档不发生任何变化

#### Scenario: 切换活动 Frame 更新时间线

- **WHEN** 用户在多画板文档中把活动 Frame 从 A 切换到 B
- **THEN** 时间线切换为 B 的动画清单，播放头重置为 B 的会话状态

#### Scenario: 播放头驱动画布

- **WHEN** 动画中某 Entity 的位置在 0 ms 与 300 ms 各有一个关键帧，用户把播放头拖到 150 ms
- **THEN** 画布中该 Entity 显示在两个关键帧之间的插值位置
- **AND** 文档与撤销历史不发生任何变化

#### Scenario: 播放不产生事务

- **WHEN** 用户播放整条动画
- **THEN** 撤销历史中不新增任何条目

### Requirement: 页面脚本作为 Frame Inspector 属性

活动页面默认 Frame 的 Inspector MUST 将页面 setup 显示为与 Frame 尺寸、背景共用同一个
Property Panel Root 的“页面脚本”属性，MUST NOT 再在属性工具栏上方显示独立作用域块。
该属性 MUST 只在拥有页面 setup 归属的 Frame 上出现，MUST 只由 Editor 组合页面、资源和
Script Runtime 语义，不得下沉到 Property Panel 或 Asset Browser 包。

#### Scenario: 未关联页面选择或快捷创建脚本

- **WHEN** 活动页面没有 setupScript 且用户选中其默认 Frame
- **THEN** 页面脚本属性列出页面同目录中拥有稳定 assetKey 的 `.setup.js` 文件供选择
- **AND** 可写 Provider 提供按页面名快捷创建入口，创建成功后自动关联并打开脚本标签
- **AND** 页面文档与事务历史保持不变

#### Scenario: 已关联页面查看和管理脚本

- **WHEN** 活动页面关联的 setup 成功运行
- **THEN** 页面脚本属性显示当前脚本名称以及重新加载、打开、切换和解除操作
- **AND** 属性内列出 setup 返回成员的名称、value/method 类别、当前值以及运行 diagnostic
- **AND** State 更新或 setup revision 重载后，成员信息在同一属性内更新

#### Scenario: 页面与 Inspector 目标切换

- **WHEN** 用户在页面标签、默认 Frame 与其它 Entity Inspector 目标之间切换
- **THEN** 页面脚本属性只显示活动页面实例的数据并且只出现在默认 Frame 的 Inspector
- **AND** 默认 Inspector 始终只有一个属性搜索工具栏

#### Scenario: 页面脚本属性视觉状态

- **WHEN** 用户在深色工作区打开已关联 setup 的默认 Frame Inspector
- **THEN** 页面脚本以横跨属性网格的可折叠分组显示，标题栏提供重新加载脚本按钮且低频操作位于更多菜单
- **AND** 返回成员以紧凑列表显示类型徽标、名称与最终值，不重复显示 method 类别
- **AND** 该确定状态具有 Playwright 视觉黄金文件

## RENAMED Requirements

- FROM: `### Requirement: 隐式 Canvas Inspector`
- TO: `### Requirement: Frame Inspector`
- FROM: `### Requirement: Canvas Map 输出尺寸与背景 Inspector`
- TO: `### Requirement: Frame Map 尺寸与背景 Inspector`
- FROM: `### Requirement: 页面脚本作为 Canvas Inspector 属性`
- TO: `### Requirement: 页面脚本作为 Frame Inspector 属性`

## ADDED Requirements

### Requirement: 受约束的 Frame 升格入口

Editor MUST NOT 提供裸露的“升格为 Frame”命令。Container 升格为 Frame MUST 只作为以下四个
用户动作的隐含结果发生：从场景选择创建项目组件、新建画板、为该容器绑定动画、把该容器设为
独立导出目标。每次隐含升格 MUST 作为同一个可撤销事务的一部分，并 MUST 在 UI 中说明该容器
已成为独立作用域边界。

#### Scenario: 创建组件时隐含升格

- **WHEN** 用户对一个普通 Container 执行“从选择创建项目组件”
- **THEN** 该 Container 获得 `Frame` Component 且 id 与子级保持不变
- **AND** 升格与创建组件在同一个事务中，可一次撤销

#### Scenario: 不提供裸升格命令

- **WHEN** 用户在场景树或画布上右键一个普通 Container
- **THEN** 菜单中不出现独立的“升格为 Frame”项

### Requirement: 多画板下的 Frame 动作目标

在存在多个根 Frame 的文档中，所有以 Frame 为对象的编辑器动作 MUST 以**当前选中 Frame** 为目标：
适配画布、缩放到 Frame、Frame 相关快捷键与工具栏动作均如此。当前选中的不是 Frame 时，目标
MUST 解析为该选择所属的最近祖先 Frame；没有任何选择时 MUST 回退到页面的 `defaultFrameId`。
`defaultFrameId` MUST 只用于该回退与预览默认目标，MUST NOT 覆盖显式选择。

#### Scenario: 适配当前选中 Frame

- **WHEN** 文档有三个根 Frame，用户选中第二个并执行“适配画布”
- **THEN** 视口适配第二个 Frame 的边界
- **AND** `defaultFrameId` 不发生变化

#### Scenario: 从后代解析目标 Frame

- **WHEN** 用户选中某个嵌套 Frame 内的一个矩形并执行“缩放到 Frame”
- **THEN** 目标解析为该矩形最近的祖先 Frame，而不是文档根 Frame

#### Scenario: 无选择时回退默认 Frame

- **WHEN** 用户清空选择后执行“适配画布”
- **THEN** 视口适配 `defaultFrameId` 指向的 Frame
