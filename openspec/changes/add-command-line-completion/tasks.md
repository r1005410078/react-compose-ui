## 1. 共享 Pattern

- [x] 1.1 `matchComposeCommandCompletions`：`/` 列出全部并按其后文本过滤；无 `/` 时空缓冲不提示；
      整词 > 前缀 > 显示名/检索词包含，同档保持次序
- [x] 1.2 `ComposeCommandLine` 加 `completions` 与 `messages.completionsLabel`；列表是 listbox，
      输入框在传入词汇表时成为 combobox（`aria-expanded` / `aria-controls` /
      `aria-activedescendant`），焦点不离开输入框
- [x] 1.3 键盘：方向键移动高亮、`Enter` 提交高亮项的 `id`、`Tab` 填进缓冲、`Escape` 先收起列表；
      命令进行中不提示；点一条与键入全名走同一条提交路径
- [x] 1.4 不可用的命令照样列出并标明 `disabledReason`
- [x] 1.5 单元测试（纯函数）与组件测试（角色、键盘、整词优先、两级 Escape、命令进行中不提示）

## 2. Stage

- [x] 2.1 `useStageDrafting` 返回 `commandDescriptors`（内建 + 宿主注入，不记忆化）
- [x] 2.2 `ComposeStage` 把它交给命令行，文案加 `draftingCommandCompletions`，placeholder 改成
      「键入命令，/ 列出全部」
- [x] 2.3 组件测试：`/` 列出内建绘图与编辑命令，前缀 + 回车启动补全出来的那条
- [x] 2.4 既有测试与端到端里的定位从 `textbox` 改成 `combobox`

## 3. 端到端与文档

- [x] 3.1 端到端：列表含宿主注入的动作与其不可用原因、第一级 Escape 只收起列表、前缀回车启动、
      点一条等价于敲全名
- [x] 3.2 `AGENTS.md` 补一段
- [x] 3.3 `bun run lint && bun run typecheck && bun run test && bun run build && bun run test:e2e`
