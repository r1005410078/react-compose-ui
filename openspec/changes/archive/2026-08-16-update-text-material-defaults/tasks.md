## 1. 规格与 Red 测试

- [x] 1.1 Red：为 Text Preset 的白色 Inter 12px、Hug × Hug 与默认自动行高添加材料单测，并记录失败证据。
  - Red command/result/reason：`bun --cwd packages/materials test -- create-basic-materials.test.tsx ...` 失败；当前 seed 为深色 24px 且 LayoutItem 为 fixed，因此缺少目标默认行为。
- [x] 1.2 Red：为 Text Props Contract、Inspector 分类、Renderer/measurement 的对齐、大小写和装饰语义添加单测，并记录失败证据。
  - Red command/result/reason：同一 Materials 定向测试失败；当前 contract 与 Inspector 均不包含四个排版字段，measurement host 也没有应用 case，因此缺少目标行为。
- [x] 1.3 Red：为文字工具的单击 Hug、拖拽 Fixed 与预览尺寸添加 Stage 合同测试，并记录失败证据。
  - Red command/result/reason：`bun --cwd packages/stage test -- src/stage-surface/compose-stage.test.tsx` 失败；`entityFromDrawingSeed` 不支持 preserve-Hug 路径，当前绘制会无条件转为 fixed。

## 2. Materials（Green → Refactor）

- [x] 2.1 Green：更新 Text defaults、专用 Hug preset、Props Contract、Renderer 和 isolated measurement。
  - Green command/result：`bun --cwd packages/materials test` 通过（9 files / 68 tests）；覆盖白色 Inter 12px、Hug preset、自动行高和文字 case measurement。
- [x] 2.2 Green：扩展 Text Inspector 的文字与排版字段，并保持绑定、重置和 authored props 合并语义。
  - Green command/result：`bun --cwd packages/materials test` 通过；Inspector 合同覆盖水平/垂直对齐、大小写与文字装饰四个字段。
- [x] 2.3 Refactor：收敛 Text 默认/兼容 fallback，确认旧显式属性不变且 Stage/Preview 复用同一 Renderer。
  - Regression command/result：`bun run test` 通过（39 packages）；既有未显式写入新字段的文本继续走兼容 fallback，Stage 与 Preview 共享 Renderer。

## 3. Stage（Green → Refactor）

- [x] 3.1 Green：区分 click 与 drag 的 Text drawing component 映射；click 保留 Hug，drag 固定 bounds。
  - Green command/result：`bun --cwd packages/stage test` 通过（4 files / 39 tests）；纯映射验证 click 保留 Hug、drag 提交精确 Fixed bounds。
- [x] 3.2 Green：更新 Text drawing preview 为新的小型默认文本基线。
  - Green command/result：`bun run test:e2e` 通过（39/39）；新增文字绘制 E2E 生成并校验 `e2e/__screenshots__/stage-drawing-text-preview.png`。
- [x] 3.3 Refactor：确认其余绘制 Preset 仍使用固定 bounds，取消与自动回到选择工具不回归。
  - Regression command/result：`bun run test:e2e` 通过；既有矩形、线条、Shift 绘制、取消和自动回选流程均通过。

## 4. 验证与交付

- [x] 4.1 运行并记录 OpenSpec 严格校验、Materials/Stage 定向测试、lint、typecheck、test、build、E2E 与 diff check。
  - Validation command/result：`openspec validate update-text-material-defaults --strict` 通过；`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 与 `git diff --check` 均通过。OpenSpec telemetry 的离线 PostHog flush 报错不影响校验结果。
- [x] 4.2 仅在用户要求后提交或推送；不包含既有无关未跟踪文件。
  - Delivery result：本次未收到提交或推送指令，因此未执行 Git 写入；`.github/`、`1.md` 和 `todo` 等既有无关未跟踪文件保持原样，未纳入变更范围。
