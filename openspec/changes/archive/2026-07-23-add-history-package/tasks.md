## 1. 规范与包基座

- [x] 1.1 创建 history 与 editor-workspace-layout 规范增量并通过 strict validate
- [x] 1.2 创建 `@compose-ui/history` 包基座、构建配置、样式入口和 README

## 2. History 引擎 Red → Green → Refactor

- [x] 2.1 先写失败测试：初始基线、提交、no-op、撤销、重做、任意跳转和 reset
- [x] 2.2 实现最小不可变时间线与 `useHistory`
- [x] 2.3 先写失败测试并实现 merge、分支清理、100 条裁剪和 Strict Mode 稳定性
- [x] 2.4 重构并记录 Red、Green、Regression 命令与结果
  - Red command/result/reason：`bun run --cwd packages/history test`；12 failed、1 passed；
    时间线 stub 尚未实现提交、导航、合并、分支和容量行为。
  - Green command/result：`bun run --cwd packages/history test`；初次实现后 13/13 passed，
    补齐默认 100 条容量和独立导出覆盖后 15/15 passed。
  - Regression command/result：`bun run --cwd packages/history typecheck && bun run --cwd
    packages/history lint && bun run --cwd packages/history build`；全部通过。

## 3. HistoryPanel 与快捷键 Red → Green → Refactor

- [x] 3.1 先写失败测试：列表顺序、当前/未来样式、跳转、空状态、属性透传和可访问性
- [x] 3.2 实现 HistoryPanel 与独立样式
- [x] 3.3 先写失败测试并实现 Cmd/Ctrl+Z、Shift+Z、Ctrl+Y、输入框和 IME 行为
- [x] 3.4 重构并记录 Red、Green、Regression 命令与结果
  - Red command/result/reason：`bun run --cwd packages/history test`；面板与快捷键用例包含在
    12 个失败用例中；stub 未渲染记录，也未拦截文档快捷键。
  - Green command/result：`bun run --cwd packages/history test`；15/15 passed，包含过去/未来
    跳转、空状态、属性透传、IME 和不可用动作。
  - Regression command/result：`bun run pack:dry-run`；history tarball 包含 JS、声明文件、
    README 与独立 `styles.css`。

## 4. Editor 集成 Red → Green → Refactor

- [x] 4.1 先写失败测试：可选分栏、historyPanel 覆盖、分隔线和快捷键集成
- [x] 4.2 实现 `ComposeEditorProps`、场景树/历史上下分栏和历史样式集成
- [x] 4.3 确认 Dockview 面板数量不变且插槽更新不重建布局
  - Red command/result/reason：`bun run --cwd packages/editor test`；4 failed、11 passed；
    editor 尚未接受历史协议或渲染场景历史分栏。
  - Green command/result：`bun run --cwd packages/editor test`；初次实现后 15/15 passed，补齐
    Pointer 调整和内容更新回归后 16/16 passed。
  - Regression command/result：`bun run --cwd packages/editor typecheck && bun run --cwd
    packages/editor lint && bun run --cwd packages/editor build`；全部通过，Dockview 初始化仍为一次。

## 5. 示例纵向流程 Red → Green → Refactor

- [x] 5.1 先写 Playwright 失败测试：记录属性/结构编辑、快捷键撤销重做、点击跳转和分支清理
- [x] 5.2 将示例文档状态合并为 `DemoDocumentSnapshot` 并接入 `useHistory`
- [x] 5.3 记录全部现有有效编辑，清理回退后失效选择，保持 fixture 状态独立
- [x] 5.4 新增历史视觉黄金文件并审查受影响的场景树黄金文件
  - Red command/result/reason：`bunx playwright test --project=chromium --grep 'OpenSpec:
    history'`；3 failed；示例尚未渲染历史面板，也没有文档历史交互。
  - Green command/result：相同定向命令的功能用例 2/2 passed；`bun run test:e2e:update --
    --project=chromium --grep '宿主独立加载样式 - 视觉'` 1/1 passed并确认新增黄金图。
  - Regression command/result：`bun run test:e2e`；37/37 passed；既有场景树黄金图经审查
    无需更新，属性输入在历史回退时同步恢复。

## 6. 文档与完成门禁

- [x] 6.1 更新根 README、history/editor README、AGENTS、project、overview 和当前限制
- [x] 6.2 更新依赖、pack dry run 脚本和 changeset
- [x] 6.3 运行 strict validate、lint、typecheck、test、build、test:e2e、pack dry run 和 diff check
- [x] 6.4 在本文件补齐所有 Red/Green/Regression 证据并勾选实际完成项
  - Regression command/result：`openspec validate add-history-package --strict`、`bun run lint`、
    `bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e`、
    `bun run pack:dry-run` 与 `git diff --check`；全部通过。

## 7. History Dockview 面板调整

- [x] 7.1 修改 editor 测试，先验证 History 是场景树下方的独立子 Dockview 面板
  - Red command/result/reason：`bun run --cwd packages/editor test`；4 failed、12 passed；当前
    实现仍渲染 CSS Grid 和自定义 separator，没有创建子 Dockview 或 History Dockview panel。
- [x] 7.2 使用稳定 group/panel ID 实现子 Dockview 60%/40% 布局并移除自定义分隔线
  - Refined Red command/result/reason：`bun run --cwd packages/editor test`；2 failed、14 passed；
    子 Dockview 已替换旧分隔线，但尚未创建稳定的场景与历史 group。
  - Green command/result：`bun run --cwd packages/editor test`；16/16 passed；场景与历史使用稳定
    group/panel ID，初始高度为 60%/40%，内容更新不重建子 Dockview。
- [x] 7.3 更新文档和黄金图，运行 editor、E2E 与完整质量门禁
  - Regression command/result：`bun run --cwd packages/editor typecheck`、`bun run --cwd
    packages/editor lint`、`bun run --cwd packages/editor build`、`bun run lint`、`bun run
    typecheck`、`bun run test`、`bun run build`、`bun run test:e2e`、`bun run pack:dry-run`、
    `openspec validate add-history-package --strict` 与 `git diff --check`；全部通过，完整 E2E
    为 37/37 passed，黄金图已更新并人工审查。
