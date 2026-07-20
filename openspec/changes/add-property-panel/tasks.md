## 1. 提案与包基座

- [x] 1.1 严格校验 OpenSpec 提案并确认每个 Scenario 的自动化测试映射
- [x] 1.2 建立 `@compose-ui/property-panel` 包、Tailwind 前缀样式、Vitest 和发布配置
- [x] 1.3 更新根工作区脚本、Valibot peer dependency 和示例应用依赖

## 2. Schema 模型与基础类型（Red → Green → Refactor）

- [x] 2.1 Red：为 pipe/包装器解包、metadata、字段路径、排序和基础类型映射添加失败测试并记录证据
- [x] 2.2 Green：实现最小同步 Schema 遍历器和基础 renderer，使对应测试通过
- [x] 2.3 Red/Green：为 optional/nullable/nullish 存在性和默认值生成补充失败测试后实现
- [x] 2.4 Refactor：拆分纯 Schema 模型、路径更新和默认值解析并复跑回归

### 2.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test`；8/8 测试按目标行为失败，
  当前包骨架尚未解包 Schema、读取 metadata、生成字段控件、更新路径或发出受控变更。
- Green command/result：同一命令 8/8 通过；基础 Schema inspector、确定性初值、不可变路径更新、
  string/number/bigint/boolean/date/literal/picklist/enum renderer 与有效受控回调已完成。
- Regression command/result：`bun run --cwd packages/property-panel typecheck` 通过。
- Optional/default Red command/result/reason：`bun run --cwd packages/property-panel test`；新增结构
  用例在缺少存在性控制和有效初值生成时失败。
- Optional/default Green command/result：同一命令在包装器存在性、renderer `createDefault` 与确定性
  Schema 初值完成后通过。

## 3. 嵌套与集合结构（Red → Green → Refactor）

- [x] 3.1 Red/Green：为对象分组、数组增删移动和 tuple/rest 编辑添加失败测试后实现
- [x] 3.2 Red/Green：为 record 新增、改键、重复 key 和删除添加失败测试后实现
- [x] 3.3 Red/Green：为 union/variant 分支识别、默认值生成、禁用和切换添加失败测试后实现
- [x] 3.4 Refactor：统一结构操作原因、不可变路径更新和折叠树渲染并复跑回归

### 3.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test`；新增对象、数组、tuple、
  record 与 union 的 5 条测试因结构 UI 和操作尚未实现而失败。
- Green command/result：同一命令 13/13 通过；后续 tupleWithRest 和 variant 回归也通过。
- Regression command/result：最终包测试 30/30 通过，`bun run typecheck` 通过。

## 4. 受控校验与自定义 renderer（Red → Green → Refactor）

- [x] 4.1 Red：为有效回调详情、parsed output、无效草稿和 async 拒绝添加失败测试
- [x] 4.2 Green：实现统一候选校验、issue 路径和草稿提交状态机
- [x] 4.3 Red：为 editor ID、matcher、覆盖优先级、缺失 renderer 和实例隔离添加失败测试
- [x] 4.4 Green/Refactor：实现实例级 renderer registry 和公共 renderer props

### 4.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test`；4 条校验、async 和 registry
  用例因缺少统一候选校验、草稿及 renderer 选择而失败。
- Green command/result：同一命令 17/17 通过；matcher 默认值、实例隔离和包含名称/Schema 类型的
  不支持状态在后续回归中通过。
- Regression command/result：`bun run lint && bun run typecheck && bun run test` 全部通过。

## 5. 面板骨架与双分隔线（Red → Green → Refactor）

- [x] 5.1 Red/Green：为 header、分组折叠、搜索恢复、筛选、设置和默认值重置添加组件测试后实现
- [x] 5.2 Red：为两条分隔线独立 Pointer 拖动、宽度 clamp、键盘操作和 ARIA 添加失败测试
- [x] 5.3 Green：实现共享三列布局、Pointer Capture、ResizeObserver 和默认列宽恢复
- [x] 5.4 Refactor：完成紧凑深色样式、CSS 变量、焦点和滚动状态并复跑组件回归

### 5.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test`；23 条测试中新增的搜索、
  筛选、设置、重置和双分隔线 6 条按目标行为失败。
- Green command/result：同一命令 23/23 通过。
- Refine Red/Green command/result：metadata section/折叠、renderer 初值和 ResizeObserver 的 3 条
  新测试先失败，完成后 26/26 通过；无效数组项重置测试先 1 条失败，完成后 30/30 通过。
- Regression command/result：最终 `bun run test` 中 property-panel 30/30 通过。

## 6. 示例应用与 ECharts 自定义类型（Red → Green → Refactor）

- [x] 6.1 Red：为文本组件迁移到属性面板后的原有编辑流程添加失败测试
- [x] 6.2 Green：通过 editor `inspectorPanel` 插槽接入属性面板并保持文本流程兼容
- [x] 6.3 Red：为 EChartOption custom Schema、echart renderer 选择和非法 option 添加失败测试
- [x] 6.4 Green：实现 ECharts 图表节点、结构化自定义属性 UI、真实预览和 Canvas 同步
- [x] 6.5 Refactor：确认 ECharts 只存在于示例应用依赖和代码路径，公共包声明无泄漏

### 6.x 执行证据

- Red command/result/reason：`bunx playwright test --grep 'OpenSpec: property-panel'`；示例尚无属性
  面板、ECharts 新增入口和分隔线时对应浏览器流程失败。
- Collection Red command/result/reason：`bunx playwright test --grep '在示例面板编辑集合' --workers=1`；
  因示例 Schema 尚无“关键词”数组，测试等待“添加 关键词”失败。
- Invalid option Red command/result/reason：`bunx playwright test --grep '编辑 ECharts 配置' --workers=1`；
  因自定义 renderer 尚未显示非法数值草稿 issue 而失败。
- Green command/result：属性面板目标 E2E 7/7 通过；文本、数组、ECharts 修改、非法草稿、复制和
  Canvas 同步均通过。
- Boundary check result：`rg` 确认 property-panel 的 package、src 和 dist 没有 ECharts runtime
  import 或 dependency；ECharts 仅在 `app`。

## 7. E2E、视觉与交付

- [x] 7.1 添加文本编辑、复杂结构、自定义 ECharts 类型和两条分隔线关键 Chromium E2E
- [x] 7.2 独立生成并人工检查属性面板默认、集合展开、ECharts 编辑和 resize 黄金文件
- [x] 7.3 更新根 README、包 README、架构约束、OpenSpec project 和 changeset
- [x] 7.4 运行 strict validate、lint、typecheck、test、build、test:e2e、pack dry run 和 diff check
- [x] 7.5 在本文件按行为循环记录 Red command/result/reason、Green command/result 和 Regression command/result

### 7.x 最终门禁

- `openspec validate add-property-panel --strict`：通过；命令结束时仅遥测域名不可达警告，不影响校验。
- `bun run lint`：通过。
- `bun run typecheck`：10/10 Turbo tasks 通过。
- `bun run test`：9/9 Turbo tasks 通过；property-panel 30/30，仓库现有测试全部通过。
- `bun run build`：6/6 packages 通过。
- `bun run test:e2e`：Chromium 33/33 通过，包含 7 条 property-panel 纵向/视觉流程。
- `bun run pack:dry-run`：5 个公共包通过；property-panel 包含公开声明、JS、CSS 和 README，
  unpacked 53.42KB。
- `git diff --check`：通过。
- Visual review：已检查 `property-panel-default.png`、`property-panel-resized.png`、
  `property-panel-echart-editor.png` 和 `property-panel-echart-canvas.png`，无裁切、重叠或非预期状态。

### 7.y UE 参考图视觉返工证据

- Red command/result/reason：`bunx playwright test --grep '宿主加载属性面板样式' --workers=1`；
  新增 Rectangle 视觉案例后因示例尚无“添加矩形组件”入口而失败。
- Green command/result：示例补齐由 Valibot Schema 驱动的 Rectangle、vector/size/color/alignment
  renderer、嵌套 Border/Stroke、Layout 和 State 后，目标视觉用例通过。
- Visual review：浏览器逐项对照 UE 参考图，确认近黑渐变层次、SVG 工具图标、树形引导线、
  双语标签、可见 `＝` 拖拽柄、操作列边界和 480px 默认检查器宽度；重新检查默认与 resize
  两张完整高度基线，并复核 ECharts editor/canvas 基线。
- Regression command/result：`bun run lint`、`bun run typecheck`、`bun run test`、`bun run test:e2e`
  全部通过；Chromium 33/33，property-panel 30/30。
- Package result：`bun run pack:dry-run` 的 5 个公共包全部通过；property-panel 包含公开声明、
  JS、CSS 和 README，unpacked 53.42KB。
