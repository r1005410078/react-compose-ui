# 变更：命令面板检索与编辑器动作目录

## 原因

`@compose-ui/command-panel` 目前只是观测工具：订阅 runtime 事件，显示 committed / noop / rejected 流水，
没有任何可执行入口。用户无法从一处检索并调用编辑器操作。

同时，编辑器的可调用操作分散在四套互不相通的词汇里：`BUILTIN_COMMAND_TYPES`（23 条文档变更，无展示元数据
且 runtime 不可枚举）、`ComposeEditorShortcutAction`（17 条动作，有稳定 ID、双语标签与可改键位，但没有执行
入口）、`ComposeSceneTreeCommand`（11 条，仅限场景树包）、`ComposeCommandPreset`（宿主自备的调试表单）。

关键约束：`TransactionRuntime.dispatch` 每条命令必然产生 transaction 进入历史，没有豁免口；而 viewport、
tool、选区、面板与偏好被刻意排除在命令系统之外。因此不能简单地把「缩放」变成 `EditorCommand`——撤销栈会被
视口操作淹没。

## 变更内容

- 在 `@compose-ui/command-panel` 新增 `ComposeCommandAction` 协议与 `actions` prop：宿主提供已本地化的可执行
  动作，面板负责检索、分组、键盘导航与执行。
- 面板顶部新增检索输入框。空查询保持现有事件日志形态不变；`/` 显示全部动作；文本按 title / category /
  keywords / id 过滤。`/` 为可选前缀。
- 在 `@compose-ui/editor` 新增动作目录，把现有 16 条 `ComposeEditorShortcutAction` 装配为可执行动作，复用
  既有双语标签、用户可改键位与 scope 分组。
- 动作的 `run()` 自行决定走 `dispatch`（进历史）还是会话状态 setter（不进历史），据此在不改动
  `EditorCommand` 协议的前提下让视口与工具操作可被检索调用。

## 影响

- 受影响规范：`command-panel`、`editor-preferences`
- 受影响代码：`packages/command-panel` 公共入口与面板实现、`packages/editor` 控制器与动作目录
- 不改动 `@compose-ui/core` 的 `EditorCommand` / `TransactionRuntime` 协议
- 不改动 `packages/stage` 的键盘处理；其 if 阶梯与动作目录并存并共用 `stage-engine` planner，去重是后续独立变更
