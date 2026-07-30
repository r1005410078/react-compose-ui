## 1. OpenSpec 与测试准备

- [x] 1.1 审批：审阅并批准 `add-output-background-paint` 提案后再开始实现。
- [x] 1.2 Red：为 v5 output Paint 校验、默认值和 `output.configure` 完整往返添加 Core 测试；运行目标测试并记录因 `backgroundColor` 仍为唯一字段导致的失败。
  - Red command/result/reason: `bunx vitest run packages/core/src/ecs-document.test.ts` failed at `校验结构化输出背景` because `validateComposeDocument` still requires `output.backgroundColor` and rejects `backgroundPaint`.
- [x] 1.3 Green：以 `backgroundPaint` 替换 Output 纯色字段，更新命令、fixture、示例和公共 API 文档。
  - Green command/result: `bun run test --filter @compose-ui/core --filter @compose-ui/components --filter @compose-ui/component-registry --filter @compose-ui/preview --filter @compose-ui/stage --filter @compose-ui/editor` passed Core 36、Components 39、Registry 13、Preview 9、Stage 17、Editor 78 tests.
- [x] 1.4 Refactor：运行 Core 回归并记录结果。
  - Refactor command/result: the same focused command passed all Core document and transaction regression tests after the v5 field replacement.

## 2. 单层 Paint 编辑与 Canvas Inspector

- [x] 2.1 Red：为 Paint Picker 的单一 dialog、Solid/Gradient 共享内嵌色盘，和 Canvas Inspector 的 Paint renderer 添加组件测试；记录失败证据。
  - Red command/result/reason: `bun run test --filter @compose-ui/editor` failed `点击输出并编辑背景 Paint`: the Inspector only exposed `选择输出背景颜色`, so no `输出背景` Paint trigger or `线性` control existed.
- [x] 2.2 Green：实现紧凑内嵌色盘及 Canvas Inspector `backgroundPaint` 提交，保证不激活 Entity Paint Port。
  - Green implementation: `ComposePaintPicker` now embeds the color editor in its only Popover; Canvas Inspector maps `backgroundPaint` to the generic Paint semantic editor and intentionally supplies no Entity Paint Editor Port.
- [x] 2.3 Refactor：运行 components、property-panel、editor 测试并记录结果。
  - Refactor command/result: `bun run test --filter @compose-ui/core --filter @compose-ui/components --filter @compose-ui/component-registry --filter @compose-ui/preview --filter @compose-ui/stage --filter @compose-ui/editor` passed all focused package tests.

## 3. Stage、Preview 与 E2E

- [x] 3.1 Red：为 Stage/Preview 的 Linear、Radial、Angular 输出 Paint 渲染添加测试，并补充 Canvas Inspector 的 Playwright 流程；记录失败证据。
  - Red command/result/reason: `bun run test --filter @compose-ui/stage` failed the output Paint scenario because `stage-output-paint` did not exist before Stage rendered output backgrounds.
- [x] 3.2 Green：渲染不可交互的输出背景 Paint，并更新 Stage/Preview/document fixture。
  - Green implementation: Stage renders its output Paint beneath the transparent selection rect with `pointer-events: none`; Preview reuses the registry Paint layer. Linear, radial and angular fixtures are covered by the focused package tests.
- [x] 3.3 Refactor：执行相关单元、组件、E2E 与视觉黄金验证，审阅新增或更新黄金图。
  - Refactor command/result: `bunx playwright test --update-snapshots=all --grep "(隐式 Canvas Inspector|Paint Picker)" --reporter=list` passed 2 tests and regenerated `stage-workspace-canvas-color-picker.png`; the updated image was manually reviewed.

## 4. 回归与交付

- [x] 4.1 更新 README 和适用的包 README，说明 output Paint 迁移。
- [x] 4.2 运行 `openspec validate add-output-background-paint --strict`、lint、typecheck、test、build、E2E 和 `git diff --check`，并记录结果。
  - Validation result: `openspec validate add-output-background-paint --strict`、`git diff --check`、`bun run lint`、`bun run typecheck` 与 `bun run build`（18 个包）均通过；`bun run test` 通过 33 个包任务（包括 Storybook 42 项浏览器测试）；`bun run test:e2e` 先完成 18 包构建，再通过 17 项 Playwright E2E。
