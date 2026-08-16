## 1. 规范

- [x] 1.1 建立页面脚本 Canvas Inspector 属性的需求、设计与场景，并运行 strict validate。
  - Result：`openspec validate integrate-page-script-inspector --strict` 通过；PostHog telemetry 因沙箱无网络未上报，不影响退出码。

## 2. 属性交互行为循环

- [x] 2.1 Red/Green：未关联页面列出同目录 setup、选择已有脚本并在能力允许时快捷创建。
  - Red command/result/reason：`cd packages/editor && bun run test -- src/pages/page-script-scope-panel.test.tsx src/inspector/canvas-inspector.test.tsx`，3 failed；旧作用域块没有脚本选择、快捷创建或 Canvas 属性 renderer。
  - Green command/result：定向组件测试通过；选择写入稳定引用，快捷创建生成 `Home.setup.js`、关联并打开。
  - Regression command/result：`cd packages/editor && bun run test`，14 files / 137 tests 通过。
- [x] 2.2 Red/Green：已关联页面显示当前脚本、运行成员、诊断以及打开/解除操作。
  - Red command/result/reason：同一命令中已关联场景找不到“选择页面脚本”控件；旧组件只有名称和值定义列表，没有打开/解除与成员类别 UI。
  - Green command/result：定向组件测试通过；覆盖 State 实时值、method、diagnostic、手动重新加载、打开和解除。
  - Regression command/result：Editor 全量 137 tests 通过。

## 3. Canvas Inspector 聚合行为循环

- [x] 3.1 Red/Green：页面脚本与输出字段共用一个 Property Panel Root，Canvas/Entity 与页面切换不泄漏状态。
  - Red command/result/reason：同一命令中 Canvas 场景找不到 `pageScript` 属性路径；`pageScriptInspector` 尚未接入 Schema renderer。
  - Green command/result：Canvas 单测与页面工作区集成测试通过；`pageScript` 路径与输出字段共用一个搜索工具栏，页面选择/解除同步活动会话。
  - Regression command/result：Editor 全量 137 tests 通过。
- [x] 3.2 Refactor：复用既有 setup 模板、页面关联和脚本标签打开路径，移除旧独立作用域样式。
  - Regression command/result：`DEFAULT_PAGE_SETUP_SCRIPT` 同时服务资源菜单和 Inspector；Editor 全量 137 tests 通过。

## 4. 纵向验证

- [x] 4.1 更新页面计数器 E2E 断言，覆盖属性内成员、选择/创建入口与确定性视觉黄金文件。
  - Result：页面计数器纵向流程通过；新增 `page-script-canvas-property.png`，验证同一 Canvas Inspector 中的全宽折叠分组、手动重新加载、紧凑返回成员、更多菜单、打开脚本与重载诊断。
- [x] 4.2 同步 Editor README，说明页面脚本位于 Canvas Inspector 及 Provider 能力边界。
  - Result：README 已说明同目录选择、快捷创建、打开/解除、运行成员与 Provider 能力降级。
- [x] 4.3 运行 OpenSpec strict validation、lint、typecheck、test、build、E2E 与 `git diff --check` 并记录结果。
  - Result：`openspec validate integrate-page-script-inspector --strict`、`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 与 `git diff --check` 均通过；E2E 35/35 通过。全量测试在沙箱外复验，以允许 Storybook 浏览器测试监听临时本地端口。
