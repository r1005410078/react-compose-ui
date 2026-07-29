# property-panel Specification

## Purpose
TBD - created by archiving change add-property-panel. Update Purpose after archive.
## Requirements
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
ID 或 renderer matcher 为 `v.custom` 等类型选择 UI。Renderer MUST 可以声明普通三列或标题行加
全宽内容区布局，字段 metadata MUST 可以覆盖 renderer 默认布局。Registry MUST NOT 使用模块级可变状态。

#### Scenario: 使用显式自定义 editor
- **WHEN** 字段 metadata 指定一个已注册 renderer ID
- **THEN** 面板使用该 renderer 显示和编辑字段
- **AND** renderer 的 commit 仍经过完整 Schema 校验和统一变更回调

#### Scenario: 缺少类型 renderer
- **WHEN** 字段既没有内置 renderer 也没有匹配的自定义 renderer
- **THEN** 面板显示包含字段名称和 Schema 类型的可访问不支持状态
- **AND** 不会用不安全的字符串转换修改该值

#### Scenario: 使用全宽自定义 renderer
- **WHEN** 匹配的 renderer 或字段 metadata 声明全宽布局
- **THEN** 面板在紧凑标题行显示字段名称与统一操作
- **AND** renderer 在下一行跨越属性名、编辑器和操作区三列
- **AND** metadata 布局优先于 renderer 默认布局，未声明布局时保持普通三列
- **AND** 搜索、筛选、只读、存在性、重置和受控提交语义保持一致

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

#### Scenario: 外部重置清除自定义数值草稿
- **WHEN** 自定义数值 renderer 提交有效值后，受控 value 因分组重置发生变化
- **THEN** renderer 显示新的受控值而不是先前提交时的本地草稿
- **AND** 同一复合 renderer 中的每个数值输入均同步恢复默认值

### Requirement: 双分隔线三列布局

系统 MUST 为普通字段使用共享的属性名、编辑器和右侧操作区三列布局，并 MUST 提供两条可以分别
调整相邻列边界的垂直分隔线。全宽自定义 renderer 的内容区 MUST 不受三列宽度和普通控件轨道限制。

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
- **THEN** 属性名列和操作列分别恢复到 160px 与 36px，并在窄面板下安全 clamp
- **AND** 列宽不会写入 localStorage、Schema 或受控 value

### Requirement: 属性面板视觉与样式隔离

系统 MUST 提供作用域限定的紧凑深色样式入口，并 MUST 允许宿主通过包级 CSS 变量调整主题与密度。
样式不得重置宿主的全局元素样式。

#### Scenario: 宿主加载属性面板样式
- **WHEN** 宿主导入 `@compose-ui/property-panel/styles.css`
- **THEN** header、工具栏、分组、字段、错误、操作区和分隔线使用一致的紧凑深色视觉
- **AND** 面板滚动、焦点和 hover 状态在宿主页面中清晰可见

#### Scenario: 显示 UE4 参考密度
- **WHEN** 示例应用以默认桌面布局显示 Rectangle 属性面板
- **THEN** Inspector 约为 400px，属性面板内容区约为 365px，属性名列和操作列分别为 160px 与 36px
- **AND** 普通编辑控件在不超过 234px 的右对齐轨道内显示，复杂自定义 renderer 可以在标题下占满整行
- **AND** 正文约为 12px，header、工具栏、一级分组、嵌套分组、字段行和输入框分别约为
  52px、36px、28px、26px、26px 和 22px
- **AND** Checkbox、操作按钮和绑定入口分别约为 16px、22px 和 20px

#### Scenario: 宿主覆盖紧凑密度
- **WHEN** 宿主覆盖公开的字体、Header、工具栏、分组、字段、控件或树缩进 CSS 变量
- **THEN** 公共面板区域使用覆盖后的几何值
- **AND** 未覆盖的密度变量继续使用 UE4 紧凑默认值

#### Scenario: 显示 UE4 扁平分组标题栏
- **WHEN** 面板同时显示展开和收起的一级、嵌套属性分组
- **THEN** 一级标题栏使用贯穿整行的扁平深灰背景、单层低对比边线和靠左的小型实心三角
- **AND** 展开与收起只改变三角方向及内容可见性，不改变标题栏背景、尺寸或边线
- **AND** 嵌套标题栏使用更弱的纯色层级，不使用高光渐变、阴影或卡片式分隔

#### Scenario: 深层属性保持可读
- **WHEN** 属性结构包含多级对象、集合或分组
- **THEN** 层级只改变标题、字段标签和树形引导线的紧凑缩进，不得移动共享编辑列边界
- **AND** 每级缩进约为 14px，并在深层级封顶于约 72px 以保留字段名称空间
- **AND** 每条字段横向支线 MUST 从当前父级竖线向右连接字段名，不得从竖线左侧穿过

#### Scenario: 层级线避让交互控件
- **WHEN** Record key 等独立交互控件跨过父级树形竖线的坐标
- **THEN** 控件使用不透明背景显示在层级线之上，层级线不得穿过控件内容或边框
- **AND** 层级线不得拦截控件的 Pointer、焦点或文本编辑交互

#### Scenario: 显示 Rectangle 参考控件细节
- **WHEN** 用户查看默认 Rectangle 的 Transform、Appearance、Layout 和 State
- **THEN** 参考数值按要求显示一位小数，角度与像素单位显示在控件内部
- **AND** Checkbox、Visibility 眼睛图标、Alignment 图标、颜色色块和选中态符合 UE4 深色视觉
- **AND** Advanced、Diagnostics 与 Supported Types 保持默认折叠

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

### Requirement: 默认节点类型覆盖

示例应用启动时 MUST 创建并选中 Rectangle 默认节点；该节点 MUST 在同一个受控 Valibot Schema 中
覆盖属性面板已经支持的 string、number、bigint、boolean、date、literal、picklist、enum、object、
optional、nullable、nullish、array、tuple/rest、record、union、variant 和 custom renderer 类型族。

#### Scenario: 展开默认节点的完整类型展厅
- **WHEN** 用户打开示例应用且未执行任何新增操作
- **THEN** Scene Tree、Canvas 和属性面板默认显示并选中 Rectangle 节点
- **WHEN** 用户展开“支持类型 Supported Types”分组
- **THEN** 面板按基础类型、存在性包装、集合结构、联合结构和自定义类型显示可折叠子分组
- **AND** 每个受支持类型族至少有一个使用有效默认值的可访问示例字段
- **AND** ECharts custom 字段继续通过实例级 renderer 显示且不成为公共包依赖

### Requirement: 自适应属性操作轨道

系统 MUST 在可调整的右侧操作列中完整暴露存在性、重置和集合操作，并 MUST 在可用槽位不足时使用
可访问的溢出菜单，而不是裁剪、自动撑宽或横向滚动。

#### Scenario: 窄操作列容纳多个操作
- **WHEN** 36px 操作列中的属性同时具有多个操作
- **THEN** 行内显示一个可访问的溢出菜单入口
- **AND** 菜单包含全部可用操作及其禁用状态

#### Scenario: 扩大操作列逐步显示操作
- **WHEN** 用户把操作列扩大到可以容纳两个或三个槽位
- **THEN** 系统按确定优先级直接显示高优先级操作
- **AND** 剩余操作继续出现在最后一个槽位的溢出菜单中

#### Scenario: 通过行上下文菜单执行操作
- **WHEN** 用户在具有操作的属性行打开上下文菜单
- **THEN** 菜单提供与操作轨道一致的完整操作集合
- **AND** 键盘用户可以聚焦、执行和关闭菜单

### Requirement: 受控属性变量绑定

系统 MUST 允许宿主把页面或全局变量单向绑定到显式声明可绑定的逻辑输入，并 MUST 将绑定关系与
Valibot 字面 input 分开受控。所有字段 MUST 通过 Schema metadata 显式授权；自定义类型还 MUST 通过
renderer 的 binding target descriptor 描述可绑定子目标。未提供绑定配置时现有属性面板行为 MUST
保持兼容。

#### Scenario: 未声明字段不启用变量绑定
- **WHEN** 宿主提供 binding 配置，但内置或自定义字段没有声明 `propertyPanel.binding.enabled: true`
- **THEN** 字段不显示绑定入口并继续作为普通字面输入编辑
- **AND** 指向该字段的外部 binding 地址被报告为不存在的目标且不会改变 effective value

#### Scenario: 显式启用内置字段变量绑定
- **WHEN** 内置字段声明 `propertyPanel.binding.enabled: true` 且宿主提供 binding 配置
- **THEN** 字段显示绑定入口并使用固定 target ID `value`
- **AND** `semanticScope` 和宿主 `canBind` 继续过滤兼容候选

#### Scenario: 绑定类型兼容变量
- **WHEN** 用户在属性绑定选择器中选择通过目标 Schema、语义 scope 和宿主规则的变量
- **THEN** 面板发出独立 binding change 而不修改字面 value
- **AND** 输入显示解析后的有效值并阻止直接字面编辑
- **AND** 绑定入口与选择器提供变量名称和解析预览

#### Scenario: 绑定入口不遮挡原控件
- **WHEN** 一个显式启用绑定的逻辑输入处于未绑定、已绑定或错误状态
- **THEN** 系统在原控件旁的独立槽位中显示绑定入口且不覆盖控件内容
- **AND** 未绑定、已绑定和错误入口始终可见，不依赖 hover 或键盘聚焦
- **AND** 默认入口使用约 `36px × 20px` 的 UE4 风格紧凑链条按钮，窄复合输入可缩至约 `20px`
- **AND** 变量名称、解析预览与错误状态通过 tooltip、ARIA 和选择器完整提供

#### Scenario: 搜索分组变量候选
- **WHEN** 用户打开未绑定输入的选择器并输入查询
- **THEN** 选择器只显示匹配查询且类型兼容的候选
- **AND** 候选按页面变量与全局变量分组

#### Scenario: 解绑与恢复默认值
- **WHEN** 用户解绑一个属性
- **THEN** 系统删除绑定并继续显示绑定前保留的字面值
- **WHEN** 用户恢复绑定属性的默认值
- **THEN** 系统删除绑定并把字面值恢复为有效 `defaultValue`

#### Scenario: 变量解析失败时安全回退
- **WHEN** 已绑定变量缺失或当前值不再通过目标或完整根 Schema
- **THEN** effective value 回退到对应字面值且组件继续渲染
- **AND** 绑定 trigger 常显错误状态并可由有错误筛选找到

#### Scenario: 只读面板显示绑定状态
- **WHEN** 面板或字段处于只读状态且已有绑定
- **THEN** 面板显示变量名称、解析预览和状态
- **AND** 用户不能绑定、换绑、解绑或修改字面值

### Requirement: 自定义 Renderer 子目标绑定

系统 MUST 允许自定义 renderer 声明多个稳定的逻辑绑定目标，并 MUST 让属性面板 UI 与宿主 Canvas
通过同一组纯 getter/setter 解析有效值。

#### Scenario: 复合数值输入分别绑定
- **WHEN** 字段 metadata 启用绑定，且 vector2 或 size2 renderer 显式声明 X/Y 或 W/H 子目标
- **THEN** 每个逻辑输入可以独立绑定、预览和解绑
- **AND** 未绑定的同级输入继续编辑原字面字段值

#### Scenario: ECharts 输入分别绑定
- **WHEN** 字段 metadata 启用绑定，且 ECharts renderer 显式声明标题、类型、系列名称和数据子目标
- **THEN** 四个输入可以分别绑定兼容变量
- **AND** 有效绑定通过现有 EChartsOption 映射同步更新真实图表

### Requirement: 结构操作维护绑定地址

系统 MUST 在集合或联合结构发生变化时同步维护受影响的绑定地址，避免绑定漂移到其他属性。

#### Scenario: 数组和 Record 重映射绑定
- **WHEN** 用户移动或删除数组项，或者重命名或删除 record key
- **THEN** 后代绑定地址按同一结构变化移动、换键、移位或删除
- **AND** 未受影响路径的绑定保持不变

#### Scenario: 清理失效后代绑定
- **WHEN** 用户 reset 分组、删除或取消可选值，或者切换 union 分支
- **THEN** 不再存在的后代目标绑定被删除
- **AND** binding change 以 `reset` 或 `remap` 原因发出

### Requirement: 属性面板共享 UI 环境

PropertyPanel MUST 消费共享 Theme/I18n Context，使用语义 token 渲染 Dark/Light，并为搜索、设置、
变量绑定、集合操作、校验状态和可访问名称提供 zh-CN/en-US 内建文案。纯绑定解析 MUST 保留
稳定 issue code，React 展示层 MUST 按 code 本地化；宿主 Schema metadata 保持原文。

#### Scenario: 使用英文浅色属性面板

- **WHEN** PropertyPanel 位于 light/en-US Provider 且包含绑定与集合控件
- **THEN** 第一方 chrome、错误和 ARIA 显示英文并使用完整浅色层级
- **AND** 宿主提供的字段 title、description 与枚举 label 不被翻译

#### Scenario: 覆盖属性面板消息

- **WHEN** 宿主覆盖一个 propertyPanel 命名空间消息
- **THEN** 对应内建文案使用覆盖值
- **AND** 属性 value、Schema 校验与 onValueChange 行为不变

### Requirement: 单面板多属性分组

Property Panel MUST 提供 Root 与 Section 组合 API，使多个独立同步 Schema 在同一面板内共享唯一的
搜索、筛选、显示设置和列宽状态。每个 Section MUST 保持自己的受控 value、default value、只读状态、
校验和变更回调。

#### Scenario: 聚合多个独立 Section

- **WHEN** 宿主在同一个 Property Panel Root 中挂载多个 Section
- **THEN** 界面只显示一套搜索、筛选、设置和列宽控制
- **AND** 编辑一个 Section 只调用该 Section 的变更回调

#### Scenario: 跨 Section 搜索

- **WHEN** 用户搜索匹配某个 Section 名称或后代字段
- **THEN** 仅显示匹配 Section、字段及其祖先
- **AND** 匹配 Section 在搜索期间展开，清空搜索后恢复此前折叠状态

#### Scenario: 保持独立面板兼容

- **WHEN** 宿主在 Root 外继续单独挂载 ComposePropertyPanel
- **THEN** 面板保持现有工具栏、Region、校验和提交行为
- **AND** 同一组件在 Section 上下文内只渲染共享面板中的字段树

