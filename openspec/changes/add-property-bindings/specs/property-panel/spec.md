## ADDED Requirements

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

系统 MUST 允许宿主把页面或全局变量单向绑定到可编辑逻辑输入，并 MUST 将绑定关系与 Valibot 字面
input 分开受控。未提供绑定配置时现有属性面板行为 MUST 保持兼容。

#### Scenario: 绑定类型兼容变量
- **WHEN** 用户在属性绑定选择器中选择通过目标 Schema、语义 scope 和宿主规则的变量
- **THEN** 面板发出独立 binding change 而不修改字面 value
- **AND** 输入显示变量名称和解析预览并阻止直接字面编辑

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
- **WHEN** vector2 或 size2 renderer 声明 X/Y 或 W/H 子目标
- **THEN** 每个逻辑输入可以独立绑定、预览和解绑
- **AND** 未绑定的同级输入继续编辑原字面字段值

#### Scenario: ECharts 输入分别绑定
- **WHEN** ECharts renderer 声明标题、类型、系列名称和数据子目标
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
