## MODIFIED Requirements

### Requirement: ECharts 自定义类型示例

图表 Inspector MUST 由**图表物料包**提供，示例应用 MUST NOT 为了演示而自己再注册一个图表 renderer——示例应用不是产品能力，把「产品该有的图表」放在那里会让它既不可用也不可发现。

图表运行时 MUST NOT 成为属性面板包的依赖，也 MUST NOT 成为基础物料包的依赖。

示例应用 MUST 仍注册至少一个**宿主自定义 renderer**，使「宿主可以注册实例级 renderer」这条扩展点保持有可执行的证据。

#### Scenario: 选择图表组件
- **WHEN** 用户新增或选择一个图表节点
- **THEN** Scene Tree、Canvas 和属性面板引用同一个受控组件
- **AND** 图表字段由图表物料自己的 Inspector 渲染

#### Scenario: 编辑图表配置
- **WHEN** 用户修改图表类型、标题、类目、系列名称或数据
- **THEN** 提交通过图表 Prop Contract 校验的值
- **AND** 画布中的图表显示最新配置
- **AND** 属性面板公共包中不存在任何图表运行时代码或依赖

#### Scenario: 宿主扩展点仍有证据
- **WHEN** 检查示例应用注册的 Renderer
- **THEN** 其中至少有一个是示例应用自己定义的自定义 renderer

### Requirement: 自定义 Renderer 子目标绑定

系统 MUST 允许自定义 renderer 声明多个稳定的逻辑绑定目标，并 MUST 让属性面板 UI 与宿主 Canvas
通过同一组纯 getter/setter 解析有效值。Property Panel MUST 根据 descriptors 自动生成行级聚合入口，
renderer MUST NOT 负责绑定入口的布局。

#### Scenario: 复合数值输入分别绑定
- **WHEN** 字段 metadata 启用绑定，且 vector2 或 size2 renderer 显式声明 X/Y 或 W/H 子目标
- **THEN** 操作列的单个聚合入口按 descriptor 顺序列出每个逻辑目标及其状态
- **AND** 每个逻辑输入可以独立绑定、预览和解绑
- **AND** 未绑定的同级输入继续编辑原字面字段值

#### Scenario: 图表输入分别绑定
- **WHEN** 图表 Inspector 提供类目与系列字段，且宿主对两者启用绑定
- **THEN** 两个输入可以分别打开兼容变量的选择器
- **AND** 有效绑定同步更新画布上真实的图表

#### Scenario: Renderer 无需放置绑定入口
- **WHEN** 宿主 renderer 通过 descriptors 声明一个或多个绑定子目标
- **THEN** Property Panel 自动把这些目标加入字段操作列和行上下文菜单
- **AND** renderer 只通过 `targets` 或 `getTarget()` 读取绑定状态与 effective value
- **AND** renderer 的编辑布局不需要 `.property-panel__binding-target`、`.property-panel__binding-slot` 或
  `renderTrigger()`
