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

## 8. 默认节点完整类型覆盖（Red → Green → Refactor）

- [x] 8.1 Red：新增 Rectangle 默认节点完整类型展厅 E2E，并确认当前缺少支持类型分组
- [x] 8.2 Green：扩展 Rectangle Schema、默认值和 renderer registry，覆盖全部已支持类型族
- [x] 8.3 Refactor：保持类型演示默认折叠，不破坏 UE 主属性视觉和 ECharts 独立示例
- [x] 8.4 Regression：运行 strict validate、lint、typecheck、test、build 和 Chromium E2E
- [x] 8.5 Clarification：示例启动时直接创建并选中 Rectangle，不要求用户先点击新增按钮

### 8.x 执行证据

- Red command/result/reason：`bunx playwright test --grep '展开默认节点的完整类型展厅' --workers=1`；
  1/1 按目标行为失败，Rectangle 面板尚无“支持类型 Supported Types”分组。
- Green command/result：同一命令 1/1 通过；Rectangle 默认节点现已覆盖 string、number、bigint、
  boolean、date、literal、picklist、enum、object、optional、nullable、nullish、array、tuple/rest、
  record、union、variant，并通过自定义 renderer 展示 EChartsOption。
- Clarification Red command/result/reason：移除目标 E2E 中“添加矩形组件”点击后，同一命令 1/1 失败；
  首屏找不到 Rectangle 属性面板，证明实现仍依赖用户手动新增。
- Clarification Green command/result：初始化 Scene Tree、Canvas、受控 Rectangle 数据和选择状态后，
  同一命令 1/1 通过；无需任何操作即可展开完整类型展厅。
- Refactor/visual result：完整类型展厅及其五个子分组默认折叠；浏览器实际首屏确认 Scene Tree、Canvas、
  属性面板三处均显示并选中 Rectangle；属性面板黄金图保持不变，受新首屏影响的场景树全页黄金图已
  更新并通过回归。
- Regression command/result：`bun run lint`、`bun run typecheck`、`bun run test` 通过；
  `bun run test:e2e` 同时完成 6/6 packages 构建及 Chromium 34/34 测试，全部通过。

## 9. UE4 视觉精细还原（Red → Green → Refactor）

- [x] 9.1 Red：锁定 650px Inspector、236/36px 列宽、234px 控件轨道及紧凑区域高度
- [x] 9.2 Green：实现公共包默认 UE4 几何、层次、缩进、Checkbox 和窄面板响应式行为
- [x] 9.3 Green：实现 Rectangle 小数、内嵌单位、Visibility、Color 与 Alignment 细节
- [x] 9.4 Refactor：浏览器逐项对照参考图并更新必要的视觉黄金文件
- [x] 9.5 Regression：运行 strict validate、lint、typecheck、test、build、Chromium E2E 和 diff check

### 9.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test` 中 2/30 按目标失败，默认及恢复
  列宽仍为 160px；`bun run --cwd packages/editor test` 中 1/11 按目标失败，Inspector 仍为 480px；
  `bunx playwright test --grep '宿主加载属性面板样式' --workers=1` 1/1 按目标失败，首个几何断言
  实测 480px 而非 650px。
- Green command/result：property-panel 30/30、editor 11/11 通过；目标 Chromium 几何与控件细节
  2/2 通过。浏览器实测 Inspector 650px、属性面板内容 615px、两列 236/36px、普通控件轨道
  234px，Header/工具栏/一级分组/字段行/输入框分别为 64/46/37/36/28px；窄面板 clamp、Pointer
  拖动、键盘调整和恢复默认列宽均通过组件回归。
- Visual review：使用浏览器逐项检查默认、resize 与 ECharts 展开状态；Rectangle 的一位小数、内嵌
  `°`/`px`、眼睛 Visibility、深色 Checkbox、四种 Alignment 图标和 28px 色块与参考图一致，Advanced、
  Diagnostics、Supported Types 默认折叠。ECharts 自定义 renderer 的 control/editor 实测 326/342px，
  未受 234px 上限约束；已更新 property-panel 三张基线及受 Inspector 变宽影响的场景树全页基线，人工
  检查无裁切、重叠或非预期状态。
- Regression command/result：`openspec validate add-property-panel --strict`、`bun run lint`、
  `bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e`、`bun run pack:dry-run`
  和 `git diff --check` 全部通过；Chromium 35/35，property-panel 30/30，5 个公共包 dry-run 成功。

## 10. Inspector 宽度与深层树紧凑化（Red → Green → Refactor）

- [x] 10.1 Research：核对桌面 Inspector 的常见默认宽度与可调整模式
- [x] 10.2 Red：锁定 400px Inspector、160/36px 默认列宽与深层共享编辑列
- [x] 10.3 Green：移除嵌套内容整体偏移，改为小步长、深度封顶的标题/标签/引导线缩进
- [x] 10.4 Visual：浏览器检查 Rectangle 深层属性、默认布局和 resize 基线
- [x] 10.5 Regression：运行 strict validate、lint、typecheck、test、build、Chromium E2E 和 diff check

### 10.x 执行证据

- Research：Apple AppKit 的标准 Inspector 宽度为 270pt；SwiftUI 官方示例使用 225pt ideal、400pt max；
  Figma 与 Godot 官方文档均采用可调整面板。结合中英双语标签，本示例选择 400px 作为紧凑默认值。
- Red command/result/reason：`bun run --cwd packages/property-panel test` 新增/更新用例 3/31 按目标失败，
  默认列宽仍为 236px 且深层字段没有受控深度；`bun run --cwd packages/editor test` 1/11 按目标失败，
  Inspector 仍为 650px。目标 Chromium 用例在全部新几何断言通过后，仅因旧 615px 黄金图失败。
- Green command/result：property-panel 31/31、editor 11/11 通过；六层嵌套字段的标签缩进封顶为 62px，
  分组缩进封顶为 84px。键盘列宽与 Supported Types 点击目标 E2E 2/2 通过；分隔线命中区由 9px
  收紧至 5px，不再遮挡窄面板中的分组按钮。
- Visual review：浏览器实测 Inspector/内容区/属性名列为 400/365/160px，顶层与深层编辑列 X 坐标
  完全一致，Rectangle 深层文字起点 70px、六层嵌套封顶 88px，横向溢出为 0；人工检查默认、
  resize、ECharts 和全页基线，无裁切、重叠或不可见字段。
- Tree-line correction Red/Green：新增伪元素坐标断言后 property-panel 1/31 按目标失败，字段支线使用
  14px 步长而父级竖线使用 18px 步长；统一坐标公式后 31/31 通过。浏览器实测 Stroke 子字段的
  branch/guide 均为 56px，Supported Types 基础字段均为 38px，支线宽度统一为 10px、文字间隔为 4px。
- Regression command/result：`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、
  `bun run test:e2e` 与 `bun run pack:dry-run` 全部通过；Chromium 35/35、property-panel 31/31、
  editor 11/11、5 个公共包 dry-run 成功；OpenSpec strict 与 `git diff --check` 亦通过，校验结束后的
  遥测域名不可达警告不影响结果。

## 11. 自定义 Renderer 全宽布局（Red → Green → Refactor）

- [x] 11.1 Spec：补充 renderer 布局、metadata 覆盖优先级和全宽内容行为
- [x] 11.2 Red：为 inline 默认值、full-width、双向 metadata 覆盖及统一操作添加失败组件测试
- [x] 11.3 Green：实现公共布局类型、全宽标题/内容结构、树线定位和分隔线交互隔离
- [x] 11.4 Example：将 ECharts renderer 迁移到全宽布局并移除应用级 `:has()` 布局特例
- [x] 11.5 Docs/Visual：更新包文档、Chromium 几何断言和 ECharts 视觉基线
- [x] 11.6 Regression：运行 strict validate、lint、typecheck、test、build、Chromium E2E、pack dry run 和 diff check

### 11.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test`；新增 3 条全宽布局组件测试
  按目标失败，当前 renderer 定义忽略 `layout`，没有标题行加可访问全宽内容区；原有 31 条测试通过。
  `openspec validate add-property-panel --strict` 同时通过，仅有遥测域名不可达警告。
- E2E Red command/result/reason：`bunx playwright test --grep '选择 ECharts 图表组件$' --workers=1`；
  1/1 按目标失败，示例 registry 尚未声明全宽布局，找不到 `chart.option` 的全宽可访问内容区。
- Green command/result：`bun run --cwd packages/property-panel test` 35/35 通过，包 typecheck 通过；
  ECharts 几何、列宽无关性、点击命中和深层树线两个目标 Chromium 用例均通过。
- Visual result：浏览器检查独立 ECharts 与 Rectangle 类型展厅；标题和操作位于紧凑首行，内容从
  当前树缩进延伸至面板右侧，父级竖线与标题支线对齐，分隔线不穿过内容。人工确认后将 ECharts
  属性面板黄金图从 365×450 更新为 365×468。
- Regression command/result：`openspec validate add-property-panel --strict`、`bun run lint`、
  `bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e`、`bun run pack:dry-run`
  和 `git diff --check` 全部通过；Chromium 35/35、property-panel 35/35、5 个公共包 dry-run 成功。

## 12. 分隔线拖拽柄按需显示

- [x] 12.1 Red：在属性面板视觉 E2E 中断言拖拽柄默认透明、hover 后显示
- [x] 12.2 Green：拖拽柄仅在分隔线 hover、键盘 focus-visible 或按下拖动时显示

### 12.x 执行证据

- Red command/result/reason：`bunx playwright test --grep '宿主加载属性面板样式' --workers=1`；1/1 按
  目标失败，拖拽柄初始 opacity 为 1。
- Green command/result：重新构建后同一命令 1/1 通过；默认 opacity 为 0，hover 后为 1，视觉
  黄金图保持通过。

## 13. UE4 紧凑信息密度（Red → Green → Refactor）

- [x] 13.1 Spec/Red：锁定 12px 正文、52/36/28/26/22px 区域几何和可覆盖密度变量
- [x] 13.2 Red：锁定 14px 树缩进、72px 深层封顶和树线共享坐标
- [x] 13.3 Green：实现公共面板密度变量、紧凑控件、菜单、绑定入口和错误状态
- [x] 13.4 Green：同步 Rectangle、Visibility、Alignment、颜色与 ECharts renderer 密度
- [x] 13.5 Refactor/Visual：更新并人工检查默认、resize、绑定选择器和 ECharts 黄金文件
- [x] 13.6 Regression：运行 strict validate、lint、typecheck、test、build、Chromium E2E、pack dry run 和 diff check

### 13.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test -- -t "深层全宽字段保留封顶缩进|深层字段缩进封顶"`；
  2/2 按目标失败，现有行内坐标仍为 18px 步长，深层字段仍封顶于 88px 而非 72px。
  `bun run build && bunx playwright test --grep "宿主加载属性面板样式" --workers=1` 完成构建后 1/1
  按目标失败，面板正文实测仍为 14px 而非 12px；失败来自尚未实现的新密度，不是选择器或环境错误。
- Green command/result：`bun run --cwd packages/property-panel typecheck` 与目标缩进测试通过；随后完整
  `bun run --cwd packages/property-panel test` 47/47 通过。Chromium 几何用例锁定 12px 正文、
  52/36/28/26/22px 区域尺寸、16px Checkbox、22px 操作按钮、20px 绑定入口、14px 树缩进及
  `--pp-row-height`/`--pp-tree-indent` 宿主覆盖；功能断言转绿后仅旧黄金图按预期失败。
- Visual command/result：`bun run test:e2e:update` 构建成功且 Chromium 39/39 通过；更新默认、resize、
  绑定选择器、ECharts 以及包含 Inspector 的受影响全页基线。人工检查四个属性面板基线，普通字段、
  树线、复合数值、颜色、Alignment 和全宽图表均无重叠或横向溢出，ECharts 预览保持可读。
- Regression command/result：`openspec validate add-property-panel --strict && bun run lint && bun run typecheck && bun run test && bun run build && bun run pack:dry-run && git diff --check`；
  strict validation、全仓 lint/typecheck/test/build、5 个公共包 dry run 和差异检查全部通过，property-panel
  47/47。最终非更新模式 `bun run test:e2e` 构建成功，39/39 Chromium 场景与视觉基线全部通过。

## 14. UE4 扁平分组标题栏（Red → Green → Refactor）

- [x] 14.1 Red：锁定一级栏纯色背景、单层边线、无阴影及展开/收起视觉一致
- [x] 14.2 Red：锁定靠左实心三角和更弱的嵌套分组纯色层级
- [x] 14.3 Green：移除分组渐变、双线和卡片式阴影并重绘三角图标
- [x] 14.4 Visual/Regression：更新目标黄金文件并运行完整质量门禁

### 14.x 执行证据

- Red command/result/reason：`bunx playwright test --grep "宿主加载属性面板样式" --workers=1`；
  1/1 按目标失败，一级 Appearance 标题栏仍返回三层 radial/linear gradient，而规范要求
  `background-image: none`；失败准确证明旧高光渐变尚未移除。OpenSpec strict validation 同时通过。
- Green command/result：重新构建并运行同一 Chromium 用例后，一级/嵌套分组纯色、无阴影、
  单层边线、实心三角及展开/收起背景一致等新增断言全部通过；用例仅因旧视觉黄金文件按预期失败。
- Visual command/result：`bun run test:e2e:update` 39/39 通过并更新默认、resize、绑定选择器和
  ECharts 四张受影响基线；人工检查确认标题栏连续铺满、嵌套层级可辨，字段控件与弹层无重叠。
- Regression command/result：`openspec validate add-property-panel --strict && bun run lint && bun run typecheck &&
  bun run test && bun run build && bun run pack:dry-run && git diff --check` 全部通过，property-panel 47/47；
  最终非更新模式 `bun run test:e2e` 39/39 通过。

## 15. 层级线避让 Record 控件（Red → Green → Refactor）

- [x] 15.1 Red：锁定 Record key 输入位于引导线之上且保持 Pointer/焦点交互
- [x] 15.2 Green：修正 Record key 输入的堆叠层级并保持不透明控件背景
- [x] 15.3 Regression：运行属性面板测试、strict validation 和完整质量门禁

### 15.x 执行证据

- Red command/result/reason：`bun run build && bunx playwright test --grep "展开默认节点的完整类型展厅" --workers=1`；
  1/1 按目标失败，真实 Chromium 中 Record key 输入的 computed `position` 为 `static`，父级
  `z-index: 1` 引导线因而绘制在控件之上并穿过其内容。
- Green command/result：加入 Record key 的局部 stacking context 后，同一 Chromium 用例的 position、
  z-index、Pointer 命中与引导线层级断言全部通过；人工检查新增局部黄金图，竖线在输入框下方消失，
  并在值字段处继续保持树形连接。
- Regression command/result：两个 OpenSpec change strict validation、全仓 lint/typecheck/test/build、
  5 个公共包 pack dry run 与 `git diff --check` 全部通过，property-panel 48/48；最终非更新模式
  `bun run test:e2e` 39/39 通过，包含新增 Record 局部视觉基线。

## 16. 自定义数值 Renderer 外部重置同步（Red → Green → Refactor）

- [x] 16.1 Red：复现 Angle 与 Scale 提交后执行 Transform 重置仍显示旧草稿
- [x] 16.2 Green：提交成功后更新草稿基线，使受控 value 变化时不再命中旧草稿
- [x] 16.3 Regression：运行 strict validation、lint、typecheck、test、build、Chromium E2E 和 diff check

### 16.x 执行证据

- Red command/result/reason：`bun run test:e2e -- --grep "外部重置清除数值 renderer 草稿"`；
  1/1 按目标失败，点击 `重置 Transform` 后 Angle 期望 `0.0`、实际仍为 `5.0`，证明 renderer
  使用了提交前 value 作为草稿 source，外部值回到默认值时错误命中旧草稿。
- Green command/result：将成功提交后的草稿 source 更新为候选值后，同一 Chromium 用例 1/1 通过；
  Angle 恢复 `0.0`，Scale X/Y 均恢复 `1.0`。
- Regression command/result：两个 OpenSpec change strict validation、全仓 lint/typecheck/test/build 与
  `git diff --check` 全部通过；最终非更新模式 `bun run test:e2e` 40/40 通过。
