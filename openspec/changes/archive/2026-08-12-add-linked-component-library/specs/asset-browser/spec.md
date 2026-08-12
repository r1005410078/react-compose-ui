## ADDED Requirements

### Requirement: 宿主注册的外部资源放置目标

Asset Browser MUST 允许宿主以受控 external drag session 注册一个或多个 type 的放置处理器，并以 type、
普通 payload、client point 与目标文件夹 id 回调宿主。它可以依赖 assets，但 MUST NOT 读取
ComposeDocument、Scene Tree 或 Component Store。可接受的拖拽悬停可写文件夹或当前目录时 MUST 显示明确
状态；未注册 type、只读目标或处理器拒绝时不得触发写入。

#### Scenario: 接收宿主组件导出

- **WHEN** 宿主注册的外部 type 被拖到可写 Assets 文件夹
- **THEN** Browser 向宿主回调 type、普通 payload、client point 与目标文件夹 id
- **AND** Browser 不解释该载荷为组件或文档

#### Scenario: 拒绝只读或未知目标

- **WHEN** 外部会话悬停只读目录、未知 type 或不可写 Provider
- **THEN** Browser 不显示可放置状态且松手不调用处理器

#### Scenario: 保持资源既有拖拽

- **WHEN** 用户导入系统文件、把资源拖入 Canvas 或在 Browser 内移动资源
- **THEN** 对应既有协议保持不变且不调用外部放置处理器

### Requirement: 组件资源图标

Asset Browser MUST 允许宿主根据媒体类型与已解析摘要为 Base Component 和 Variant 提供不同图标与
accessible name，不得要求 Browser 自身解析组件文件。

#### Scenario: 显示 Base 与 Variant 文件

- **WHEN** 宿主为两个资源描述提供不同语义图标
- **THEN** 资源树与网格均显示对应图标而不改变普通 JSON 文件行为
