## ADDED Requirements

### Requirement: 独立受控属性面板

系统 MUST 提供可独立安装的 `@compose-ui/property-panel` React 包。`PropertyPanel` MUST 接收
同步 Valibot Schema、受控 input value、可选 default value 和变更回调，并且不得拥有页面
文档、持久化或撤销历史。

#### Scenario: 宿主挂载属性面板
- **WHEN** 宿主使用有效同步 Schema 和对应 value 挂载 `PropertyPanel`
- **THEN** 面板显示 Schema 对应的属性结构
- **AND** 根元素保留宿主传入的标准 `div` 属性
- **AND** 面板不直接修改宿主传入的 value

#### Scenario: 使用异步 Schema
- **WHEN** 宿主向首版面板传入 async Valibot Schema
- **THEN** 面板显示可访问的不支持说明
- **AND** 所有属性编辑操作保持禁用

### Requirement: Schema 类型自动映射

系统 MUST 从 Valibot Schema 的公开运行时结构生成类型匹配的编辑 UI，并 MUST 正确解包 pipe
与 optional、nullable、nullish 等包装器。

#### Scenario: 显示基础属性类型
- **WHEN** Schema 包含 string、number、bigint、boolean、date、literal、picklist 和 enum 字段
- **THEN** 每个字段显示与输入类型匹配的文本、数值、开关、日期或选择控件
- **AND** pipe 中可映射的数值约束应用于对应控件

#### Scenario: 显示存在性包装器
- **WHEN** 字段允许 undefined 或 null
- **THEN** 字段提供可访问的存在性控制
- **AND** 启用字段时只使用能够通过内部 Schema 的候选默认值

### Requirement: 嵌套与集合属性编辑

系统 MUST 在同一可折叠属性树中支持对象、数组、元组、record、union 和 variant，并 MUST
保持 string/number 字段路径可定位到完整受控值。

#### Scenario: 编辑嵌套对象
- **WHEN** Schema 包含多层对象并且用户展开一个对象分组
- **THEN** 子属性按照稳定路径显示在该分组下
- **AND** 修改叶子属性只替换对应路径上的值

#### Scenario: 修改数组和元组
- **WHEN** 用户新增、删除或移动数组项，或编辑 tuple 固定项和 rest 项
- **THEN** 面板发出与目标结构一致的候选完整值
- **AND** 不允许删除 tuple 固定项或执行无法产生有效值的操作

#### Scenario: 修改 record
- **WHEN** 用户新增、重命名或删除 record 条目
- **THEN** key 与 value 分别通过对应 Schema 校验
- **AND** 重复或无效 key 不会提交给宿主

#### Scenario: 切换联合类型分支
- **WHEN** 用户为 union 或 variant 选择另一个可生成有效默认值的分支
- **THEN** 面板以该分支的有效候选值发出一次分支切换变更
- **AND** 无法生成有效值的分支保持禁用

### Requirement: Metadata 驱动的展示属性

系统 MUST 使用 `v.title`、`v.description` 和 `propertyPanel` metadata 决定属性名称、说明、
顺序、分组、可见性、只读状态、高级状态、单位和 editor ID。Schema metadata MUST NOT 包含
React 组件实例或实现。

#### Scenario: 应用展示 metadata
- **WHEN** 字段声明 title、description、order、unit 和只读 metadata
- **THEN** 面板按指定名称、顺序和单位显示字段及说明
- **AND** 只读字段可查看但不可修改

#### Scenario: 切换高级字段和说明
- **WHEN** 用户通过设置菜单切换高级字段或字段说明
- **THEN** 带对应 metadata 的内容立即显示或隐藏
- **AND** 该设置不修改 Schema 或受控 value

### Requirement: 有效受控变更

系统 MUST 在候选完整 input 通过同步 Schema 校验后才调用 `onValueChange`。回调 MUST 同时
包含 next input、parsed output、字段路径、字段前后值和操作原因。

#### Scenario: 提交有效字段值
- **WHEN** 用户输入能够使完整 Schema 校验成功的新字段值
- **THEN** 面板只调用一次 `onValueChange`
- **AND** 回调详情准确描述字段路径、旧值、新值、原因和 parsed output

#### Scenario: 保留无效输入草稿
- **WHEN** 用户输入暂时无法通过 Schema 的文本或数字
- **THEN** 面板在字段附近显示对应 issue 并保留本地草稿
- **AND** 面板不调用 `onValueChange`
- **AND** 用户修正输入后可以提交有效值

### Requirement: 自定义类型 Renderer Registry

系统 MUST 允许每个 `PropertyPanel` 实例注册自定义 renderer，并 MUST 支持通过 metadata editor
ID 或 renderer matcher 为 `v.custom` 等类型选择 UI。Registry MUST NOT 使用模块级可变状态。

#### Scenario: 使用显式自定义 editor
- **WHEN** 字段 metadata 指定一个已注册 renderer ID
- **THEN** 面板使用该 renderer 显示和编辑字段
- **AND** renderer 的 commit 仍经过完整 Schema 校验和统一变更回调

#### Scenario: 缺少类型 renderer
- **WHEN** 字段既没有内置 renderer 也没有匹配的自定义 renderer
- **THEN** 面板显示包含字段名称和 Schema 类型的可访问不支持状态
- **AND** 不会用不安全的字符串转换修改该值

### Requirement: 搜索筛选与默认值重置

系统 MUST 提供属性搜索、全部/已修改/有错误筛选、分组折叠和按 default value 重置能力。

#### Scenario: 搜索嵌套属性
- **WHEN** 用户输入匹配字段标题、key、路径或 description 的查询
- **THEN** 面板显示匹配字段及其祖先分组并临时展开路径
- **AND** 清空查询后恢复搜索前的折叠状态

#### Scenario: 筛选修改或错误
- **WHEN** 用户选择已修改或有错误筛选
- **THEN** 面板只显示相对 default value 变化或当前具有 issue 的字段及其祖先

#### Scenario: 重置属性分组
- **WHEN** 分组值偏离有效 default value 且用户执行重置
- **THEN** 面板发出一次以默认分组值替换当前分组值的 reset 变更
- **AND** default value 本身保持不变

### Requirement: 双分隔线三列布局

系统 MUST 使用共享的属性名、编辑器和右侧操作区三列布局，并 MUST 提供两条可以分别调整相邻
列边界的垂直分隔线。

#### Scenario: 指针调整两条分隔线
- **WHEN** 用户分别拖动属性名/编辑器和编辑器/操作区分隔线
- **THEN** 对应列宽分别变化且所有可见属性行保持对齐
- **AND** 属性名、编辑器和操作区均不小于其最小可用宽度

#### Scenario: 键盘调整分隔线
- **WHEN** 键盘用户聚焦分隔线并按方向键或 Shift 加方向键
- **THEN** 分隔线按标准步长或加速步长移动
- **AND** 当前值和允许边界通过 separator ARIA 属性暴露

#### Scenario: 恢复默认列宽
- **WHEN** 用户在设置菜单中执行恢复默认列宽
- **THEN** 两条分隔线恢复当前面板宽度下的默认位置
- **AND** 列宽不会写入 localStorage、Schema 或受控 value

### Requirement: 属性面板视觉与样式隔离

系统 MUST 提供作用域限定的紧凑深色样式入口，并 MUST 允许宿主通过包级 CSS 变量调整主题。
样式不得重置宿主的全局元素样式。

#### Scenario: 宿主加载属性面板样式
- **WHEN** 宿主导入 `@compose-ui/property-panel/styles.css`
- **THEN** header、工具栏、分组、字段、错误、操作区和分隔线使用一致的紧凑深色视觉
- **AND** 面板滚动、焦点和 hover 状态在宿主页面中清晰可见

### Requirement: ECharts 自定义类型示例

示例应用 MUST 定义 `EChartOption` 自定义 Valibot 类型、注册实例级 `echart` renderer，并 MUST
把属性修改同步应用到画布中的真实 ECharts 图表。ECharts MUST NOT 成为属性面板包依赖。

#### Scenario: 选择 ECharts 图表组件
- **WHEN** 用户新增或选择示例 ECharts 图表节点
- **THEN** Scene Tree、Canvas 和属性面板引用同一个受控示例组件
- **AND** 图表 option 字段使用已注册的 ECharts 自定义 renderer

#### Scenario: 编辑 ECharts 配置
- **WHEN** 用户通过自定义 renderer 修改图表标题、图表类型、series 名称或数据
- **THEN** renderer 提交通过自定义 Schema 校验的 `EChartOption`
- **AND** 画布中的 ECharts 图表显示最新配置
- **AND** 属性面板公共包中不存在 ECharts 运行时代码或依赖
