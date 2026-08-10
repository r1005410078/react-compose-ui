## MODIFIED Requirements

### Requirement: 双分隔线三列布局

系统 MUST 为普通字段使用共享的属性名、编辑器和右侧操作区三列布局，并 MUST 提供两条可以分别
调整相邻列边界的垂直分隔线。全宽自定义 renderer 的内容区 MUST 不受三列宽度和普通控件轨道限制。
默认布局 MUST 优先将常见 Inspector 的剩余宽度分配给编辑器，同时保持三图标操作列可用。

#### Scenario: 指针调整两条分隔线
- **WHEN** 用户分别拖动属性名/编辑器和编辑器/操作区分隔线
- **THEN** 对应列宽分别变化且所有可见属性行保持对齐
- **AND** 属性名、编辑器和操作区均不小于其最小可用宽度

#### Scenario: 键盘调整分隔线
- **WHEN** 键盘用户聚焦分隔线并按方向键或 Shift 加方向键
- **THEN** 分隔线按标准步长或加速步长移动
- **AND** 当前值和允许边界通过 separator ARIA 属性暴露

#### Scenario: 默认布局优先编辑列
- **WHEN** Inspector 内容区为常见的约 365px 宽度，且用户尚未调整列宽
- **THEN** 属性名列为 120px，右侧操作列为 76px，中间编辑列约为 169px
- **AND** 右侧操作列继续容纳三个 22px 紧凑操作，而编辑列可优先容纳属性内容和并列输入

#### Scenario: 恢复默认列宽
- **WHEN** 用户在设置菜单中执行恢复默认列宽
- **THEN** 属性名列和操作列分别恢复到 120px 与 76px，并在窄面板下安全 clamp
- **AND** 列宽不会写入 localStorage、Schema 或受控 value

### Requirement: 自适应属性操作轨道

系统 MUST 在可调整的右侧操作列中完整暴露绑定、存在性、重置和集合操作，并 MUST 在可用槽位不足时使用
可访问的状态感知聚合菜单，而不是裁剪、自动撑宽、覆盖编辑区或横向滚动。直接入口的稳定优先级 MUST 为：
binding（含 bound/invalid）→ 存在性或新增 → 重置 → 删除 → 移动；同一优先级保持声明顺序，并让 enabled
项排在同优先级的 disabled 项之前。

#### Scenario: 默认三图标操作列容纳绑定与重置
- **WHEN** 默认操作列中的属性同时具有绑定、重置或其他最多三个紧凑操作
- **THEN** 系统按确定优先级直接显示最多三个 22px 图标或既有紧凑控件
- **AND** binding 占用第一个直接槽位，存在性或新增、重置、删除、移动依次使用其余直接槽位
- **AND** 已绑定的单目标入口显示解绑图标，使重置不会因单槽聚合而不可见
- **AND** 已绑定或错误状态通过入口图标或徽标常显，不会只隐藏在菜单内

#### Scenario: 超过三项操作时使用最后一个更多图标
- **WHEN** 绑定和普通操作总数超过当前操作列可直接容纳的三个槽位
- **THEN** 系统按确定优先级直接显示前两个操作
- **AND** 第三个可见槽位显示可访问的“更多”图标
- **AND** 余下操作继续出现在该图标打开的菜单中，并保留禁用状态

#### Scenario: 缩窄或扩大操作列逐步收纳操作
- **WHEN** 用户调整操作列宽度，使可用槽位少于或多于默认三个槽位
- **THEN** 系统按确定优先级直接显示可容纳的操作
- **AND** 一旦存在未直接显示的操作，最后一个可见槽位显示溢出或聚合入口

#### Scenario: 通过行上下文菜单执行操作
- **WHEN** 用户在具有操作的属性行打开上下文菜单
- **THEN** 菜单提供与操作轨道一致的完整操作集合和绑定目标入口
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
- **THEN** 字段操作列提供绑定入口并使用固定 target ID `value`
- **AND** `semanticScope` 和宿主 `canBind` 继续过滤兼容候选

#### Scenario: 绑定类型兼容变量
- **WHEN** 用户在属性绑定选择器中选择通过目标 Schema、语义 scope 和宿主规则的变量
- **THEN** 面板发出独立 binding change 而不修改字面 value
- **AND** 原输入控件替换为变量标识，变量标识显示名称、解析预览并允许打开选择器换绑
- **AND** 操作列中的单目标绑定按钮变为解绑图标；解绑后恢复保留的字面输入

#### Scenario: 多子目标只替换已绑定控件
- **WHEN** 自定义 renderer 的多个 target 中只有部分 target 已绑定
- **THEN** 每个已绑定 target 的原控件替换为对应变量标识
- **AND** 未绑定同级 target 继续显示并编辑原字面输入
- **AND** 变量标识可独立换绑，行级聚合菜单可独立解绑相应 target

#### Scenario: 绑定入口不占用编辑区
- **WHEN** 一个显式启用绑定的逻辑输入处于未绑定状态
- **THEN** 系统不在原控件旁保留绑定槽位，输入宽度与未启用绑定的等价字段一致
- **AND** 绑定入口在属性行 hover、行内 focus 或入口自身 focus 时从既有操作列显示
- **AND** 入口显隐不改变字段、输入或相邻行的几何
- **AND** 完整变量名称、解析预览与操作说明通过 tooltip、ARIA 和选择器提供

#### Scenario: 已绑定和错误入口常显
- **WHEN** 一个绑定目标处于已绑定或解析错误状态
- **THEN** 操作列始终显示蓝色绑定或红色错误状态，不依赖 hover
- **AND** 变量标识用非纯颜色、字段与变量名称以及可访问说明表达值来源
- **AND** 入口获得键盘焦点时可见且不存在不可见焦点停靠点

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
- **AND** 操作列常显错误状态并可由有错误筛选找到

#### Scenario: 只读面板显示绑定状态
- **WHEN** 面板或字段处于只读状态且已有绑定
- **THEN** 面板显示变量名称、解析预览和状态
- **AND** 用户不能绑定、换绑、解绑或修改字面值

### Requirement: 自定义 Renderer 子目标绑定

系统 MUST 允许自定义 renderer 声明多个稳定的逻辑绑定目标，并 MUST 让属性面板 UI 与宿主 Canvas
通过同一组纯 getter/setter 解析有效值。Property Panel MUST 根据 descriptors 自动生成行级聚合入口，
renderer MUST NOT 负责绑定入口的布局。

#### Scenario: 复合数值输入分别绑定
- **WHEN** 字段 metadata 启用绑定，且 vector2 或 size2 renderer 显式声明 X/Y 或 W/H 子目标
- **THEN** 操作列的单个聚合入口按 descriptor 顺序列出每个逻辑目标及其状态
- **AND** 每个逻辑输入可以独立绑定、预览和解绑
- **AND** 未绑定的同级输入继续编辑原字面字段值

#### Scenario: ECharts 输入分别绑定
- **WHEN** ECharts Inspector 提供标题和数据字段，且宿主对两者启用绑定
- **THEN** 两个输入可以分别打开兼容变量的选择器
- **AND** 有效绑定通过现有 EChartsOption 映射同步更新真实图表

#### Scenario: Renderer 无需放置绑定入口
- **WHEN** 宿主 renderer 通过 descriptors 声明一个或多个绑定子目标
- **THEN** Property Panel 自动把这些目标加入字段操作列和行上下文菜单
- **AND** renderer 只通过 `targets` 或 `getTarget()` 读取绑定状态与 effective value
- **AND** renderer 的编辑布局不需要 `.property-panel__binding-target`、`.property-panel__binding-slot` 或
  `renderTrigger()`
