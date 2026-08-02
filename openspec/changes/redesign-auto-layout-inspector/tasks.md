## 1. OpenSpec 与协议

- [x] 1.1 严格校验提案，并建立每个 Scenario 的测试映射。
  - Validation: `openspec validate redesign-auto-layout-inspector --strict` 通过；Scenario 映射到 Property Panel、Registry、Editor、Materials 单测及 `e2e/integration.spec.ts`。
- [x] 1.2 Red：为 action-only Section 与 missingInspector 聚合建立失败测试并记录证据。
  - Red command: `bun run test -- compose-property-panel.test.tsx`、`bun run test -- compose-registry-renderers.test.tsx`
  - Red result: action-only Section 仍渲染折叠按钮和正文；missing Inspector adapter 尚未导出，两个目标测试按预期失败。
  - Red reason: 当前公共协议只覆盖已存在 Component，Property Panel Section 也始终假定可折叠正文。
- [x] 1.3 Green/Refactor：实现公共协议、TSDoc、Registry 错误边界与 Editor 聚合。
  - Green: action-only Section、`missingInspector` 定义与 adapter、Editor 缺失组件聚合测试通过。

## 2. 按需 Auto Layout

- [x] 2.1 Red：覆盖新 Container/容器能力无 Layout，以及“布局 +”可见性与菜单可访问性。
  - Red: preset 仍包含 Layout，缺失 Layout 时 Registry/Editor 没有可渲染入口，新测试按预期失败。
- [x] 2.2 Green/Refactor：实现缺失 Layout 入口和默认自由容器。
  - Green: Container preset/capability 测试、missing Layout action-only 测试及菜单可访问性测试通过。
- [x] 2.3 Red：覆盖添加时直接子项全转 Flow、锁定零提交和单事务语义。
  - Red: 原 Inspector 只能更新已有 Layout，无法生成添加 Layout 与批量转换子项的原子命令。
- [x] 2.4 Green/Refactor：实现无 React 的添加命令规划并接入 Inspector。
  - Green: `layout-mode-commands.test.ts` 验证单 batch、直接子项 Flow 和锁定失败边界。
- [x] 2.5 Red：覆盖移除时 Snapshot 烘焙、Fill/Hug 转换、旧基础归属和失败边界。
  - Red: 原实现没有移除模式命令，也没有 Snapshot 烘焙或旧 `Composition` 归属修复。
- [x] 2.6 Green/Refactor：实现移除规划、标题栏状态、重置与移除菜单。
  - Green: 单测覆盖 Flow→Absolute、Fill/Hug→Fixed、border offset、缺失 box、标题菜单单 batch。

## 3. Inspector 与实时预览

- [x] 3.1 Red：覆盖 LayoutItem 条件字段、计算值和 margin 紧凑入口。
  - Red: 通用 Schema 面板同时暴露 offset、alignSelf、所有 sizing value 和四个 margin 字段。
- [x] 3.2 Green/Refactor：实现 Absolute/Flow 与 Fixed/Fill/Hug 的条件展示。
  - Green: `component-inspectors.test.tsx` 验证定位、尺寸模式、计算值、margin 展开和 CSS 副标题。
- [x] 3.3 Red：覆盖 Chromium 选项顺序、三行布局、gap 合并/分轴和 align-content 提示。
  - Red: 旧控件顺序、双 gap 字段及上层 padding 网格不符合批准稿，相关测试按预期失败。
- [x] 3.4 Green/Refactor：实现 Flex 控件和约 400px 侧栏响应式样式。
  - Green: 单测与 `flex-layout-inspector.png` 覆盖两列三行、完整 align-content/align-items、统一 gap 和响应式密度。
- [x] 3.5 Red：覆盖四边 padding 联动、重新联动和 wrap 多行实时预览。
  - Red: 原实时预览只展示方向轴，不可编辑 padding，也没有稳定的 wrap 多行夹具。
- [x] 3.6 Green/Refactor：实现紧凑可编辑盒模型并删除重复 padding 字段。
  - Green: 单测覆盖四边编辑、联动/解除联动、分轴 gap；E2E 覆盖 wrap、多行预览和 Stage 样式隔离。

## 4. 集成与验收

- [x] 4.1 添加新建自由 Container→添加 Auto Layout→移除→Undo/Redo E2E。
  - Regression: `自动布局显式启用 / 自由 Container 添加、移除并可撤销重做` 通过。
- [x] 4.2 更新并人工审阅 1280×720 默认态与启用态黄金图。
  - Regression: 更新 8 张受影响黄金图；人工检查 Flex Inspector、LayoutItem 及完整工作区截图无裁剪、遮挡或第二布局引擎偏差。
- [x] 4.3 更新 README、架构说明、Changeset/pack 文档（如公共 API 发布需要）。
  - Docs: README 与 Changeset 已同步；现有包边界未改变，无需修改根 AGENTS 架构说明。
- [x] 4.4 运行相关测试及 `lint`、`typecheck`、`test`、`build`、`test:e2e`、`pack:dry-run`。
  - Regression: `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e`（30 passed）和 `bun run pack:dry-run` 全部通过。
- [x] 4.5 在各任务下记录 Red/Green/Regression 证据并完成严格 OpenSpec 校验。
