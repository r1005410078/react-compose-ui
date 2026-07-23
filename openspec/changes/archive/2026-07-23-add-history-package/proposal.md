# 变更：新增独立历史记录包

## 原因

编辑器当前的修改分散在示例应用状态中，既没有统一的会话历史，也无法通过快捷键撤销或重做。
历史列表还需要作为可独立复用的受控组件，而不是与 Dockview 或场景树内部实现耦合。

## 变更内容

- 新增 `@compose-ui/history` 包，提供不可变快照历史 Hook、受控 HistoryPanel 和快捷键 Hook。
- 为 `ComposeEditor` 增加可选历史控制器和历史面板插槽，并通过子 Dockview 把 History
  作为独立面板放在场景树下方。
- 将示例应用的有效文档编辑接入同一历史时间线，支持撤销、重做和点击记录跳转。
- 增加包级单元/组件测试、编辑器集成测试、浏览器纵向流程和视觉黄金文件。

## 影响

- 受影响的规范：`history`、`editor-workspace-layout`
- 受影响的代码：`packages/history`、`packages/editor`、`app`、根文档与发布配置
- 公共 API：新增 `@compose-ui/history`；`ComposeEditorProps` 新增 `history` 与 `historyPanel`
