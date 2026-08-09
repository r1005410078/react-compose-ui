## MODIFIED Requirements

### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph 与 Component
Library、中央文档区与 Stage Toolbar、右侧 Component Inspector、底部 Transaction Log 与 Command。
中央区域必须获得扣除三个边缘区后的主要可用空间。未启用页面系统时，中央文档区显示固定 Canvas；
启用页面系统时，中央文档区等待并显示页面文档标签，不得显示无文件的 Canvas。

#### Scenario: 单文档宿主首次挂载编辑器

- **WHEN** 宿主未启用页面系统并挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph、Component Library 与 Component 图标标签，以及标题为
  “Canvas”“日志”“命令”的三个文字标签
- **AND** 三个图标标签分别保留对应的可访问名称和悬停提示
- **AND** Scene Graph 使用设计组件图标，且左侧活动栏底部显示带可访问名称的设置图标
- **AND** Stage Toolbar 显示在 Canvas 内容区域顶部
- **AND** Canvas 内容显示在中央主要区域

#### Scenario: 页面宿主首次挂载编辑器

- **WHEN** 宿主启用页面系统并挂载一个 `ComposeEditor`
- **THEN** 工作区显示左、右、底部工具区和空的中央页面文档组
- **AND** 中央区域不显示标题为“画布”或“Canvas”的固定标签

#### Scenario: Strict Mode 重放初始化

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 左、右、底部各只存在一个 Edge Group
- **AND** 默认外层面板各只存在一个实例
- **AND** 单文档模式有一个 Canvas 面板，页面模式没有 Canvas 面板

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
