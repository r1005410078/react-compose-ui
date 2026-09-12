# editor-workspace-layout Specification

## Purpose

定义 `@compose-ui/editor` 基于 Dockview 的固定四区工作区、六份 React 内容来源、样式加载契约、宿主属性透传以及仅存活于组件实例的临时布局行为。
## Requirements
### Requirement: 边缘工具区

系统 MUST 在同一个 Dockview 实例里承载左、右、底三个边缘区：左侧是场景图与工具组上下分栏的
两个普通组，右侧是承载 Component Inspector 的普通组，底部是原生 Edge Group，承载资源、Command
与 Transaction Log。**左右 MUST NOT 是 Edge Group**：Dockview 的边缘组包着中间那一列而底部边缘组
住在那一列里，左右做成边缘组会把底部夹在中间。底部 Edge Group MUST 横跨整个编辑器宽度，与两侧
折叠 / 展开状态无关。

两侧 MUST NOT 渲染竖向图标轨。**折叠入口 MUST 只有应用顶栏右端的布局开关一处**：组头上
MUST NOT 再有折叠按钮，编辑器边缘 MUST NOT 再留把手。收起 MUST 把那一侧的组整个藏掉（左侧两个
组一起），展开 MUST 恢复收起前的尺寸且内容 MUST NOT 重新挂载。画布组 MUST 隐藏组头（它只有一个
面板）——画布列的头由文档标签条承担，见「文档标签条」。底部 Edge Group 折叠后 MUST 只剩它的
标签条。

#### Scenario: 检查默认边缘区

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 与 `getEdgeGroup('right')` 都为空；场景图与工具组是左侧上下
  分栏的两个普通组，Component 面板是右侧的普通组
- **AND** `getEdgeGroup('bottom')` 返回同时包含资源、命令与 Transaction Log 的组

#### Scenario: 组头上没有折叠按钮

- **WHEN** 用户查看场景图组头与属性组头
- **THEN** 两个头上都没有折叠按钮
- **AND** 编辑器左右边缘没有把手

#### Scenario: 收起再展开

- **WHEN** 用户点击应用顶栏右端的右栏开关，再点一次
- **THEN** 属性面板连头一起收起，再展开时恢复收起前的尺寸
- **AND** 面板内容不重新挂载

#### Scenario: 左栏一起收起

- **WHEN** 用户点击左栏开关
- **THEN** 场景图与工具组一起收起

#### Scenario: 底部工具区不受两侧折叠影响

- **WHEN** 用户折叠或展开左右任意一个或两个 Edge Group
- **THEN** 底部 Edge Group 的宽度与横向位置保持不变
- **AND** 底部工具区内容不重新挂载

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

设置入口 MUST 是**应用菜单里的一项**（见「应用标志与应用菜单」）；应用顶栏与文档标签条上
MUST NOT 再有独立的设置齿轮按钮。设置 MUST 仍可从 `editor.settings` 动作与它的键位执行——
菜单 MUST NOT 成为它的唯一入口。

设置模态 MUST 使用 `@compose-ui/components` 的 ComposeDialog，通过全视口 Portal 覆盖当前浏览器
窗口；它 MUST NOT 成为 Dockview 面板，也 MUST NOT 被任一组、画布或宿主 Editor root 的尺寸、
overflow 或 stacking context 裁剪。设置模态 MUST NOT 改变 Dockview 布局或活动面板。

#### Scenario: 从应用菜单打开设置

- **WHEN** 用户点开顶栏最左的标志菜单并选择「设置」
- **THEN** 全视口遮罩上显示居中的设置弹框，且弹框内容使用 Compose Theme/I18n
- **AND** 当前各组、画布与其他面板保持挂载和原尺寸

#### Scenario: 顶栏上没有齿轮

- **WHEN** 用户查看应用顶栏
- **THEN** 右端只有三个布局开关，没有设置按钮

#### Scenario: 更新设置期间保持布局

- **WHEN** 用户切换主题、语言或修改快捷键
- **THEN** Dockview group 和 panel 实例不被重建
- **AND** 用户已调整的尺寸、折叠状态与活动标签保持不变

### Requirement: 工作区主题 token

共享 UI Context 样式入口 MUST 定义可继承的 dark 与 light 工作区 token，并让 Editor、Stage、
SceneTree、History、CommandPanel、PropertyPanel、OperationLog 与基础材料 Inspector 的默认
surface、border、text、hover、selected、focus 和 scrollbar 使用这些 token。Dark MUST 保持
既有视觉层级，editor 不得依赖逐包浅色祖先覆盖。

`workspaceBackground` 与 `panelBackground` 在**两种主题下都 MUST 是不同的值**：前者是卡片
下面那张桌面，后者是卡片自己的底，同值时卡片浮在同色底上、只剩边框在说话。深色主题的桌面
MUST 比面板更暗。本次 MUST 只改桌面这一个值——`panelBackground`、`surfaceRaised` 与
`surfaceSunken` MUST 保持既有取值，既有的每一处对比度因此不需要重新验算。

#### Scenario: 显示浅色默认工作区

- **WHEN** ComposeEditor 解析主题为 light 并使用全部默认面板
- **THEN** 所有工作区区域使用完整浅色层级且文本、选中态与焦点态清晰可辨
- **AND** 不出现只适合深色背景的孤立内建区域或浏览器默认滚动条

#### Scenario: 桌面色与面板色可分

- **WHEN** 解析主题为 dark 或 light
- **THEN** `--compose-workspace-bg` 与 `--compose-panel-bg` 的计算值不相等
- **AND** dark 下桌面色比面板色更暗

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
assetResolver 或默认 Provider resolver 经 `services` 注入 Stage；显式 resolver 优先。

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

两个内建工作区 MUST 各有自己的默认货架，MUST NOT 共用一条：

- **页面**：选择、变换指示器、分割线、吸附、网格及其大小菜单、分割线、容器绘制、文字绘制、
  分割线、`RECTANGLE`、`ARROW`。
- **绘图**：选择、变换指示器、分割线、吸附、正交、极轴及其增量角菜单、网格及其大小菜单、
  分割线、`LINE`、`PLINE`、`RECTANGLE`、`POLYGON`、`CIRCLE`、`ARC`、`ARROW`、`WIRE`、
  分割线、文字绘制。

绘图命令 MUST 各有一个按钮，按下 MUST 启动与在命令行敲下该名字**完全相同**的会话。某个工作区
的货架不含某条命令时，该命令 MUST 仍可从命令行、快捷键与命令面板启动——货架收走的是入口，
MUST NOT 是能力。

**形状 split button MUST NOT 存在**，`draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值
MUST 一并删除。选择 MUST 是一个普通按钮，MUST NOT 带判定模式菜单。框选、精确移动与移动画布
三个工具位 MUST NOT 出现。

绘图命令按钮的按下态 MUST 来自 Stage 上报的**当前会话命令 id**，MUST NOT 由工具栏自己记
「刚点了哪个」。

「设计 / 动画」模式切换器与保存按钮住在文档标签条右端，MUST NOT 属于货架。宽度不足以放下
整条货架时，MUST 按顺序从尾部把放不下的按钮收进一个「更多」菜单，MUST NOT 裁掉。

button 常态 MUST 不具有逐项 Card、边框或胶囊背景；当前工具与 hover/focus 可以使用低调状态底色，
工具类别 MUST 使用细分割线分组。默认 toolbar MUST 不渲染 zoom、fit 或单独 canvas settings
图标；宿主 `stageToolbar` slot 不受影响。

#### Scenario: 渲染默认工具栏

- **WHEN** 未提供 `stageToolbar` slot 的 `ComposeEditor` 在未自定义的工作区里渲染
- **THEN** toolbar 按规定顺序显示全部工具、绘图命令组与网格 menu trigger
- **AND** 缩放与居中视图只出现在画布内控件组

#### Scenario: 两个内建工作区默认货架不同

- **WHEN** 用户在页面与绘图之间切换且两者都未自定义过工具栏
- **THEN** 页面的工具栏没有 `LINE` / `PLINE` / `POLYGON` / `CIRCLE` / `ARC` / `WIRE` 与正交 /
  极轴，绘图的有
- **AND** 绘图的工具栏没有容器绘制，页面的有

#### Scenario: 页面里被收走的命令仍可用

- **WHEN** 用户在页面工作区里敲 `CIRCLE`，或在图面上按下 `C`
- **THEN** 两条路都启动同一条命令会话，与在绘图工作区里逐字相同

#### Scenario: 绘图里被收走的工具仍可用

- **WHEN** 用户在绘图工作区（默认货架不含容器）打开命令面板并检索「容器工具」
- **THEN** 该动作列出且可执行，快捷键同样仍可用

#### Scenario: 窄窗口收进更多

- **WHEN** 工具栏行的宽度放不下整条货架
- **THEN** 尾部放不下的按钮进入「更多」菜单，菜单里的每一项与原按钮同名同图标
- **AND** 「设计 / 动画」与保存仍在文档标签条右端可见

#### Scenario: 按钮启动命令会话

- **WHEN** 用户点击绘图命令组里的 `RECTANGLE` 按钮
- **THEN** 命令行进入与敲 `RECTANGLE` 后完全一致的提示状态
- **AND** 该按钮呈按下态

#### Scenario: 取消命令后按钮不再按下

- **WHEN** 上述会话中按下 `Escape`
- **THEN** 该按钮不再呈按下态

#### Scenario: 使用网格菜单

- **WHEN** 用户打开网格的 chevron menu
- **THEN** menu 具有 menu-button ARIA、键盘导航、Escape 关闭和焦点恢复
- **AND** 网格菜单能切换会话级可见性、选择 4/8/16/32 等网格间距或进入更多画布设置

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

Editor MUST 以独立 TransactionRuntime 打开 Base 或 Variant，提供 dirty、保存、关闭确认、revision
冲突和活动会话回调。Base 可以定义稳定暴露属性；Variant 继承定义并在保存时从直接父快照生成稳定操作。
场景实例内部 MUST 不进入结构编辑树。

打开入口 MUST 包含组件目录、资源目录，以及页面场景树上组件实例行的进入控件，且三条入口 MUST
复用同一份按 assetKey 去重的会话。三条入口的**呈现**按意图分流：从组件目录或资源目录打开的
MUST 呈现为文档标签（打开一份文件来编辑），从场景树进入的 MUST 呈现为来路那份文档之上的一层
（当前画布的一次导航）。同一份会话 MUST NOT 同时以两种方式呈现。

#### Scenario: 独立编辑 Base

- **WHEN** 用户双击组件目录或资源目录中的 Base
- **THEN** Editor 打开独立 Runtime 的文档标签，允许结构编辑、暴露属性、保存与冲突处理

#### Scenario: 独立编辑 Variant

- **WHEN** 用户打开 Variant 并修改字段或结构
- **THEN** 编辑器显示 resolved document，保存时只持久化相对直接父源的规范操作和新快照

#### Scenario: 从实例创建 Variant

- **WHEN** 用户从带 propertyOverrides 的场景实例创建 Variant
- **THEN** 新 Variant 直接引用该实例来源并把属性覆盖转换为字段操作

#### Scenario: 从场景树实例行打开

- **WHEN** 用户在页面场景树上对组件实例行执行进入
- **THEN** Editor 得到的会话与从组件目录打开得到的是同一份
- **AND** 它呈现为当前文档之上的一层，不产生文档标签

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

动画编辑开关开启时编辑器 MUST 进入动画模式，关闭时 MUST 退出；开关的入口与退出规则由
「动画编辑开关」承载。动画模式 MUST 以**当前作用域 Frame** 为界：时间线显示该 Frame
`Animations` 清单中的动画，属性面板打点只作用于该 Frame 内的 Entity。作用域 Frame MUST 解析为
「选中对象所属的最近祖先 Frame」，没有任何选择时 MUST 回退到页面的 `activeFrameId`——与
`多画板下的 Frame 动作目标` 同一条规则，因此「哪一块会被发布」与「正在编辑哪一块的动画」可以
不同。时间线、动画文件选择器、镜像水合、自动记录与关键帧 Inspector MUST 全部解析到同一个
Frame，MUST NOT 各自解析。作用域 Frame MUST 在时间线上具名可见，使跳转可被察觉。
组件文档 MUST 同样支持动画模式，作用域为组件的根 Frame。动画模式下画布、属性面板与预览 MUST
显示当前播放头时刻的采样文档，而所有编辑命令 MUST 仍然派发到基础文档。播放头、播放状态、
自动记录开关与动画选择 MUST 是编辑器会话状态，MUST NOT 写入文档或撤销历史。

动画模式下画布拖拽 MUST 以锁定原父级运行（Editor 向 Stage 传入 `lockGestureParent`）：
move 手势 MUST NOT 产生跨父级 reparent 落点与结构命令——动画模式的拖拽表达姿态编辑，
自动记录开启时写入播放头处的关键帧、关闭时写入基础 offset，对象 MUST 始终留在其所属
场景内。退出动画模式后跨父级拖拽 MUST 恢复既有行为。

#### Scenario: 进入与退出动画模式

- **WHEN** 用户按下时间线上的动画编辑开关
- **THEN** 编辑器进入动画模式，画布显示当前作用域 Frame 的采样文档
- **WHEN** 用户再按一次开关
- **THEN** 编辑器退出动画模式，画布恢复显示基础文档

#### Scenario: 组件文档的动画模式

- **WHEN** 用户在组件文档下开启动画编辑
- **THEN** 时间线显示组件根 Frame 的动画，打点写入该组件文档
- **AND** 宿主页面文档不发生任何变化

#### Scenario: 切换活动 Frame 更新时间线

- **WHEN** 用户在多画板文档中把活动 Frame 从 A 切换到 B
- **THEN** 时间线切换为 B 的动画清单，播放头重置为 B 的会话状态

#### Scenario: 选中另一块场景内的对象切换作用域

- **WHEN** 激活场景是 A，用户选中场景 B 里的一个 Entity
- **THEN** 时间线切换为 B 的动画清单，打点写入 B
- **AND** 页面的 `activeFrameId` 不发生变化

#### Scenario: 清空选择回退到激活场景

- **WHEN** 用户在场景 B 中打点后清空选择
- **THEN** 时间线回到激活场景 A 的动画清单

#### Scenario: 动画模式拖拽不跨场景挂载

- **WHEN** 在动画模式下，用户拖动场景 B 内的对象且落点越过 B 的边界或进入场景 A
- **THEN** 对象仍属场景 B，不产生任何 reparent 或 moveEntity 命令
- **AND** 自动记录开启时该拖拽在播放头处写入 B 场景动画的关键帧，场景 A 的动画不变

#### Scenario: 播放头驱动画布

- **WHEN** 动画中某 Entity 的位置在 0 ms 与 300 ms 各有一个关键帧，用户把播放头拖到 150 ms
- **THEN** 画布中该 Entity 显示在两个关键帧之间的插值位置
- **AND** 文档与撤销历史不发生任何变化

#### Scenario: 播放不产生事务

- **WHEN** 用户播放整条动画
- **THEN** 撤销历史中不新增任何条目

### Requirement: 空动画的创建引导

当前活动 Frame 还没有绑定动画时，时间线 MUST 显示空状态而不是演示数据，并提供一个本地化的
创建入口。创建 MUST 按文档类型分流：

- **页面文档**：为该 Frame 生成**独立的**动画文件资产（命名取「页面名-场景名」，同名冲突
  追加序号）、写入该 Frame 的 `Animations.source` 并把清单水合进 `Animations.items` 会话
  镜像；MUST NOT 复用页面上其他场景已绑定的文件引用。
- **组件文档**：MUST NOT 创建任何动画文件，直接把清单写进组件根的 `Animations.items`，
  且 MUST NOT 写入 `Animations.source`。

文件创建是资源写入，不进入撤销历史；引用写入与镜像水合 MUST 是可撤销事务。Frame 已绑定动画
但会话镜像缺失（如撤销越过水合事务）时，空状态 MUST 改为提供「载入绑定动画」入口，只重新
派发水合事务而不重复创建文件；该入口只对有 `source` 的 Frame 出现，因此在组件文档下不出现。
创建或载入完成后 MUST 自动选中该动画、开启动画编辑，时间线切换到正常状态；已绑定动画即使
没有任何轨道也 MUST 显示正常时间线而非创建引导。空状态 MUST NOT 显示播放控件、标尺以外的
关键帧交互或任何占位轨道。

#### Scenario: 初始页面的时间线

- **WHEN** 用户在一个活动 Frame 没有绑定动画的页面上切到动画工作区
- **THEN** 时间线显示空状态与创建入口，不显示任何演示轨道
- **AND** 属性面板不显示动画检查器，动画编辑开关未按下

#### Scenario: 创建第一条动画

- **WHEN** 用户在空状态下触发创建
- **THEN** 页面同目录新增动画文件资产，该 Frame 的 `Animations.source` 写入其稳定引用
- **AND** `Animations.items` 新增该动画清单，时间线退出空状态并选中它，动画编辑开关按下

#### Scenario: 组件文档创建动画不落文件

- **WHEN** 用户在组件文档的空状态下触发创建
- **THEN** 资源目录不新增任何动画文件，组件根的 `Animations.source` 仍然缺席
- **AND** 组件根的 `Animations.items` 新增该清单，时间线退出空状态并选中它

#### Scenario: 第二块场景创建得到独立文件

- **WHEN** 场景 A 已绑定动画文件，用户在场景 B 的空状态下触发创建
- **THEN** 页面同目录新增一份属于 B 的动画文件，B 的 `Animations.source` 指向它
- **AND** A 绑定的文件不新增 B 的分区

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

这条语义 MUST 由**属性面板自己的标签**承载，MUST NOT 再额外占一条主体标题行：标签 MUST 是
`属性 · <对象>` 的形式，并 MUST 在文字左侧常驻一个不随选区改变的属性面板图标——变的是文字，
不变的是图标与位置，否则跟着选区变的标签会让用户以为面板被换掉了。

#### Scenario: 选中实例显示实例语义

- **WHEN** 用户在页面上选中 component-instance
- **THEN** 属性面板的标签出现实例语义（如「属性 · 实例」）
- **AND** 提供创建变体入口且不与复制实例混淆

#### Scenario: 标签跟随选区但图标不动

- **WHEN** 用户从矩形改选一个容器
- **THEN** 属性面板标签的文字随之改变
- **AND** 标签左侧的图标与标签位置保持不变

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
已成为独立作用域边界。「新建场景」MUST 同时可以由空间化操作触发：在所有场景之外新建一个
容器等价于新建场景。全部隐含升格入口 MUST 复用 core 的升格纯函数，MUST NOT 各自内联实现。

#### Scenario: 创建组件时隐含升格

- **WHEN** 用户对一个普通 Container 执行“从选择创建项目组件”
- **THEN** 该 Container 获得 `Frame` Component 且 id 与子级保持不变
- **AND** 升格与创建组件在同一个事务中，可一次撤销

#### Scenario: 不提供裸升格命令

- **WHEN** 用户在场景树或画布上右键一个普通 Container
- **THEN** 菜单中不出现独立的“升格为 Frame”项

#### Scenario: 在场景外新建容器即新建场景

- **WHEN** 用户在所有场景之外新建一个容器
- **THEN** 该容器直接以场景形态出现在 `rootIds` 中，而不是成为某块既有场景的子级
- **AND** 用户不需要先创建容器再执行任何额外的升格命令

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

### Requirement: 画布动画绑定属性

活动页面的**页面配置面板** MUST 在「页面脚本」分组下方显示「动画」分组：它 MUST 是
共享 Property Panel Root 中的一个 Section，MUST NOT 引入第二个属性工具栏、独立分组 chrome
或嵌套的独立属性面板。该分组 MUST 按文档 `rootIds` 顺序为**每一块根场景**显示一个动画
绑定行：行标签是场景名，行内容是该 Frame 的动画绑定，MUST NOT 只显示激活场景或当前
作用域场景的单一行。激活场景所在行 MUST 有可辨识的标注；当前动画作用域场景与激活场景
不同时，作用域行 MUST 同样可辨识——「哪一块会被发布」与「正在编辑哪一块的动画」可以
不同，本分组负责让这件事可见。每行的文件引用与会话镜像 MUST 解析到该行自己的 Frame，
MUST NOT 一行取 A 场景、另一侧取 B 场景。

未绑定的行列出页面同目录中拥有稳定 assetKey 的动画文件供绑定，并在可写 Provider 上提供
快捷创建入口：创建 MUST 生成以「页面名-场景名」命名的动画文件资产并绑定到该行的场景，
MUST NOT 复用页面上其他场景已绑定的文件引用；同名冲突 MUST 追加序号重试而不是覆盖。
已绑定的行 MUST 显示当前动画文件名称，支持更换与取消关联，并以属性面板既有的绑定入口
提供该场景动画的播放控制变量绑定编辑，复用页面 setup 返回作用域的成员作为绑定候选。

绑定引用保存在该 Frame `Animations.source` 上：关联、更换与取消关联 MUST 通过
`animation.source.set` 文档命令写入，是可撤销事务；动画文件资产的创建是资源写入，
MUST NOT 进入撤销历史。取消关联 MUST NOT 删除动画文件资源。多块场景指向同一份文件
（既有共享文件页面）MUST 仍被如实显示并可逐行独立解绑。

#### Scenario: 逐场景列出绑定行

- **WHEN** 活动页面有场景 A、B、C，其中 A 绑定了动画文件而 B、C 未绑定，用户点击空白工作区
- **THEN** 动画分组按 `rootIds` 顺序显示三行，A 行显示其文件名称，B、C 行显示绑定与创建入口
- **AND** 激活场景所在行带有可辨识的标注

#### Scenario: 为第二块场景创建独立文件

- **WHEN** 场景 A 已绑定「Home-主屏.animation.json」，用户在场景 B 的行上触发快捷创建
- **THEN** 页面同目录新增以页面名与 B 场景名命名的新动画文件并绑定到 B
- **AND** A 的绑定与文件内容不受影响

#### Scenario: 已绑定行编辑变量绑定

- **WHEN** 某场景行绑定了动画且页面 setup 返回作用域可用
- **THEN** 该行显示当前动画文件名称与取消关联操作
- **AND** 播放控制变量绑定的编辑派发可撤销的动画配置命令

#### Scenario: 取消关联不删除资源

- **WHEN** 用户在某场景行取消当前的动画绑定
- **THEN** 该 Frame 的 `Animations.source` 被清空，动画文件仍由 Asset Provider 保留
- **AND** 该场景会话镜像中的动画清单被移除，其余场景行不受影响

#### Scenario: 共享文件页面如实显示

- **WHEN** 打开一个两块场景绑定同一份动画文件的既有页面
- **THEN** 两行显示同一个文件名称，各自可独立更换或解绑
- **AND** 解绑其中一行不改变另一行的绑定

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

### Requirement: 场景树根级落点

场景树的“根级”就是场景所在的那一层。在根级新建容器 MUST 得到一块新场景，其摆位 MUST 与
命令面板的「新建场景」一致。把已经是场景的 Entity 拖动或复制到根级 MUST 让它留在根级，
MUST NOT 塞进某块既有场景——否则在树里既无法给场景排序，也无法复制出一块平级的场景。
把非场景 Entity 落到根级时 MUST 解析为一块既有场景。

#### Scenario: 场景树根级新建容器

- **WHEN** 用户在场景树的根级新建一个容器
- **THEN** 场景树根层多出一块场景，与既有场景平级，摆在既有场景右侧

#### Scenario: 在场景树里给场景排序

- **WHEN** 用户把第二块场景拖到根级第一位
- **THEN** 它仍然是一块根场景，只是顺序变了，而不是成为第一块场景的子级

#### Scenario: 复制场景得到平级场景

- **WHEN** 用户在场景树里复制一块场景
- **THEN** 副本是一块与它平级的根场景

### Requirement: 场景与容器同图标

场景树、拖拽预览与其余按 `Composition.presetId` 取图标的位置 MUST 为场景与容器呈现同一个
图标——场景就是放在顶层的容器。Registry MUST 注册与场景 `presetId` 对应的 Preset，使这些
位置 MUST NOT 掉到通用兜底图标。可访问名称 MUST 仍然区分场景与容器。

#### Scenario: 场景行与容器行图标一致

- **WHEN** 场景树同时显示一块场景与一个普通容器
- **THEN** 两行使用同一个图标
- **AND** 两行的可访问名称仍分别表述为场景与容器

### Requirement: 多场景动画会话

页面会话 MUST 按 Frame 分桶跟踪动画状态：绑定引用、已载入的文件条目、文件 revision 与镜像
清单 MUST 各自归属于所属 Frame，MUST NOT 用单一标量把整页固定到一块场景上。不同 Frame
MAY 绑定不同的动画文件，也 MAY 指向同一份（既有共享文件页面）。打开页面时系统 MUST 按
assetKey 去重读取每份被引用的动画文件，并把各 Frame 的分区一次性水合进对应镜像；某份
文件加载失败 MUST 只降级它涉及的场景并保留页面内嵌镜像。保存页面时 MUST 把各 Frame
镜像的变化**按其绑定的文件聚合**回写：同一份文件只写一次，不同文件各自写入；某份文件
写入失败或冲突 MUST 向用户显式报告，MUST NOT 阻止页面本体与其他文件的保存。为某个
Frame 绑定或解除动画文件 MUST 只影响该 Frame。

#### Scenario: 两块场景各自建动画

- **WHEN** 用户先在场景 A 创建动画并打点，再切到场景 B 创建动画并打点
- **THEN** 两条动画分别出现在各自 Frame 的清单里，互不覆盖
- **AND** 保存后重新打开页面，两块场景的动画都仍在

#### Scenario: 独立文件各自回写

- **WHEN** 场景 A 与 B 绑定不同的动画文件，用户改动两边的动画时长后保存页面
- **THEN** 两份文件各自被写入一次，各自只包含所属场景的分区变化

#### Scenario: 共享文件合并回写

- **WHEN** 两块场景绑定同一份动画文件，用户改动两边的动画时长后保存页面
- **THEN** 两处改动都写进同一份动画文件的各自分区，该文件只被写入一次

#### Scenario: 单份文件写入失败不阻塞其余保存

- **WHEN** 保存时场景 B 绑定的动画文件写入失败
- **THEN** 页面本体与场景 A 的动画文件正常保存
- **AND** 用户收到指明失败文件的显式提示

#### Scenario: 解除一块场景的绑定

- **WHEN** 用户解除场景 B 的动画绑定
- **THEN** 场景 A 的动画与时间线不受影响

### Requirement: 未保存场景的动画创建

为某块场景创建动画 MUST NOT 要求它已经出现在上次保存的页面文件里：刚画出来的场景
MUST 同样能创建动画。创建流程 MUST 先确认存在可绑定的作用域场景再落文件，使任何前置校验
失败都不会在资源目录里留下没有引用的孤儿动画文件。创建失败时 MUST 呈现可操作的原因，
MUST NOT 只留下一个毫无变化的空态面板。

#### Scenario: 给刚画出来的场景创建动画

- **WHEN** 用户画出第二块场景、选中其中的对象后点击「创建动画」，且页面尚未保存
- **THEN** 该场景获得自己的动画与时间线
- **AND** 页面的激活场景不发生变化

#### Scenario: 创建失败不留孤儿文件

- **WHEN** 创建动画因为没有可绑定的场景而失败
- **THEN** 资源目录中不出现新的动画文件

### Requirement: Editor Stage 属性显式组合

ComposeEditor MUST 通过显式属性组合把宿主覆盖合并到 controller 计算的 Stage 属性上，
MUST NOT 使用 `cloneElement` 向 Stage 元素克隆注入。覆盖优先级 MUST 由组合函数签名与类型
表达，MUST NOT 依赖注释约定。宿主直接渲染 `controller.stage` 元素的既有用法 MUST 保持可用。

编辑器模式（如动画模式）MUST 通过组装一个 `policy` 表达其画布语义，MUST NOT 以逐项条件
spread 平铺布尔的方式注入。

#### Scenario: 宿主覆盖优先于 controller 默认值

- **WHEN** controller 计算出的 Stage 属性与宿主覆盖同时提供 `assetResolver`
- **THEN** 生效值为宿主覆盖
- **AND** 该优先级由类型检查保证，而非运行时约定

#### Scenario: 动画模式组装 policy

- **WHEN** 编辑器进入动画模式
- **THEN** Stage 收到的 `policy.lockGestureParent` 为 true
- **AND** 退出动画模式后该项恢复缺省，画布跨父级挂载行为与既有一致

#### Scenario: 直接渲染 controller.stage

- **WHEN** 宿主不使用默认工作区而直接渲染 `controller.stage`
- **THEN** Stage 正常渲染并保持既有行为

### Requirement: 画布 Inspector 关键帧缓动编辑

动画模式下页面已绑定动画且时间线选中了某个关键帧时，画布 Inspector 的「动画」Section MUST 在
「当前时间」下方追加三行：标识所选关键帧的只读行（所属对象、属性与时间）、缓动预设行，以及
与属性行等宽的贴边曲线编辑区。这三行 MUST 与 Section 现有字段共用同一个属性面板 Root 的搜索、筛选与
列宽，MUST NOT 嵌套第二个属性面板 Root 或引入自带工具栏的外来面板。

未进入动画模式、页面未绑定动画、文档镜像缺失或时间线没有选中关键帧时，Section MUST NOT 渲染
这三行，其余字段保持不变。缓动编辑区 MUST 由 `@compose-ui/animation-panel` 的缓动曲线编辑器
提供，Editor MUST NOT 自行实现第二套曲线交互。

#### Scenario: 选中关键帧后出现缓动区

- **WHEN** 用户在动画模式下点击画布空白处，再在时间线上选中一个关键帧
- **THEN** 「动画」Section 在「当前时间」下方显示该关键帧的标识行、缓动预设行与曲线编辑区

#### Scenario: 取消选中后缓动区消失

- **WHEN** 用户在时间线上取消关键帧选中
- **THEN** 「动画」Section 只剩动画文件、播放与当前时间三行

#### Scenario: 未绑定动画时不显示缓动区

- **WHEN** 页面没有绑定动画文件
- **THEN** 「动画」Section 保持未绑定状态，不显示任何缓动字段

### Requirement: 关键帧缓动写入文档并可撤销

在画布 Inspector 修改所选关键帧的缓动 MUST 派发关键帧插值命令写入被动画 Entity 的轨道，因此
MUST 可撤销，并 MUST 立即反映到舞台采样与预览播放。一次连续的控制柄拖拽 MUST 通过共享
`mergeKey` 合成一条事务，撤销一步即回到拖拽前的插值。选择预设或提交控制点数值 MUST 各自产生
一条可独立撤销的事务。

轨道末帧的出向段不参与求值，但 MUST 照常可编辑，并 MUST 在缓动区显示一条常驻说明；编辑器
MUST NOT 因为它是末帧而丢弃已写入的插值。

#### Scenario: 选择预设可撤销

- **WHEN** 用户把某关键帧的缓动从 Linear 改为 Ease in and out，然后撤销
- **THEN** 该关键帧恢复为 Linear，缓动区与曲线同步回退

#### Scenario: 一次拖拽合并为一步撤销

- **WHEN** 用户连续拖动曲线控制柄经过多个中间位置后松手，然后撤销一次
- **THEN** 插值直接回到拖拽开始前的值，而不是回到某个中间位置

#### Scenario: 缓动改动影响采样

- **WHEN** 用户把 0 ms 关键帧的插值改为 `hold`，并把播放头移到该段中间
- **THEN** 舞台显示的仍是 0 ms 关键帧的值，预览播放同样按 `hold` 跳变

#### Scenario: 末帧可编辑并给出说明

- **WHEN** 用户选中某属性轨道的最后一个关键帧
- **THEN** 缓动区照常可编辑，并显示该帧出向段当前不参与求值的说明

### Requirement: 首次进入的激活场景取景

编辑器 controller MUST 把「首次布局就绪时适配激活场景」透传给 Stage，并 MUST 默认开启：
固定初始视口在任何真实场景尺寸下都不是可用的取景。宿主 MUST 能通过 controller 选项关闭它，
关闭时 `initialViewport` 就是用户进入后看到的取景。

该适配 MUST NOT 进入文档、事务历史或操作日志——视口始终是会话状态。

#### Scenario: 默认进入即适配

- **WHEN** 宿主以默认选项创建 controller 并打开一个含 1280×720 激活场景的页面
- **THEN** 画布缩放小于 100%，该场景整体落在可视区域内且四周留有空白

#### Scenario: 宿主关闭自动适配

- **WHEN** 宿主把 controller 的自动适配选项设为 false
- **THEN** 进入后画布停在 `initialViewport`，缩放为 100%

### Requirement: 工具栏上的角度约束

默认工具栏的吸附组 MUST 提供**正交**与**极轴**两个按钮。两者 MUST 互斥并各自渲染按下态：
它们是同一个单选组的两个成员，按下已经按下的那一个 MUST 关闭角度约束。

**这两个按钮 MUST NOT 只做键位的第二个入口。** 今天角度约束藏在 `F8` 后面、Stage 自己持有，
宿主读不到也就画不出按下态——用户不按那个键就不知道有这回事。工具栏解决的是**可发现性**，
因此按下态是必需的，不是装饰。

极轴按钮 MUST 带一个**增量角**下拉，取值为 AutoCAD 的八个 360 约数
（90 / 45 / 30 / 22.5 / 18 / 15 / 10 / 5），与网格大小那个菜单同构（split button + 
`menuitemradio`）。**附加角表不做**：增量角是「一族」而附加角是「一条」，这个区别真实且有用，
但它需要一整套增删行的编辑面，而眼下没有消费者。

状态 MUST 由 editor controller 持有并传给 Stage：工具栏要画按下态，而事实来源只能有一份，
Stage 记一份、工具栏记一份必然漂移。

角度约束 MUST NOT 进入文档，因此切换它 MUST NOT 产生事务、MUST NOT 进撤销历史——它是「怎么
画」而不是「画了什么」，与网格设置同一条判断。

#### Scenario: 两个按钮互斥

- **WHEN** 极轴按下的状态下点击正交
- **THEN** 正交按下、极轴弹起

#### Scenario: 再点一次关掉

- **WHEN** 点击已经按下的那一个
- **THEN** 两个都弹起，角度约束关闭

#### Scenario: 增量角下拉

- **WHEN** 打开极轴按钮的下拉并选择 90°
- **THEN** 该项标记为已选，且 45° 方向不再被追踪

#### Scenario: 切换不进撤销历史

- **WHEN** 切换角度约束之后按撤销
- **THEN** 撤销的是切换之前的那一次文档变更，角度约束不变

### Requirement: 场景树进入组件与返回

默认 Editor MUST 把场景树的 `enter` 操作意图解析为「进入该实例当前引用的组件资源」：进入的
MUST 是实例引用的直接父源（引用变体即进变体，不追到根 Base）。

进入 MUST NOT 新增文档标签。Editor MUST 把该组件会话压成来路那份文档之上的**一层**，并维护
一条**会话级**来路栈；该栈 MUST NOT 写入文档、撤销历史或偏好。

同一个 assetKey 在任意时刻 MUST 至多只有一份会话：进入一个已经打开的组件资源 MUST 复用既有
会话而不是新建，且该会话在层存续期间 MUST NOT 同时呈现为文档标签。进入的目标已经在来路栈中时，
Editor MUST 把栈截断到它所在的那一段，而 MUST NOT 再压一层。

栈 MUST 只在栈顶就是当前呈现的那份文档时有效：用户切到栈外的文档标签时 MUST 整条丢弃；
栈中某一段对应的会话被关闭时 MUST 截断到仍然存在的最长前缀。有来路时 Editor MUST 把当前树的
根节点标记为来路出口，退无可退时 MUST NOT 标记。

返回 MUST 弹出栈顶那一层、回到来路那一段，并**还原进入时的选区**、展开其祖先使其可见。
返回 MUST NOT 隐含保存，也 MUST NOT 弹出保存确认。被弹出的那一层：在**进入之前该会话就已经
存在**，或它**有未保存的修改**时，Editor MUST 保留该会话并把它呈现为文档标签；两者都不成立时
MUST 关闭该会话。

#### Scenario: 从实例行进入不新增标签

- **WHEN** 用户在页面文档的场景树上对一个组件实例行执行进入
- **THEN** 场景树只显示该组件文档的节点，其根行成为来路出口
- **AND** 文档标签条不新增任何标签

#### Scenario: 返回并还原选区

- **WHEN** 用户在进入后点击根行的返回控件
- **THEN** Editor 回到来路那份文档
- **AND** 进入时选中的那个实例重新被选中且其祖先展开

#### Scenario: 干净地返回即丢弃

- **WHEN** 用户进入一个此前未打开的组件、未作任何修改即返回
- **THEN** 该组件会话被关闭
- **AND** 文档标签条不因这次进入多出任何标签

#### Scenario: 带着未保存修改返回

- **WHEN** 用户在层里修改了组件文档而未保存，随后返回
- **THEN** Editor 不保存也不弹出确认
- **AND** 该组件会话保留并以带未保存标记的文档标签呈现

#### Scenario: 进入已经打开的组件

- **WHEN** 用户进入的组件资源已有打开的文档标签
- **THEN** Editor 复用那份会话而不新建，该标签在层存续期间从标签条让位
- **AND** 返回后它回到标签条

#### Scenario: 回到栈中已有的那一层

- **WHEN** 用户进入的目标就是来路栈中已有的某一段
- **THEN** Editor 把栈截断到那一段
- **AND** 不再压入新的一层

#### Scenario: 切到栈外的标签

- **WHEN** 用户在层存续期间点击栈外的另一条文档标签
- **THEN** 来路整条丢弃
- **AND** 根行不再呈现返回控件与头部底色

#### Scenario: 来路那份文档被关闭

- **WHEN** 来路中某一段的文档会话被关闭
- **THEN** 来路截断到仍然存在的最长前缀
- **AND** 退无可退时根行不再呈现返回控件与头部底色

### Requirement: 进入层的呈现

层存续期间，文档标签条 MUST 继续把**来路那条**标签呈现为活动标签——用户仍站在那份文档上，
只是进了它内部的一层。层自身 MUST NOT 出现在标签条中，因此 MUST NOT 提供关闭控件：离开一层的
唯一出口是返回。

Editor MUST 在画布上给出一处**不依赖文字**的模式提示，使「我此刻编辑的不是来路那份文档」在场景树
面板不可见时仍然读得出来。该提示 MUST NOT 表达路径或名称，也 MUST NOT 占用常驻纵向空间——
当前在哪一层由场景树的来路出口行回答。页面文档上 MUST NOT 呈现该提示。

#### Scenario: 层不占标签条

- **WHEN** 用户从页面文档进入一个组件
- **THEN** 标签条的条目数量不变，页面那条仍呈现为活动标签
- **AND** 屏幕上没有可关闭该层的控件

#### Scenario: 画布给出模式提示

- **WHEN** 层存续
- **THEN** 画布内容区呈现模式提示
- **AND** 返回之后该提示消失

#### Scenario: 场景树不可见时仍可读

- **WHEN** 用户在层存续期间折叠或关闭场景树面板
- **THEN** 画布的模式提示仍然呈现

### Requirement: 实例头栏提供打开组件入口

默认 Editor 在选中页面 component-instance 时，实例操作区 MUST 提供一个「打开组件」控件，
其行为与场景树的进入一致——同样压一层、同样不新增文档标签。该控件 MUST 与「创建变体」在视觉与
可访问名称上可区分：一个进入既有资源，另一个另存为新的组件库资源。

#### Scenario: 从实例头栏打开组件

- **WHEN** 用户在实例操作区执行「打开组件」
- **THEN** Editor 进入该实例引用的组件，效果与场景树进入一致
- **AND** 文档标签条不新增任何标签

#### Scenario: 与创建变体可区分

- **WHEN** 实例操作区同时呈现「打开组件」与「创建变体」
- **THEN** 两者具有不同的图形与可访问名称
- **AND** 「打开组件」不创建任何组件库资源

### Requirement: 场景树新增菜单与画布添加菜单同一份货架

默认 Editor MUST 把画布右键「添加组件」所用的那一份货架**原样**交给场景树的新增菜单：
两处 MUST 呈现相同的分组与相同的条目 id，MUST NOT 各自求值一份。货架被裁剪到空时
Editor MUST NOT 向场景树提供菜单，此时新增按钮退回既有的建议插入行为。

Editor MUST 把场景树的 `add` 意图路由到与**点击物料面板瓦片**完全相同的添加路径——不带画布
落点，因此新对象落在当前选区所在的容器里。该路径 MUST NOT 因入口不同而产生第二套落点规则。

新对象 MUST 在场景树里可见：Editor MUST 展开落进去的那个容器。被选中却藏在折叠父级里的行，
与什么都没发生在屏幕上没有区别，而这条入口的用户此刻正看着树。

#### Scenario: 两处入口列出同一批条目

- **WHEN** 用户分别打开画布右键的添加菜单与场景树的新增菜单
- **THEN** 两者呈现相同的分组与条目

#### Scenario: 从场景树新增菜单添加

- **WHEN** 用户在场景树选中一个容器，再从新增菜单选中一项
- **THEN** 新对象落在该容器内
- **AND** 该容器被展开，新对象作为选中行在树里可见
- **AND** 效果与点击物料面板上同一项的瓦片一致

#### Scenario: 货架为空时退回

- **WHEN** 当前工作区的货架不含任何条目
- **THEN** 场景树的新增按钮仍按建议插入位置新建容器
- **AND** 不呈现空菜单

### Requirement: 单一 Dockview 实例

`ComposeEditor` MUST 只创建**一个** Dockview 实例：左栏场景图与工具组两个普通组上下分栏，
右栏属性一个普通组，中央画布组，底部一个原生边缘组。MUST NOT 嵌套第二个 Dockview。可访问
landmark MUST 只有一份。

#### Scenario: 只有一个 Dockview

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** DOM 中只存在一个 Dockview 根，底部一个边缘组横跨全宽，中央一个画布组

#### Scenario: Strict Mode 下唯一

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 每个组与每个面板各只存在一个实例

### Requirement: 文档标签条

文档（页面文档、组件文档、资源文件文档）MUST 是编辑器会话而 MUST NOT 是 Dockview panel。

文档标签条 MUST 位于**画布列自己的头上**——画布面板内容的第一行，高 30px，因此与左右两栏的
Dockview 面板头**同高且顶边落在同一条线上**。它 MUST NOT 再横贯编辑器全宽，MUST NOT 住在应用
顶栏里，也 MUST NOT 与 36px 的画布工具栏合成一行：标签数量没有上界而工具栏货架从尾部溢出，
同行会让多开一个文件就吃掉一颗工具按钮。

标签 MUST 是圆角标签，并 MUST 遵循「chrome 的选中画法」：活动的一格是一块柔和的圆角底加
`text-strong`，静息只有文字。标签 MUST NOT 贴满整格、MUST NOT 用竖线相互分隔、MUST NOT 用下划线
或 accent 条表示活动。标签 MUST 显示文档类型图标、名称、未保存圆点与关闭按钮；关闭按钮 MUST 只在
hover / focus 时显出自己的底。

标签条 MUST 实现 `tablist` 可访问语义：方向键在文档间移动并激活，`Home` / `End` 到两端，
`Delete` MUST NOT 关闭。标签条上 MUST NOT 有保存按钮、布局开关、工作区切换器或设置入口——
它们住应用顶栏，保存 MUST 仍可从 `document.save` 动作与它的键位执行。

标签条**行尾** MUST 承载「设计 / 动画」模式切换器（见「设计与动画模式切换器」）：这一行因此
回答**这是哪个文档、在编它的哪一层**，而下一行的工具栏回答**用什么工具**。切换器 MUST 在
`tablist` 之外，MUST NOT 参与标签的方向键循环，并 MUST 钉在横向滚动区之外。

文档 MUST 由 `provider.id + assetKey（缺失时 entry.id）` 唯一标识，重复打开 MUST 激活现有标签
而非创建副本；资源文件文档 MUST 保留未保存 Monaco 草稿。关闭 dirty 文档或改动已打开资源的条目时，
系统 MUST 提供保存、放弃或取消决策，并只在保存成功或放弃后关闭；取消、保存失败或 revision
conflict 不执行关闭或对应 Provider 操作。中央画布组 MUST 只承载画布，画布 MUST 跟随活动文档。
文档 MUST NOT 参与 Dockview 拖放、浮动、布局持久化、ComposeDocument、History 或 Operation Log。

#### Scenario: 标签条与左右面板头齐平

- **WHEN** 编辑器挂载并打开两个页面
- **THEN** 文档标签条只占画布那一列的宽度，不横贯编辑器
- **AND** 它的顶边 y 与左栏场景图组头、右栏属性组头的顶边 y 相同，高度都是 30px
- **AND** 三条头部行的左内边距都是 8px

#### Scenario: 活动标签是圆角底而不是下划线

- **WHEN** 用户查看活动文档标签
- **THEN** 它有一块圆角底且文字更亮
- **AND** 它没有下划线、没有 accent 条，与相邻标签之间没有竖线

#### Scenario: 画布上方多了一条头部行

- **WHEN** 编辑器挂载
- **THEN** 画布内容的顶边距编辑器顶边 102px（应用顶栏 30 + 沟槽 6 + 头部行 30 + 工具栏 36）
- **AND** 工具栏不再有自己的 1px 下边框，卡的边框是 inset 阴影因此不占布局

#### Scenario: 行尾是模式切换器

- **WHEN** 用户查看文档标签条
- **THEN** 行尾是带「设计」「动画」两段文字的切换器
- **AND** 在标签上按方向键只在文档之间移动，不会走进切换器

#### Scenario: 键盘在文档间移动

- **WHEN** 焦点在活动文档标签上按右方向键
- **THEN** 下一个文档激活，画布、场景图与属性面板跟随

#### Scenario: 从默认资源浏览器打开资源

- **WHEN** 默认 Asset Browser 发出文件打开意图
- **THEN** 标签条打开或激活对应资源文档标签
- **AND** 切走再切回时未保存的 Monaco 草稿仍在

#### Scenario: 删掉按钮之后仍能保存

- **WHEN** 用户在有未保存改动的页面文档上按 `Cmd/Ctrl+S`，或从命令面板执行「保存文档」
- **THEN** 文档保存成功，标签上的未保存圆点消失

#### Scenario: 关闭 dirty 文档

- **WHEN** 用户关闭 dirty 文档标签，或重命名、移动、删除包含 dirty 已打开资源的条目
- **THEN** 系统提供保存、放弃或取消决策，并只在保存成功或放弃后关闭
- **AND** 取消、保存失败或 revision conflict 不执行关闭或对应 Provider 操作

### Requirement: 工作区定义与注入

`@compose-ui/editor` MUST 导出 `ComposeEditorWorkspaceDefinition` 与 `COMPOSE_DEFAULT_WORKSPACES`。
一个工作区定义 MUST 包含：稳定 `id`（不本地化）、已本地化 `title`、可选 `icon`、`layout`
（面板名 preset 或不透明快照）、`palette`（标题、搜索、货架 `sections`）、`session`（角度约束、
增量角、网格可见、十字光标臂长、变换 Gizmo）、`seeds`（新建文档的网格步长、网格吸附与对齐
吸附）。定义里 MUST NOT 存在能改变命令集、按钮含义或快捷键的字段。

`ComposeEditor` MUST 接受 `workspaces` prop 替换内建列表；`id` 重名 MUST 抛错而 MUST NOT 静默
丢弃。宿主注入的工作区与用户另存的工作区 MUST 是同一种定义，差别只在谁给了初始布局。

#### Scenario: 宿主注入工作区

- **WHEN** 宿主传入 `[...COMPOSE_DEFAULT_WORKSPACES, substation]`，其 `palette` 只含
  `Symbols / 变电站` 一段
- **THEN** 切换器出现第三段，激活时应用宿主给的布局、货架与会话默认值

#### Scenario: 重名抛错

- **WHEN** 宿主传入两个 `id` 相同的工作区
- **THEN** 挂载抛出错误而不是静默丢弃其中一个

#### Scenario: 定义里没有改含义的字段

- **WHEN** 宿主注入任意工作区
- **THEN** 命令行词汇表、快捷键与动作目录与不注入时逐项相同

### Requirement: 内建工作区

`COMPOSE_DEFAULT_WORKSPACES` MUST 恰好三个：`page`（页面）、`drawing`（绘图）与 `animation`
（动画）。三者的 preset MUST 摆出同一套四区结构（左侧场景图在上、工具组在下，中央画布，右侧
属性，底部边缘组）：页面 = 工具组标题「基础组件」、场景 / 工具 60%/40%（场景内容至少 160px、
工具内容至少 120px）、左右两侧展开、底部折叠、底部活动标签为资源；绘图 = 工具组标题「符号库」、
活动、分栏拉高、底部边缘组折叠、其余相同；动画 = 与页面相同，只有底部边缘组不同：
`[时间线, 资源, 命令, 日志]`、**展开**、时间线活动。

`session` MUST 只在十字光标臂长上不同（页面 5 / 动画 5 / 绘图 100）：角度约束、增量角、网格可见与
变换指示器三边 MUST 同值——会话开关本来就按工作区各记一份并在切回时恢复，默认值再分叉一次只会
让「我上次把它关了」与「这个工作区本来就是关的」在屏幕上分不开。

`seeds` MUST 在两处不同：网格步长页面 8 / 动画 8 / 绘图 10，**对齐吸附页面与动画开、绘图关**；
网格吸附三边都开。工具栏货架是否相同 MUST NOT 由本能力回答——它由「工具栏货架」承载；动画的
默认货架 MUST 含「动画编辑」那一格（指向 `document.toggleAnimationMode`）。页面与动画的 `palette` MUST 是基础组件 + `components`
平铺、无搜索；绘图的 `palette` MUST 是 `Symbols` 按子文件夹分组 + `components` + 基础组件折叠，
标题「符号库」，带搜索。宿主提供 `history` 或显式 `historyPanel` 时，历史 MUST 作为工具组的
第二个标签加入，未提供时 MUST NOT 显示空历史标签。

#### Scenario: 默认三个工作区

- **WHEN** 宿主不传 `workspaces`
- **THEN** 切换器有「页面」「绘图」「动画」三段，「页面」按下
- **AND** 页面的布局与之前的默认布局逐像素一致

#### Scenario: 绘图的初始布局

- **WHEN** 用户首次切到绘图
- **THEN** 工具组标签叫「符号库」且活动、分栏高于页面工作区、底部边缘组折叠、十字光标贯穿图面
- **AND** 事务日志没有新行，撤销栈长度不变

#### Scenario: 动画的初始布局

- **WHEN** 用户首次切到动画
- **THEN** 底部边缘组展开且时间线是活动标签，其余面板与页面工作区逐项相同
- **AND** 动画编辑开关未按下，事务日志没有新行

#### Scenario: 历史面板加入工具组

- **WHEN** 宿主提供 HistoryNavigationController
- **THEN** 三个工作区的工具组都显示历史标签，页面与动画的活动标签仍是基础组件、绘图的仍是符号库

### Requirement: 面板拖拽与硬约束

面板 MUST 可拖拽到任一组（含底部边缘组），MUST NOT 设置 `locked` 或 `disableDnd`。三条约束 MUST 由代码
保证：画布面板的标签 MUST NOT 有关闭按钮且 `removePanel` MUST 拒绝它；每种面板 MUST 至多一个
（拖是搬不是复制）；时间线面板 MUST NOT 进入快照。浮动组与弹出窗口 MUST 关闭。

拖拽移动 MUST NOT 重建面板内容（Dockview 的 `skipDispose` 路径），画布在拖拽期间 MUST 保持
同一 React 实例。

#### Scenario: 把基础组件面板拖到右栏

- **WHEN** 用户把工具组里的基础组件面板拖到右栏、放在属性面板上方
- **THEN** 基础组件面板出现在右栏，左栏只剩场景图
- **AND** 画布内容没有重新挂载

#### Scenario: 画布不可关闭

- **WHEN** 用户查看画布面板的标签或尝试以任何方式移除它
- **THEN** 标签上没有关闭按钮，画布仍在
- **AND** 工作区不会进入没有画布的状态

#### Scenario: 不能拖出浮动组

- **WHEN** 用户把一个面板拖到组的外面
- **THEN** 没有浮动组或弹出窗口产生

### Requirement: 工作区布局快照

用户改动布局（拖面板、调分栏、折叠、换活动标签）后，系统 MUST 把 Dockview `toJSON` 结果记入
偏好 `workspace.layouts[当前工作区 id]`（可防抖），并经 `onPreferencesChange` 通知宿主。快照
MUST 对宿主不透明：带 Dockview 版本号的 opaque 值，MUST NOT 暴露 `SerializedDockview` 类型。
快照 MUST NOT 进入文档、事务历史或操作日志。

激活工作区时：有快照 MUST 先校验（版本号一致、面板 id 全部已知、画布面板存在），通过则
`fromJSON`；不通过 MUST 丢弃该快照回到定义里的 `layout`（preset 重新摆出，快照则再校验一次），MUST NOT
报错或阻塞打开文档。定义只有快照且它也不成时 MUST 从列表删掉并提示。「重置布局」MUST 删除
快照。

#### Scenario: 拖过的布局随工作区记住

- **WHEN** 用户在自定义工作区里把基础组件面板拖到右栏，切到页面再切回
- **THEN** 基础组件面板仍在右栏
- **AND** 页面工作区的布局不受影响

#### Scenario: 快照失配回退

- **WHEN** 偏好里某个工作区的快照引用了一个宿主已关闭的面板
- **THEN** 该工作区按定义里的 preset 摆出默认布局，且偏好里该快照被清除
- **AND** 没有错误提示阻塞

#### Scenario: 快照不进事务

- **WHEN** 用户拖动面板之后按撤销
- **THEN** 撤销的是拖动之前的那一次文档变更，面板位置不变

### Requirement: 切换不打断画布

画布、场景图与属性面板的内容 MUST 各自渲染进一个在编辑器实例生命周期内稳定存在的宿主元素；
Dockview 面板挂载时 MUST 把该元素放进自己的容器，卸载时 MUST NOT 销毁它。工作区切换经
`fromJSON` 重建面板之后，MUST 把同一个元素放进新面板，MUST NOT 重新挂载其中的 React 组件。

#### Scenario: 命令会话跨切换存活

- **WHEN** `LINE` 已取到一个点，用户切换工作区
- **THEN** 命令行提示仍是「指定下一点」，键入到一半的坐标还在命令行里，下一次点击落地成一段
- **AND** 选择集与视口不变

#### Scenario: Strict Mode 下宿主元素唯一

- **WHEN** React Strict Mode 重放挂载
- **THEN** 画布只有一个宿主元素与一个 React 实例

### Requirement: 工作区切换

切换器 MUST 是 `radiogroup`，方向键按索引循环；hover / focus 时 MUST 提示该工作区会换的东西。
切换 MUST 依次：应用目标工作区的布局（快照或 preset）、物料货架、会话开关（角度约束、增量角、
网格可见、十字光标臂长、Gizmo）；记入 `workspace.lastUsed` 与当前文档的 `workspace.byDocument`。
切换 MUST NOT 改变活动文档、选择集、视口、当前工具，MUST NOT 产生事务或撤销条目，
MUST NOT 打断正在取点的命令。切换 MUST NOT 打开动画编辑；目标布局里没有时间线面板时 MUST
退出动画编辑——它唯一的可见依据随布局一起消失了。会话开关的改动 MUST 记入当前工作区，切回时
恢复；网格步长与对齐吸附是**文档**字段，切换 MUST NOT 碰它们——它们只由新建时的种子给初值。

#### Scenario: 切换不产生事务

- **WHEN** 用户从页面切到绘图
- **THEN** 事务日志没有新行，撤销栈长度不变，`document.canvas.grid` 与 `smartSnap` 不变

#### Scenario: 会话开关随工作区记住

- **WHEN** 用户在绘图里关掉网格显示，切到页面再切回绘图
- **THEN** 绘图里网格仍是关的，页面里网格仍是开的

#### Scenario: 货架跟着切

- **WHEN** 用户从页面切到绘图
- **THEN** 工具组标签变成「符号库」，面板按文件夹分组并出现搜索框

#### Scenario: 方向键按索引循环

- **WHEN** 有三个工作区且焦点在最后一段按右方向键
- **THEN** 第一段被选中

#### Scenario: 切换永不打开动画编辑

- **WHEN** 一份页面上次在动画工作区里编辑过，用户重新打开它
- **THEN** 落在动画工作区、时间线可见，但动画编辑开关未按下，画布显示基础文档

### Requirement: 按文档记忆工作区

激活一个文档标签时，若偏好 `workspace.byDocument[文档 key]` 记着的工作区与当前不同，系统 MUST
切换到它；没记过 MUST NOT 切换。用户点切换器 MUST 记成当前文档的新记忆；新建文档 MUST 继承当前
工作区。记忆 MUST 存在偏好里，MUST NOT 写进页面文件或文档。记忆里的 id 不在当前工作区列表时
MUST 依次回退到 `lastUsed`、列表第一个。

#### Scenario: 文档回到自己的工作区

- **WHEN** A 页上次在自定义工作区里编辑、B 页在页面里，用户 A→B→A
- **THEN** 激活 A 时回到自定义工作区，激活 B 时回到页面
- **AND** 两次切换都没有事务

#### Scenario: 未打开过的文档不切换

- **WHEN** 当前在页面工作区，用户首次打开 C 页
- **THEN** 工作区仍是页面，C 页从此记为页面

#### Scenario: 记忆失效回退

- **WHEN** 文档记着的工作区已被删除
- **THEN** 激活该文档时切到 `lastUsed`，该文档的记忆改为 `lastUsed`

### Requirement: 工作区管理

切换器右端 MUST 有管理菜单：另存为工作区…、重命名、自定义工具栏…、重置、删除、只看画布、
自定义物料面板…。**保存 MUST NOT 有按钮**——改动即记入。面板挪位或货架改动后切换器该段 MUST
显示修改点表示「与基线不同」（内建与宿主注入的基线是定义自带的 `layout` 与默认货架，
自定义的基线是创建时的快照与货架）；分栏尺寸、折叠、活动标签的改动 MUST 记入但 MUST NOT 点亮
修改点；重置后修改点 MUST 消失。「重置」MUST 一并重置布局与两条货架。布局与货架改动 MUST NOT
进入编辑器撤销历史。

另存为 MUST 复制当前布局快照、工具栏货架、物料货架、会话默认值与新建种子，只询问名称并列出
复制的内容；显示名重复 MUST 自动加序号而 MUST NOT 拒绝；创建后 MUST 立即切换过去并记入当前
文档；来源工作区 MUST 原样保留。自定义工作区 MUST 存入偏好 `workspace.custom`。删除 MUST 确认，
确认框 MUST 写明记着它的文档数与回退去处；删除后 MUST 切到 `lastUsed`，指向它的文档记忆 MUST
改为 `lastUsed`。内建与宿主注入的工作区 MUST NOT 可删、MUST NOT 可重命名，但 MUST 可重置；
菜单项 MUST 灰掉并标明原因而 MUST NOT 隐藏。

#### Scenario: 另存为带着货架

- **WHEN** 用户在绘图里改过工具栏后选择「另存为工作区…」并输入「变电站」
- **THEN** 「变电站」的工具栏与改过的绘图工具栏逐项相同
- **AND** 绘图的修改点仍在

#### Scenario: 货架改动点亮修改点

- **WHEN** 用户从工具栏移除一个按钮
- **THEN** 当前段出现修改点；选择「重置」后按钮回来、布局回到基线且修改点消失

#### Scenario: 删除自定义工作区

- **WHEN** 用户删除「变电站」并确认
- **THEN** 切换器切到 `lastUsed`，记着变电站的文档改为 `lastUsed`，它的两条货架从偏好里删除

#### Scenario: 内建不可删

- **WHEN** 当前是「页面」且用户打开管理菜单
- **THEN** 「删除」与「重命名」灰掉并标明「内建」，仍可见；「重置」可用

### Requirement: 只看画布

管理菜单与动作目录 MUST 提供「只看画布」：开启时 MUST 调用 Dockview `maximizeGroup` 最大化
画布组，再次触发 MUST `exitMaximizedGroup`。状态 MUST 按工作区记忆，MUST NOT 进入文档或事务。

#### Scenario: 只看画布

- **WHEN** 用户触发「只看画布」
- **THEN** 画布组占满编辑器，工具栏行与命令行仍可见
- **AND** 再次触发后布局回到之前的样子

### Requirement: 新建文档种子

在某个工作区里新建页面文档时，新文档 MUST 从该工作区的 `seeds` 取 `document.canvas.grid` 的
网格步长与网格吸附，以及 `document.canvas.smartSnap`。种子 MUST 只在新建时落地：切换工作区
MUST NOT 改写已有文档的这两个字段，也 MUST NOT 产生事务。新场景尺寸 MUST NOT 属于种子
（两个内建都是 1920×1080）。

对齐吸附与特征点捕捉 MUST NOT 在绘图工作区里同时默认生效：两者是姐妹查询——前者给出
`{axis, value}` 的参考线、后者给出落在端点上的二维点，同时开着会在同一次取点里给出互相
拉扯的答案，而特征点候选**刻意不出盒的角点**正是为了避开对齐吸附的语义。因此绘图种子的
对齐吸附 MUST 关。这只是**默认值**：已经打开的文档 MUST NOT 被工作区改写，用户仍可用工具栏
的吸附按钮开关它，那本来就是一次进撤销历史的文档编辑。

#### Scenario: 绘图里新建页面

- **WHEN** 当前是绘图工作区，用户新建一个页面
- **THEN** 画布设置里网格步长读 10 / 10 且吸附开

#### Scenario: 绘图里新建的页面不开对齐吸附

- **WHEN** 当前是绘图工作区，用户新建一个页面并画一条线经过另一个对象的包围盒边缘
- **THEN** 画布设置里对齐吸附是关的，落点不被对齐参考线改写
- **AND** 端点、中点与端口的特征点捕捉照常生效

#### Scenario: 切换不改已有文档

- **WHEN** 一个步长为 8、对齐吸附开着的页面打开着，用户切到绘图
- **THEN** 该页面的步长仍是 8、对齐吸附仍是开的，事务日志没有新行

### Requirement: 顶栏布局开关

应用顶栏右端 MUST 常驻左 / 底 / 右三个布局开关，它们 MUST 是折叠与展开对应面板的**唯一**
入口。实心 MUST 表示展开、描边 MUST 表示收起，两种状态都 MUST 渲染——只在其中一态出现的
指示器无法让用户确认另一态。开关 MUST 是可切换按钮并携带 `aria-pressed`，MUST NOT 因对应
面板被收起而移动或消失：位置不随面板存亡而变，正是它取代边缘把手的全部理由。

开关这一段与左侧的工作区之间 MUST NOT 画竖线，MUST 只靠间距与「钉在最右」的位置分段。

底栏 MUST 与左右两栏一样有开关；此前它只能靠工作区 preset 折叠，没有任何显式入口。

开关 MUST NOT 产生事务或撤销条目。折叠状态 MUST 随工作区布局快照走，与既有的布局记忆一致。

本期 MUST 只有三颗：第四个候选「只看画布」在工作区管理菜单里已有入口，再给一个会违反本变更
据以删掉边缘把手的那条规则。

#### Scenario: 三颗开关常驻

- **WHEN** 编辑器挂载
- **THEN** 应用顶栏右端有左、底、右三个开关，各自反映对应面板此刻是展开还是收起
- **AND** 它们与左侧的工作区之间没有竖线

#### Scenario: 收起之后开关不动

- **WHEN** 用户收起右栏
- **THEN** 右栏开关变成描边态，位置不变
- **AND** 再点它一次右栏恢复到收起前的尺寸

#### Scenario: 底栏第一次有显式入口

- **WHEN** 用户点击底栏开关
- **THEN** 底部 Edge Group 折叠，只剩标签条

#### Scenario: 折叠不进历史

- **WHEN** 用户连续切换三个开关
- **THEN** 事务日志没有新行，撤销栈长度不变

### Requirement: 面板头统一为标签加一条 chrome

左栏场景图、左栏物料面板与右栏属性面板的头 MUST 是**同一条规则的三个实例**：一条 30px 的
Dockview 标签行，加**至多一条** chrome 行（搜索与宿主动作共用它）。三块面板 MUST NOT 再有
第二条常驻的标题行。

属性面板的对象语义 MUST 由标签承载（见「实例与组件文档的标题语义」），它此前占的那条 52px
标题行 MUST 删除；行里那簇动作（实例 Apply / Revert、添加能力）MUST 并进 chrome 行的右端，
MUST NOT 另起一行。

#### Scenario: 属性面板不再有标题行

- **WHEN** 用户选中一个矩形
- **THEN** 属性面板从 Dockview 标签行下方直接是搜索那一条 chrome，然后就是属性内容
- **AND** 对象名出现在标签上而不是单独一行

#### Scenario: 动作与搜索同一行

- **WHEN** 用户选中一个组件实例
- **THEN** 实例动作与「添加能力」出现在搜索那一行的右端
- **AND** 面板里没有第二条工具条

#### Scenario: 场景图本来就符合

- **WHEN** 用户查看场景图面板
- **THEN** 它是标签行加一条 chrome（`+` 与搜索），没有第二条标题行

### Requirement: 应用顶栏

编辑器顶部 MUST 有一条高 30px、横贯全宽、位于 Dockview **之外**的应用顶栏。它从左到右
MUST 恰好是三段：**标志 ▾**、**工作区切换器**、**三个布局开关**。

段与段之间 MUST 只有间距，MUST NOT 画竖线：标志钉在最左、开关钉在最右，位置本身已经分好段，
而竖线是把「我数得清有几段」画出来，那件事本来不需要用户去数。

顶栏 MUST NOT 承载文档标签、保存按钮或「设计 / 动画」模式切换器——它们分别住画布列头、
`document.save` 动作与画布工具栏。顶栏上的任何操作 MUST NOT 产生事务或撤销条目。

#### Scenario: 顶栏恰好三段

- **WHEN** 编辑器挂载
- **THEN** 顶栏从左到右是标志加 `▾`、工作区切换器、三个布局开关
- **AND** 顶栏上没有文档标签、没有保存按钮、没有模式切换器

#### Scenario: 段之间没有竖线

- **WHEN** 用户查看应用顶栏
- **THEN** 三段之间只有间距，没有任何竖向分隔线

#### Scenario: 顶栏不进历史

- **WHEN** 用户在顶栏切换工作区并连续切换布局开关
- **THEN** 事务日志没有新行，撤销栈长度不变

### Requirement: 应用标志与应用菜单

应用顶栏最左 MUST 是标志加一个 `▾`，整体是**一颗按钮**并携带 `aria-haspopup="menu"`；
点击 MUST 打开应用作用域的菜单，`Escape` 与点击外部 MUST 关闭并把焦点还给它。

标志 MUST 是**实心**图形，MUST NOT 用描边圆角矩形——顶栏右端那三个布局开关就是描边圆角矩形，
两者相距不到一屏，同形会让它们读成一家人。标志 MUST NOT 带文字标记：30px 一行里的字母会挤掉
紧邻的工作区，而标志的职责是那颗把手，不是署名。

菜单本期 MUST 恰好两项：**设置**与**命令面板**。两项 MUST 都不是各自能力的唯一入口——
`editor.settings` 与命令面板的既有动作、键位 MUST 保持可用。

#### Scenario: 标志打开应用菜单

- **WHEN** 用户点击顶栏最左的标志
- **THEN** 展开一个 `role="menu"`，含「设置」与「命令面板」两项
- **AND** 按 `Escape` 关闭，焦点回到标志按钮

#### Scenario: 键盘可达

- **WHEN** 焦点落在标志按钮上按下方向键
- **THEN** 菜单展开且焦点落在第一项

#### Scenario: 菜单不是唯一入口

- **WHEN** 用户不打开菜单，直接执行 `editor.settings` 的键位
- **THEN** 设置弹框照常打开

### Requirement: chrome 的选中画法

表示「选中 / 活动」的画法 MUST 只有一种：**一块柔和的圆角底**加 `text-strong`。它作用于
应用顶栏与头部行——头部行指左栏面板头、画布列的文档标签条与右栏面板头。这三处 MUST NOT 用
下划线或 accent 条、
MUST NOT 贴满整格、MUST NOT 用竖线分段。hover MUST 只改文字颜色而 MUST NOT 上底——底是「选中」
的专用通道，hover 也上底会让「指着」与「选中」同形，而两者可以同时成立。

画布工具栏的按下态 MUST 保持既有的 `surface-selected` 底，MUST NOT 跟着改成灰底：顶栏与头部行
回答**你在看哪一个**（导航，一组里恰好一个有底），工具栏回答**哪个开着**（状态，可以同时开
好几个）；同一块灰底放进「可以同时为真」的一组里，读不出还剩几个开着。

活动格的底色 MUST 由端到端用例断**计算后的值**而不是只断 class：本仓库已经有过一次样式靠层叠
静默失效（无层规则压过 `@layer components`），只断 class 的用例挡不住它。

#### Scenario: 三处长一个样

- **WHEN** 用户查看工作区切换器、文档标签条与左右面板头
- **THEN** 三处的活动项都是圆角底加更亮的文字
- **AND** 三处都没有下划线、没有 accent 条、没有竖线分隔

#### Scenario: hover 与选中可分

- **WHEN** 指针悬停在一个未选中的文档标签上
- **THEN** 它的文字变亮而没有底
- **AND** 活动标签的底不变

#### Scenario: 工具栏按下态不跟着变

- **WHEN** 用户查看画布工具栏里被按下的选择工具
- **THEN** 它的底仍是 `surface-selected`，与顶栏活动格的灰底不同色

### Requirement: 面板卡片化

编辑器的边缘区 MUST 画成浮在桌面上的卡片：每张卡 8px 圆角，卡与卡之间 6px 沟槽，编辑器四边
同样留 6px。桌面 MUST 是比卡片更暗的一档（见「工作区主题 token」），否则卡片浮在同色底上只剩
边框在说话。

深色主题 MUST 用 1px 边框加一道极淡的上缘高光表达卡片，MUST NOT 用投影——深色底上没有光可挡，
大阴影只会把桌面糊成一片灰，而这个产品的画布本来就暗，任何漫射都会削掉网格点。浅色主题 MUST
反过来用软阴影，MUST NOT 只用 1px 灰线——白底上它读起来像表格线。

卡片 MUST NOT 有悬停或激活高亮：Dockview 的「活动组」跟着每一次点击到处跳，一圈会闪的边框比
没有更差，而哪个组是活动的已经由标签的圆角底回答了。卡片 MUST NOT 再给内容加一层内边距——
面板内容各自已经有自己的内边距，再套一层会让场景树的行缩进两次。

圆角 MUST 只作用在卡的外框上：画布卡里的标尺与命令行 MUST 照旧贴满整宽，圆角切掉标尺刻度会让
0 点附近读不准。卡片 MUST NOT 启用 Dockview 浮动组——卡片是视觉分组，不是「可以飘起来」的许可。

#### Scenario: 卡片浮在更暗的桌面上

- **WHEN** 编辑器以深色主题挂载
- **THEN** 每个边缘区是一张 8px 圆角、带 1px 边框的卡
- **AND** 卡之间露出的桌面色计算值比卡片底色更暗

#### Scenario: 沟槽尺寸

- **WHEN** 编辑器以默认三栏布局挂载
- **THEN** 相邻两张卡之间的水平距离是 6px
- **AND** 最外侧的卡与编辑器边缘之间也是 6px

#### Scenario: 卡片不闪

- **WHEN** 用户依次点击左栏、画布与右栏
- **THEN** 三张卡的边框颜色与阴影都不发生变化

#### Scenario: 画布卡不切圆角内容

- **WHEN** 用户查看画布卡
- **THEN** 标尺与命令行横贯卡的整个宽度，两端不被圆角切掉

### Requirement: 一张卡对应一颗折叠开关

卡的单位 MUST 是**顶栏一颗折叠开关管的那一块**，MUST NOT 是一个 Dockview 组。因此编辑器
MUST 恰好有四张卡：左区、画布区、右区、底区——三张与三颗开关一一对应，剩下画布那张是唯一不能
被收起的东西。

左区那两个组（场景图与工具组）MUST 画成**一张**卡：一颗开关一按就收走两个组，画成两张会让
一颗按钮同时抓走两个看起来各自独立的对象。它们内部的段界 MUST 由色阶表达（一条 `surface-raised`
的头压在 `panel-bg` 的内容上），MUST NOT 画横线，也 MUST NOT 露出沟槽；两个组 MUST 仍各自可以
拖走、可以改高度。

用户把一个面板拖进左区时 MUST NOT 长出第五张卡——它落进左卡成为里面的第三段。卡的数量由**区**
决定，MUST NOT 由组的数量决定。

应用顶栏 MUST NOT 画成卡片：它不参与拖放、不进布局快照、搬不走，也没有开关能收起它，
给它一张卡等于宣称它可以被搬走。画布卡里的三层（文档标签条、工具栏、画布）MUST NOT 各自成卡，
它们是同一个面板的内部结构。

已知代价 MUST 说在明处：卡**内部**那条上下分界的拖拽命中带仍是 Dockview 的 4px 且不可见——
「看得见的就是拖得到的」这条只对卡与卡之间成立。

#### Scenario: 数一数有几张卡

- **WHEN** 编辑器以默认三栏布局挂载且底栏展开
- **THEN** 屏幕上恰好有四张卡：左区、画布区、右区、底区
- **AND** 应用顶栏不是卡片

#### Scenario: 左区上下一体

- **WHEN** 用户查看左栏的场景图与基础组件两段
- **THEN** 两段外面是同一张卡的同一圈边框，中间没有沟槽也没有横线
- **AND** 两段之间仍可拖动改变高度

#### Scenario: 拖入面板不长出第五张卡

- **WHEN** 用户把底栏的一个面板拖到左区形成第三个组
- **THEN** 左区仍然是一张卡，新组成为卡内的第三段

#### Scenario: 收起一侧收走整张卡

- **WHEN** 用户点击左栏开关
- **THEN** 整张左卡连同它的两段一起消失，桌面在那一侧连成一片

### Requirement: 沟槽即 sash

卡与卡之间那 6px MUST 同时是**边界**与**拖拽命中带**：可见宽度与命中带宽度 MUST 相等。
今天两者不等（看得见 1px、拖得到 4px 且不可见），而在贴边布局里这个问题无法修——把 1px 线
加粗到 6px，那 6px 就是一条粗黑线。

间距 MUST 由 Dockview 的 `theme.gap` 提供，MUST NOT 用 CSS 给视图内缩：Dockview 用 JS 把内容
尺寸算好再写进去，纯 CSS 内缩会让内容比可见卡宽 6px 并在右侧被裁掉。sash 的可见与命中宽度
MUST 调整到与沟槽一致。

沟槽区域 MUST NOT 画任何线：它本身就是那条边界。

#### Scenario: 拖得到的就是看得见的

- **WHEN** 用户把指针放在两张卡之间沟槽的任意一侧边缘
- **THEN** 指针变成调整尺寸的形状
- **AND** 从沟槽内任意一点按下拖动都能改变两侧宽度

#### Scenario: 沟槽里没有线

- **WHEN** 用户查看两张卡之间
- **THEN** 只有一条 6px 的桌面色，没有 1px 分隔线

### Requirement: 卡内不画横线

卡片内部 MUST NOT 画任何横向分隔线，分层 MUST 全部交给既有的三档色阶
（`surface-raised` 卡头 / `panel-bg` 内容 / `surface-sunken` 画布）；MUST NOT 为此新增
主题 token。唯一还在的线 MUST 是卡的外框——它分的是卡与桌面，那是真边界。

分层的判据 MUST 是**这一条服务的是谁**：文档标签条服务这张卡，取卡头那一档；工具栏行服务画布，
取画布那一档并与画布连成一片；命令行回到卡头那一档。工具栏行与画布之间 MUST NOT 画线——画布
真正的顶边是标尺，网格点在标尺内沿才停住，那条边因此有它自己的理由。

文档标签条与工具栏行的左内边距 MUST 都是 8px：活动标签的填充与选中工具的填充是两块相距 30px
的实心矩形，它们的左边 MUST 是同一个数。两行内容的文字与图标 MUST NOT 被强行对到同一条竖线上
——那是两种控件各自的内衬，眼睛对齐的是填充块的边。

#### Scenario: 画布卡里一条横线都没有

- **WHEN** 用户查看画布卡的标签行、工具栏行、画布与命令行
- **THEN** 四段之间没有任何 1px 分隔线
- **AND** 四段的计算背景色分别是卡头、画布、画布、卡头那三档

#### Scenario: 左卡两段靠色阶分开

- **WHEN** 用户查看左卡的两段
- **THEN** 段界处没有横线，只有卡头色压在内容色上的一次色阶变化

### Requirement: 时间线是可摆放的工作区面板

`ComposeWorkspacePanelName` MUST 包含 `timeline`，映射到既有的时间线面板 id。preset 与快照 MUST
都能摆它，它 MUST 随布局持久化并参与快照校验，MUST NOT 再由任何模式动态加入或移除。任何工作区
的布局都可以摆时间线；没有摆它的工作区里 MUST NOT 出现时间线。

时间线面板 MUST 在动画编辑关闭时也正常渲染当前作用域 Frame 的动画（或创建引导），MUST NOT
渲染成空白或 `null`。

#### Scenario: 时间线随快照走

- **WHEN** 用户在动画工作区把时间线面板拖到右侧一列，切走再切回
- **THEN** 时间线仍在右侧，且不重复出现在底部

#### Scenario: 没有时间线的工作区

- **WHEN** 用户处于页面工作区
- **THEN** 底部边缘组只有资源、命令、日志三个标签，没有时间线

### Requirement: 动画编辑开关

动画编辑 MUST 是一个显式开关，它承载今天动画模式的语义那一半：画布、属性面板与预览显示播放头
时刻的采样文档；自动记录开启时把编辑命令改写为播放头处的关键帧；画布拖拽锁定原父级；跨过开启
那一刻打开一次变换指示器。开关状态 MUST 是编辑器会话状态，MUST NOT 写入文档、撤销历史或偏好。

进入 MUST 有三条入口，且每条都是用户对动画本身的动作：时间线面板 chrome 上的开关按钮
（`aria-pressed`，由编辑器渲染而不是 `animation-panel`）；动作目录里的
`document.toggleAnimationMode`（命令面板可达、键位页可绑；id 沿用既有的以免偏好失配，默认不
绑键——裸字母与常用组合都已被占着）；对时间线的任何一次交互（拖播放头、打点、创建或载入动画）。
当前布局里没有时间线面板时，该动作 MUST 以不可用原因说明而不是静默不动。
切换工作区 MUST NOT 打开它。

退出 MUST 跟着可见依据走：再按一次开关；时间线面板不再可见（被其它底部标签盖住、被关闭、
被换掉的布局去掉）时 MUST 退出——屏幕上唯一说明「拖动会变成关键帧」的东西就是它。

#### Scenario: 切到动画工作区不进入

- **WHEN** 用户从页面工作区切到动画工作区
- **THEN** 时间线出现在底部，开关未按下，画布仍显示基础文档
- **AND** 事务日志没有新行

#### Scenario: 拖播放头即进入

- **WHEN** 动画编辑关闭，用户把时间线的播放头拖到 150 ms
- **THEN** 开关变为按下，画布显示 150 ms 的采样文档

#### Scenario: 换到没有时间线的布局即退出

- **WHEN** 动画编辑开启，用户切到绘图工作区
- **THEN** 开关关闭，画布恢复基础文档，事务日志没有新行

#### Scenario: 命令面板可达

- **WHEN** 用户在命令面板搜索「动画」
- **THEN** 列出「动画编辑」动作，执行后开关按下且时间线所在的底部组展开
- **AND** 当前工作区没有时间线时该动作显示为不可用并说明原因

### Requirement: 工具栏货架

工具栏 MUST 按当前工作区的货架渲染：一列目录 id（含 `'separator'`），来自定义上的可选 `toolbar`
或偏好 `workspace.toolbars[id]`，都缺席即默认货架。目录 MUST 来自动作目录、命令描述符与宿主
`toolbarItems` prop（每项：id、图标、标题、指向一个动作或命令 id）；不在目录里的 id MUST 跳过而
MUST NOT 报错。货架 MUST 永远是目录的子集，MUST NOT 改变任何按钮的含义、图标或快捷键。

**货架 MUST NOT 成为任何能力的唯一入口**：能上架的每一项 MUST 至少还有命令行、单键快捷键或
命令面板中的**一条**路，因此从任何工作区的货架上拿掉它都 MUST NOT 改变命令可用性。只有按钮
而没有第二条入口的功能 MUST NOT 进目录——否则「按工作区增删货架」就成了按工作区改能力，而那是
工作区的硬边界禁止的。

条件是**至少一条**而不是三条都在，因为两类目录项的第二条入口本来就不同：绘图命令走命令行与
单键（它们**刻意不进动作目录**，那会为已经能敲 `CIRCLE` 的东西造第二个词），容器与文字走动作
目录与快捷键（它们没有命令词）。要求三条齐全会把这条不变量变成一条永远不成立的规则。

为满足这条不变量，动作目录 MUST 补上 `stage.canvasSettings` 与 `stage.toggleTransformGizmo`
（默认都不绑键）：在此之前画布设置只在网格 ▾ 菜单里、变换指示器只有工具栏那颗按钮，两格都
只有一个入口，按本条规则本该退出目录。

「选择」MUST 固定在第一位且不可移除。复合项（极轴及其增量角菜单、网格及其大小菜单）MUST 整体上下架，
MUST NOT 拆开。「设计 / 动画」与保存 MUST NOT 在货架上。

#### Scenario: 移除按钮不移除能力

- **WHEN** 用户从绘图的工具栏移除「容器」
- **THEN** 按钮消失，`stage.drawContainerTool` 的快捷键与命令行里的动作仍可用

#### Scenario: 目录里没有只有按钮的功能

- **WHEN** 遍历两条内建货架上的每一格
- **THEN** 每一格都声明了自己的第二条入口（命令、动作或 Stage 功能键），且声明为动作的那些
  确实在动作目录里

#### Scenario: 画布设置与指示器有第二条入口

- **WHEN** 用户在命令面板里检索「画布设置」或「变换指示器」
- **THEN** 两条动作都列出且可执行，即使当前工作区的货架上没有网格或指示器那一格

#### Scenario: 宿主上架自己的命令

- **WHEN** 宿主经 `toolbarItems` 提供带图标的 `MIRROR` 命令并把它写进工作区的 `toolbar`
- **THEN** 工具栏出现该按钮，点击启动与命令行敲 `MIRROR` 相同的会话

#### Scenario: 未知 id 跳过

- **WHEN** 货架里引用了宿主已关闭的命令
- **THEN** 该格不渲染，工具栏其余按钮正常

#### Scenario: 复合项整体移动

- **WHEN** 用户在对话框里拖动「极轴 ▾」
- **THEN** 开关与增量角菜单一起移动，不存在只有菜单没有开关的格

### Requirement: 自定义工具栏

右键工具栏按钮 MUST 提供「从工具栏移除」「在此处插入分隔」「自定义工具栏…」。

自定义对话框 MUST 由**编排区**与**来源列**两块组成，两块之间 MUST 可以互相拖动：从来源列拖进
编排区即上架，从编排区拖回来源列即移出，编排区内拖动即改顺序。编排区 MUST 把货架排成一条
**横栏**，每一格 MUST 与工具栏按钮同尺寸并画同一枚图标——对话框里排出来的就是工具栏上画出来的。

工具栏此刻的宽度可知时，编排区 MUST 在「会被收进『更多』的第一格」之前画一枚切口标记，其后的
格 MUST 呈现为收起态且仍可拖动；宽度不可知时 MUST NOT 画这枚标记，MUST NOT 猜一个位置。

来源列 MUST 逐条印出该格的**第二条入口**（单键、命令词，或命令面板）。该声明 MUST 住在源码的
目录里而 MUST NOT 只住在用例里。

「设计 / 动画」与保存 MUST NOT 出现在任一块；「选择」MUST 显示为固定项且 MUST NOT 可拖动。
宿主注入的项 MUST 标明来源。改动 MUST 写入偏好 `workspace.toolbars[当前工作区 id]`。

#### Scenario: 右键移除

- **WHEN** 用户右键「直线」并选择「从工具栏移除」
- **THEN** 按钮消失，当前段出现修改点

#### Scenario: 拖动重排

- **WHEN** 用户在对话框里把一格拖到另一格之前并点「完成」
- **THEN** 工具栏按新顺序渲染，且该顺序随工作区记住

#### Scenario: 从来源列拖进货架

- **WHEN** 用户把来源列里的「圆」拖到编排区两格之间松手
- **THEN** 该格插在那个位置，来源列里不再有它

#### Scenario: 拖回来源列即移出

- **WHEN** 用户把编排区里的「创建容器」拖到来源列上松手
- **THEN** 该格从货架消失并出现在来源列里

#### Scenario: 选择不可移除

- **WHEN** 用户查看对话框或右键「选择」
- **THEN** 「选择」标为固定，没有移除入口，拖动它不产生任何位置变化

#### Scenario: 来源列印出第二条入口

- **WHEN** 用户打开对话框查看来源列
- **THEN** 每一条都带着它的第二条入口，绘图命令印命令词或单键，只有动作的印「命令面板」

### Requirement: 自定义物料面板

工作区管理菜单、**组件面板标签的右键菜单**与瓦片右键 MUST 都提供「自定义物料面板…」。标签右键
MUST 在面板里一个瓦片都没有时仍然可用——空面板正是最需要配置的那一档。

对话框 MUST 与「自定义工具栏」共用同一套骨架：同一个对话框壳、同一条页脚、同一列来源、同一套
拖拽与键盘语义。编排区 MUST 把货架排成一列**段卡**，段卡 MUST 直接带上该段的选项：文件夹来源
的两个开关（按子文件夹分组 / 默认折叠）与基础组件的单项勾选（`paletteHidden` 的 Preset MUST NOT
出现）。面板标题与搜索框开关是**面板级**的，MUST 排在编排区之外。

来源列 MUST 列出还没上架的基础组件与资源里的文件夹路径，MUST NOT 另做一棵资源树。
「重置为默认」MUST 在页脚左端。改动 MUST 写入偏好 `workspace.palettes[当前工作区 id]`。
瓦片右键的「从面板隐藏」MUST 只对基础组件可用，「只看这一组」与「在资源里打开此文件夹」MUST
只对文件夹来源的瓦片可用。

#### Scenario: 标签右键打开

- **WHEN** 用户右键组件面板的标签
- **THEN** 菜单里有「自定义物料面板…」，选它打开对话框

#### Scenario: 空面板仍可配置

- **WHEN** 货架上只剩一段而那一段引用的文件夹已不在资源里，面板显示「找不到」
- **THEN** 右键标签仍可打开对话框，用户可以去掉那一段或添加别的来源

#### Scenario: 添加来源

- **WHEN** 用户把来源列里的 `Symbols / 变电站` 拖进编排区
- **THEN** 货架在那个位置多出一段，默认按子文件夹分组
- **AND** 面板立即显示这一段

#### Scenario: 段卡直接带选项

- **WHEN** 用户查看一段文件夹来源的段卡
- **THEN** 「按子文件夹分组」与「默认折叠」两个开关就在这张卡上，不需要先选中它

#### Scenario: 隐藏基础组件

- **WHEN** 用户右键「Container」并选择「从面板隐藏」
- **THEN** 瓦片消失，当前段出现修改点，从资源拖入布局容器仍可用

### Requirement: 货架编排的拖拽与键盘

两个货架对话框的编排区 MUST 同时提供指针与键盘两条重排通道，两条通道 MUST 写同一份草稿——
一列 id 加一个插入下标；指针与键盘各自只负责把那个下标算出来。

指针那条 MUST 走 Pointer Events 与指针捕获，MUST NOT 使用 HTML5 Drag and Drop。拖动 MUST 在
**指针离开过按下点**之后开始，MUST NOT 引入位移阈值——按下不动 MUST 仍然是一次普通的选中。
拖动期间：

- 落点 MUST 画成**两格之间的一条插入线**，MUST NOT 高亮被指针压住的那一格。
- 被抓走的那一件 MUST 在原位留下影子，松手在无落点处 MUST 落回原处。
- 落区（编排区或来源列）MUST 整体高亮回答「这里能放」，跟着光标那件东西 MUST 带徽标回答
  「松手会发生什么」，两者 MUST NOT 合成一处。

键盘那条 MUST 是「抓起—移动—放下」：编排区是 `listbox`，方向键移动焦点，`空格` 抓起与放下，
抓起之后方向键移动那一件，`Escape` 放弃并回原位，`Delete` 移出，`\` 在其后插入分隔；来源列
`Enter` 与 `空格` 上架。每一次抓起、移动、放下与放弃 MUST 经 live region 播报当前位置与总数。

#### Scenario: 按下不动仍是选中

- **WHEN** 用户在一格上按下并原地松开
- **THEN** 该格被选中，货架顺序不变

#### Scenario: 拖动中的三种指示

- **WHEN** 用户抓起一格并移到另外两格之间
- **THEN** 那两格之间出现插入线，原位留着影子，编排区整体高亮且光标处的副本带「加入」徽标

#### Scenario: 拖到无落点处松手

- **WHEN** 用户把一格拖到对话框之外并松手
- **THEN** 货架顺序不变，影子消失

#### Scenario: 键盘抓起并移动

- **WHEN** 用户把焦点落在一格上，按 `空格`，按两次方向键，再按 `空格`
- **THEN** 该格前移两位，live region 依次播报抓起、两次移动与放下

#### Scenario: 键盘放弃

- **WHEN** 用户抓起一格、移动一次后按 `Escape`
- **THEN** 该格回到原位，货架顺序与抓起之前逐项相同

