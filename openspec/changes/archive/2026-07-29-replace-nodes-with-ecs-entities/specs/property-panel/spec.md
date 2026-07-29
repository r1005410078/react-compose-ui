## ADDED Requirements

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
