## ADDED Requirements

### Requirement: Headless 绘制会话

StageInteractionController MUST 通过普通数据 context、event、snapshot 与 effect 支持 draw preview 和
`drawing.commit`，不得读取 Registry、Renderer props、React 或 DOM。绘制 geometry MUST 在世界坐标中
规范化，pointermove MUST 不 dispatch，pointerup MUST 最多请求一个 commit effect，取消 MUST 丢弃 preview。

#### Scenario: 绘制 preview 与提交

- **WHEN** draw tool 从 surface 开始拖拽并正常松手
- **THEN** snapshot 在拖拽中发布预览 bounds，松手时发出包含 tool、bounds 与合法 parent 命中的 commit effect
- **AND** Engine 不创建 Entity 或读取 Preset 内容

#### Scenario: Shift 锁定正方形与正圆

- **WHEN** 用户使用 rectangle 或 circle 工具拖拽，并在 pointermove 与 pointerup 时按住 Shift
- **THEN** preview 与 `drawing.commit` MUST 使用相同的等宽高 bounds，当前鼠标点 MUST 保持为绘制终点，负向拖拽仍保持正确象限
- **AND** 约束只存在于 Headless Engine；松开 Shift 后恢复常规矩形或椭圆 bounds

#### Scenario: 绘制被取消

- **WHEN** draw gesture 收到 Escape、pointercancel、window blur 或失去有效 pointer capture
- **THEN** draw preview 被清理且不存在 commit 或 command dispatch effect

### Requirement: Headless 两点端点会话

StageInteractionController MUST 通过通用的两点端点 hit、`segmentPreview` snapshot 与 `segment.commit` effect
支持端点拖拽。该协议只包含 Entity ID 与世界坐标，MUST 不读取 Renderer、SVG、Registry、React 或 DOM；
surface 负责解释和持久化两点图形的业务含义。

#### Scenario: 端点预览与提交

- **WHEN** surface 为当前单选 Entity 发送端点 hit，并持续发送 pointermove
- **THEN** Controller 使用既有 grid/smart snap 规则更新 `segmentPreview`，不 dispatch 文档命令
- **AND** pointerup 最多发出一个包含最终首尾坐标的 `segment.commit` effect

#### Scenario: 端点会话取消

- **WHEN** 端点会话收到 pointercancel、Escape、window blur 或失去 pointer capture
- **THEN** `segmentPreview` 被清理
- **AND** 不发出 `segment.commit` 或文档命令 effect

## MODIFIED Requirements

### Requirement: Headless 交互 Controller

系统 MUST 提供实例级 `StageInteractionController`，使用普通数据事件、不可变 snapshot 和 surface effect port
表达 pan、marquee、move、resize、rotate、guide、external drag 与 draw。一个 controller MUST 同时只允许一个
surface 连接。

#### Scenario: 连接并驱动 surface

- **WHEN** 宿主连接一个 surface、更新受控 context 并发送 Pointer 事件
- **THEN** controller 发布对应 phase 与 preview snapshot
- **AND** viewport、selection、pointer capture、绘制提交和命令请求通过 effect port 返回

#### Scenario: 拒绝第二个同时连接的 surface

- **WHEN** 同一 controller 已连接 surface 且另一个 surface 尝试连接
- **THEN** connectSurface 明确抛错
- **AND** 原连接与活动交互保持不变
