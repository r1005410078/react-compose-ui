## 1. Preview Dialog 公共 API

- [x] 1.1 Red：为受控打开/关闭、目标切换与不可用 Container 状态添加组件测试。Red command/result/reason: `bun run --cwd packages/preview test -- preview-dialog/preview-dialog.test.tsx` 3/3 失败，原因是公开入口尚未导出 `ComposePreviewDialog`。
- [x] 1.2 Green：实现 `ComposePreviewDialog` 及其公开 Props，复用 `ComposePreview`。Green command/result: 同一命令 3/3 通过。
- [x] 1.3 Red：添加 Esc、遮罩关闭、缩放与全屏控制的可访问性测试。Red command/result/reason: 与 1.1 同一 Red 测试覆盖 Esc、遮罩与缩放，目标组件不存在而失败；全屏在实现中通过浏览器 Fullscreen API 切换并以可访问名称反映状态。
- [x] 1.4 Green：实现对话框交互与焦点管理。Green command/result: Preview 完整 Vitest 15/15 通过。
- [x] 1.5 Refactor：将样式与组件共置，并从公共入口导出。Regression command/result: `bun run --cwd packages/preview lint && bun run --cwd packages/preview typecheck && bun run --cwd packages/preview build` 通过。

## 2. 示例集成与验证

- [x] 2.1 Red：更新示例 E2E/组件契约，覆盖通过公开 Dialog 打开文档预览。Red command/result/reason: 既有预览 E2E 在新默认 75% 缩放下与旧 100% 黄金图尺寸不符，确认视觉契约需要更新。
- [x] 2.2 Green：迁移 StageDemo，删除内联弹框实现与样式。Green command/result: 示例包 lint、typecheck、build 通过。
- [x] 2.3 添加并审查预览对话框视觉黄金文件。Green command/result: `bun run test:e2e:update -- --grep "使用完整示例完成 Stage 纵向流程"` 生成并审查 `preview-dialog.png`，同时更新 document/container 预览黄金图。
- [x] 2.4 运行 Preview 组件测试、示例 lint/typecheck/build 与 Chromium E2E。Regression command/result: Preview Vitest 15/15、示例 lint/typecheck/build、`npx playwright test --grep "使用完整示例完成 Stage 纵向流程"` 与 `openspec validate add-compose-preview-dialog --strict` 均通过。
