## 1. OpenSpec 与测试映射

- [x] 1.1 创建 proposal、design、tasks 与能力增量并通过 strict validate
  - Regression command/result：`openspec validate add-basic-materials --strict` 返回
    `Change 'add-basic-materials' is valid`；随后 telemetry 因沙箱无网络失败，不影响校验退出码 0。
- [x] 1.2 为每个 Scenario 建立 `OpenSpec: <capability> / <Requirement> / <Scenario>` 自动化测试
  - Regression command/result：core、registry、stage、preview、editor、materials 测试标题或紧邻注释
    已逐项映射本变更全部 Scenario。

## 2. Core 样式协议 Red → Green → Refactor

- [x] 2.1 Red：覆盖合法/非法 style、kind 默认解析与 schemaVersion 1 旧文档兼容
  - Red command/result/reason：`bun run --cwd packages/core test` 失败 3 项；当前校验器忽略
    style 且 `resolveNodeStyle` 尚不存在，符合目标行为缺失预期。
- [x] 2.2 Green：实现 NodeStyle、NodeShadow、严格校验、默认值与 resolveNodeStyle
  - Green command/result：core 旧文档、合法部分 style、非法字段与默认解析测试 13/13 通过。
- [x] 2.3 Red：覆盖 style set/reset、路径、锁定、noop、inverse 与 batch
  - Red command/result/reason：同一 core 测试失败 3 项；runtime 报
    `command.unknown-type`，证明样式命令尚未注册。
- [x] 2.4 Green：实现内置样式命令并记录 History/事件
  - Green command/result：`bun run --cwd packages/core test` 39/39 通过；
    `bun run --cwd packages/core typecheck` 退出 0。
- [x] 2.5 Refactor：统一 style 路径更新与错误码，记录 core 回归证据
  - Red command/result/reason：补充显式 `undefined` 非 JSON style 用例后，
    `bun run --cwd packages/core test -- document.test.ts` 失败 1 项；validator 把可选字段的
    “缺失”和“自有属性值为 undefined”混为一谈。
  - Regression command/result：改用自有属性检测后 core 39/39、registry 11/11 通过。

## 3. Registry、Stage 与 Preview Red → Green → Refactor

- [x] 3.1 Red：覆盖 ComponentDefinition 默认 style 的独立种子与非法 factory
  - Red command/result/reason：`bun run --cwd packages/component-registry test` 失败 2 项；
    seed 尚未返回 style，registry 也未调用或校验 style factory。
- [x] 3.2 Green：扩展 registry seed 和 NodeInspectorProps
  - Green command/result：`bun run --cwd packages/component-registry test` 11/11 通过；
    `bun run --cwd packages/component-registry typecheck` 退出 0。
- [x] 3.3 Red：覆盖 Frame Pointer/键盘 drop、居中根级创建、选择与旧 component drag 兼容
  - Red command/result/reason：`bun run --cwd packages/stage test` 失败 2 个 Frame preset 用例；
    Palette 尚未渲染 Frame，符合目标能力缺失预期。
- [x] 3.4 Green：实现 Frame presets、附加 drag API 和 Palette 顺序
  - Green command/result：Stage 36/36 通过，旧 Component drop 用例保持通过。
- [x] 3.5 Red：覆盖 Frame/Group/Component 在 Stage 与 Preview 的相同样式输出
  - Red command/result/reason：同一次 Stage Red 运行另有 1 个 resolved style 用例失败，
    节点 wrapper 尚未应用文档 style；Preview 对应用例同时先于实现写入。
- [x] 3.6 Green：实现共享 style 映射与几何无关视觉层
  - Green command/result：Stage 36/36、Preview 7/7，两个包 typecheck 均退出 0。
- [x] 3.7 Refactor：清理重复 CSS/style 映射并记录包回归证据
  - Regression command/result：Stage 与 Preview 各自把几何和视觉映射集中到单一 helper；
    为保持 Preview 不依赖 Stage 的架构边界，没有新增跨包 DOM/CSS 协议。根级 test 全部通过。

## 4. Materials 与 Editor Red → Green → Refactor

- [x] 4.1 Red：覆盖默认物料、factory overrides、extension 顺序和旧 Rectangle fallback
  - Red command/result/reason：tests 在实现文件创建前写入；首次命令先被新 workspace 尚未链接
    React 阻断，因此该次输出不作为有效行为 Red。完成 `bun install` 后进入最小实现，这是本循环
    对严格 Red 证据的已记录偏差。
- [x] 4.2 Green：新增 materials package、完整 renderers、Inspectors、主题样式和 bundle factory
  - Green command/result：materials 6/6 通过，typecheck 与独立 build 退出 0。
- [x] 4.3 Red：覆盖 controller Frame presets、Frame/Group Inspector 与 Component Inspector 优先级
  - Red command/result/reason：`bun run --cwd packages/editor test -- controller.test.tsx`
    失败 1 项，Frame 单选仍显示空 Inspector，符合目标行为缺失预期。
- [x] 4.4 Green：扩展 controller 并把 node.style 事务映射为 Property 日志
  - Green command/result：editor 29/29 通过；完整示例按 inspector source 将
    `node.style.*` 和原子 batch 归类为 Property，并记录 Before/After 与 patches。
- [x] 4.5 Refactor：确认 materials 不依赖 editor，所有跨包导入使用公共入口
  - Regression command/result：materials package manifest 无 editor 依赖；`bun run lint` 与
    `bun run pack:dry-run` 退出 0。
- [x] 4.6 Refactor：按 Frame、Rectangle、Text 目录拆分 materials 内部实现
  - Regression command/result：根公共入口与 npm exports 保持不变；旧 `materials.tsx`、
    `renderers.tsx` 和聚合测试已删除。`bun run --cwd packages/materials lint`、
    `typecheck`、`build`、`pack:dry-run` 均退出 0，拆分后的 4 个测试文件共 9/9 通过。

## 5. 示例、E2E 与完成门禁

- [x] 5.1 迁移示例 Text/Rectangle/Frame，保留 ECharts extension
- [x] 5.2 Red/Green：拖入 Frame → 基础组件 → style Inspector → undo/redo → 日志 → Preview
  - Green command/result：`bun run test:e2e -- --grep "使用完整示例完成 Stage 纵向流程"
    --workers=1` 1/1 通过；完整流程覆盖 Frame、Rectangle、Text、Group style、undo/redo、
    Operation Log 与 Preview。
  - Regression command/result：创建 1280px Frame 后先执行“适配 Frame”，并使用稳定 role/testid
    定位，修复组件落在 Scene Graph 覆盖区域及 Background/Preview 严格定位歧义。
- [x] 5.3 更新并人工审查默认、选择、吸附、失败与 Frame style 视觉黄金文件
  - Regression command/result：`bun run test:e2e` 的视觉用例比较四份既有黄金文件通过；
    本次仅修正纵向流程定位，黄金图无非预期差异。
- [x] 5.4 更新 README、project/AGENTS、pack 脚本与 Changeset
- [x] 5.5 运行 strict validate、lint、typecheck、test、build、pack dry-run、test:e2e 和 diff check
  - Regression command/result：strict validate、lint、typecheck、test、build 与 pack dry-run
    在 materials 目录拆分后均再次退出 0；`git diff --check` 退出 0，
    `bunx playwright test --list` 列出 6 条 Chromium E2E。
  - Blocked：`bun run test:e2e` 已完成 build，但 Vite preview 绑定
    `127.0.0.1:4173` 被沙箱以 `EPERM` 拒绝；提权请求也被策略拒绝，因此尚未执行浏览器断言或
    更新/人工审查视觉黄金文件。
  - Regression command/result：获准在沙箱外绑定本机预览端口后，root lint、typecheck、test、
    build、pack dry-run 全部退出 0；`bun run test:e2e` 6/6 通过并完成黄金文件比较。
