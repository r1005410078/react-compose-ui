# scene-tree Specification

## Purpose
TBD - created by archiving change add-scene-tree-component. Update Purpose after archive.
## Requirements
### Requirement: 独立受控场景树包
The scene tree package MUST export `ComposeSceneTree` and compose-prefixed contracts, compose the shared
`ComposeTree`, and no longer accept an explicit locale prop.

#### Scenario: Scene tree after vNext import
- **WHEN** a consumer uses the vNext scene tree
- **THEN** selection, move commands, keyboard navigation, visibility and locking retain their current behaviour

### Requirement: 大规模虚拟化树

系统 MUST 使用 `@tanstack/react-virtual` 虚拟化固定高度树行，并使用迭代式算法构建索引
和可见列表。完全展开 5000 个节点时，不得把全部节点同时挂载到 DOM。

#### Scenario: 渲染 5000 个展开节点
- **WHEN** 宿主提供 5000 个完全展开的节点并显示场景树
- **THEN** DOM 中只存在视口及 overscan 范围内的树行且不超过 80 行
- **AND** 用户可以滚动并定位到第 5000 个节点

#### Scenario: 虚拟行保留树语义
- **WHEN** 虚拟列表只渲染树的一部分
- **THEN** 每个可见行仍提供正确的层级、同级位置、集合大小、选择和展开语义

### Requirement: 树选择与导航

系统 MUST 支持桌面 IDE 式单选、多选、连续范围选择、展开折叠和键盘导航，并将结果
通过受控回调通知宿主。

#### Scenario: 使用鼠标组合选择
- **WHEN** 用户单击节点、使用 Ctrl/Cmd 切换节点或使用 Shift 选择连续范围
- **THEN** 组件分别请求替换选择、切换选择或选择可见行范围
- **AND** macOS 的 Ctrl+点击不得打开自定义或浏览器右键菜单

#### Scenario: 使用键盘浏览树
- **WHEN** 树具有焦点且用户使用方向键、Home、End 或 Space
- **THEN** 焦点、展开和选择按照树控件语义变化
- **AND** 被定位的虚拟节点会滚动进入视口

### Requirement: 场景节点操作意图

系统 MUST 支持重命名、删除、移动、可见性和锁定操作，并尊重节点能力标记。组件 MUST
只发出操作意图，不直接修改宿主节点数据。

#### Scenario: 编辑允许操作的节点
- **WHEN** 用户重命名、删除、切换可见性或切换锁定状态
- **THEN** 组件发出包含目标节点和新值的对应操作意图

#### Scenario: 使用平台键位开始重命名
- **WHEN** 节点具有焦点且用户在非 Windows 平台按 Enter，或在 Windows 平台按 F2
- **THEN** 组件进入该节点的重命名编辑状态
- **AND** 双击节点不会进入重命名状态

#### Scenario: 节点禁止某项操作
- **WHEN** 节点能力或锁定状态禁止用户请求的操作
- **THEN** 组件不发出该操作意图
- **AND** 控件以禁用或不可用状态呈现

#### Scenario: 拖动多个选中节点
- **WHEN** 用户拖动一个已选节点且当前存在多个可移动选中节点
- **THEN** 组件发出保留相对顺序的批量移动意图
- **AND** 不允许把节点移动到自身、后代或不可包含子项的目标中
- **AND** 拖动未选节点时先请求单选该节点并只移动该节点
- **AND** 同时选中祖先与后代时只移动最外层祖先

#### Scenario: 默认编辑器应用多选移动意图
- **WHEN** 用户在默认编辑器中使用 Shift 连续选择多个节点并拖动其中一个已选节点
- **THEN** 默认编辑器保留完整受控选择并在 Pointer Up 后应用批量移动意图
- **AND** 场景树与 Canvas 按移动后的树顺序同步显示全部节点

#### Scenario: 使用静态节点和落点横线拖拽
- **WHEN** 主指针移动超过启动阈值并在树内拖动节点
- **THEN** 节点位置在 Pointer Up 前保持不变
- **AND** 顶部 4px 和底部 4px 有效插入位置显示按目标层级缩进的横线
- **AND** 中间 16px 有效父级位置隐藏横线并整行高亮目标节点
- **AND** Pointer Up 时只发出一次 `move` 操作意图
- **AND** Escape、Pointer Cancel 或失去指针捕获时取消操作
- **AND** 指针位于任意节点上半区时可以插入该节点之前，包括展开子树的第一个子项
- **AND** 落点横线保持在真实插入边界，不因前一节点存在展开后代而跳到子树末尾

#### Scenario: 将拖动节点放入目标节点
- **WHEN** 指针进入允许包含子项的目标节点中间 16px
- **THEN** 组件整行高亮目标节点并准备追加到其子项末尾
- **AND** Pointer Up 发出的 `move` 使用目标节点 ID 作为 `parentId`
- **AND** 锁定、叶节点、自身、后代和同位 no-op 目标不高亮且不显示替代反馈

#### Scenario: 显示单节点和多节点拖拽预览
- **WHEN** 主指针移动超过 5px 启动拖拽
- **THEN** 单个实际移动节点显示跟随指针的名称胶囊
- **AND** 多个实际移动节点显示跟随指针的数量圆标
- **AND** 数量排除锁定、禁止移动及已由选中祖先包含的后代节点
- **AND** 预览不拦截指针并限制在视口内
- **AND** Pointer Up、Escape、Pointer Cancel 或失去指针捕获后移除预览

#### Scenario: 通过横向位置改变层级
- **WHEN** 用户在拖动中横向移动指针
- **THEN** 组件按 16px 层级单位选择有效目标深度
- **AND** 从节点文字、图标或行空白处开始拖动时，相同水平位置默认保持源节点层级
- **AND** 向右最多增加一级，向左可以逐级提升到根层
- **AND** 不足一个完整层级单位的横向抖动不改变目标深度
- **AND** 相同位置、搜索状态、自身、后代、锁定父节点或不可包含子项的目标不显示有效横线

#### Scenario: 从文字区域快速拖动并改变层级
- **WHEN** 用户从节点文字区域开始并用一次快速指针移动跨过启动阈值和一个层级单位
- **THEN** 浏览器不创建原生文字选区，组件仍计算并提交有效落点
- **AND** 默认示例允许组件节点成为有效父节点，并展开新父节点显示移动后的子项层级

#### Scenario: 拖拽期间展开和滚动
- **WHEN** 指针在可包含子项的折叠节点上稳定悬停 600ms
- **THEN** 组件通过受控展开回调请求展开该节点
- **AND** 指针接近视口上下边缘时仅纵向自动滚动
- **AND** 场景树不得产生横向滚动或裁掉节点左侧内容

### Requirement: 新增节点入口

系统 MUST 在检索框附近显示且只显示一个新增节点图标按钮，并在节点与空白区右键菜单中
提供相同新增动作。按钮和菜单 MUST 使用相同的建议插入位置算法。

#### Scenario: 使用新增按钮
- **WHEN** 用户点击检索框附近具有可访问名称的新增按钮
- **THEN** 组件根据当前选择发出一个 `create` 操作意图

#### Scenario: 从选中节点右键新增子节点
- **WHEN** 用户右键点击允许包含子项的选中节点并执行新增
- **THEN** `create` 操作使用该节点 ID 作为 `parentId`
- **AND** 默认编辑器将新节点插入该父节点并展开它

#### Scenario: 连续新增多个节点
- **WHEN** 宿主连续处理多个 `create` 操作意图
- **THEN** 每次操作均创建具有稳定唯一身份的新节点
- **AND** 场景树、Canvas 和 Inspector 对同一节点的选择与内容更新保持同步
- **AND** 删除其中一个节点不影响其他已创建节点

#### Scenario: 计算建议插入位置
- **WHEN** 选中节点可以包含子项
- **THEN** 建议插入到该节点子级末尾
- **AND** 不可包含子项时建议插入到该节点之后
- **AND** 无选择时建议插入根节点末尾

#### Scenario: 使用上下文菜单新增
- **WHEN** 用户在节点或空白区打开上下文菜单并选择新增节点
- **THEN** 组件使用与新增按钮相同的插入位置规则发出 `create` 操作意图

### Requirement: 节点检索

系统 MUST 提供名称检索框，以及大小写敏感 `Aa`、全词匹配 `ab` 和正则表达式 `.*`
三个独立开关。检索结果 MUST 保留匹配节点的祖先路径，不得清除被过滤节点的选择。

#### Scenario: 使用普通与组合检索
- **WHEN** 用户输入检索词并切换任意匹配开关组合
- **THEN** 组件使用对应的大小写、Unicode 全词和正则规则匹配节点名称
- **AND** 只显示匹配节点及其祖先路径

#### Scenario: 清空检索
- **WHEN** 用户清空检索内容
- **THEN** 场景树恢复检索前的展开状态和完整可见节点集合
- **AND** 受控选择保持不变

#### Scenario: 输入无效正则表达式
- **WHEN** 正则模式启用且检索文本无法编译
- **THEN** 输入框设置 `aria-invalid`
- **AND** 组件显示可访问错误并显示零个结果
- **AND** 组件不抛出运行时异常

### Requirement: 受控场景树命令

系统 MUST 导出 `useSceneTreeCommands`、`SceneTreeCommandController`、`SceneTreeCommand`
和 `SceneTreeClipboard`，并允许 `SceneTree` 通过可选 `commands` 属性复用外部 controller。
Hook MUST 只保存实例内剪贴板，MUST NOT 修改节点、生成 ID、克隆业务数据或访问系统剪贴板。

#### Scenario: 计算新增命令位置
- **WHEN** 宿主执行新增子节点、兄弟节点、根节点或建议新增命令
- **THEN** Hook 分别计算子级末尾、目标之后、根级末尾或按容器/叶节点/无选择规则计算位置
- **AND** 叶节点、锁定目标或无效父级对应命令不可执行

#### Scenario: 规范化批量命令来源
- **WHEN** 当前选择包含多个、乱序、失效、锁定或祖先与后代节点
- **THEN** Hook 按树顺序规范化来源并去除已由选中祖先包含的后代
- **AND** 剪切过滤锁定或禁止移动节点，删除过滤锁定或禁止删除节点，复制保留锁定节点

#### Scenario: 复制并重复粘贴节点
- **WHEN** 用户复制有效选择并粘贴到有效子级、兄弟或根级位置
- **THEN** Hook 发出包含来源 ID、目标父级和索引的 `duplicate` 操作意图
- **AND** 复制剪贴板保留并允许重复粘贴，也允许复制到来源节点的后代

#### Scenario: 剪切并移动节点
- **WHEN** 用户剪切有效选择并粘贴到有效位置
- **THEN** Hook 只发出一次 `move` 操作意图并在成功发出后清空剪贴板
- **AND** 自身、后代、非法父级、同位 no-op、失效来源或空剪贴板不发出操作

#### Scenario: 删除和清空剪贴板
- **WHEN** 用户执行删除或调用 `clearClipboard`
- **THEN** 删除仅包含允许删除的规范化节点并发出 `delete` 意图
- **AND** 清空后所有粘贴命令不可执行

### Requirement: 场景树命令菜单与快捷键

系统 MUST 用场景树命令 controller 驱动节点及空白区上下文菜单和键盘快捷键，并呈现命令
可用状态。菜单 MUST 为复制、剪切和删除显示其实际键位；“粘贴为子节点”“粘贴为兄弟节点”和
“粘贴到根级”不得显示 `Cmd/Ctrl+V`，因为键盘行为只会执行建议粘贴，而不是这些精确目标动作。

#### Scenario: 打开节点命令菜单
- **WHEN** 用户右键已选节点或未选节点
- **THEN** 已选节点保留多选，未选节点先请求单选
- **AND** 菜单按新增子节点、新增兄弟节点、复制、剪切、粘贴为子节点、粘贴为兄弟节点、删除顺序分组显示
- **AND** 复制、剪切和删除在菜单末尾显示实际键位，粘贴目标不显示快捷键

### Requirement: 默认编辑器复制节点

默认示例 MUST 处理 `duplicate` 操作，为复制的文本节点及子树生成稳定且唯一的新 ID，并同步
场景树、Canvas、Inspector 和选择状态。

#### Scenario: 复制文本组件并继续编辑
- **WHEN** 用户复制一个或多个文本节点并粘贴到有效位置
- **THEN** 示例按原相对顺序插入具有新 ID 的深拷贝并选中新副本
- **AND** 在 Inspector 修改副本文本只同步副本对应的场景树和 Canvas 内容

### Requirement: 场景树视觉与样式隔离

系统 MUST 使用 Tailwind CSS 构建场景树自有样式，禁用 Preflight 并使用包级前缀。树行
MUST 使用单行固定高度布局，默认节点使用三维盒子图标。顶部工具区
MUST 使用接近 Unity 层级面板的紧凑密度，同时保留清晰的焦点状态和可点击区域。

#### Scenario: 显示默认场景树外观
- **WHEN** 宿主加载场景树样式并渲染根节点与普通节点
- **THEN** 检索栏、单个新增按钮、展开箭头、文档图标、三维盒子图标、可见性和锁定控件按深色主题显示
- **AND** 顶部工具栏高度为 32px，新增按钮与检索框高度为 24px，检索文字为 11px
- **AND** 节点虚拟行间距为 24px，实际行背景高度为 22px、上下各留 1px，左右各内缩 4px 并使用 5px 圆角
- **AND** 新增按钮不显示外围边框，加号图标为 14px 且在点击区域中水平和垂直居中
- **AND** 大小写、全词和正则按钮具有完整可点击区域，启用时显示明确的蓝色背景与边框
- **AND** 节点行使用普通箭头光标，可点击按钮使用手型光标，拖拽启动后才使用抓取光标
- **AND** 未选中行悬停时使用 VS Code 式 `#2a2d2e` 浅灰背景
- **AND** 选中但未键盘聚焦的行使用低调的 `#37373d` 圆角胶囊背景，不显示高亮蓝色侧边条
- **AND** 键盘聚焦行使用 `#062f4a` 背景与 `#007fd4` 内描边，并优先于悬停和选中样式
- **AND** 开关启用状态与上述节点行状态可被视觉区分

### Requirement: 场景树内建本地化

SceneTree MUST 接受可选 zh-CN 或 en-US locale，并在未提供时保持 zh-CN。检索、空状态、菜单、
操作名称、错误和 ARIA 文案 MUST 来自完整内建词典；节点 label MUST 保持宿主值。

#### Scenario: 使用英文场景树

- **WHEN** 宿主以 en-US 挂载 SceneTree 并打开检索与命令菜单
- **THEN** 内建控件、状态、菜单和可访问名称显示英文
- **AND** 节点 label 不被翻译

#### Scenario: 独立使用默认语言

- **WHEN** 宿主独立挂载 SceneTree 且不提供 locale
- **THEN** 现有简体中文内建文案和行为保持不变

### Requirement: SceneTree 组合公共 Tree

SceneTree MUST 依赖 `@compose-ui/components` 的公共 Tree 承载虚拟行、受控选择/展开、键盘和
Pointer 拖排，同时在 scene-tree 内保留场景命令、检索工具栏、右键菜单、可见性和锁定语义。
现有 SceneTree 公共 API、操作 intent 和规范视觉 MUST 保持兼容。

#### Scenario: 迁移后使用场景树

- **WHEN** 宿主按现有 SceneTreeProps 挂载并操作场景树
- **THEN** 选择、展开、检索、命令、重命名、可见性、锁定和 reparent intent 保持原行为
- **AND** 消费者不需要直接配置公共 Tree

#### Scenario: 保持场景树视觉

- **WHEN** 默认深色工作区渲染迁移后的 SceneTree
- **THEN** 行高、缩进、图标、选择、焦点、拖拽目标和工具栏黄金视觉无非预期变化

### Requirement: 普通行的无领域外部拖拽

SceneTree MUST 允许宿主为普通行拖拽注册外部 drag type 和受控生命周期，并只传递稳定 nodeIds、普通
payload 与 client point；它 MUST NOT 依赖 Core、assets、Component Store 或 Asset Browser。一次普通行
拖拽在树内有效目标结束时 MUST 继续执行既有 move，在注册外部目标结束时 MUST 结束外部会话，其他位置
MUST 取消且不移动节点。

#### Scenario: 树内移动优先

- **WHEN** 普通行拖拽在合法树内目标松开
- **THEN** SceneTree 只发出既有 move operation
- **AND** 外部会话收到 cancel 而不是 drop

#### Scenario: 导出规范化多选

- **WHEN** 用户拖动已选行并在树外注册目标松开
- **THEN** 外部生命周期收到按树规则规范化的稳定 nodeIds、注册 type 和最终 client point
- **AND** SceneTree 不发出 move operation

#### Scenario: 外部拖拽不可用

- **WHEN** 宿主未注册外部拖拽或选择被宿主拒绝
- **THEN** 普通树内选择、键盘和重排保持现有行为

### Requirement: 宿主提供节点语义图标

SceneTree MUST 渲染宿主提供的 Group、Container、Base Component 与 Variant 图标及 accessible name，
不得仅用颜色区分语义。

#### Scenario: 区分结构与关联实例

- **WHEN** 节点模型包含 Group、Container、Base instance 与 Variant instance
- **THEN** 每种语义显示可辨识形状和对应 accessible name

### Requirement: 组件实例内部子树投影

SceneTree MUST 支持宿主把组件实例解析后的内部实体树作为该实例节点的后代提供，内部节点使用与宿主实体
ID 不冲突的复合地址标识。投影 MUST 惰性发生：仅在实例节点展开或被下钻时构建。内部节点 MUST 可选中，
并按宿主声明的能力位表达可重命名、可删除、可移动等受限行为。

#### Scenario: 展开实例查看内部层级

- **WHEN** 用户展开一个 component-instance 节点
- **THEN** 树显示解析后的内部实体层级，节点以复合地址标识且不与宿主实体 ID 碰撞

#### Scenario: 内部节点可选中

- **WHEN** 用户点击实例内部节点
- **THEN** 选区包含该复合地址，宿主据此把编辑路由到实例覆盖

#### Scenario: 受限能力位

- **WHEN** 宿主声明内部节点不可移出实例子树
- **THEN** 树拒绝越界拖放并保持原结构

#### Scenario: 未展开保持单节点

- **WHEN** 实例节点未展开
- **THEN** 不构建内部投影，观感与既有单节点一致

### Requirement: 场景树复用共享右键菜单

场景树 MUST 使用 `@compose-ui/components` 的 ContextMenu 与 Hook 呈现节点和空白区命令菜单，
不得保留独立 Portal 定位、菜单键盘循环或外部点击关闭实现。

#### Scenario: 在共享菜单中保留场景选择语义

- **WHEN** 用户右键已选节点、未选节点或树空白区
- **THEN** 已选节点保留多选，未选节点先请求单选，空白区只显示根级命令
- **AND** Ctrl/Meta 特例仍不打开自定义菜单，命令顺序、禁用状态和危险删除标记保持不变

### Requirement: 场景树区分组件实例与普通节点

场景树 MUST 为 component-instance 使用组件符号图标（空心，表示引用），MUST NOT 使用与主组件库
实心图标相同的填充样式冒充库本体。普通物料节点 MUST 继续使用其物料图标。节点 accessible name
或可见标签 MUST 不暗示页面行为「创建变体」。

#### Scenario: 实例行使用组件符号

- **WHEN** 场景树包含 component-instance 与 Rectangle 子节点
- **THEN** 实例行显示空心组件符号，Rectangle 显示矩形类图标

#### Scenario: 复制不改变树语义为变体资源

- **WHEN** 用户通过场景树复制组件实例节点
- **THEN** 树中出现第二个实例节点
- **AND** 不出现新的库资源创建成功作为该操作的必然结果

