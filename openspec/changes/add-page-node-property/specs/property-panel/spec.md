## ADDED Requirements

### Requirement: node 基础属性 Editor

属性面板 MUST 提供稳定 editor ID 为 `node` 的基础 editor，用于编辑指向宿主节点的引用值。该 editor
MUST 呈现当前值的人类可读标签、提供可筛选的候选列表以供选择，并 MUST 提供清空入口。提交
MUST 先通过字段 Schema 校验再走统一受控变更回调。该 editor MUST NOT 依赖 ComposeDocument、资源
Provider 或编辑器工作流类型。

#### Scenario: 从候选列表选择

- **WHEN** 用户打开 node editor 的候选列表并选中一个候选
- **THEN** 面板以该候选值发出一次受控变更
- **AND** 字段显示该候选的可读标签

#### Scenario: 清空引用

- **WHEN** 用户对已有引用的 node 字段执行清空
- **THEN** 面板以空值发出一次受控变更
- **AND** 字段显示未设置状态

#### Scenario: 未知引用值

- **WHEN** 字段值指向宿主已无法解析的节点
- **THEN** 字段显示可辨识的占位标签
- **AND** 该值不被自动改写或清空

#### Scenario: 只读与绑定
- **WHEN** 字段处于只读状态，或该字段已启用变量绑定
- **THEN** 选择、清空与拖入均不产生受控变更
- **AND** 字段仍显示当前有效值

### Requirement: node Editor 宿主端口

属性面板 MUST 通过实例级宿主端口为 node editor 提供候选集合、可读标签解析、可接受的拖拽媒体类型
列表，以及把拖拽载荷解析为候选的入口。端口 MUST NOT 要求面板理解候选值的领域含义，面板
MUST NOT 使用模块级可变状态保存端口。未注入端口时 node 字段 MUST 呈现无候选的可访问状态且仍可清空。

#### Scenario: 端口提供候选与标签

- **WHEN** 宿主注入端口并给出候选集合与标签解析
- **THEN** 候选列表按端口内容呈现
- **AND** 已保存值的标签由端口解析得到

#### Scenario: 未注入端口

- **WHEN** 字段使用 node editor 但宿主未注入端口
- **THEN** 字段呈现无候选的可访问状态
- **AND** 已有值仍可被清空

### Requirement: node Editor 拖入赋值

node editor MUST 作为拖放目标接受宿主声明的拖拽媒体类型。仅当拖拽数据的类型与宿主声明的类型
存在交集时，editor MUST 接受该拖拽并给出可见的放置反馈；否则 MUST NOT 阻止默认行为。放置时
editor MUST 把命中的媒体类型与其文本载荷交由宿主端口解析，解析成功且通过 Schema 校验后
MUST 以「拖入」为原因发出一次受控变更。解析失败 MUST NOT 产生变更。

#### Scenario: 接受宿主声明的拖拽

- **WHEN** 拖拽携带宿主声明的媒体类型并落在 node 字段上
- **THEN** 字段在悬停期间显示放置反馈
- **AND** 放置后以拖入为原因发出一次受控变更

#### Scenario: 拒绝无关拖拽

- **WHEN** 拖拽只携带宿主未声明的媒体类型
- **THEN** 字段不显示放置反馈且不阻止默认行为
- **AND** 放置不产生受控变更

#### Scenario: 载荷无法解析

- **WHEN** 放置的载荷类型匹配但宿主端口无法解析出候选
- **THEN** 不产生受控变更
- **AND** 字段保持原值
