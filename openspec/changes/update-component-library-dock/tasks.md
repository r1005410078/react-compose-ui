## 1. 场景树与下方工具 Dock

- [x] 1.1 [Red] 为外层左侧只保留 Scene Graph、内层下方工具组及基础组件默认激活补充 workspace/React 测试并记录失败证据
  - Red command/result: `bun run --cwd packages/editor test -- workspace-layout/workspace-layout.test.ts compose-editor/compose-editor.test.tsx` 失败；外层仍创建第七个 `compose-component-library` 面板，内层没有基础组件面板且无 history 时没有子 Dock。
  - Reason: 目标 Dock 拓扑尚未实现。
- [x] 1.2 [Green] 重构 Editor workspace 初始化和内嵌 Dock，使基础组件与可选历史共享下方标签组
- [x] 1.3 [Regression] 运行 Editor workspace 与 ComposeEditor 测试并记录结果
  - Regression command/result: `bun run --cwd packages/editor test -- compose-editor/compose-editor.test.tsx workspace-layout/workspace-layout.test.ts` 通过（49 tests）；覆盖基础组件默认激活、可选 History，以及运行时移除 History 标签。

## 2. 分类组件九宫格

- [x] 2.1 [Red] 为基础分类标题、可折叠九宫格和既有新增交互补充 Palette 组件测试并记录失败证据
  - Red command/result: `bun run --cwd packages/stage test -- component-palette/compose-component-palette.test.tsx` 失败；找不到“基础 (2)”分类控制项，当前只渲染扁平列表。
  - Reason: 分类网格和折叠状态尚未实现。
- [x] 2.2 [Green] 实现 Palette 分类网格与紧凑样式，保留点击/拖拽新增语义
- [x] 2.3 [Regression] 运行 Stage Palette 测试并记录结果
  - Regression command/result: `bun run --cwd packages/stage test -- component-palette/compose-component-palette.test.tsx` 通过（4 tests）。

- [x] 2.4 [Red] 为等尺寸 Tile、统一图标和随指针移动的拖拽占位预览补充 Palette 测试并记录失败证据
  - Red command/result: `bun run --cwd packages/stage test -- component-palette/compose-component-palette.test.tsx` 失败（2 tests）；Tile 没有统一 SVG 图标，且 pointerdown 尚未越过阈值就展示了固定在 `12px, 12px` 的预览。
  - Reason: 原实现直接渲染 Preset 的字形图标，并且未将 `external.clientPoint` 映射到预览坐标。
- [x] 2.5 [Green] 统一九宫格视觉与图标，并让拖拽预览使用最新 pointer 位置
- [x] 2.6 [Green] 允许等尺寸 Tile 随面板可用宽度自动换行，并更新视觉黄金图
  - Regression command/result: `bun run --cwd packages/stage test -- component-palette/compose-component-palette.test.tsx` 通过（4 tests）；`bun run build` 通过；Chromium 组件库黄金图已更新，验证 5 个 Tile 在默认三列后自动排入第二行。

## 3. 浏览器验收与交付

- [ ] 3.1 [Red] 添加 Editor 组件库默认展示的确定性 E2E 场景和视觉黄金测试并记录失败证据
- [x] 3.2 [Green] 通过 Chromium 验证场景树、基础组件、历史标签和交互
  - Chromium result: `bunx playwright test e2e/integration.spec.ts --project=chromium --grep '完整示例入口' --update-snapshots` 通过并更新组件库黄金图；`--grep 'Controller 驱动的默认组合'` 通过，断言拖拽占位在 Stage client pointer 右下方出现并在 pointerup 后消失。
- [x] 3.3 [Refactor] 整理文案与样式；运行相关测试、严格 OpenSpec 校验、lint、typecheck、test、build、test:e2e 并记录结果
  - Final result: `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e`、`bun run pack:dry-run` 均通过；`bunx openspec validate update-component-library-dock --strict` 通过。OpenSpec CLI 随后仅报告不可达 telemetry host 的网络日志，不影响校验结果。
  - Accessibility: Storybook Chromium 测试发现 Dock 标签和 Palette landmark 重名后，新增“基础组件内容 / Component content”可访问名称；`bun run --cwd apps/storybook test` 和最终全量测试均通过。

## 4. 底部工具组默认值

- [x] 4.1 [Red → Green] 调整底部工具组为资源、命令、日志，并默认收起
  - Red command/result: `bun run --cwd packages/editor test -- workspace-layout/workspace-layout.test.ts` 失败；底部 Edge Group 未传入 `collapsed: true`，且 Transaction Log 仍为首个活动标签。
  - Green command/result: `bun run --cwd packages/editor test -- workspace-layout/workspace-layout.test.ts compose-editor/compose-editor.test.tsx` 通过（49 tests）；`bun run build` 通过；Chromium 完整示例入口测试通过，断言底部小于 80px 且标签顺序为资源、命令、日志。
