# 设计：状态感知的行级属性绑定入口

## 上下文

Property Panel 的字段行已经由属性名、编辑区和可调整操作列三部分组成。变更前操作列默认 36px，并通过
`RowActionRail` 在空间不足时把存在性、重置和集合动作收进溢出菜单。绑定入口目前位于编辑区内，每个
逻辑目标创建一个常驻正常流槽位；这保证了发现性和稳定几何，却让最需要空间的编辑控件承担了成本。

自定义 renderer 已经通过 descriptors 完整声明稳定 target ID、Schema、getter/setter 和状态，面板不需要
renderer 再决定入口放在哪里。将入口提升到字段行后，内置字段、语义 editor 和宿主 renderer 可以采用
同一套操作轨道与聚合逻辑。

## 目标与非目标

- 目标：未绑定字段不再因为绑定能力损失编辑宽度。
- 目标：已绑定和错误状态无需 hover 即可识别，并保持键盘、屏幕阅读器与焦点恢复语义。
- 目标：单目标保持短路径，多目标可以在一个入口中分别管理。
- 目标：绑定与现有行操作在默认三图标操作列中确定地共存，并让重置保持可见。
- 目标：默认三列布局优先保障编辑器宽度，而不牺牲三图标操作轨道。
- 目标：已绑定的控件明确显示所引用的变量，而不是伪装成只读字面输入。
- 非目标：修改绑定地址、候选过滤、effective value、结构重映射或持久化协议。
- 非目标：增加表达式、双向绑定、变量管理或新的编辑器全局模式。

## 决策

### 1. 字段行统一拥有绑定目标

字段节点在选择 renderer 并建立 binding controller 后，把全部可绑定 targets 交给行级
`RowActionRail`。内置标量视为一个固定 `value` target；自定义 renderer 只读取 controller 的
`targets`/`getTarget()`，不再渲染 trigger 或依赖绑定布局 CSS。

这会删除 `PropertyPanelRendererBindingController.renderTrigger()`。`PropertyPanelBindingConfig` 的
受控 bindings、候选与 picker override 保持不变；默认行级入口最终选定单个 target 后，继续复用现有
变量选择器和 bind/unbind 流程。

### 2. 已绑定控件替换为变量标识

Property Panel 新增可复用的 `ComposePropertyPanelBoundValue`。内建标量、第一方 semantic editor 与
materials renderer 在对应 target 已绑定时以该标识替换原本的 input、select、picker 或 node trigger；未绑定
的同级 target 继续显示原控件。标识显示变量名称及简短有效值预览，错误时显示可读错误状态；点击标识会打开
该 target 的选择器以换绑。解绑后，面板继续使用原先保留的 `literalValue` 重新渲染原控件。

这是一个面向宿主 renderer 的公共 React helper，而非把变量显示规则复制到每个 renderer。renderer 继续通过
`getTarget()` 判定是否替换控件；面板不尝试在任意第三方 JSX 外部强行替换其输入元素。没有更新 helper 的宿主
renderer 保持兼容的只读有效值行为。

### 3. 状态感知显隐与解绑

行级入口使用 `literal | bound | invalid` 聚合状态，优先级为 `invalid > bound > literal`：

- `literal`：入口仍在 DOM 和键盘顺序中，但视觉上只在行 hover、行内 `focus-within` 或入口自身
  `focus-visible` 时出现。入口获得键盘焦点时必须立即可见，不能形成不可见焦点停靠点。
- `bound`：单目标入口使用解绑图标、解绑可访问名称与绑定强调色并始终可见。它直接删除 binding，而变量
  标识承担换绑入口；配置级 `renderTrigger` 只覆盖未绑定的直接绑定入口，避免覆盖内建解绑语义。
- `invalid`：入口使用错误色、`aria-invalid` 与错误提示并始终可见。

操作列默认保持 76px，因此显隐不会改变字段、编辑器或相邻行的几何。绑定后的原输入不再渲染，
并通过字段级 `data-binding-state`、变量标识、tooltip 与 ARIA 提示来源；变量名和错误详情不能只靠颜色。

### 4. 单目标直达与聚合菜单

- 当字段只有一个未绑定 target 时，链条按钮直接打开该 target 的变量选择器；已绑定时同一位置变为解绑图标。
- 当字段有多个 targets 时，操作列显示一个绑定目标聚合入口；该菜单按 descriptor 顺序列出 target label、
  当前变量和状态。普通行操作仍按第 5 节的槽位规划显示或进入“更多”菜单。
- 当可用操作列只有一个槽位且字段同时具有 binding target 和普通行操作时，唯一入口改为组合聚合菜单；该
  菜单按“绑定”与“其他操作”分区。选择 target 后打开现有变量选择器，返回时焦点回到组合入口。
- 聚合入口图标/徽标表达最高 binding state；即使其他动作同时存在，已绑定或错误状态也不能只藏在菜单内。
- 行上下文菜单继续提供完整操作集合；多 target 的“绑定”项打开同一个聚合目标列表。

### 5. 三图标操作轨道规划

`RowActionRail` 从只接收扁平动作扩展为同时接收 binding targets 和普通 actions，并由一个确定规划函数
决定直接入口、聚合入口与溢出内容。默认操作列宽度恰好容纳三个 22px 图标（含 2px 间距与边距）；不足三个
时按实际容量收纳，超过三个时最后一个可见槽位替换为“更多”图标，菜单列出所有余下动作及其禁用状态。
直接入口按以下稳定优先级排列：binding（含 bound/invalid）→ 存在性或新增 → 重置 → 删除 → 移动；同一
优先级保留声明顺序，并让 enabled 项排在同优先级的 disabled 项之前。binding 占用第一个直接槽位；其余槽位
按上述普通动作优先级填充。若还有未直接显示的操作，最后一个可见槽位必须改为“更多”。因此绑定、存在性与
重置这三个紧凑操作会全部直显；若再有删除或移动，则“更多”收纳低优先级的余项。

规划函数保持纯逻辑，以默认三槽、窄列、单/多目标、bound/invalid、重置和 disabled 组合做单元测试。不能
通过让按钮溢出、撑宽列或覆盖编辑区来容纳入口。

默认 Inspector 内容区约为 365px：属性名列采用 120px、操作列保持 76px，因此中间编辑列默认获得约 169px。
属性名仍可通过分隔线扩展，窄面板继续以 88px 属性名、32px 操作列和 120px 编辑器的最小宽度安全 clamp。

### 6. 可访问性与指针行为

显隐不能只依赖 hover。键盘聚焦行内控件后入口出现，Tab 可以到达入口；从反向 Tab 直接到达入口时，
入口自身的 focus-visible 使其出现。聚合入口声明 menu/dialog 语义，支持 Escape 关闭、方向键或标准 Tab
  导航，并在关闭 picker 或菜单后恢复到原入口。只读 target 显示状态但禁止绑定、换绑和解绑。
- 变量标识使用可访问按钮语义；其名称包含字段与变量名称。解绑按钮使用字段名作为 accessible name，并在
  解绑后将焦点保留或恢复到重新出现的绑定入口，避免焦点丢失。

## 风险与权衡

- 未绑定入口不再全时可见，首次发现性弱于当前方案；通过 hover、focus、行上下文菜单和一致的操作列位置
  补偿，不增加全局“绑定模式”。
- 变量标识替换控件后，用户不能直接核对 input 控件的格式化值；标识保留变量名称、有效值预览与换绑入口，
  让来源比只读输入更清楚。
- 多目标从每个输入旁一键打开变为先选 target；换取窄 Inspector 中显著更宽的输入区和更少视觉噪声。
- 删除 `renderTrigger()` 会影响自定义 renderer 源码；当前 descriptors 已包含统一渲染所需信息，迁移只需
  删除手工 slot，避免保留两套布局路径。
- 聚合入口会增加操作轨道规划复杂度；用纯规划函数隔离状态组合，React 层只负责渲染与焦点。
