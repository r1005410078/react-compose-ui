# Change: 为编辑器面板增加共享右键菜单

## Why

画布、操作日志、历史和命令调试台缺少目标相关的快捷操作，且危险操作没有统一确认路径。
已有六个 Compose 右键菜单也没有把已经生效的键盘动作直接呈现在菜单末尾，用户难以发现或
确认重绑后的键位。

## What Changes

- 复用 ComposeContextMenu 为画布、操作日志、历史、命令、场景树和资源浏览器提供右键菜单。
- 新增共享 ComposeConfirmDialog，并为日志清空、命令清空和命令重放提供确认。
- 命令调试台支持复制和以新命令 ID 重放当前会话事件。
- 新增共享 ComposeKeybinding 格式化能力；只为存在且当前生效的动作显示快捷键，重绑后菜单立即
  同步。日志和命令面板不显示不存在的键位，场景树粘贴目标也不把“建议粘贴”误标为精确动作键位。

## Impact

- Affected specs: components、stage、operation-log、history、command-panel、scene-tree、asset-browser。
- Affected packages: components、editor、stage、operation-log、history、command-panel、scene-tree、asset-browser。
