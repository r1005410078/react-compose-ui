## MODIFIED Requirements

### Requirement: 场景树操作接入默认 Controller

默认 Controller MUST 使用当前 Layout Snapshot 规划 Scene Tree move。移入 Layout MUST 自动 Flow，
跨 Layout MUST 保持 Flow 与 insertion index，移出到 free parent MUST 烘焙 Absolute；同父级 Flow
排序 MUST 只修改 Hierarchy 顺序。

#### Scenario: 使用场景树排序 Flow
- **WHEN** 用户在同一 Layout parent 内拖动一个或多个 Flow 场景树项
- **THEN** Controller 提交一次确定性 reorder 并保持所有 LayoutItem 不变
- **AND** Stage 与 Inspector 使用新 Snapshot 立即显示新顺序

