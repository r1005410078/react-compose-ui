# editor-workspace-layout Specification

## Purpose

定义 `@compose-ui/editor` 基于 Dockview 的固定四区工作区、六份 React 内容来源、样式加载契约、宿主属性透传以及仅存活于组件实例的临时布局行为。
## Requirements
### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph、中间 Canvas 与 Canvas Toolbar、右侧 Component Inspector、底部 Transaction Log 与 Command。中央 Canvas 必须获得扣除三个边缘区后的主要可用空间。

#### Scenario: 首次挂载编辑器

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph 与 Component 图标标签，以及标题为“Canvas”“日志”“命令”的三个文字标签
- **AND** Scene Graph 与 Component 图标分别保留对应的可访问名称和悬停提示
- **AND** Scene Graph 使用设计组件图标，且左侧活动栏底部显示带可访问名称的设置图标
- **AND** Canvas Toolbar 显示在 Canvas 内容区域顶部
- **AND** Canvas 内容显示在中央主要区域

#### Scenario: Strict Mode 重放初始化

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 左、右、底部各只存在一个 Edge Group
- **AND** 五个默认面板各只存在一个实例

### Requirement: 边缘工具区

系统 MUST 使用 Dockview Edge Groups 实现 Scene Graph、Component Inspector 和底部日志/命令区。Scene Graph 必须固定在 `left`，Component Inspector 必须固定在 `right`，Transaction Log 与 Command 必须作为标签共享 `bottom` Edge Group。

#### Scenario: 检查默认边缘组

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 返回包含 Scene Graph 面板的组
- **AND** `getEdgeGroup('right')` 返回包含 Component 面板的组
- **AND** `getEdgeGroup('bottom')` 返回同时包含 Transaction Log 与 Command 面板的组
- **AND** Transaction Log 是底部初始活动面板

#### Scenario: 调整边缘区尺寸

- **WHEN** 用户拖动任一 Edge Group 与中央 Canvas 之间的分隔边界
- **THEN** 对应 Edge Group 尺寸随拖动变化
- **AND** Canvas 使用剩余可用空间重新布局
- **AND** 各区域内容保持挂载并可继续操作

#### Scenario: 折叠和展开边缘区

- **WHEN** 用户点击一个 Edge Group 的活动标签
- **THEN** 该 Edge Group 在折叠和展开状态之间切换
- **AND** 展开时恢复折叠前的尺寸

### Requirement: 固定中央画布

系统 MUST 把 Canvas 作为中央普通 Dockview 主组中的固定面板。Canvas Toolbar 必须属于 Canvas 面板内容，不得成为独立 Dockview 面板。系统必须禁用默认面板拖拽、浮动和关闭入口，使 Canvas 与三个 Edge Groups 不会被用户拆散。

#### Scenario: 使用画布工具

- **WHEN** 用户操作 Canvas Toolbar 中的控件
- **THEN** 控件可以影响 Canvas 内容
- **AND** 工具栏与 Canvas 保持在同一中央面板中

#### Scenario: 用户尝试移除画布

- **WHEN** 用户尝试通过 Dockview 标签或拖拽交互移除 Canvas
- **THEN** Canvas 仍保留在中央主组
- **AND** 工作区不会进入没有主画布的状态

### Requirement: React 内容插槽

系统 MUST 将 `ComposeEditor` 的 `children` 渲染在 Canvas 内容区域，并将
`canvasToolbar`、`inspectorPanel`、`transactionLogPanel`、`commandPanel` 分别渲染在对应
语义区域。Scene Graph MUST 默认渲染 `@compose-ui/scene-tree` 的空场景树，宿主可以通过
`sceneTreeProps` 提供受控树状态，或通过 `sceneGraphPanel` 完整覆盖默认树。缺少其他可选
插槽时，系统必须在对应区域显示可访问的占位内容。

#### Scenario: 宿主提供全部工作区内容
- **WHEN** 宿主同时传入 `children`、`sceneTreeProps` 和其余四个命名插槽
- **THEN** 默认场景树和每份内容显示在对应语义区域中

#### Scenario: 默认显示空场景树
- **WHEN** 宿主未传入 `sceneTreeProps` 和 `sceneGraphPanel`
- **THEN** Scene Graph 区域显示可访问的空场景树
- **AND** 其他缺少的命名插槽显示说明区域用途的占位内容

#### Scenario: 宿主覆盖场景树
- **WHEN** 宿主提供 `sceneGraphPanel`，包括显式提供 `null`
- **THEN** Scene Graph 区域使用该值完整覆盖默认场景树

#### Scenario: 插槽与场景树内容更新
- **WHEN** 宿主在编辑器挂载后更新任一插槽或 `sceneTreeProps`
- **THEN** 对应区域显示最新内容
- **AND** Dockview 组、面板和用户调整后的尺寸不被重建

### Requirement: 嵌入与公共 API 边界

系统 MUST 保留 `ComposeEditor` 根 `<section>` 的标准 HTML 属性、默认可访问名称、
`data-compose-ui="editor"` 和 core 包标识。`ComposeEditorProps` MUST 提供可选的
`sceneTreeProps`。系统不得从 `@compose-ui/editor` 公共入口转导 SceneTree 成员、Dockview
API、序列化类型、Edge Group 对象或内部面板对象。

#### Scenario: 透传宿主属性
- **WHEN** 宿主向 `ComposeEditor` 传入 `className`、`style`、事件或自定义 `aria-label`
- **THEN** 这些属性应用于编辑器根 `<section>`
- **AND** Dockview 内部节点不覆盖宿主提供的根属性

#### Scenario: 使用编辑器公共类型
- **WHEN** 消费者从 `@compose-ui/editor` 导入公开成员
- **THEN** 消费者可以使用 `ComposeEditor` 和 `ComposeEditorProps`
- **AND** `ComposeEditorProps` 可以引用从 `@compose-ui/scene-tree` 导入的 `SceneTreeProps`
- **AND** 消费者不需要导入或引用任何 Dockview 类型

### Requirement: 编辑器样式入口

系统 MUST 提供 `@compose-ui/editor/styles.css` 样式入口，其中包含 Dockview 所需基础样式、
作用域限定的深色工作区样式和默认场景树样式。editor 自有样式 MUST 使用禁用 Preflight
且具有包级前缀的 Tailwind CSS 构建。系统必须在包文档中说明宿主需要导入该样式并为
编辑器提供非零高度。

#### Scenario: 宿主按文档加载样式
- **WHEN** 宿主导入 `@compose-ui/editor/styles.css` 并为编辑器提供确定高度
- **THEN** 四区工作台、默认场景树、标签、分隔边界和折叠后的 Edge Group 标题条正确显示在编辑器边界内
- **AND** 面板滚动条使用作用域限定的细窄深色样式，不出现浏览器默认的亮色滚动条
- **AND** editor 和场景树样式不重置宿主的全局元素样式

### Requirement: 临时布局状态

系统 MUST 将 Dockview 布局与未来页面文档状态分离。首个版本不得自动读取或写入 localStorage、远端存储或页面文档，也不得把 Dockview 序列化数据暴露为公共属性或事件。

#### Scenario: 当前实例内调整布局

- **WHEN** 用户在一个已挂载的编辑器实例中调整 Edge Group 尺寸、折叠状态或底部活动标签
- **THEN** 调整后的布局保持到该实例卸载

#### Scenario: 重新挂载编辑器

- **WHEN** 宿主卸载后重新挂载 `ComposeEditor`
- **THEN** 系统重新建立默认的左、右、底 Edge Groups 和中央 Canvas
- **AND** 不尝试恢复上一个实例的 Dockview JSON

### Requirement: 可选场景历史分栏

系统 MUST 在宿主提供 `history` 或显式提供 `historyPanel` 时，在现有 Scene Graph 外层面板中
挂载子 Dockview，并把场景内容与历史内容分别渲染为上、下两个真实 Dockview 面板。系统 MUST
在未提供历史输入时不挂载子 Dockview，并保持原有单栏场景内容。

#### Scenario: 使用默认历史面板

- **WHEN** 宿主向 ComposeEditor 提供 HistoryNavigationController
- **THEN** 子 Dockview 的 History 面板在场景树面板下方显示 `@compose-ui/history` 的 HistoryPanel
- **AND** 外层 Dockview 组和面板数量保持不变
- **AND** history 控制器驱动编辑器焦点范围内的撤销重做快捷键

#### Scenario: 覆盖历史面板

- **WHEN** 宿主显式提供 historyPanel，包括 null
- **THEN** 下方历史区域使用该值完整覆盖默认 HistoryPanel
- **AND** 同时提供的 history 控制器仍然驱动编辑器快捷键

#### Scenario: 不启用历史

- **WHEN** 宿主没有提供 history 且没有显式提供 historyPanel
- **THEN** 场景内容继续占满原 Scene Graph 面板
- **AND** 编辑器不拦截历史快捷键

### Requirement: Dockview 场景历史布局

系统 MUST 使用 Dockview 原生垂直布局和 sash，默认按 60%/40% 分配场景与历史面板高度，并
保持场景内容至少 160px、历史内容至少 120px。子 Dockview 布局状态 MUST 只存活于当前编辑器
实例，不得进入页面文档或持久化存储。

#### Scenario: 调整历史高度

- **WHEN** 用户拖动 Dockview 原生 sash
- **THEN** 场景内容和历史内容按约束调整高度
- **AND** 两侧内容保持挂载并可继续操作

#### Scenario: 编辑器内容更新

- **WHEN** 宿主更新场景、历史控制器或其他插槽
- **THEN** 两个子 Dockview 面板显示最新内容
- **AND** 用户调整后的子 Dockview 布局和外层 Dockview 布局不被重建
