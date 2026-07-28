## Decision

领域包直接依赖共享 components 的 ContextMenu 与 ConfirmDialog；菜单只调用各包既有受控协议，
不修改 ComposeDocument、OperationLog 存储格式或 History 时间线协议。命令重放生成新的 command ID，
设置 source 为 `command-panel-replay` 并移除 mergeKey。
