# Change: 为编辑器面板增加共享右键菜单

## Why

画布、操作日志、历史和命令调试台缺少目标相关的快捷操作，且危险操作没有统一确认路径。

## What Changes

- 复用 ComposeContextMenu 为四个领域面板提供右键菜单。
- 新增共享 ComposeConfirmDialog，并为日志清空、命令清空和命令重放提供确认。
- 命令调试台支持复制和以新命令 ID 重放当前会话事件。

## Impact

- Affected specs: components、stage、operation-log、history、command-panel。
- Affected packages: components、stage、operation-log、history、command-panel。
