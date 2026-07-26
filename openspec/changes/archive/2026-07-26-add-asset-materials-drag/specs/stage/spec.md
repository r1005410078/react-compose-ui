## ADDED Requirements

### Requirement: 异步资源节点创建

Stage MUST 使用 assetResolver 和 Registry seed factory 异步创建资源节点，最多并发读取四项。
成功项 MUST 以一个事务创建，失败项 MUST 被排除并形成精确汇总。

#### Scenario: 单项固有尺寸创建

- **WHEN** 用户把图片或 SVG 放到 Stage
- **THEN** 最长边不超过 512 且小图不放大，无法读取尺寸时回退 320×180
- **AND** 成功 drop 恰好创建并选中一个节点事务

#### Scenario: 批量网格创建与部分失败

- **WHEN** 多项资源中至少一项解析成功
- **THEN** 成功项按最多四列、24 世界单位间距排列，第一项中心位于 drop 点
- **AND** 一个 batch 只包含成功项并选中这些节点

#### Scenario: 等待期间父级失效

- **WHEN** 异步读取期间目标 Frame 被删除或锁定
- **THEN** 成功节点回退到 Canvas 根并保持 drop 世界锚点

#### Scenario: 资源解析取消

- **WHEN** Stage 卸载或 assetResolver 更换
- **THEN** pending drop 被中止且不派发命令
