## Context

`SceneTree` 和 `PropertyPanel` 是受控组件，只能发出修改意图，无法判断宿主是否接受。日志若在源组件
内部自动写入，会把被宿主拒绝的意图误记为成功操作。现有 `ComposeEditor` 已提供底部日志插槽，
因此日志状态和 UI 可以独立组合。

## Goals / Non-Goals

- 目标：记录已经成功提交的组件、场景结构、属性和变量绑定变更。
- 目标：按 workspace/document scope 在 IndexedDB 中持久化，并在不可用时安全降级到会话内存。
- 目标：提供紧凑的搜索、筛选、列表和结构化详情 UI。
- 非目标：undo/redo、技术诊断日志、服务端同步、防篡改审计、跨标签页实时同步、导出或清理 UI。

## Decisions

- 新能力放在独立 `@compose-ui/operation-log` 包，不修改 `editor`、`scene-tree` 或 `property-panel`
  的依赖方向。宿主只在实际应用成功的变更边界调用 `record()`。
- Provider 按必填 `scopeId` 持有当前日志状态；默认创建 IndexedDB store，也允许注入 store 进行测试
  或替换。数据库使用 `id` 主键和 `[scopeId, updatedAt]` 索引。
- `record()` 先更新内存，再串行写入 store；存储错误切换到 `degraded`，调用 `onStorageError`，但不
  回滚日志或阻断编辑操作。
- 只有显式传入 `coalesceKey` 的连续记录可以合并。默认窗口为 800ms，且必须是日志流中紧邻的同 key
  操作；合并保留首次 before、最新 after、最新 summary/time 和累计 count。
- 快照转成标记化 JSON 值；Date、BigInt 和 undefined 保真，循环引用、函数和 Symbol 记为
  unavailable。单个快照默认 64KiB，超限仅保存 preview、原始字节数和 truncated 状态。
- 每个 scope 默认保留 1000 条；只有新增记录触发最旧优先清理，合并更新不改变条目数量。
- 日志面板在内存中对当前 scope 的记录搜索和筛选；1000 条上限下首版不引入虚拟化依赖。

## Risks / Trade-offs

- IndexedDB 是本地可修改存储，不满足合规审计要求；UI 和文档明确其定位。
- 高频文本输入仍会产生 IndexedDB upsert，但合并避免记录膨胀，串行队列保证最终顺序。
- 宿主显式记录需要少量接线代码，但能确保只记录成功提交并保持现有包独立。
