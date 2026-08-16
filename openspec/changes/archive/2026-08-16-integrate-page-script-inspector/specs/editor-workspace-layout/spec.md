## ADDED Requirements

### Requirement: 页面脚本作为 Canvas Inspector 属性

活动页面的默认 Canvas Inspector MUST 将页面 setup 显示为与输出尺寸、输出背景共用同一个
Property Panel Root 的“页面脚本”属性，MUST NOT 再在属性工具栏上方显示独立作用域块。
该属性 MUST 只由 Editor 组合页面、资源和 Script Runtime 语义，不得下沉到 Property Panel
或 Asset Browser 包。

#### Scenario: 未关联页面选择或快捷创建脚本

- **WHEN** 活动页面没有 setupScript 且用户查看 Canvas Inspector
- **THEN** 页面脚本属性列出页面同目录中拥有稳定 assetKey 的 `.setup.js` 文件供选择
- **AND** 可写 Provider 提供按页面名快捷创建入口，创建成功后自动关联并打开脚本标签
- **AND** 页面输出、场景文档与事务历史保持不变

#### Scenario: 已关联页面查看和管理脚本

- **WHEN** 活动页面关联的 setup 成功运行
- **THEN** 页面脚本属性显示当前脚本名称以及重新加载、打开、切换和解除操作
- **AND** 属性内列出 setup 返回成员的名称、value/method 类别、当前值以及运行 diagnostic
- **AND** State 更新或 setup revision 重载后，成员信息在同一属性内更新

#### Scenario: 页面与 Inspector 目标切换

- **WHEN** 用户在页面标签、Canvas 输出和 Entity Inspector 目标之间切换
- **THEN** 页面脚本属性只显示活动页面实例的数据并且只出现在 Canvas Inspector
- **AND** 默认 Inspector 始终只有一个属性搜索工具栏

#### Scenario: 页面脚本属性视觉状态

- **WHEN** 用户在深色工作区打开已关联 setup 的 Canvas Inspector
- **THEN** 页面脚本以横跨属性网格的可折叠分组显示，标题栏提供重新加载脚本按钮且低频操作位于更多菜单
- **AND** 返回成员以紧凑列表显示类型徽标、名称与最终值，不重复显示 method 类别
- **AND** 该确定状态具有 Playwright 视觉黄金文件
