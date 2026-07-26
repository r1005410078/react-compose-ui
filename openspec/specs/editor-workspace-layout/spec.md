# editor-workspace-layout Specification

## Purpose

定义 `@compose-ui/editor` 基于 Dockview 的固定四区工作区、六份 React 内容来源、样式加载契约、宿主属性透传以及仅存活于组件实例的临时布局行为。
## Requirements
### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph 与 Component
Library、中间 Canvas 与 Stage Toolbar、右侧 Component Inspector、底部 Transaction Log 与
Command。中央 Canvas 必须获得扣除三个边缘区后的主要可用空间。

#### Scenario: 首次挂载编辑器

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph、Component Library 与 Component 图标标签，以及标题为
  “Canvas”“日志”“命令”的三个文字标签
- **AND** 三个图标标签分别保留对应的可访问名称和悬停提示
- **AND** Scene Graph 使用设计组件图标，且左侧活动栏底部显示带可访问名称的设置图标
- **AND** Stage Toolbar 显示在 Canvas 内容区域顶部
- **AND** Canvas 内容显示在中央主要区域

#### Scenario: Strict Mode 重放初始化

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 左、右、底部各只存在一个 Edge Group
- **AND** 六个默认外层面板各只存在一个实例

### Requirement: 边缘工具区

系统 MUST 使用 Dockview Edge Groups 实现 Scene Graph、Component Library、Component Inspector
和底部日志/命令区。Scene Graph 与 Component Library MUST 作为标签共享固定 `left` Edge Group，
Scene Graph 初始活动；Component Inspector 必须固定在 `right`；Transaction Log 与 Command
必须作为标签共享 `bottom` Edge Group。

#### Scenario: 检查默认边缘组

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 返回同时包含 Scene Graph 与 Component Library 面板的组
- **AND** Scene Graph 是左侧初始活动面板
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

系统 MUST 将显式 `children` 渲染在 Canvas 内容区域，并将 `componentLibraryPanel`、
`stageToolbar`、`inspectorPanel`、`transactionLogPanel`、`commandPanel` 分别渲染在对应语义
区域。`canvasToolbar` MUST 作为已废弃兼容别名继续工作，且与 stageToolbar 同时提供时后者优先。
Scene Graph MUST 默认渲染 `@compose-ui/scene-tree` 的空场景树，宿主可以通过 `sceneTreeProps`
提供受控树状态，或通过 `sceneGraphPanel` 完整覆盖默认树。没有 controller 时，缺少的其他可选
插槽 MUST 显示可访问占位。

#### Scenario: 宿主提供全部工作区内容

- **WHEN** 宿主同时传入 `children`、`sceneTreeProps`、componentLibraryPanel 和其余命名插槽
- **THEN** 默认场景树和每份内容显示在对应语义区域中
- **AND** 显式 children 覆盖任何 controller 默认 Stage

#### Scenario: 默认显示空场景树

- **WHEN** 宿主未传入 controller、sceneTreeProps 和 sceneGraphPanel
- **THEN** Scene Graph 区域显示可访问的空场景树
- **AND** 其他缺少的命名插槽显示说明区域用途的占位内容

#### Scenario: 宿主覆盖场景树

- **WHEN** 宿主提供 `sceneGraphPanel`，包括显式提供 `null`
- **THEN** Scene Graph 区域使用该值完整覆盖默认场景树或 controller 派生树

#### Scenario: Stage Toolbar 优先级

- **WHEN** 宿主同时提供 stageToolbar 与 canvasToolbar
- **THEN** Canvas 顶部只渲染 stageToolbar
- **WHEN** 宿主只提供 canvasToolbar
- **THEN** 旧 toolbar 继续正常渲染

#### Scenario: 插槽与场景树内容更新

- **WHEN** 宿主在编辑器挂载后更新任一插槽、sceneTreeProps 或 controller
- **THEN** 对应区域显示最新内容
- **AND** Dockview 组、面板和用户调整后的尺寸不被重建

### Requirement: 嵌入与公共 API 边界

系统 MUST 保留 `ComposeEditor` 根 `<section>` 的标准 HTML 属性、默认可访问名称、
`data-compose-ui="editor"` 和 core 包标识。`ComposeEditorProps` MUST 提供可选的 controller、
sceneTreeProps、componentLibraryPanel 与 stageToolbar，并保留 canvasToolbar 兼容属性。系统不得
从 `@compose-ui/editor` 公共入口转导 SceneTree、Stage、ComponentRegistry、CommandPanel 或
Dockview 的公共成员、序列化布局、Edge Group 对象或内部面板对象。

#### Scenario: 透传宿主属性

- **WHEN** 宿主向 `ComposeEditor` 传入 `className`、`style`、事件或自定义 `aria-label`
- **THEN** 这些属性应用于编辑器根 `<section>`
- **AND** Dockview 内部节点不覆盖宿主提供的根属性

#### Scenario: 使用编辑器公共类型

- **WHEN** 消费者从 `@compose-ui/editor` 导入公开成员
- **THEN** 消费者可以使用 `ComposeEditor`、`ComposeEditorProps`、
  `ComposeEditorController` 和 `useComposeEditorController`
- **AND** 独立包类型继续从各自 `@compose-ui/*` 公共入口导入
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

### Requirement: Controller 驱动的默认组合

默认 Editor controller MUST 派生任意根 SceneTree、Stage 与 Inspector，并不得公开或维护
activeFrameId。Frame 适配目标和新增父级 MUST 从选择及 SceneIndex 推导；删除/历史导航后选择与
展开项继续清理。

#### Scenario: 使用任意根工作区

- **WHEN** 文档根同时包含 Component 与 Frame
- **THEN** SceneTree、Stage、选择和 Inspector 显示相同完整拓扑
- **AND** controller 公共结果不包含 activeFrameId/setActiveFrameId

### Requirement: 单一事务观察边界

Controller MUST 接受可选 transaction observer，并只在 committed 与成功的 undo/redo/navigate 后
通知。Observer 的返回值或异步失败 MUST NOT 阻止或回滚 runtime；noop、rejected 和 reset MUST
NOT 作为成功编辑通知。

#### Scenario: 记录成功事务和导航

- **WHEN** runtime committed，或成功完成 undo、redo、navigate
- **THEN** observer 收到包含 transaction、方向、source 和 targets 的单一事件
- **AND** 宿主可以在一个位置映射到 operationLog.record

#### Scenario: 忽略非成功编辑

- **WHEN** dispatch 返回 noop/rejected 或宿主 reset 文档
- **THEN** transaction observer 不被当作成功编辑调用
- **AND** CommandPanel 仍可独立显示 noop/rejected 调试事件

#### Scenario: 日志写入失败

- **WHEN** observer 启动的 operation log Promise 失败
- **THEN** runtime 当前文档、历史和各编辑视图保持已提交状态

### Requirement: Frame presets 与结构节点 Inspector

默认 Editor MUST 使用 Frame preset 创建根级或嵌套 Frame，并只把 Frame 交给 Container
Inspector。SceneTree 的根新增和子级新增 MUST 都创建 Frame，不得生成 Group。

#### Scenario: 在根和 Frame 内新增 Frame

- **WHEN** SceneTree 分别请求根新增和 Frame 子级新增
- **THEN** node.create 在对应 parentId 创建带 clipContent 的 Frame
- **AND** 新节点被选择并可继续包含 Frame/Component

### Requirement: Stage 吸附工具栏

默认工具栏的画布设置 MUST 只编辑 canvas 网格、吸附与辅助线草稿；应用多个变化时提交一个
原子事务，取消或校验失败不得修改文档。output MUST 改由隐式 Canvas Inspector 编辑。适配
Frame MUST 从当前选择或最近 Frame 祖先推导。

#### Scenario: 原子修改网格和辅助线

- **WHEN** 用户同时修改网格并清空辅助线后应用
- **THEN** 文档通过一个 batch 事务更新全部设置
- **AND** 一次 undo 恢复应用前状态

### Requirement: 设置入口保持布局独立

默认工作区左侧活动栏底部 MUST 提供可聚焦设置按钮。设置模态 MUST 作为 editor root 内的
sibling 渲染并只覆盖当前 Editor，不得成为 Dockview 面板、portal 到宿主页面或改变左侧
Edge Group 的展开尺寸。

#### Scenario: 从活动栏打开设置

- **WHEN** 用户通过鼠标或键盘激活左下角设置按钮
- **THEN** 编辑器范围内显示居中模态弹框与遮罩
- **AND** 当前 Edge Group、中央 Canvas 与其他面板保持挂载和原尺寸

#### Scenario: 更新设置期间保持布局

- **WHEN** 用户切换主题、语言或修改快捷键
- **THEN** Dockview group 和 panel 实例不被重建
- **AND** 用户已调整的尺寸、折叠状态与活动标签保持不变

### Requirement: 工作区主题 token

共享 UI Context 样式入口 MUST 定义可继承的 dark 与 light 工作区 token，并让 Editor、Stage、
SceneTree、History、CommandPanel、PropertyPanel、OperationLog 与基础材料 Inspector 的默认
surface、border、text、hover、selected、focus 和 scrollbar 使用这些 token。Dark MUST 保持
既有视觉层级，editor 不得依赖逐包浅色祖先覆盖。

#### Scenario: 显示浅色默认工作区

- **WHEN** ComposeEditor 解析主题为 light 并使用全部默认面板
- **THEN** 所有工作区区域使用完整浅色层级且文本、选中态与焦点态清晰可辨
- **AND** 不出现只适合深色背景的孤立内建区域或浏览器默认滚动条

#### Scenario: 保持深色视觉

- **WHEN** ComposeEditor 使用默认 dark 主题
- **THEN** 既有 Stage、Dockview 和内建面板颜色层级不发生非预期改变
- **AND** 主题 token 不重置 editor 外的宿主全局样式

### Requirement: 隐式 Canvas Inspector

Editor MUST 把 output inspection 作为不进入文档的会话目标，并在右侧 Properties 面板显示输出
宽度、高度和背景。节点选择、SceneTree 选择与输出检查 MUST 互斥；Canvas 不得出现在 SceneTree
或 selectedIds。

#### Scenario: 点击输出并编辑属性

- **WHEN** 用户点击 Stage 输出区域并修改合法宽高或背景
- **THEN** 右侧显示 Canvas Inspector，且每次确认只提交一个可逆 output.configure 事务
- **AND** Undo/Redo 更新 Inspector 值并保持 output inspection 激活

#### Scenario: 使用常见桌面尺寸

- **WHEN** 用户选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Inspector 一次更新宽高并提交一个 output.configure 事务
- **AND** 用户仍可输入任意合法自定义尺寸

#### Scenario: 分离输出与编辑辅助设置

- **WHEN** 用户打开工具栏画布设置
- **THEN** 弹层只显示网格、吸附和辅助线设置
- **AND** 输出尺寸与背景只在 Canvas Inspector 编辑

### Requirement: 底部 Asset Browser 工作区

Editor MUST 在既有 bottom Edge Group 中新增 inactive 的“资源 / Assets”标签，Transaction Log
继续作为默认活动标签。`ComposeEditorProps` MUST 新增 `assetBrowserProps` 与
`assetBrowserPanel`；显式 panel 优先于 props，二者缺失时显示可访问占位。Editor MUST NOT
转导 Asset Browser 公共 API。

#### Scenario: 打开默认资源面板

- **WHEN** 宿主提供 assetBrowserProps 并打开底部资源标签
- **THEN** 标签显示 `@compose-ui/asset-browser` 的左树右资源界面
- **AND** Canvas、其他 Edge Group 和既有面板保持挂载及原尺寸

#### Scenario: 覆盖或省略资源内容

- **WHEN** 宿主提供 assetBrowserPanel，包括显式 null
- **THEN** 资源标签使用该值完整覆盖默认 AssetBrowser
- **WHEN** 宿主未提供 panel 或 props
- **THEN** 资源标签显示本地化、可访问的资源占位

#### Scenario: 保持底部默认活动标签

- **WHEN** Editor 首次初始化 bottom Edge Group
- **THEN** 该组包含 Transaction Log、Command 和 Assets
- **AND** Transaction Log 保持活动，Assets 初始 inactive
