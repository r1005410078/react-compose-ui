# editor-workspace-layout Specification

## Purpose

定义 `@compose-ui/editor` 基于 Dockview 的固定四区工作区、六份 React 内容来源、样式加载契约、宿主属性透传以及仅存活于组件实例的临时布局行为。
## Requirements
### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph（内部包含下方基础
组件与可选历史工具区）、中间 Canvas 与 Stage Toolbar、右侧 Component Inspector、底部资源、Command
与 Transaction Log 工具组。中央 Canvas 必须获得扣除三个边缘区后的主要可用空间。

#### Scenario: 首次挂载编辑器

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph、默认选中的基础组件工具区，以及标题为“Canvas”“资源”“命令”“日志”的四个文字标签
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
必须作为标签共享 `bottom` Edge Group。Scene Graph 与 Component Inspector 的 `left`/`right`
Edge Group MUST 承载在一个挂载于中央 Canvas 面板内部的嵌套 Dockview 实例中；底部 `bottom`
Edge Group MUST 留在外层 Dockview 实例，使其宽度与两侧 Edge Group 的折叠/展开状态无关，
始终横跨整个编辑器宽度。

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
- **THEN** 该 Edge Group 在折叠和展开状态之间切换，折叠后显示为窄轨道
- **AND** 展开时恢复折叠前的尺寸

#### Scenario: 底部工具区不受两侧折叠影响

- **WHEN** 用户折叠或展开左侧 Scene Graph、右侧 Component Inspector 中的任意一个或两个
  Edge Group
- **THEN** 底部 `bottom` Edge Group 的宽度和横向位置保持不变，继续横跨整个编辑器宽度
- **AND** 底部工具区内容不重新挂载

#### Scenario: Strict Mode 重放嵌套工作区

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 外层 Dockview 只有一个中央面板和一个 `bottom` Edge Group
- **AND** 嵌套的中层 Dockview 只有一个 `left` Edge Group 和一个 `right` Edge Group
- **AND** 两层 Dockview 中同名的可访问 landmark 使用不同的 `aria-label`，不会被辅助技术
  当成同一个区域

### Requirement: 固定中央画布

系统 MUST 在未启用页面系统时把 Canvas 作为中央普通 Dockview 主组中的固定面板。启用页面系统时，系统 MUST 保留中央主组但不得创建不对应资源文件的 Canvas 面板；中央区域由打开的页面文档承载。Canvas Toolbar 必须属于其承载文档内容，不得成为独立 Dockview 面板。系统必须禁用默认面板拖拽、浮动和关闭入口，使固定 Canvas（仅单文档模式）与三个 Edge Groups 不会被用户拆散。

#### Scenario: 使用单文档画布工具

- **WHEN** 宿主未提供页面系统且用户操作 Canvas Toolbar 中的控件
- **THEN** 控件可以影响 Canvas 内容
- **AND** 工具栏与 Canvas 保持在同一中央面板中

#### Scenario: 页面模式不显示根画布

- **WHEN** 宿主启用页面系统
- **THEN** 中央 Dockview group 不创建标题为“画布”或“Canvas”的固定标签
- **AND** 系统不会把无文件的根 Canvas 作为页面编辑回退

#### Scenario: 用户尝试移除单文档画布

- **WHEN** 宿主未提供页面系统且用户尝试通过 Dockview 标签或拖拽交互移除 Canvas
- **THEN** Canvas 仍保留在中央主组
- **AND** 工作区不会进入没有主画布的状态

### Requirement: React 内容插槽

系统 MUST 将显式 `children` 渲染在 Canvas 内容区域，并将 `componentLibraryPanel`、
`stageToolbar`、`inspectorPanel`、`transactionLogPanel`、`commandPanel` 分别渲染在对应语义
区域。`componentLibraryPanel` MUST 位于 Scene Graph 内部下方工具组的基础组件标签中；`canvasToolbar`
MUST 作为已废弃兼容别名继续工作，且与 stageToolbar 同时提供时后者优先。Scene Graph MUST 默认渲染
`@compose-ui/scene-tree` 的空场景树，宿主可以通过 `sceneTreeProps` 提供受控树状态，或通过
`sceneGraphPanel` 完整覆盖默认树。没有 controller 时，缺少的其他可选插槽 MUST 显示可访问占位。

#### Scenario: 宿主提供全部工作区内容

- **WHEN** 宿主同时传入 `children`、`sceneTreeProps`、componentLibraryPanel 和其余命名插槽
- **THEN** 默认场景树和每份内容显示在对应语义区域中
- **AND** 基础组件内容显示在场景树下方的基础组件标签内
- **AND** 显式 children 覆盖任何 controller 默认 Stage

#### Scenario: 默认显示空场景树

- **WHEN** 宿主未传入 controller、sceneTreeProps 和 sceneGraphPanel
- **THEN** Scene Graph 区域显示可访问的空场景树
- **AND** 下方基础组件区域和其他缺少的命名插槽显示说明区域用途的占位内容

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

默认工作区左侧活动栏底部 MUST 提供可聚焦设置按钮。设置模态 MUST 使用
`@compose-ui/components` 的 ComposeDialog，通过全视口 Portal 覆盖当前浏览器窗口；它不得成为
Dockview 面板，也不得被任一 Edge Group、Canvas 或宿主 Editor root 的尺寸、overflow 或 stacking
context 裁剪。设置模态不得改变左侧 Edge Group 的展开尺寸、Dockview 布局或活动面板。

#### Scenario: 从活动栏打开设置

- **WHEN** 用户通过鼠标或键盘激活左下角设置按钮
- **THEN** 全视口遮罩上显示居中的设置弹框，且弹框内容使用 Compose Theme/I18n
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

页面系统启用时，页面文档标签 MUST 持有各自的事务 runtime。编辑器启动后，系统 MUST 在页面目录解析到一个存在的 `homePageKey` 时自动打开并激活该首页；该尝试在同一页面 key 上至多执行一次，目录刷新或用户随后关闭标签不得重新打开它。Stage、Scene Graph、Inspector、History、Command 和保存动作 MUST 跟随中央组中的活动页面标签；首页为空、悬空或读取失败时，系统 MUST 显示已有非阻断状态而不得回退到宿主的根 Canvas。页面系统未启用时，工作区 MUST 使用宿主注入的 controller，保持既有单文档行为。

#### Scenario: 启动时打开标记首页

- **WHEN** 页面目录加载完成，`app.json` 标记的首页存在且可读取
- **THEN** 编辑器自动创建并激活该首页对应的页面文档标签
- **AND** Stage、Scene Graph 与 Inspector 使用该页面的 runtime

#### Scenario: 首页缺失

- **WHEN** 页面目录的 `homePageKey` 未设置、指向不存在的页面或页面读取失败
- **THEN** 编辑器不创建或激活无文件的根 Canvas
- **AND** 悬空首页继续显示非阻断缺失提示

#### Scenario: 未启用页面系统

- **WHEN** 宿主未提供页面系统配置
- **THEN** 工作区创建固定 Canvas 并使用宿主注入的 controller
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
- **AND** Stage 与画布内视口控件读取到新的 viewport 快照

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

### Requirement: 从场景选择创建项目组件

Editor MUST 从一个或多个同父级、Absolute、未锁定的顶层规范化选择创建组件。提取器 MUST 始终生成
坐标归零、透明输出、尺寸匹配当前 Layout Snapshot 世界包围并集的 Group 单根文档；单节点也包入 Group，
已有 first-class Group 不重复嵌套。资源成功创建后，Editor MUST 以一个事务在最小原 sibling index
用关联实例替换来源。

#### Scenario: 框选后创建组件

- **WHEN** 用户框选多个合法节点并从 Stage、Scene Tree 或 Command Panel 选择“创建组件…”
- **THEN** Editor 写入一个 Base 资源并以一个可撤销事务替换来源
- **AND** 新实例输出与来源世界几何一致

#### Scenario: 创建资源失败

- **WHEN** Provider 写入失败、名称冲突或确认前文档 revision 已改变
- **THEN** 场景和历史完全不变并显示失败原因

#### Scenario: 资源成功但场景替换失败

- **WHEN** 资源写入后文档 revision 改变或替换命令被拒绝
- **THEN** 资源保留、场景不变并报告“资源已保存但未实例化”

#### Scenario: 撤销组件替换

- **WHEN** 用户撤销或重做成功的场景替换
- **THEN** Undo 恢复原来源子树，Redo 恢复指向同一资源的实例
- **AND** 两个动作都不删除或重写组件资源

### Requirement: Scene Tree 到资源目录创建组件

Editor MUST 桥接 SceneTree 普通行拖拽和 Asset Browser 外部放置：树内 drop 继续移动，落入可写资源目录
时使用开始 revision、规范化 nodeIds、目标目录和命名结果执行同一创建组件流程。

#### Scenario: 普通行拖到资源目录

- **WHEN** 用户把已选 Scene Tree 行拖到可写资源目录并确认名称
- **THEN** Editor 创建 Base 组件并原子替换场景来源
- **AND** SceneTree 与 Asset Browser 都不直接依赖组件领域协议

### Requirement: 组件与 Variant 独立工作区

Editor MUST 以独立 TransactionRuntime 标签打开 Base 或 Variant，提供 dirty、保存、关闭确认、revision
冲突和活动会话回调。Base 可以定义稳定暴露属性；Variant 继承定义并在保存时从直接父快照生成稳定操作。
场景实例内部 MUST 不进入结构编辑树。

#### Scenario: 独立编辑 Base

- **WHEN** 用户双击组件目录或资源目录中的 Base
- **THEN** Editor 打开独立 Runtime，允许结构编辑、暴露属性、保存与冲突处理

#### Scenario: 独立编辑 Variant

- **WHEN** 用户打开 Variant 并修改字段或结构
- **THEN** 编辑器显示 resolved document，保存时只持久化相对直接父源的规范操作和新快照

#### Scenario: 从实例创建 Variant

- **WHEN** 用户从带 propertyOverrides 的场景实例创建 Variant
- **THEN** 新 Variant 直接引用该实例来源并把属性覆盖转换为字段操作

### Requirement: Apply、Revert 与提示后更新界面

Editor MUST 为 Variant 和实例显示当前层覆盖、单项/全部 Apply 与 Revert、pending update 和冲突确认。
实例 Apply MUST 只接受暴露属性；结构操作只在 Variant 工作区出现。更新 MUST 保留实例位置和旋转。

#### Scenario: Apply 和 Revert 覆盖

- **WHEN** 用户对当前层覆盖执行单项或全部 Apply/Revert
- **THEN** Editor 按 Component Store 结果刷新当前 Runtime、lineage、快照和覆盖状态
- **AND** partial success 显示稳定恢复指引

#### Scenario: 用户确认更新

- **WHEN** 源 revision 变化且用户确认兼容更新或丢弃列出的冲突
- **THEN** Editor 以一次事务更新实例 lineage、快照、兼容覆盖和尺寸
- **AND** 不改变实例位置与旋转

### Requirement: 动画模式

页面文档工具栏的模式切换器切到「动画」时，编辑器 MUST 进入动画模式；切回「设计」时
MUST 退出。动画模式 MUST 以当前活动 Frame 为作用域：时间线显示该 Frame `Animations` 清单中的
动画，属性面板打点只作用于该 Frame 内的 Entity。组件文档工作区 MUST 同样支持动画模式，作用域
为组件的根 Frame。动画模式下画布、属性面板与预览 MUST 显示当前播放头时刻的采样文档，而所有
编辑命令 MUST 仍然派发到基础文档。播放头、播放状态、自动记录开关与动画选择 MUST 是编辑器会话
状态，MUST NOT 写入文档或撤销历史。

#### Scenario: 进入与退出动画模式

- **WHEN** 用户在页面文档工具栏把模式切换到「动画」
- **THEN** 编辑器进入动画模式，时间线显示当前活动 Frame 的动画
- **WHEN** 用户把模式切换回「设计」
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

### Requirement: 空动画的创建引导

当前活动 Frame 还没有绑定动画时，时间线 MUST 显示空状态而不是演示数据，并提供一个本地化的
创建入口：触发创建 MUST 生成动画文件资产、写入该 Frame 的 `Animations.source` 并把清单水合进
`Animations.items` 会话镜像；文件创建与绑定是资源写入，不进入撤销历史，镜像水合 MUST 是
可撤销事务。Frame 已绑定动画但会话镜像缺失（如撤销越过水合事务）时，空状态 MUST 改为提供「载入绑定动画」入口，只重新派发
水合事务而不重复创建文件。创建或载入完成后 MUST 自动选中该动画，时间线切换到正常状态；
已绑定动画即使没有任何轨道也 MUST 显示正常时间线而非创建引导。空状态 MUST NOT 显示播放
控件、标尺以外的关键帧交互或任何占位轨道。

#### Scenario: 初始页面打开动画标签

- **WHEN** 用户在一个活动 Frame 没有绑定动画的页面上切换到动画模式
- **THEN** 时间线显示空状态与创建入口，不显示任何演示轨道
- **AND** 属性面板不显示动画检查器

#### Scenario: 创建第一条动画

- **WHEN** 用户在空状态下触发创建
- **THEN** 页面同目录新增动画文件资产，该 Frame 的 `Animations.source` 写入其稳定引用
- **AND** `Animations.items` 新增该动画清单，时间线退出空状态并选中它

#### Scenario: 撤销越过水合事务后重新载入

- **WHEN** 用户创建动画后撤销镜像水合事务
- **THEN** 时间线显示「载入绑定动画」入口而不是创建入口
- **WHEN** 用户触发载入
- **THEN** 镜像水合事务重新派发，时间线恢复正常状态且不产生新的动画文件

#### Scenario: 已绑定零轨道显示正常时间线

- **WHEN** 该 Frame 绑定的动画还没有任何轨道
- **THEN** 时间线显示正常状态与本地化的无轨道提示，不显示创建引导

### Requirement: 时间线显示文档动画

动画模式下时间线 MUST 显示由当前文档动画映射而来的对象轨道与属性轨道，对象轨道名称取自
Entity 名称。二维向量轨道 MUST 作为单条属性轨道显示，其 X 与 Y 分量在右侧关键帧属性面板中
分别可编辑——位置是一个二维量，拆成两行会造出"删了 X 行的帧、Y 行还留着"的伪状态。
时间线上的编辑操作 MUST 通过动画命令写入文档，从而参与撤销与重做。

#### Scenario: 打点后时间线长出轨道

- **WHEN** 用户为一个此前没有动画的 Entity 打下第一个位置关键帧
- **THEN** 时间线出现以该 Entity 名称命名的对象轨道，其下有一条 `Position` 属性轨道

#### Scenario: 拖动关键帧可撤销

- **WHEN** 用户在时间线上把一个关键帧拖到新时间后撤销
- **THEN** 关键帧回到原时间，画布同步恢复

#### Scenario: 二维向量在属性面板分量可编辑

- **WHEN** 用户选中位置轨道上的一个关键帧
- **THEN** 右侧关键帧属性面板显示 X 与 Y 两个可编辑分量，编辑单个分量不丢失另一个

### Requirement: 属性面板关键帧打点按钮

动画模式下，属性面板中可动画字段 MUST 在标签后显示一个菱形打点按钮，并具备四种状态：
未被动画、已被动画但当前播放头无关键帧、当前播放头有关键帧、当前配置下不可动画。
点击 MUST 在"当前播放头有关键帧"时删除该关键帧，否则以字段当前值在播放头处写入关键帧。
按钮 MUST 具备本地化 accessible name 说明当前状态，不可动画时 MUST 禁用并说明原因。
非动画模式下 MUST NOT 显示该按钮。

#### Scenario: 三态切换

- **WHEN** 用户在动画模式下选中一个绝对定位 Entity
- **THEN** 位置字段的菱形显示为未被动画状态
- **WHEN** 用户点击该菱形
- **THEN** 菱形变为"当前播放头有关键帧"状态，时间线出现对应关键帧
- **WHEN** 用户把播放头移到另一个没有关键帧的时刻
- **THEN** 菱形变为"已被动画但当前播放头无关键帧"状态

#### Scenario: 再次点击删除关键帧

- **WHEN** 菱形处于"当前播放头有关键帧"状态且用户点击它
- **THEN** 该关键帧被删除，操作可撤销

#### Scenario: 布局配置导致不可动画

- **WHEN** 选中 Entity 的 `LayoutItem.positioning` 为 `flow`
- **THEN** 位置字段的菱形禁用，其 accessible name 说明该属性在当前布局下不参与求解

#### Scenario: 退出动画模式后按钮消失

- **WHEN** 用户切换到非动画标签
- **THEN** 属性面板不再显示任何菱形按钮，字段行恢复原状

### Requirement: 自动记录把编辑改写为关键帧

动画模式下自动记录开启时，画布与属性面板对可动画属性的修改 MUST 被改写为在当前播放头处写入
关键帧，而 MUST NOT 修改基础文档中该属性的静态值。由于画布操作作用在采样文档上，改写
MUST 以修改后的**绝对值**写入关键帧。自动记录关闭时，修改 MUST 照常写入基础文档静态值。

#### Scenario: 播放头非零时在画布上拖动对象

- **WHEN** 某 Entity 在 0 ms 有位置关键帧、播放头位于 200 ms、自动记录开启，用户在画布上把它
  拖到新位置
- **THEN** 200 ms 处新增一个关键帧，其值等于对象在画布上的最终绝对位置
- **AND** 0 ms 处的关键帧与基础文档中该 Entity 的静态位置都不变

#### Scenario: 关闭自动记录后编辑基础值

- **WHEN** 自动记录关闭且用户在属性面板修改一个未被动画的属性
- **THEN** 修改写入基础文档，不产生任何关键帧

### Requirement: 时间线更多操作菜单落到可撤销命令

编辑器 MUST 把时间线更多操作菜单发出的语义动作翻译成动画命令，使每一条菜单操作都进入撤销历史。
删除属性轨道 MUST 移除该轨道及其全部关键帧；删除某个对象的全部轨道 MUST 作为**一次**事务提交，
撤销一步即可整体恢复。在指定时间打点时，值 MUST 取该 Entity 在该时刻的当前值——与属性面板菱形
按钮同源，因而在已有关键帧的轨道上等于把当前姿态钉住，不会改变画面。

菜单 MUST NOT 提供在当前上下文无法执行的操作：不存在轨道的对象行 MUST NOT 提供删除轨道条目。

#### Scenario: 删除属性轨道可撤销

- **WHEN** 某 Entity 的位置轨道有两个关键帧，用户在该属性行的菜单中选择删除轨道
- **THEN** 该轨道连同两个关键帧一起从文档中移除
- **AND** 撤销一步后轨道与两个关键帧都恢复

#### Scenario: 删除对象全部动画只占一步撤销

- **WHEN** 某 Entity 同时有位置与不透明度两条轨道，用户在对象行菜单中选择删除该对象的全部动画
- **THEN** 两条轨道都被移除
- **AND** 撤销一步后两条轨道同时恢复

#### Scenario: 在光标时间打点钉住当前姿态

- **WHEN** 某位置轨道在 0 ms 与 300 ms 各有一个关键帧，用户在 150 ms 处的车道空白右键并选择打点
- **THEN** 150 ms 处新增一个关键帧，其值等于该 Entity 在 150 ms 的采样值
- **AND** 画面在该时刻不发生任何变化

### Requirement: 动画检查器

动画模式下当前选中的是动画本身，而不是某个对象轨道或属性轨道时，右侧属性区 MUST 显示该动画的
检查器，包含名称、时长、播放模式与播放控制绑定。修改任一字段 MUST 派发动画配置命令写入文档清单，
因此 MUST 可撤销。选中回某个对象或属性轨道，或退出动画模式时，属性区 MUST 恢复显示原有 Inspector。
仅仅切换到动画标签而没有选中动画 MUST NOT 改变属性区内容。

#### Scenario: 选中动画显示检查器

- **WHEN** 用户在时间线上点击动画本身
- **THEN** 右侧属性区显示该动画的名称、时长、播放模式与播放控制绑定

#### Scenario: 切换标签不改变属性区

- **WHEN** 用户切换到动画标签但没有选中任何动画
- **THEN** 右侧属性区继续显示切换前的 Inspector 内容

#### Scenario: 修改动画参数可撤销

- **WHEN** 用户在检查器中把播放模式从播放一次改为循环，然后撤销
- **THEN** 播放模式恢复为播放一次，时间线同步

#### Scenario: 选回对象轨道恢复原 Inspector

- **WHEN** 用户从动画切换到选中某个对象轨道
- **THEN** 属性区显示该 Entity 的 Inspector，动画检查器消失

### Requirement: 播放控制绑定编辑

动画检查器 MUST 复用属性面板既有的绑定入口与变量选择器来编辑播放控制绑定，MUST NOT 引入
第二套绑定交互。`playing` 目标 MUST 只接受布尔语义的页面导出候选，`currentTime` 目标
MUST 只接受数值语义的候选。绑定与解绑 MUST 写入文档清单的 `bindings` 并可撤销。
`currentTime` 已绑定时，`playing` 的绑定入口 MUST 禁用并说明脚本已接管时间轴的原因。

#### Scenario: 绑定播放到布尔导出

- **WHEN** 页面 setup 导出了一个布尔成员，用户在检查器的播放行点击绑定入口并选中它
- **THEN** 文档清单该动画的 `bindings.playing` 记录该导出引用
- **AND** 检查器的播放行显示为已绑定该变量

#### Scenario: 候选按语义过滤

- **WHEN** 用户为 `playing` 打开变量选择器，而页面同时导出了布尔与字符串成员
- **THEN** 选择器只列出布尔成员

#### Scenario: 绑定当前时间后播放绑定禁用

- **WHEN** 用户为 `currentTime` 绑定了一个数值导出
- **THEN** 播放行的绑定入口禁用，并说明时间轴已由脚本接管

#### Scenario: 解绑可撤销

- **WHEN** 用户解除播放绑定后撤销
- **THEN** 绑定恢复，检查器重新显示为已绑定

### Requirement: 页面 Setup JavaScript 智能编辑

Editor 在页面系统启用时 MUST 为页面菜单打开或名称匹配 `*.setup.js` 的可编辑资源
注入 Setup Script Intelligence Profile。该 Profile MUST 使用 Script Runtime 公共声明为
`ctx`、State、Computed 与 setup 返回对象提供类型，且 MUST NOT 改写用户脚本。

#### Scenario: 编辑标准 Setup 导出

- **WHEN** 用户编辑 `export function setup(ctx)` 或受支持的等价直接导出
- **THEN** `ctx.` 补全 `state`、`computed` 和 `effect`，State `.value` 保留初始值类型
- **AND** 每个 Context 方法的补全详情与悬浮内容包含中文用途说明、关键生命周期语义和可用示例
- **AND** 示例使用 Markdown JavaScript fenced code block，并按当前 Monaco 主题进行语法着色
- **AND** Monaco 不在代码行内显示变量或 setup 返回对象的推导类型

#### Scenario: 类型错误不阻断保存

- **WHEN** 页面 Setup 脚本向数字 State 的 `.value` 写入字符串
- **THEN** Monaco 在可见源码的对应位置显示类型 diagnostic
- **AND** 用户仍可保存，Provider 收到的内容不包含隐藏声明或 JSDoc

#### Scenario: 非标准 Setup 声明降级

- **WHEN** Setup 脚本不使用 Editor 能够识别的直接导出形式
- **THEN** 编辑器保留 JavaScript 着色、输入和保存能力并显示不阻断的提示
- **AND** Editor 不对原始资源执行自动迁移

### Requirement: 中央 Canvas Group 承载资源文档

默认 Editor 的中央 Canvas Group MUST 永远包含不可关闭的 Canvas panel，并可在同一 Group 创建临时、可关闭的
资源 document panel。资源 panel MUST 由 `provider.id + assetKey（缺失时 entry.id）` 唯一标识，重复打开同一
资源时 MUST 激活现有 panel 而非创建副本；panel MUST 使用 `renderer: 'always'` 以保留未保存 Monaco 草稿。
资源文档不参与 Dockview 拖放、浮动、布局持久化、ComposeDocument、History 或 Operation Log。

#### Scenario: 从默认资源浏览器打开资源

- **WHEN** 默认 Asset Browser 发出文件打开意图
- **THEN** Editor 在 Canvas Group 打开或激活对应资源 document panel
- **AND** Canvas panel 保持存在且不可关闭

#### Scenario: 关闭 dirty 资源文档或修改已打开资源

- **WHEN** 用户关闭 dirty 资源 tab，或重命名、移动、删除包含 dirty 已打开资源的条目
- **THEN** Editor 提供保存、放弃或取消决策，并只在保存成功或放弃后关闭资源 document
- **AND** 取消、保存失败或 revision conflict 不执行关闭或对应 Provider 操作

### Requirement: 场景下方工具分栏

系统 MUST 在现有 Scene Graph 外层面板中始终挂载子 Dockview：场景内容作为上方真实 Dockview
面板，基础组件作为下方真实 Dockview 面板。宿主提供 `history` 或显式提供 `historyPanel` 时，History
MUST 作为基础组件的同组真实标签加入；未提供时系统不得显示空 History 标签。基础组件 MUST 是下方
工具组的初始活动面板。

#### Scenario: 使用默认历史面板

- **WHEN** 宿主向 ComposeEditor 提供 HistoryNavigationController
- **THEN** 子 Dockview 下方工具组显示基础组件与 `@compose-ui/history` 的 HistoryPanel 标签
- **AND** 基础组件保持下方初始活动标签
- **AND** history 控制器驱动编辑器焦点范围内的撤销重做快捷键

#### Scenario: 覆盖历史面板

- **WHEN** 宿主显式提供 historyPanel，包括 null
- **THEN** History 标签使用该值完整覆盖默认 HistoryPanel
- **AND** 同时提供的 history 控制器仍然驱动编辑器快捷键

#### Scenario: 不启用历史

- **WHEN** 宿主没有提供 history 且没有显式提供 historyPanel
- **THEN** 子 Dockview 仍显示场景内容和下方基础组件
- **AND** 下方工具组不显示 History 标签，且编辑器不拦截历史快捷键

### Requirement: Dockview 场景工具布局

系统 MUST 使用 Dockview 原生垂直布局和 sash，默认按 60%/40% 分配场景与下方工具组高度，并保持
场景内容至少 160px、下方工具内容至少 120px。子 Dockview 布局状态 MUST 只存活于当前编辑器实例，
不得进入页面文档或持久化存储。

#### Scenario: 调整下方工具高度

- **WHEN** 用户拖动 Dockview 原生 sash
- **THEN** 场景内容和下方工具组按约束调整高度
- **AND** 两侧内容保持挂载并可继续操作

#### Scenario: 编辑器内容更新

- **WHEN** 宿主更新场景、基础组件、历史控制器或其他插槽
- **THEN** 子 Dockview 面板显示最新内容
- **AND** 用户调整后的子 Dockview 布局和外层 Dockview 布局不被重建

### Requirement: 框选工具与判定模式菜单

默认舞台工具栏 MUST 在交互工具分组内提供框选工具入口：主按钮切换到 marquee 工具，紧邻的
chevron 触发器打开判定模式菜单。模式菜单 MUST 提供相交、包含与方向决定三项，且 MUST 复用现有
形状工具 split button 的 ARIA 与键盘结构——触发器使用 `aria-haspopup="menu"` 与
`aria-expanded`，菜单项使用 `menuitemradio` 并通过 `aria-pressed` 表达当前模式，方向键在菜单项
之间移动焦点，Escape 关闭菜单并把焦点还给触发器。模式 MUST 由编辑器持有并作为受控值传给
Stage，选择模式本身 MUST NOT 切换当前工具，也 MUST NOT 产生文档事务。主按钮图标 MUST 反映当前
模式，使用户不展开菜单也能看出生效判定。

#### Scenario: 切换到框选工具

- **WHEN** 用户点击框选主按钮
- **THEN** Stage 工具变为 marquee 且按钮呈现选中态
- **AND** 当前判定模式保持不变

#### Scenario: 从菜单切换判定模式

- **WHEN** 用户展开模式菜单并选择包含
- **THEN** Stage 收到的受控模式变为包含
- **AND** 菜单关闭、焦点回到触发器、当前工具保持不变
- **AND** 主按钮图标切换为包含模式图标

#### Scenario: 键盘操作模式菜单

- **WHEN** 焦点位于 chevron 触发器且用户按下方向键下
- **THEN** 菜单展开并把焦点移到第一项
- **AND** 按 Escape 关闭菜单并把焦点还给触发器

#### Scenario: 模式在选择工具下同样生效

- **WHEN** 判定模式为包含且用户切回 select 工具从空白拖出 marquee
- **THEN** 框选按包含判定命中节点

### Requirement: 组件实例合成 Inspector 表面

默认 Editor 在选中页面上的 component-instance（未下钻内部实体）时 MUST 将宿主身份相关字段与组件根视觉/布局字段合成到同一个 Entity Inspector 外壳中：共享唯一标题区（若有）、唯一 Property Panel 搜索/筛选/设置与列宽状态。MUST NOT 纵向堆叠两个完整 Entity Inspector 或两套属性工具栏。宿主侧 MUST 提供名称及页面级位置相关编辑；MUST NOT 在宿主侧再暴露应以组件根为事实源的外观、裁剪、几何限制、Hierarchy/Layout（容器与 Auto Layout）分组。根侧字段 MUST 经实例覆盖通路写入，MUST NOT 修改组件源文档；根侧 MUST 隐藏与宿主重复的名称、Transform、LayoutItem、可见性与锁定。下钻选中内部实体时，Inspector MUST 仅显示该内部实体，不再拼接宿主表面。

#### Scenario: 选中实例只有一个属性搜索框

- **WHEN** 用户在页面上单击选中一个 component-instance
- **THEN** 右侧 Inspector 只存在一个属性搜索框与一套筛选/显示设置
- **AND** 名称输入只出现一次

#### Scenario: 根外观与布局可编辑且写入覆盖

- **WHEN** 用户选中实例并修改组件根的外观或 Auto Layout 相关属性
- **THEN** 变更经实例覆盖通路提交，组件源 Asset 不被修改
- **AND** 同一面板内可见布局/外观分组，而非第二块独立「Container」属性面板外壳

#### Scenario: 下钻后不再拼接宿主表面

- **WHEN** 用户下钻选中实例内部实体
- **THEN** Inspector 只显示该内部实体的属性
- **AND** 不继续拼接宿主 identity 与根表面双段外壳

#### Scenario: 自定义 inspector 插槽仍可全量替换

- **WHEN** 宿主通过 editor slots 提供完整 inspector 内容
- **THEN** 默认合成逻辑不强制插入第二套面板
- **AND** 未提供 slots 时默认路径满足本需求

### Requirement: 实例与组件文档的标题语义

默认 Editor 在选中页面 component-instance 时，属性区标题语义 MUST 标明「实例」。打开主组件文档
会话时 MUST 标明「主组件」；打开变体会话时 MUST 标明「变体」并展示基于父源。实例头栏的「创建变体」
MUST 为显式动作，文案 MUST 说明将另存为组件库资源（而非复制页面节点）。

#### Scenario: 选中实例显示实例语义

- **WHEN** 用户在页面上选中 component-instance
- **THEN** 属性头或等价区域出现实例语义（如「实例 · …」）
- **AND** 提供创建变体入口且不与复制实例混淆

#### Scenario: 打开变体文档显示基于父源

- **WHEN** 用户打开 kind 为 variant 的组件文档
- **THEN** UI 标明变体并展示基于父源的显示名

### Requirement: 资源拖入画布仅实例化

从 Asset Browser 或等价资源入口将组件媒体类型拖入 Stage 时，系统 MUST 创建 component-instance
实例并绑定该资源引用，MUST NOT 因此自动创建新的变体资源文件。

#### Scenario: 资源拖入创建实例

- **WHEN** 用户将已有主组件或变体资源拖入画布并成功落点
- **THEN** 文档中新增实例实体引用该资源
- **AND** Provider 中组件文件数量不因该次拖入而增加变体文件

### Requirement: 画布与场景树共享会话剪贴板

默认编辑器 MUST 让 Stage 与 SceneTree 共用同一份会话内存剪贴板。任一表面的复制或剪切 MUST
立即可被另一表面粘贴。粘贴 MUST 使用建议落点，并由现有场景树操作规划器生成文档事务。该剪贴板
MUST NOT 写入系统剪贴板、ComposeDocument 或 History 条目本身。

#### Scenario: 场景树复制后在画布粘贴

- **WHEN** 用户在场景树复制一个节点，再聚焦画布并执行粘贴
- **THEN** 文档插入该节点的新副本并选中副本
- **AND** 只产生一次文档事务

#### Scenario: 画布剪切后在场景树粘贴

- **WHEN** 用户在画布剪切一个节点，再于场景树有效位置粘贴
- **THEN** 该节点被移动到建议落点
- **AND** 剪贴板被清空

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

### Requirement: 设计与动画模式切换器

页面文档的画布工具栏行 MUST 在保存入口旁提供「设计 / 动画」模式切换器，作为动画模式的
唯一入口；底部工具组 MUST NOT 再默认包含动画标签。切到动画模式时，编辑器 MUST 在底部
Dockview 工具组中动态加入并激活时间线面板，并展开底部组；切回设计模式时 MUST 移除时间线
面板、恢复 资源/命令/日志 标签与切换前的折叠状态。切换器 MUST 实现 radiogroup 可访问语义。
组件文档与未启用页面系统的宿主本期不提供动画模式入口。

#### Scenario: 底部工具组默认标签

- **WHEN** Dockview 工作区完成初始化
- **THEN** 底部工具组只包含 资源、命令 与 Transaction Log 标签，不包含动画标签

#### Scenario: 切换到动画模式

- **WHEN** 用户在页面文档工具栏把模式切换到「动画」
- **THEN** 底部工具组加入并激活时间线面板，且底部组展开
- **AND** 编辑器进入动画模式

#### Scenario: 切回设计模式恢复布局

- **WHEN** 用户在动画模式下把模式切换回「设计」，且进入动画模式前底部组处于折叠状态
- **THEN** 时间线面板从底部工具组移除，资源标签恢复活动
- **AND** 底部组恢复折叠状态，编辑器退出动画模式

#### Scenario: 点击其它底部标签退出动画模式

- **WHEN** 动画模式下用户激活底部工具组的资源、命令或 Transaction Log 标签
- **THEN** 编辑器退出动画模式，时间线面板被移除，模式切换器同步显示「设计」

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

### Requirement: 运动路径以物体中心为锚

动画模式下选中实体的运动路径 MUST 以物体中心为世界坐标锚点：路径折线、顶点与切线手柄
穿过物体当前采样尺寸的中心而不是左上角。路径几何与手势换算 MUST 共用同一原点，顶点
拖拽写回的仍是 `LayoutItem.offset` 语义的关键帧值，编辑语义不因锚点改变。

#### Scenario: 路径穿过物体中心

- **WHEN** 一个 200×100 的实体在两个位置关键帧之间显示运动路径
- **THEN** 路径端点位于该实体两个关键帧位置的中心（左上角 + 半宽半高）

#### Scenario: 拖拽顶点写回 offset 值

- **WHEN** 用户把一个路径顶点拖到新的世界位置
- **THEN** 写回的关键帧值等于该世界位置减去「父容器角点 + 半尺寸」原点，画布上物体
  中心跟随到指针位置

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

