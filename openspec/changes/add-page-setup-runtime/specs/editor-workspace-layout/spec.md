## ADDED Requirements

### Requirement: 页面 setup 脚本关联流程

Editor MUST 通过 Asset Browser 既有宿主菜单扩展为页面提供创建、打开、更换和解除 setup 脚本。创建
MUST 生成自包含 `.setup.js` 最小模板并以稳定资源引用更新页面；打开 MUST 复用独立脚本标签、dirty、
revision 与冲突处理。能力不足时入口 MUST 禁用，Editor MUST NOT 让 Asset Browser 拥有页面语义。

#### Scenario: 为页面创建 setup 脚本

- **WHEN** 可写页面没有 setupScript 且用户选择创建页面脚本
- **THEN** Editor 创建 JavaScript 模板、以页面 expected revision 写入稳定引用并打开脚本标签
- **AND** 页面文档内容和独立事务历史保持不变

#### Scenario: 创建脚本后页面写入冲突

- **WHEN** 脚本文件创建成功但页面 setup 引用因 revision 冲突写入失败
- **THEN** Editor 不声称关联成功，并显示新脚本已成为未关联资源及可恢复操作
- **AND** 不静默删除脚本或覆盖远端页面

#### Scenario: 更换或解除 setup 脚本

- **WHEN** 用户把页面关联到另一可引用 JavaScript 或解除当前关联
- **THEN** 页面只更新 setupScript 引用且既有 Bindings 按 exportName 保留
- **AND** 原脚本资源不被删除

### Requirement: 页面返回作用域与 Props 绑定

活动页面的 Inspector MUST 能查看 setup 返回成员的名称、value/method kind、当前值或 diagnostic，并在
Renderer Prop Contract 显式允许时提供绑定。绑定、换绑与解绑 MUST 通过文档事务修改 Entity Bindings，
支持 undo/redo；State/Computed 运行值变化 MUST NOT 产生事务。

#### Scenario: 把值和方法绑定到 Renderer Props

- **WHEN** 活动页面返回 State `num` 和 Function `onAdd`，选中 Renderer 声明兼容的 text 与 onClick Contract
- **THEN** Inspector 分别列出兼容候选并以一个可逆事务保存每次绑定
- **AND** authored text 字面值继续保留，Function 不进入 Renderer.props JSON

#### Scenario: 脚本重载刷新作用域

- **WHEN** 页面 setup 脚本成功保存新 revision
- **THEN** Editor dispose 旧 scope、显示新初始 State 并重新解析既有 Bindings
- **AND** 缺失返回成员显示错误但不会自动提交删除绑定的事务

### Requirement: 页面标签拥有 Script Runtime 生命周期

每个已打开页面标签 MUST 在其页面聚合数据之外维护独立 Script Runtime 会话。切换标签 MUST 保留非活动
标签实例，关闭标签 MUST dispose；同一页面再次打开 MUST 激活既有页面和 scope。工作区回退到宿主单文档
controller 时 MUST 不猜测页面 setup。

#### Scenario: 两个页面标签状态隔离

- **WHEN** 两个页面标签分别运行 setup 且用户切换活动标签
- **THEN** Stage、作用域面板和 Inspector 显示当前页面实例的数据
- **AND** 非活动页面 State 保留但不会驱动当前工作区 Entity

#### Scenario: 关闭页面清理脚本实例

- **WHEN** 用户关闭页面标签并完成既有 dirty 决策
- **THEN** Editor dispose 该页面的 Effect、订阅和方法 wrapper
- **AND** 迟到脚本结果不得更新其他页面或回退工作区
