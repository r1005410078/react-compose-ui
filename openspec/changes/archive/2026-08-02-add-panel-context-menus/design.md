## Decision

领域包直接依赖共享 components 的 ContextMenu 与 ConfirmDialog；菜单只调用各包既有受控协议，
不修改 ComposeDocument、OperationLog 存储格式或 History 时间线协议。命令重放生成新的 command ID，
设置 source 为 `command-panel-replay` 并移除 mergeKey。

## 快捷键显示

`@compose-ui/components` 负责将结构化 `ComposeKeybinding` 格式化为当前平台的可读文本，并继续使用
`ComposeContextMenuShortcut` 放在菜单项尾部。macOS 采用 `⌘⇧Z` 等符号，其他平台采用
`Ctrl+Shift+Z`；同一动作的多个有效替代键位以 ` / ` 分隔。Editor 的设置面板复用同一 formatter，
避免设置和右键菜单产生两套显示规则。

领域菜单只从实际安装的键盘处理器或当前快捷键配置读取提示。Stage 读取 `shortcuts`，HistoryPanel
只在宿主显式传入 `shortcuts` 时显示，Editor 则将其当前 preferences 的 history 键位传给默认面板。
场景树只标注复制、剪切和删除：键盘粘贴执行的是“建议粘贴”，并不等价于任何一个具体的右键粘贴
目标。Operation Log 与 Command Panel 没有键盘动作，因此始终不渲染快捷键占位。
