## MODIFIED Requirements

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
