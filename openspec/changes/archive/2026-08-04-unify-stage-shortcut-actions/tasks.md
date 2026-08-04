# 任务

## 1. 动作执行层与呈现层分离

- [x] 1.1 Red：为 `createComposeEditorActionHandlers` 写失败测试，覆盖可用性以稳定标识表达、不依赖 locale
- [x] 1.2 Green：抽出与语言无关的执行层，`createComposeEditorActions` 改为在其之上补本地化
- [x] 1.3 确认既有 action-catalog 与 command-panel-actions 测试仍然通过

## 2. Stage 接管协议

- [x] 2.1 Red：为 `onShortcutAction` 写失败测试，覆盖已接管、未接管、临时平移不参与、未提供回调时行为不变
- [x] 2.2 Green：在键盘处理中于临时平移与 Escape 之后插入接管钩子
- [x] 2.3 在公共入口与 TSDoc 中说明该属性语义

## 3. 编辑器接线

- [x] 3.1 控制器构建执行层并经 `stageProps` 传入 Stage
- [x] 3.2 命令面板与 Stage 共用同一执行层实例

## 4. 一致性验证

- [x] 4.1 断言键盘适配选择与命令面板适配选择得到相同视口
- [x] 4.2 e2e 确认既有 `Control+g` 等键盘编辑路径行为不变

## 5. 验证

- [x] 5.1 `bun run lint`、`typecheck`、`test`、`build`
- [x] 5.2 `bun run test:e2e`
- [x] 5.3 `openspec validate unify-stage-shortcut-actions --strict`
