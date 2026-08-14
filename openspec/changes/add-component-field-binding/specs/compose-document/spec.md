## MODIFIED Requirements

### Requirement: Renderer Props 绑定 Component

ComposeDocument v6 MUST 支持可选内建 `Bindings` Component，并 MUST 同时接受 version 1 与 version 2。
Version 1 MUST 保持既有 `rendererProps.fields` 顶层 Prop 绑定；version 2 MUST 允许可选 `rendererProps`
与 `componentFields`，其中 `componentFields` 把 Component Key 与稳定 Field 名称分别映射到引用。引用
MUST 为 `{ scope: 'page', exportName: string }`。`rendererProps`（version 1 与 2）MUST 只允许出现在
拥有 Renderer 的 Entity 上；`componentFields` MUST NOT 要求 Entity 拥有 Renderer，但引用的 Component
MUST 存在于该 Entity 上。Bindings MUST 只保存严格 JSON 引用，不得保存脚本当前值、State、Computed 或
Function。Core MUST 校验引用形状但 MUST NOT 依赖运行时 Registry 判断 Renderer Prop、Component 或
Field 是否存在；全部分区均未绑定时 MUST 拒绝空 Component。

#### Scenario: 保存页面返回成员绑定

- **WHEN** 一个 Renderer Entity 把 `text` 与 `onClick` 分别绑定到页面返回成员 `num` 与 `onAdd`
- **THEN** version 1 或 version 2 文档 JSON 往返后保留两个稳定引用
- **AND** 文档中不包含两个成员的当前值或函数对象

#### Scenario: 保存 Component 字段绑定

- **WHEN** 一个 Entity 的 `WidgetSwitcher.activeIndex` 绑定到页面返回成员 `activeStep`
- **THEN** Core 以 version 2 `componentFields` 保存 Component Key、稳定 Field 名称和页面引用
- **AND** WidgetSwitcher authored `activeIndex` 与 `activeStep` 当前值分别保留且互不覆盖

#### Scenario: 保留未知绑定目标

- **WHEN** 文档包含当前 Registry 未声明的合法 Renderer Prop、Component Key、Field 名称或页面返回成员
- **THEN** Core 继续保留合法 Bindings JSON
- **AND** 运行时消费方负责诊断和 authored fallback

#### Scenario: 拒绝非法 Bindings

- **WHEN** Bindings 集合为空，`rendererProps` 出现在没有 Renderer 的 Entity 上，`componentFields`
  引用的 Component 在该 Entity 上不存在，或 version、scope、分区、目标名称、exportName 的形状非法
- **THEN** ComposeDocument 校验返回精确路径的稳定 issue
- **AND** 不返回部分有效文档

#### Scenario: 兼容读取旧 Bindings

- **WHEN** ComposeDocument v6 包含合法 `Bindings.version: 1`
- **THEN** Core 与 Renderer 绑定 Runtime 保持既有解析结果，且序列化不改写 version
- **AND** 只有首次保存 Component 字段绑定时才把该 Entity 的候选写成 version 2
