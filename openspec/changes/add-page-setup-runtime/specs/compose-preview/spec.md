## ADDED Requirements

### Requirement: Preview 页面 setup 运行

Preview MUST 能够接受聚合页面与 Script Runtime 配置，创建当前页面实例的 setup scope，并用解析后的
value/method runtime Props 渲染。独立只传 ComposeDocument 的既有 Preview MUST 保持纯字面渲染，除非
宿主显式注入 scope。卸载 MUST dispose setup、Effect、订阅、方法 wrapper 与迟到异步结果。

#### Scenario: 点击方法更新绑定值

- **WHEN** Preview 页面把 Text.text 绑定到 State `num`、Button.onClick 绑定到方法 `onAdd`
- **THEN** 点击 Button 调用同一页面实例的方法并让 Text 显示递增后的 num
- **AND** 文档、事务历史和 authored Props 保持不变

#### Scenario: 独立文档 Preview 保持兼容

- **WHEN** 宿主只向 ComposePreview 传入 ComposeDocument 与 Registry
- **THEN** Preview 使用 authored Props 正常渲染
- **AND** 不猜测、搜索或执行任何页面脚本

### Requirement: 嵌套页面脚本实例隔离

Preview 递归渲染 Page Slot 时 MUST 为每个 Slot 页面创建独立 setup scope，并继续应用既有循环与深度
护栏。一个嵌套脚本失败 MUST 只降级对应 Slot；Slot 卸载或页面引用变化 MUST dispose 旧 scope。

#### Scenario: 两个 Page Slot 引用同一计数页面

- **WHEN** 两个 Slot 同时渲染同一页面且用户只点击其中一个实例的方法
- **THEN** 只有该 Slot 内的绑定值更新
- **AND** 两个实例分别拥有 Effect cleanup 与 diagnostic 生命周期
