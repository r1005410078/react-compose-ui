# 任务

## 1. 动作协议与过滤模型

- [x] 1.1 在 `packages/command-panel/src/types.ts` 定义 `ComposeCommandAction`，扩展 `ComposeCommandPanelProps.actions`
- [x] 1.2 Red：为 `command-filter.ts` 写失败测试，覆盖前导 `/` 剥离、多字段匹配、分组、空查询与空结果
- [x] 1.3 Green：实现纯函数 `filterComposeCommandActions` 与分组
- [x] 1.4 从 `src/index.tsx` 导出新类型

## 2. 检索 UI

- [x] 2.1 Red：为检索区写失败测试，覆盖三态行为、combobox/listbox ARIA、`aria-activedescendant`、上下键、Enter、Escape、禁用项不执行
- [x] 2.2 Green：实现 `command-search.tsx` 并挂载到 `compose-command-panel.tsx`
- [x] 2.3 同步 `compose-command-panel.test.tsx` 顶部本地类型 shim
- [x] 2.4 在 `commandMessages` / `getCommandMessages` 补 zh-CN 与 en-US 文案
- [x] 2.5 在 `styles.css` 补检索区样式，沿用既有 token
- [x] 2.6 补带 actions 的 Storybook story，含禁用项与长列表
- [x] 2.7 确认既有 13 个测试语义未变

## 3. 编辑器动作目录

- [x] 3.1 Red：为 `action-catalog.ts` 写失败测试，覆盖空选区禁用、`canUndo=false` 禁用、排除临时平移、未提供设置入口时省略该条
- [x] 3.2 Green：实现 `createComposeEditorActions`，复用 `getEditorShortcutActionLabel`、`COMPOSE_EDITOR_SHORTCUT_SCOPES` 与 `stage-engine` 可用性判断
- [x] 3.3 在 `controller.tsx` 装配目录并传入命令面板
- [x] 3.4 为 `UseComposeEditorControllerOptions` 增加可选设置入口回调，并在 `compose-editor.tsx` 透传

## 4. 键盘隔离

- [x] 4.1 Red：焦点在检索框内输入 Stage 快捷键字符，断言工具、视口与文档均未变化
- [x] 4.2 确认 History 撤销重做语义不受影响，不得断言其失效

## 5. 端到端与验证

- [x] 5.1 e2e：打开命令 tab，输入 `/`，执行一条文档动作，断言文档变化且事件日志新增
- [x] 5.2 e2e：执行一条视口动作，断言视口变化且历史条目数不变
- [x] 5.3 `bun run lint`、`typecheck`、`test`、`build`
- [x] 5.4 `bun run test:e2e`
- [x] 5.5 `openspec validate add-command-action-palette --strict`
