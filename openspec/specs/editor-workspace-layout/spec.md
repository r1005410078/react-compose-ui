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
宽度、高度和结构化背景 Paint。节点选择、SceneTree 选择与输出检查 MUST 互斥；Canvas 不得出现在
SceneTree 或 selectedIds。Canvas 背景 MUST 使用既有 `paint` 属性编辑器，但不得连接实体的渐变画布
控制柄或图层取色会话。

#### Scenario: 点击输出并编辑背景 Paint

- **WHEN** 用户点击 Stage 输出区域，并把背景从 Solid 改为任一合法 Gradient
- **THEN** 右侧显示 Canvas Inspector，且每次确认只提交一个可逆 `output.configure` 事务
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

### Requirement: Editor 资源拖入桥接

默认 Editor MUST 把 Asset Browser Canvas drag 事件映射到当前 controller，并把显式
assetResolver 或默认 Provider resolver 注入 Stage；显式 resolver 优先。

#### Scenario: 默认资源面板拖入当前 Stage

- **WHEN** 一个 Editor 的默认 Asset Browser 发出拖拽事件
- **THEN** 只有该 Editor 的 interactionController 收到事件
- **AND** 宿主 onCanvasDrag 回调仍被调用

### Requirement: 默认 ECS 工作区同步

默认 Controller MUST 使用当前 Layout Snapshot 规划 Scene Tree move。移入 Layout MUST 自动 Flow，
跨 Layout MUST 保持 Flow 与 insertion index，移出到 free parent MUST 烘焙 Absolute；同父级 Flow
排序 MUST 只修改 Hierarchy 顺序。

#### Scenario: 使用场景树排序 Flow
- **WHEN** 用户在同一 Layout parent 内拖动一个或多个 Flow 场景树项
- **THEN** Controller 提交一次确定性 reorder 并保持所有 LayoutItem 不变
- **AND** Stage 与 Inspector 使用新 Snapshot 立即显示新顺序

### Requirement: ECS 聚合 Entity Inspector

默认 Editor Inspector MUST 显示 Identity，并按 Registry 顺序聚合当前 Entity 已附加 Component
属性区和 Renderer 内容区。所有属性区 MUST 位于同一个 Property Panel，并共享唯一的搜索、筛选、
显示设置与列宽状态；Composition MUST 保持内部隐藏；锁定时除 Lock 外全部只读。

#### Scenario: 查看矩形组合

- **WHEN** 用户选择 Rectangle Entity
- **THEN** Inspector 显示 Transform、Visibility、Lock、Appearance 与 Rectangle 内容
- **AND** 用户可以感知属性由多个能力区组合而成

#### Scenario: 使用单一 Inspector 工具栏

- **WHEN** Entity 同时拥有多个 Component 和 Renderer 内容属性
- **THEN** Inspector 只显示一个属性搜索框、一组筛选和显示设置
- **AND** 搜索可跨 Component 分组过滤，所有属性行共享列宽

#### Scenario: 添加能力分组

- **WHEN** 用户添加几何限制或容器能力
- **THEN** Inspector 增加对应的可折叠 Component 分组
- **AND** 不新增第二套属性工具栏

#### Scenario: 合并容器属性

- **WHEN** Entity 同时拥有 Hierarchy 与 Clip
- **THEN** Inspector 只显示一个“容器”分组
- **AND** 子项数量与裁剪属性使用共享属性列展示

#### Scenario: 未知扩展降级

- **WHEN** Entity 保存了当前 Registry 不认识的 Component 或 Renderer
- **THEN** Inspector 使用普通 Component 分组显示降级说明
- **AND** 不创建空分组或额外属性工具栏

#### Scenario: 解锁 Entity

- **WHEN** Entity 已锁定
- **THEN** 只有 Lock 控件仍可编辑
- **AND** 解锁后其他属性与能力入口恢复可用

### Requirement: 添加和移除能力

Inspector 顶部 MUST 提供“添加能力”，列出 Registry 中可用、已附加、冲突和不可用状态。
添加 MUST 原子补齐依赖；移除 MUST 二次确认并遵守依赖、基础项、锁定与子项保护。

#### Scenario: 添加几何限制

- **WHEN** 用户给 Rectangle 添加“几何限制”
- **THEN** Inspector 立即出现 TransformConstraints 属性区
- **AND** History 只新增一个事务

#### Scenario: 确认移除能力

- **WHEN** 用户移除可移除能力
- **THEN** AlertDialog 说明将删除能力数据
- **AND** 取消保持文档不变，确认后原子移除

#### Scenario: 显示不可移除原因

- **WHEN** 能力被依赖、定义缺失、属于基础组合、目标锁定或 Container 含子项
- **THEN** 移除入口禁用并提供对应可访问说明

### Requirement: 聚合 Inspector 通过 Registry Inspector 协议渲染

EntityInspector MUST 通过 ComposeComponentDefinition.inspector 渲染包括内建 Component 在内的
全部分组，MUST NOT 按 Component Key 硬编码内建编辑 UI；能力移除按钮状态 MUST 直接来自
listCapabilityAvailability；切换选中 Entity 时 MUST 重置移除确认等局部会话状态。

#### Scenario: 内建与宿主 Component 走同一条渲染路径

- **WHEN** Registry 内建与宿主 Component 定义都带 inspector
- **THEN** Inspector 按 order 渲染全部分组且无编辑器侧特判

#### Scenario: 切换选中重置移除确认

- **WHEN** 能力移除确认对话框打开时选中 Entity 发生变化
- **THEN** 对话框关闭且不会作用于新选中的 Entity

### Requirement: 容器创建 Preset 可配置

controller MUST 提供 containerPresetId 选项（默认 "container"）；Preset 缺失时创建入口
MUST 输出可定位的警告而不是静默失败。

#### Scenario: 缺失容器 Preset 时给出警告

- **WHEN** Registry 中不存在 containerPresetId 指向的 Preset 且用户触发创建
- **THEN** 不产生事务并输出包含该 Preset ID 的警告

### Requirement: VNext Editor composition API
ComposeEditor MUST replace flat panel, toolbar and children overrides with compose-prefixed `slots`, scene tree,
history and assets configuration; it MUST not retain legacy aliases.

#### Scenario: Slot overrides default workspace content
- **WHEN** a consumer provides an editor slot
- **THEN** that slot replaces only its matching default workspace content and the rest of the workspace remains intact

### Requirement: Canvas Map 输出尺寸与背景 Inspector

隐式 Canvas Inspector MUST 将输出尺寸显示为 Map 属性：左侧 Key 只能选择“常见尺寸”或“自定义尺寸”；右侧 Value 在“常见尺寸”时显示六个桌面分辨率，在“自定义尺寸”时显示紧凑 Size W/H。输出背景 MUST 显示为 Color 属性。Key 是 Inspector 本地瞬时状态，不得写入 ComposeDocument。

#### Scenario: 在 Canvas Map 的常见尺寸 Value 选择分辨率
- **WHEN** 用户将左列 Key 选择为“常见尺寸”，并在右侧 Value 选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Canvas 输出 W/H 同步为该分辨率且不显示自定义 W/H 属性
- **AND** 系统只提交一次可逆 `output.configure` 事务

#### Scenario: 选择并编辑自定义 Canvas Size
- **WHEN** 用户将左列 Key 选择为“自定义尺寸”
- **THEN** 同一 property row 的右侧 Value 显示当前输出 W/H
- **AND** 系统不派发 `output.configure` 或创建无意义事务
- **WHEN** 用户提交合法自定义 W/H
- **THEN** 系统只提交一次可逆 `output.configure` 事务，尺寸匹配常见分辨率时 Key 自动回到“常见尺寸”，否则保持“自定义尺寸”
- **AND** 无效草稿不改写输出；Undo/Redo 或宿主外部 W/H 更新后，Inspector 依据当前尺寸重新选择 Key/Value 并保持 output inspection 激活

#### Scenario: 编辑 Canvas Color
- **WHEN** 用户通过 Color Picker 选择输出背景颜色
- **THEN** Color 行不显示 CSS 字符串，并以一次可逆 `output.configure` 事务提交有效颜色

### Requirement: Editor 协调 Paint 编辑会话

ComposeEditor MUST 在每个实例内协调 Inspector Paint edit port、Stage 受控 paint target 和 Color History Provider。编辑 Popover 在 Stage canvas interaction 期间保持 pinned；退出 target 后恢复常规 Popover dismissal 和焦点。

#### Scenario: Inspector 与画布同步编辑

- **WHEN** 用户打开单个 Entity 的背景 Paint editor
- **THEN** Editor 激活对应 Stage Paint target 和实例级会话颜色历史
- **AND** 不改变 ComposeDocument、Selection 或 History，直到正式编辑提交

### Requirement: 资源面板页面操作

Editor MUST 通过 Asset Browser 的宿主上下文菜单插槽提供创建页面、设为首页与以只读方式查看页面
JSON 三项操作，且这三项 MUST 只在页面文件（设为首页与查看 JSON）或恒定（创建页面）出现。
Provider 缺少相应能力时对应项 MUST 渲染为禁用；已是首页的页面其设为首页项 MUST 禁用。创建页面
MUST 复用 Asset Browser 的命名对话框、规范化页面文件后缀、写入空白页面文档，并在创建成功后
刷新目录并打开该页面。

#### Scenario: 右键创建页面

- **WHEN** 用户在资源面板目录上右键并选择创建页面，输入名称后确认
- **THEN** 该目录下生成对应的页面文件并在树与网格中可见
- **AND** 该页面随即以页面标签打开

#### Scenario: 缺少写入能力时禁用

- **WHEN** Provider 不具备创建文件或写入能力
- **THEN** 创建页面项渲染为禁用
- **AND** 不发起任何写入

#### Scenario: 非页面文件不显示页面项

- **WHEN** 用户在图片或脚本文件上右键
- **THEN** 设为首页与查看页面 JSON 两项不出现

### Requirement: 页面文档标签与按页面事务运行时

Editor MUST 在双击页面文件时以独立的页面标签打开该页面，并 MUST 为每个已打开页面维护独立的事务
运行时。已打开的页面再次被打开 MUST 激活既有标签而不重复创建运行时。页面标签 MUST 复用既有资源
文档标签的关闭与脏状态提示机制。同一页面文件 MUST 允许同时以页面标签与只读 JSON 标签打开。

#### Scenario: 双击打开页面标签

- **WHEN** 用户双击一个页面文件
- **THEN** 打开页面标签且其文档内容为该页面
- **AND** 该页面拥有独立的事务运行时与撤销历史

#### Scenario: 重复打开激活既有标签

- **WHEN** 用户双击一个已打开的页面
- **THEN** 既有页面标签被激活
- **AND** 不新建运行时且不丢失未保存改动

#### Scenario: 页面与只读 JSON 并存

- **WHEN** 同一页面既以页面标签打开，又以只读 JSON 方式打开
- **THEN** 两个标签同时存在且互不覆盖
- **AND** 只读标签不显示脏状态提示

### Requirement: 工作区跟随活动页面

Editor MUST 使画布、场景树、Inspector 与历史面板跟随当前活动页面标签。切换活动页面 MUST 使这些
面板呈现该页面的文档与撤销历史，且 MUST NOT 残留上一页面的选择或视口。无页面打开时工作区
MUST 回退到宿主注入的控制器。

#### Scenario: 切换活动页面

- **WHEN** 用户在两个已打开页面标签之间切换
- **THEN** 画布、场景树、Inspector 与历史面板均切换到该页面
- **AND** 每个页面各自的撤销历史保持可用

#### Scenario: 切换不残留会话状态

- **WHEN** 在一个页面中选中若干实体后切换到另一页面
- **THEN** 新页面的选择为空且视口为该页面的初始视口
- **AND** 检视目标不指向已不存在的实体

#### Scenario: 无页面打开

- **WHEN** 没有任何页面标签打开
- **THEN** 工作区使用宿主注入的控制器
- **AND** 既有单文档宿主行为不变

### Requirement: 页面保存与写入冲突

Editor MUST 以最近一次成功读写得到的 revision 作为期望 revision 保存页面。保存成功 MUST 清除脏
状态并更新期望 revision。Provider 报告写入冲突时 Editor MUST 呈现确认对话框，提供强制覆盖与取消
两个选项，且 MUST NOT 在用户未确认时覆盖远端内容。关闭存在未保存改动的页面标签 MUST 复用既有的
关闭确认流程。

#### Scenario: 保存清除脏状态

- **WHEN** 用户修改页面后保存成功
- **THEN** 该标签的脏状态提示消失
- **AND** 重新打开该页面可见已持久化的改动

#### Scenario: 不关闭标签也能保存

- **WHEN** 页面存在未保存改动，用户按下保存快捷键或点击页面面板的保存入口
- **THEN** 页面被写入且脏状态清除
- **AND** 标签保持打开
- **AND** 无未保存改动时保存入口渲染为禁用

#### Scenario: 写入冲突确认

- **WHEN** 页面在外部被改写后用户在编辑器内保存
- **THEN** 呈现提供强制覆盖与取消的确认对话框
- **AND** 选择取消时远端内容保持不变

#### Scenario: 关闭未保存页面

- **WHEN** 用户关闭存在未保存改动的页面标签
- **THEN** 呈现关闭确认
- **AND** 取消时标签保持打开且改动保留

### Requirement: 页面条目的图标与名称

Editor MUST 为页面条目提供区别于普通文件的图标，图标 MUST 表达「由组件组装成的一屏」而不是
通用文档，且 MUST 按所在表面选择合适尺寸。Editor MUST 以去掉存储后缀的显示名呈现页面名称。
两者的判定依据 MUST 是 Provider 上报的媒体类型，因此重命名 MUST NOT 使其退回普通文件呈现。

#### Scenario: 页面使用专属图标与显示名

- **WHEN** 资源面板中存在页面条目
- **THEN** 该条目使用页面图标，且目录网格中的图标尺寸大于文件树行中的图标
- **AND** 显示名不包含页面文件的存储后缀

#### Scenario: 重命名页面不需要输入存储后缀

- **WHEN** 用户重命名一个页面
- **THEN** 输入框中只出现去掉存储后缀的显示名
- **AND** 提交后该条目仍是页面：保留页面图标与页面专属操作

#### Scenario: 非页面条目不受影响

- **WHEN** 条目的媒体类型不是页面
- **THEN** 该条目使用内建图标与原始名称

### Requirement: 首页标记与清单对账

Editor MUST 通过 Asset Browser 的标记插槽在文件树与目录网格中为首页页面渲染可访问的首页标记，
且标记 MUST 具有图形语义与可读名称。当首页页面经由本编辑器被删除时 Editor MUST 清空清单中的
首页指向；经由本编辑器被重命名时 MUST 将首页指向改写为新的稳定 key。首页 key 悬空时
Editor MUST NOT 自动改写清单，而 MUST 以非阻断方式提示。

#### Scenario: 设为首页后标记出现

- **WHEN** 用户对某页面选择设为首页
- **THEN** 文件树与目录网格都为该页面渲染首页标记
- **AND** 重新加载后该标记仍指向同一页面

#### Scenario: 首页转移

- **WHEN** 用户对另一页面选择设为首页
- **THEN** 标记转移到新页面
- **AND** 原页面不再显示标记

#### Scenario: 删除首页页面

- **WHEN** 用户在本编辑器内删除当前首页页面
- **THEN** 清单中的首页指向被清空
- **AND** 界面不再显示首页标记

#### Scenario: 首页 key 悬空

- **WHEN** 清单指向的页面已在外部被删除
- **THEN** 不渲染首页标记并给出非阻断提示
- **AND** 清单不被自动改写

### Requirement: 视口更新的渲染范围

Controller MUST 把 viewport 作为可订阅的会话状态持有，使 viewport 更新只重渲订阅了 viewport 的
组件。与 viewport 无关的工作区面板 MUST NOT 因为纯 viewport 更新而重渲。`controller.viewport`
读取 MUST 返回当前快照，`setViewport` 的签名与受控 Stage 契约 MUST 保持不变。

#### Scenario: 平移不重渲无关面板

- **WHEN** 用户平移画布，只有 viewport 发生变化
- **THEN** 场景树、Inspector 与命令面板不重新渲染
- **AND** Stage 与工具栏读取到新的 viewport 快照

#### Scenario: 宿主读取视口

- **WHEN** 宿主读取 `controller.viewport`
- **THEN** 返回当前 viewport 快照
- **AND** 需要跟随 viewport 变化重渲的宿主通过订阅入口获得通知

#### Scenario: 切换文档重置视口

- **WHEN** 宿主换用另一个 runtime
- **THEN** viewport 重置为初始值
- **AND** 订阅方收到重置后的快照

### Requirement: 页面 setup 脚本关联流程

Editor MUST 通过 Asset Browser 既有宿主菜单扩展为页面提供创建、打开、更换和解除 setup 脚本。创建
MUST 生成自包含 `.setup.js` 最小模板并以稳定资源引用更新页面；打开 MUST 复用独立脚本标签、dirty、
revision 与冲突处理。能力不足时入口 MUST 禁用，Editor MUST NOT 让 Asset Browser 拥有页面语义。

#### Scenario: 为页面创建 setup 脚本

- **WHEN** 可写页面没有 setupScript 且用户选择创建页面脚本
- **THEN** Editor 创建 JavaScript 模板、以页面 expected revision 写入稳定引用并打开脚本标签
- **AND** 页面文档内容和独立事务历史保持不变

#### Scenario: 创建脚本后页面写入冲突

- **WHEN** 脚本文件创建成功但页面 setup 引用因 revision 冲突写入失败
- **THEN** Editor 不声称关联成功，并显示新脚本已成为未关联资源及可恢复操作
- **AND** 不静默删除脚本或覆盖远端页面

#### Scenario: 更换或解除 setup 脚本

- **WHEN** 用户把页面关联到另一可引用 JavaScript 或解除当前关联
- **THEN** 页面只更新 setupScript 引用且既有 Bindings 按 exportName 保留
- **AND** 原脚本资源不被删除

### Requirement: 页面返回作用域与 Props 绑定

活动页面的 Inspector MUST 能查看 setup 返回成员的名称、value/method kind、当前值或 diagnostic，并在
Renderer Prop Contract 显式允许时提供绑定。绑定、换绑与解绑 MUST 通过文档事务修改 Entity Bindings，
支持 undo/redo；State/Computed 运行值变化 MUST NOT 产生事务。

#### Scenario: 把值和方法绑定到 Renderer Props

- **WHEN** 活动页面返回 State `num` 和 Function `onAdd`，选中 Renderer 声明兼容的 text 与 onClick Contract
- **THEN** Inspector 分别列出兼容候选并以一个可逆事务保存每次绑定
- **AND** authored text 字面值继续保留，Function 不进入 Renderer.props JSON

#### Scenario: 脚本重载刷新作用域

- **WHEN** 页面 setup 脚本成功保存新 revision
- **THEN** Editor dispose 旧 scope、显示新初始 State 并重新解析既有 Bindings
- **AND** 缺失返回成员显示错误但不会自动提交删除绑定的事务

### Requirement: Renderer Props 分类与绑定合并

Renderer 的全部公开顶层 Prop Contract MUST 按 Definition 声明的 Props 分类提供绑定入口。没有声明
分类的 Contract 与没有分类元数据的旧 Renderer Inspector MUST 进入 Editor 提供的「高级」分类；Editor
MUST NOT 再增加通用「内容」分类。由自定义 Inspector 呈现的 value Prop MUST 保留原类型控件并在字段
旁显示入口；绑定能力 MUST NOT 把已有或可由其 Schema 表达的字面 editor 降级为 binding-only。只有
method 或确实没有字面 editor 的 value Prop 才使用所属分类的 binding-only 行。只有存在未分类内容时
才显示「高级」，Editor MUST NOT 再显示独立「数据绑定」分组。

#### Scenario: 按定义分类显示 Props

- **WHEN** Renderer 声明「文本」与「排版」分类，并把各 value/method Contract 归入对应分类
- **THEN** Editor 直接显示「文本」与「排版」，每个 Contract 在所属分类以字段入口或 binding-only 行出现
- **AND** Inspector 中没有通用「内容」或独立「数据绑定」分组，且每个 Contract 只有一个绑定入口

#### Scenario: 未分类 Props 默认进入高级

- **WHEN** Renderer 的一个 Contract 没有 category，或旧 Renderer Inspector 没有声明 propCategories
- **THEN** Editor 把对应字段或 Inspector 放入「高级」分类

#### Scenario: 没有未分类内容时隐藏高级

- **WHEN** Renderer 的全部 Contract 均已归入显式分类，且没有旧 Inspector 或未知 Renderer 内容
- **THEN** Editor 不渲染「高级」分组

#### Scenario: Text 字体属性保留类型控件

- **WHEN** Text Renderer 声明 fontSize、fontFamily、fontWeight、letterSpacing 与 lineHeight Contract
- **THEN** 每个属性继续显示与 Schema 类型匹配的字面控件，并在同一行显示字段绑定入口
- **AND** 这些属性不得显示为独立的 binding-only 行

### Requirement: 页面标签拥有 Script Runtime 生命周期

每个已打开页面标签 MUST 在其页面聚合数据之外维护独立 Script Runtime 会话。切换标签 MUST 保留非活动
标签实例，关闭标签 MUST dispose；同一页面再次打开 MUST 激活既有页面和 scope。工作区回退到宿主单文档
controller 时 MUST 不猜测页面 setup。

#### Scenario: 两个页面标签状态隔离

- **WHEN** 两个页面标签分别运行 setup 且用户切换活动标签
- **THEN** Stage、作用域面板和 Inspector 显示当前页面实例的数据
- **AND** 非活动页面 State 保留但不会驱动当前工作区 Entity

#### Scenario: 关闭页面清理脚本实例

- **WHEN** 用户关闭页面标签并完成既有 dirty 决策
- **THEN** Editor dispose 该页面的 Effect、订阅和方法 wrapper
- **AND** 迟到脚本结果不得更新其他页面或回退工作区

