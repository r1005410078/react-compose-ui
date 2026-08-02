## 1. OpenSpec 与测试契约

- [x] 1.1 创建并严格校验 property-panel、basic-materials、editor-workspace-layout 增量规范。
  - Regression command/result: `bunx openspec validate add-semantic-property-editors --strict` → `Change 'add-semantic-property-editors' is valid`。
- [x] 1.2 为基础 renderer 的自动选择、宿主覆盖、校验、只读、重置、绑定、Color 与 Size 预设建立 Red 测试。
  - Red command/result: `bun run --cwd packages/property-panel test -- src/semantic-editors/semantic-editors.test.tsx` → 4 个场景失败。
  - Red reason: 当前 registry 不含内建 `vector2`/`size`/`color`，所以只渲染对象子字段或普通文本输入，宿主 renderer 未获字段显示名。
  - Green command/result: `bun run --cwd packages/property-panel test` → 3 个文件、60 个测试通过；`lint`、`typecheck`、`build` 均通过。
- [x] 1.3 为五种 Materials Inspector 的语义值适配和 Visibility 命令建立 Red 测试。
  - Red command/result: `bun run --cwd packages/materials test -- src/material-inspector-kit/inspector/semantic-inspectors.test.tsx` → 6 个场景失败。
  - Red reason: Inspector 仍使用扁平 x/y/width/height 表单，且没有 Visibility 或 `node.set-visibility` 适配。
  - Green command/result: `bun run --cwd packages/materials test` → 7 个文件、21 个测试通过；`lint`、`typecheck`、`build` 均通过。
- [x] 1.4 为 Canvas Size 单行预设、Color 与 output.configure/undo-redo 建立 Red 测试，并为关键流程准备 Playwright 覆盖。
  - Red command/result: `bun run --cwd packages/editor test -- src/controller.test.tsx` → Canvas Inspector 场景失败。
  - Red reason: 旧实现使用独立 preset renderer 和三个扁平输出字段，没有 Size/Color 语义 editor。
  - Green command/result: `bun run --cwd packages/editor test` → 4 个文件、64 个测试通过；Canvas 与 Materials 关键 Playwright 流程均通过，并已审阅后更新 `svg-material-inspector.png`。
- [x] 1.5 为共享 Shadcn Color Picker 建立 Red 测试，并修订受影响 OpenSpec 增量。
  - Red command/result: `bun run --cwd packages/components test -- src/color-picker/compose-color-picker.test.tsx` → 5 个场景失败。
  - Red reason: 公共入口尚未导出 `ComposeColorPicker`，因此受控 Trigger、色盘、透明、Theme/I18n 与焦点流程均不可渲染。
  - Green command/result: 同一命令 → 5 个场景通过；Color Picker 使用 Shadcn CLI 生成的 Base UI Popover 源码作为内部基础。
- [x] 1.6 为 Canvas 输出尺寸枚举、自定义 W/H 与 Undo/Redo 建立 Red 测试。
  - Red command/result: `bun run --cwd packages/editor test -- src/controller.test.tsx` → Canvas 枚举场景失败。
  - Red reason: 旧 Inspector 只提供“输出尺寸预设”与同一属性内的 W/H，没有独立的“输出尺寸”枚举或按 custom 条件展示的 Size。
  - Green command/result: 同一命令 → 16 个测试通过；默认、常见尺寸、自定义无事务、无效草稿、Undo/Redo 与宿主外部 W/H 更新均已覆盖。
- [x] 1.7 为单键分支 Map、左列 Key 和 Canvas Map 输出尺寸建立 Red → Green 测试。
  - Red command/result: `bun run --cwd packages/property-panel test -- src/semantic-editors/semantic-editors.test.tsx` → Map 无效 Schema 场景失败。
  - Red reason: 错误文案重复输出 `Map`，未精确描述字段契约。
  - Green command/result: 同一命令 → 10 个测试通过；`bun run --cwd packages/editor test -- src/controller.test.tsx` → 16 个测试通过。

## 2. Property Panel 基础语义编辑器

- [x] 2.1 实现不可变的内建 renderer registry、稳定 ID、字段显示名和 Size preset metadata。
- [x] 2.2 实现 Vector2、Size、Angle、Opacity、Corner Radius、Stroke Width、Visibility、Color、Alignment、Map，并接入现有校验、只读、重置和绑定；Map 的 Key/Value 使用受控分支 Schema，不声明绑定目标。
- [x] 2.3 使 property-panel Red 测试转绿后，在不改变外部行为的前提下整理 feature-first 结构与样式。
- [x] 2.4 将 Vector2 与 Size 改为 UE4 式同一 property row 的紧凑 X/Y、W/H 布局。
  - Red command/result: `bun run --cwd packages/property-panel test -- src/semantic-editors/semantic-editors.test.tsx` → Vector2 字段仍为 `data-property-layout="full-width"`。
  - Green command/result: Vector2、Size 均为 `inline`，`bun run --cwd packages/property-panel test` → 60 个测试通过；真实浏览器中的 Rectangle Inspector 已验证左侧名称、右侧并排 X/Y 与 W/H。

## 3. Inspector 迁移

- [x] 3.1 将 Frame、Rectangle、Text、Image、SVG 表单迁移为语义值并保持原有 command payload、batch 与 legacy fallback。
- [x] 3.2 将 Canvas Inspector 迁移为输出尺寸 Map（左列 Key + 右列预设或 Size）+ Color，切换 custom 不产生事务。
- [x] 3.3 使 Materials 和 Editor Red 测试转绿，并补充主题、I18n、焦点和真实编辑器 E2E 覆盖。

## 4. 文档与验证

- [x] 4.1 更新 components、property-panel、materials、editor README 以及包依赖边界说明。
- [x] 4.2 运行 `openspec validate add-semantic-property-editors --strict`、受影响包测试/构建、仓库 lint/typecheck/test/build/test:e2e 与 `git diff --check`；在每项任务下补全 Red/Green/Regression 证据。
  - Passed: `bunx openspec validate add-semantic-property-editors --strict`、`bun run --cwd packages/property-panel test`（64）、`typecheck`、`build`、`bun run --cwd packages/editor test`（64）、`typecheck`、`build`、仓库 `bun run lint`、`bun run typecheck`、`bun run build` 与 `git diff --check`；`bunx playwright test e2e/integration.spec.ts --grep '隐式 Canvas Inspector / 快捷选择常见 PC 尺寸' --project=chromium` 通过，并审阅后更新 `stage-workspace-canvas-inspector.png`、`stage-workspace-canvas-color-picker.png` 与 `stage-workspace-low-zoom-grid.png`。
  - Full test regression: 首次 `bun run test` 在沙箱内被 Storybook IPv6 监听限制阻断；允许本地监听后，除 Storybook Button 的 4 个既有色彩对比 a11y 失败外，所有包测试（含 Editor 64）通过。
  - Full browser regression: 允许本地监听后 `bun run test:e2e` 为 10 通过、4 失败；Canvas Map 流程通过。失败为 SVG Material Inspector 的既有黄金图差异、高速 pointer 手势、组合 Frame 直接拖动与设置弹框 inert，均未修改于本 change。
