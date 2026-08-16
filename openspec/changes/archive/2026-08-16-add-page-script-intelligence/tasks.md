## 1. 规范与协议

- [x] 1.1 为 Asset Browser 着色、隐藏智能层与 Editor Setup 提示建立 OpenSpec 场景并通过 strict validate。
- [x] 1.2 为 `ComposeScriptIntelligenceProfile`、`ComposeVirtualTextInsertion`、`scriptIntelligence` 与 Runtime 声明常量添加公共协议、TSDoc 和包文档。

## 2. Monaco 着色与隐藏模型

- [x] 2.1 Red/Green：用实际 tokenizer 场景证明 JS/TS 不再是单色，再补齐 basic-language contribution。
  - Red command/result/reason：`cd packages/asset-browser && bun run test -- src/monaco-runtime.test.ts`，1 failed；JS/TS language 的 `loader` 为 `undefined`，证明 basic-language contribution 未注册。
  - Green command/result：`cd packages/asset-browser && bun run test -- src/monaco-runtime.test.ts`，1 passed；JavaScript 与 TypeScript 均产生多个 token 类型。
- [x] 2.2 Red/Green：覆盖虚拟插入校验、正反 offset/range 映射、触及隐藏段的结果丢弃与 Profile 失败降级。
  - Red command/result/reason：`cd packages/asset-browser && bun run test -- src/script-intelligence/virtual-text.test.ts`，测试因虚拟文本模块尚不存在而失败。
  - Green command/result：同一命令，3 passed；覆盖 UTF-16 插入、正反映射、隐藏段拒绝和无效插入降级。
- [x] 2.3 Red/Green：覆盖 completion、hover、signature、diagnostic debounce/迟到丢弃和完整 dispose，实现 shadow model bridge。
  - Red command/result/reason：`cd packages/asset-browser && bun run test -- src/script-intelligence/monaco-script-intelligence.test.ts`，测试因 shadow model bridge 尚不存在而失败。
  - Green command/result：同一命令，1 passed；随后 Asset Browser 全量测试 10 files / 56 tests passed。
- [x] 2.4 Red/Green：关闭 Setup 脚本的类型 Inlay Hint，同时保留后台类型推导能力。
  - Red command/result/reason：`cd packages/asset-browser && bun run test -- src/script-editor.test.tsx src/script-intelligence/monaco-script-intelligence.test.ts`，2 failed；编辑器仍启用 Inlay Hint 且 bridge 仍注册 provider。
  - Green command/result：同一命令通过；编辑器显式关闭 Inlay Hint，bridge 不再注册或查询 Inlay provider。

## 3. Setup 类型与 Editor 接线

- [x] 3.1 Red/Green：为 Runtime 声明文本建立 Context/State/Computed/Setup 契约测试，并导出稳定常量。
  - Red command/result/reason：`cd packages/script-runtime && bun run test -- src/type-declarations.test.ts`，1 failed；公共入口没有导出声明常量。
  - Green command/result：`cd packages/script-runtime && bun run test -- src/type-declarations.test.ts`，1 passed。
- [x] 3.2 Red/Green：扫描三种直接 setup 导出，跳过注释/字符串/模板伪匹配，并用 TypeScript Language Service 证明 `ctx.`、`.value`、只读 Computed、返回类型与错误推导。
  - Red command/result/reason：`cd packages/editor && bun run test -- src/pages/page-script-intelligence.test.ts`，测试因 Setup Profile 与扫描器尚不存在而失败。
  - Green command/result：同一命令，3 passed；TypeScript Language Service 验证 Context 补全、State/Computed、精确返回成员和赋值 diagnostic。
- [x] 3.3 Red/Green：页面能力启用时识别 `*.setup.js` 与页面菜单打开，重复打开更新现有会话，普通 JS 不注入 Profile。
  - Red command/result/reason：`cd packages/editor && bun run test -- src/pages/page-workspace.test.tsx`，新增断言因资源会话没有 `scriptIntelligence` 而失败。
  - Green command/result：同一命令通过；随后 Editor 全量测试 13 files / 133 tests passed。
- [x] 3.4 Red/Green：为全部 `ctx` 工具方法补充中文用途、参数、生命周期与示例提示。
  - Red command/result/reason：Runtime 声明契约测试与 Editor TypeScript Language Service 测试各 1 failed；补全详情没有中文文档。
  - Green command/result：`cd packages/script-runtime && bun run test -- src/type-declarations.test.ts` 1 passed；`cd packages/editor && bun run test -- src/pages/page-script-intelligence.test.ts` 3 passed，确认 `state`、`computed`、`effect` 的补全详情均包含中文示例。
- [x] 3.5 Red/Green：以 Monaco 原生 Markdown fenced code block 呈现并着色示例代码。
  - Red command/result/reason：Runtime 声明契约测试与 Editor Language Service 测试各 1 failed；文档只有缩进文本，没有 `javascript` fenced code block。
  - Green command/result：Runtime 1 passed、Editor 3 passed、Asset Browser bridge 1 passed；Playwright 验证详情面板生成多种 Monaco token class。

## 4. 纵向验证与文档

- [x] 4.1 Playwright：打开 Counter setup，验证多色 token、`ctx.` 建议、无类型 Inlay Hint、类型 marker、可保存与重开后无隐藏声明。
  - Result：目标场景 1 passed；全量 E2E 35 passed。
- [x] 4.2 更新 Asset Browser、Script Runtime 与 Editor README，记录 Profile 边界、JavaScript-only 和不阻断保存。
- [x] 4.3 运行 OpenSpec strict validate、受影响包测试、lint、typecheck、test、build、E2E 与 `git diff --check`，记录实际结果。
  - Result：Script Runtime 15 tests、Asset Browser 56 tests、Editor 133 tests 均通过；根级 lint、typecheck、39 个测试任务、21 个 build 任务及 35 个 E2E 场景通过。OpenSpec strict validate 与 `git diff --check` 在最终收尾复验。
