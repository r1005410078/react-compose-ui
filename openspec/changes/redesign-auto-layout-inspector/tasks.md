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
- [x] 4.6 实现 LayoutItem 历史中间稿（后由 5.x 复合几何 Inspector 整体取代）。
  - Red: Component Inspector 测试确认计算值仍是只读输入且 `Absolute` 被错误翻译；E2E 确认嵌入式 LayoutItem 未形成设计稿中的两行网格。
  - Green: 自定义 positioning、offset、axis sizing 与 align-self renderer，并让 LayoutItem 在窄 Inspector 中保持三列首行和两列次行；布局项覆盖面板列宽拖拽线，保证最右侧模式可点击。
  - Regression: Materials 51 项测试、全仓 37 个测试任务、30 条 E2E、`lint`、`typecheck` 与 `build` 通过；该中间稿黄金图已在 5.8 替换。

## 5. 基础 Inspector 复合几何编辑器

- [x] 5.1 替换旧版单列草稿，补充 Components 角度选择器规范并通过严格 OpenSpec 校验。
  - Validation: `openspec validate redesign-auto-layout-inspector --strict` 通过；PostHog 遥测网络失败不影响本地校验与退出码。
- [x] 5.2 Red：为 Registry 基础分组、默认展开和多嵌入 Inspector 搜索建立失败测试并记录证据。
  - Red command: 在 `packages/property-panel` 与 `packages/editor` 分别运行目标 Vitest 文件。
  - Red result: 多嵌入 Section 的后一次不可见报告覆盖名称命中；Editor 仍创建独立“几何”分组且普通分组默认展开，目标测试按预期失败。
  - Red reason: Section 只有单个 `embeddedVisibility`，Registry 尚无基础分组与默认展开元数据。
- [x] 5.3 Green/Refactor：实现 Registry 元数据、Editor 分组聚合和 Property Panel 可见性注册并记录回归。
  - Green command/result: Property Panel 56 项与 Editor Inspector 2 项目标测试全部通过。
  - Regression: 既有 action-only、跨 Section 搜索、折叠恢复及缺失 Layout 入口测试保持通过。
- [x] 5.4 Red：为通用角度选择器的任意输入、转盘单提交、快捷角、键盘、取消与焦点恢复建立失败测试。
  - Red command: `packages/components` 运行新增 Angle Picker 目标测试。
  - Red result/reason: 三个 Scenario 均因公共 `ComposeAnglePicker` 尚不存在而按预期失败。
- [x] 5.5 Green/Refactor：实现共享角度选择器并让基础 Angle Editor 复用，记录相关回归。
  - Green command/result: Components Angle Picker 3 个 Scenario 与 Property Panel 11 项语义 Editor 测试全部通过。
  - Regression: Components 构建成功；任意角度输入、归一化转盘、单次 pointerup、快捷角、键盘、取消及焦点恢复均通过。
- [x] 5.6 Red：为 Absolute/Flow 复合变换、W/H 尺寸输入、Snapshot fallback 和可展开外边距建立失败测试。
  - Red command: `packages/materials` 运行 Component Inspector 目标测试。
  - Red result: 4 个新增/修改场景按预期失败；Transform 仍独立，定位控件与 CSS 副标题仍存在，Flow 无旋转复合行，外边距仍在 change 时立即提交。
  - Red reason: Materials 仍使用旧三列 LayoutItem renderer，尚未建立跨 Transform/LayoutItem 的复合视图模型。
- [x] 5.7 Green/Refactor：实现跨 Transform/LayoutItem 的复合几何 Inspector 与窄侧栏样式，记录相关回归。
  - Green command/result: Materials Component Inspector 16 项测试通过；Absolute 显示 X/Y/旋转，Flow 显示 align-self/旋转，W/H 共用尺寸行。
  - Regression: Fill/Hug 数字转 Fixed、Snapshot/fallback、外边距展开/联动收起、单次事务与锁定/只读边界均通过。
- [x] 5.8 更新 E2E、黄金图、README、公共 TSDoc 与 Changeset。
  - E2E: 新增 `basic-inspector-absolute-fixed.png`、`basic-inspector-flow-fill.png`、`basic-inspector-margin-expanded.png` 和 `basic-inspector-rotation-popup.png`，删除旧三列 LayoutItem 黄金图。
  - Review: 人工检查 365px 基础分组、旋转弹层、外边距展开与 Auto Layout 实时预览，无水平溢出或遮挡。
  - Docs: 根 README、Components/Registry/Materials/Property Panel/Editor README、公共 TSDoc 与 Changeset 已同步。
- [x] 5.9 运行相关测试及 `lint`、`typecheck`、`test`、`build`、`test:e2e`、`pack:dry-run` 并记录证据。
  - Validation: `openspec validate redesign-auto-layout-inspector --strict`、`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 和 `bun run pack:dry-run` 全部通过。
  - E2E result: Chromium 30/30 通过，包含 Basic Absolute/Flow、Auto Layout、Hug/Fill、Page Slot 深嵌套与 Stage/Preview 回归。

## 6. 独立 Angle 属性与融合 Size 输入

- [x] 6.1 调研 Figma 公开文档，修订 proposal、design 与增量规范并通过严格 OpenSpec 校验。
  - Research: Figma 将 rotation 作为独立字段；W/H 作为主尺寸字段，通过相邻菜单选择 Fixed/Hug/Fill，直接输入数值自动转为 Fixed。
  - Validation: `openspec validate redesign-auto-layout-inspector --strict` 通过；PostHog 遥测网络失败不影响校验结果与退出码。
- [x] 6.2 Red：为位置/自身对齐、旋转和尺寸各自独立的 Schema 字段建立失败测试。
  - Expected red: 当前 `BasicTransformValue` 仍把 positioning、X/Y、alignSelf 与 rotation 放入同一自定义字段。
  - Red result: 目标测试 17 项中 3 项按预期失败；缺少独立 `position`/`rotation` 字段与 Angle renderer。
- [x] 6.3 Red：为 W/H 的融合输入外壳、尾部模式菜单、合法模式与键盘/焦点语义建立失败测试。
  - Expected red: 当前 AxisSizingControl 仍渲染具有独立边框的 input 与原生 select。
  - Red result: 目标测试找不到 W/H 融合 group，确认值输入和模式选项尚未形成一个复合控件。
- [x] 6.4 Green/Refactor：把 Absolute 位置接到独立 Position 自定义类型、Flow 自身对齐接到独立 picklist、rotation 接到内建 `angle`，并按字段路径分派既有命令。
  - Green result: Materials 17 项目标测试通过；每个可见属性均拥有独立标准属性行和语义类型。
- [x] 6.5 Green/Refactor：实现 AxisSizing compound control，使值区与模式触发器共享边框、焦点和禁用/只读状态；保留输入数字转 Fixed 与 Snapshot fallback。
  - Green result: W/H 分别暴露可访问 compound group；目标测试与 Materials typecheck 通过。
- [x] 6.6 更新 365px Absolute/Flow、Angle 弹层和 Fixed/Fill/Hug 黄金图并人工检查标签对齐、菜单可达性与无横向溢出。
  - E2E: 更新 Basic Flow/Absolute、margin 展开、Angle 弹层与完整 Fill 交互五张黄金图；目标 Playwright 场景通过。
  - Review: 名称、位置/自身对齐、旋转、尺寸和外边距共享标签列；Fill/Hug 不重复显示模式名，Fixed 保留数值与尾部模式；365px 无横向溢出。
- [x] 6.7 更新 README/Changeset，并运行目标测试、`lint`、`typecheck`、`test`、`build`、`test:e2e`、`pack:dry-run` 与严格 OpenSpec 校验，记录 Red/Green/Regression 证据。
  - Docs: 根 README、Materials README 与 Changeset 已同步独立 Position/Align Self、Angle 和融合 AxisSizing 控件语义。
  - Regression: Materials 51 项测试、全仓 37 个测试任务、`bun run lint`、`bun run typecheck`、`bun run build` 与 `bun run pack:dry-run` 全部通过。
  - E2E: Chromium 30/30 通过；除五张 Basic/Fill 目标黄金图外，仅更新 SVG Inspector 与 Hug 完整工作区中确由基础属性拆行产生的差异。
  - Validation: `openspec validate redesign-auto-layout-inspector --strict` 通过；PostHog 遥测网络失败不影响本地严格校验与退出码。
