## MODIFIED Requirements

### Requirement: 场景 Inspector

Editor MUST 把选中的 Frame Entity 当作**普通容器 Entity** 呈现：右侧 Properties 面板显示与
其它容器完全一致的 Entity Inspector（身份、几何、外观、Auto Layout、容器结构与溢出），
外加一个由 Registry Component Definition 提供的「场景」分组承载常见尺寸预设与该 Frame 的
辅助线。Editor MUST NOT 再为 Frame 提供专用的、绕开 Registry 的 Inspector 面板。
Frame 的尺寸 MUST 只出现一次：它显示在几何分组的既有尺寸字段上，提交 MUST 改派
`entity.frame.size.set` 以同时更新 `Frame.size` 与布局回退，且尺寸模式 MUST 锁定为固定值。
页面脚本与动画绑定 MUST NOT 出现在 Frame 的 Inspector 中——它们属于页面配置面板。
Frame MUST 出现在 SceneTree 与 selectedIds 中；Editor MUST NOT 保留任何不进入文档的
output inspection 会话目标。Frame 背景 MUST 使用既有 `paint` 属性编辑器。

#### Scenario: 点击输出并编辑背景 Paint

- **WHEN** 用户选中 Stage 中某个 Frame，并把背景从 Solid 改为任一合法 Gradient
- **THEN** 右侧显示该 Frame 的容器 Inspector，且每次确认只提交一个可逆的 Entity Appearance 事务
- **AND** Undo/Redo 更新 Inspector 值并保持该 Frame 选中

#### Scenario: 使用常见桌面尺寸

- **WHEN** 用户选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Inspector 一次更新该 Frame 的宽高并提交一个事务
- **AND** 用户仍可输入任意合法自定义尺寸

#### Scenario: 分离输出与编辑辅助设置

- **WHEN** 用户打开工具栏画布设置
- **THEN** 弹层只显示网格与吸附设置
- **AND** Frame 尺寸、背景与辅助线只在场景 Inspector 与标尺交互中编辑

#### Scenario: 多画板下的目标切换

- **WHEN** 用户在多个根 Frame 之间切换选择
- **THEN** Inspector 只显示当前选中 Frame 的属性
- **AND** 页面脚本与动画绑定不随选择变化，它们只出现在页面配置面板

#### Scenario: 场景是真容器

- **WHEN** 用户选中一个 Frame
- **THEN** Inspector 显示圆角、边框、透明度、Auto Layout 与容器溢出等全部容器属性
- **AND** 尺寸字段只出现一次，修改它同时更新 `Frame.size` 与布局回退，且不提供 Hug 选项

### Requirement: Frame Map 尺寸与背景 Inspector

场景分组 MUST 将 Frame 常见尺寸显示为 Map 属性：左侧 Key 只能选择“常见尺寸”或“自定义尺寸”；右侧 Value 在“常见尺寸”时显示六个桌面分辨率，在“自定义尺寸”时把编辑交回几何分组的尺寸字段。Frame 背景 MUST 由容器 Inspector 的既有外观分组以 Color 属性显示。Key 是 Inspector 本地瞬时状态，不得写入 ComposeDocument。场景分组 MUST 使用与当前受控 value 无关的固定默认 Frame 尺寸作为重置基线，MUST NOT 把当前 value 作为 `defaultValue` 传入 Property Panel。

#### Scenario: 在 Canvas Map 的常见尺寸 Value 选择分辨率
- **WHEN** 用户将左列 Key 选择为“常见尺寸”，并在右侧 Value 选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** 该 Frame 的 W/H 同步为该分辨率
- **AND** 系统只提交一次可逆事务

#### Scenario: 选择并编辑自定义 Canvas Size
- **WHEN** 用户将左列 Key 选择为“自定义尺寸”
- **THEN** 编辑落到几何分组既有的尺寸字段，场景分组不再重复显示 W/H
- **AND** 系统不派发事务
- **WHEN** 用户提交合法自定义 W/H
- **THEN** 系统只提交一次可逆事务，尺寸匹配常见分辨率时 Key 自动回到“常见尺寸”，否则保持“自定义尺寸”
- **AND** 无效草稿不改写 Frame；Undo/Redo 或宿主外部 W/H 更新后，Inspector 依据当前尺寸重新选择 Key/Value 并保持该 Frame 选中

#### Scenario: 编辑 Canvas Color
- **WHEN** 用户通过 Color Picker 选择 Frame 背景颜色
- **THEN** Color 行不显示 CSS 字符串，并以一次可逆事务提交有效颜色

#### Scenario: 重置 Canvas 输出背景
- **WHEN** 当前 Frame 背景与默认 Frame 背景不同
- **THEN** 背景属性行显示重置动作
- **AND** 执行重置以一次可逆事务把背景恢复为默认值

### Requirement: 页面脚本作为页面配置属性

活动页面的**页面配置面板** MUST 将页面 setup 显示为与激活场景选择器共用同一个
Property Panel Root 的「页面脚本」Section：脚本文件是嵌入该 Root 的标准属性字段行，
返回成员是贴边整行的自定义属性字段，重新加载、快捷创建与更多操作位于 Section 标题行
动作槽；MUST NOT 再自带独立分组 chrome、第二个属性工具栏或嵌套的独立属性面板。
该属性 MUST 只出现在页面配置面板，MUST NOT 出现在任何 Entity 的 Inspector 中；
它 MUST 只由 Editor 组合页面、资源和 Script Runtime 语义，不得下沉到 Property Panel
或 Asset Browser 包。

#### Scenario: 未关联页面选择或快捷创建脚本

- **WHEN** 活动页面没有 setupScript 且用户点击空白工作区
- **THEN** 脚本文件字段列出页面同目录中拥有稳定 assetKey 的 `.setup.js` 文件供选择
- **AND** 可写 Provider 在分组标题行提供按页面名快捷创建入口，创建成功后自动关联并打开脚本标签
- **AND** 页面文档与事务历史保持不变

#### Scenario: 已关联页面查看和管理脚本

- **WHEN** 活动页面关联的 setup 成功运行
- **THEN** 脚本文件字段显示当前脚本名称，分组标题行提供重新加载与更多操作（打开、解除）
- **AND** 返回成员字段列出 setup 返回成员的名称、value/method 类别、当前值以及运行 diagnostic
- **AND** State 更新或 setup revision 重载后，成员信息在同一字段内更新

#### Scenario: 页面与 Inspector 目标切换

- **WHEN** 用户在页面标签、空白工作区与 Entity Inspector 目标之间切换
- **THEN** 页面脚本分组只显示活动页面实例的数据并且只出现在页面配置面板
- **AND** 默认 Inspector 始终只有一个属性搜索工具栏

#### Scenario: 页面脚本属性视觉状态

- **WHEN** 用户在深色工作区打开已关联 setup 的页面配置面板
- **THEN** 页面脚本以共享 Root 的可折叠分组显示，样式与其它属性分组一致，标题行提供
  重新加载脚本按钮且低频操作位于更多菜单
- **AND** 返回成员以紧凑列表显示类型徽标、名称与最终值，不重复显示 method 类别
- **AND** 该确定状态具有 Playwright 视觉黄金文件

### Requirement: 画布动画绑定属性

活动页面的**页面配置面板** MUST 在「页面脚本」分组下方显示「动画」分组：它 MUST 是
共享 Property Panel Root 中的一个 Section，动画文件是嵌入该 Root 的标准属性字段行，
MUST NOT 引入第二个属性工具栏、独立分组 chrome 或嵌套的独立属性面板。该分组编辑的
MUST 是**当前激活场景**的动画绑定；文件引用与会话镜像 MUST 解析到同一个 Frame，
MUST NOT 一侧取激活场景、另一侧取当前选择。分组列出页面同目录
中拥有稳定 assetKey 的动画文件供绑定，支持更换与取消关联，并在可写 Provider 上通过分组
标题行动作提供按页面名快捷创建入口。创建 MUST 生成动画文件资产并默认绑定到激活场景。
已绑定时该分组 MUST 以属性面板既有的绑定入口提供播放控制变量绑定编辑，复用页面 setup
返回作用域的成员作为绑定候选。绑定引用保存在该 Frame `Animations.source` 上，绑定、更换、取消关联与创建是资源写入，
MUST NOT 进入撤销历史；取消关联 MUST NOT 删除动画文件资源。

#### Scenario: 未绑定页面选择或快捷创建动画

- **WHEN** 活动页面的激活场景没有绑定动画且用户点击空白工作区
- **THEN** 动画属性列出页面同目录中拥有稳定 assetKey 的动画文件供选择
- **AND** 可写 Provider 提供按页面名快捷创建入口，创建成功后自动绑定并水合会话镜像

#### Scenario: 已绑定页面编辑变量绑定

- **WHEN** 激活场景绑定了动画且页面 setup 返回作用域可用
- **THEN** 动画属性显示当前动画文件名称与取消关联操作
- **AND** 播放控制变量绑定的编辑派发可撤销的动画配置命令

#### Scenario: 取消关联不删除资源

- **WHEN** 用户取消激活场景当前的动画绑定
- **THEN** 该 Frame 的 `Animations.source` 被清空，动画文件仍由 Asset Provider 保留
- **AND** 会话镜像中的动画清单被移除，时间线回到创建引导

#### Scenario: 切换激活场景切换动画绑定

- **WHEN** 用户把激活场景从 A 切到 B
- **THEN** 动画分组显示 B 的绑定文件与 B 的清单
- **AND** 文件选择器与时间线指向同一个 Frame

### Requirement: 受约束的 Frame 升格入口

Editor MUST NOT 提供裸露的“升格为 Frame”命令。Container 升格为 Frame MUST 只作为以下四个
用户动作的隐含结果发生：从场景选择创建项目组件、新建场景、为该容器绑定动画、把该容器设为
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
MUST 解析为该选择所属的最近祖先 Frame；没有任何选择时 MUST 回退到页面的 `activeFrameId`。
`activeFrameId` MUST 用于该回退、预览默认目标与页面配置面板的作用域，MUST NOT 覆盖显式选择。

#### Scenario: 适配当前选中 Frame

- **WHEN** 文档有三个根 Frame，用户选中第二个并执行“适配画布”
- **THEN** 视口适配第二个 Frame 的边界
- **AND** `activeFrameId` 不发生变化

#### Scenario: 从后代解析目标 Frame

- **WHEN** 用户选中某个嵌套 Frame 内的一个矩形并执行“缩放到 Frame”
- **THEN** 目标解析为该矩形最近的祖先 Frame，而不是文档根 Frame

#### Scenario: 无选择时回退默认 Frame

- **WHEN** 用户清空选择后执行“适配画布”
- **THEN** 视口适配 `activeFrameId` 指向的 Frame

## ADDED Requirements

### Requirement: 页面配置面板

没有任何选择时，Editor MUST 在右侧 Properties 面板显示**页面配置**：一个共享 Property Panel
Root，依次包含激活场景选择器、页面脚本 Section 与动画 Section。它 MUST NOT 包含任何页面尺寸
字段——尺寸属于场景而不属于页面。多选时 MUST 仍显示既有的空态提示而不是页面配置：多选下
「页面配置」没有确定含义。未启用页面系统的宿主 MUST 回落到既有空态提示，MUST NOT 出现空壳面板。

#### Scenario: 点击空白工作区打开页面配置

- **WHEN** 用户点击所有场景之外的空白工作区
- **THEN** 选择被清空，右侧显示页面配置面板
- **AND** 面板包含激活场景、页面脚本与动画，且不包含任何尺寸字段

#### Scenario: 多选不显示页面配置

- **WHEN** 用户同时选中两个 Entity
- **THEN** 右侧显示空态提示而不是页面配置面板

#### Scenario: 无页面系统时回落空态

- **WHEN** 宿主没有配置页面系统且没有任何选择
- **THEN** 右侧显示既有空态提示
- **AND** 不出现只有标题没有内容的页面配置面板

### Requirement: 新建场景与激活场景

Editor MUST 提供「新建场景」动作，在工作区可见范围内不与既有场景重叠的位置创建一块默认尺寸的
根 Frame；该动作 MUST 是可撤销的文档事务，且 MUST NOT 自动改变激活场景——激活写在页面文件里，
与文档撤销不同步，自动激活会造出「撤销后场景已删除但激活仍指向它」的悬空状态。

Editor MUST 提供「设为激活场景」动作，并 MUST 提供三个入口：场景标题标签上的激活标记、
场景的右键菜单、页面配置面板的激活场景选择器。激活 MUST 写入 `ComposePageFile.activeFrameId`，
因此 MUST NOT 进入撤销历史；写入 MUST 使用期望 revision，冲突或失败 MUST 向用户显式报告，
MUST NOT 静默吞掉。任一时刻 MUST 恰好有一个激活场景。

#### Scenario: 新建第二个场景

- **WHEN** 用户在只有一个场景的页面上执行「新建场景」
- **THEN** 文档 rootIds 新增一块默认尺寸 Frame，位置不与既有场景重叠
- **AND** 激活场景保持不变，且该动作可一次撤销

#### Scenario: 切换激活场景

- **WHEN** 用户点击非激活场景标签上的激活标记
- **THEN** 该场景成为激活场景，页面配置面板的选择器同步更新
- **AND** 原激活场景不再显示激活标记

#### Scenario: 激活不进入撤销历史

- **WHEN** 用户切换激活场景后按下撤销
- **THEN** 激活场景保持为新选择的那个
- **AND** 撤销作用于此前的文档事务

#### Scenario: 激活写入失败可见

- **WHEN** 激活写入因 revision 冲突失败
- **THEN** 用户看到明确的失败提示
- **AND** 面板显示的激活场景与页面文件保持一致

## RENAMED Requirements

- FROM: `### Requirement: Frame Inspector`
- TO: `### Requirement: 场景 Inspector`
- FROM: `### Requirement: 页面脚本作为 Frame Inspector 属性`
- TO: `### Requirement: 页面脚本作为页面配置属性`
