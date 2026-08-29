## 1. 命令别名

- [x] 1.1 `PLINE` 补别名 `P`、`RECTANGLE` 补 `R`、`WIRE` 补 `W`、`ARROW` 补 `X`
- [x] 1.2 用例：七条绘图命令各自能以单字母别名解析出来（`stage-engine`）

## 2. 快捷键动作

- [x] 2.1 `ComposeStageShortcutAction` 新增七个 `drafting.*` 动作
- [x] 2.2 `STAGE_SHORTCUT_ACTIONS` 与 `DEFAULT_STAGE_SHORTCUTS` 补齐默认键位
- [x] 2.3 新增 `COMMAND_SHORTCUTS`（动作 → 命令 id），与 `TOOL_SHORTCUTS` 同处

## 3. 接线

- [x] 3.1 `useStageKeyboardCommands` 接收 `startCommand` 与 `isCommandActive`
- [x] 3.2 `compose-stage.tsx` 把 `draftingSession.start` 与 `activeCommandId` 传进去
- [x] 3.3 命令进行中不启动新命令
- [x] 3.4 与别的 Stage 动作撞键时让路；编辑器目录里没有的动作回 `false`

## 4. 测试

- [x] 4.1 组件测试：按 `L` 后命令行进入 `LINE` 的第一步提示
- [x] 4.2 组件测试：`primary+X` 仍是剪切，不启动 `ARROW`
- [x] 4.3 组件测试：焦点在命令行输入框时单键不启动命令
- [x] 4.4 组件测试：命令进行中按 `R` 不替换当前会话
- [x] 4.5 端到端：按 `R` 画一个矩形、按 `L` 画线、焦点在命令行时字母是文本

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`
