## 1. 提案与测试基座

- [x] 1.1 严格校验 OpenSpec 提案并确认所有 Scenario 的测试映射
- [x] 1.2 建立 `@compose-ui/scene-tree` 包、Tailwind 构建与测试配置
- [x] 1.3 建立 Playwright 黄金文件独立更新命令和确定性运行环境

## 2. 树模型与虚拟化（Red → Green → Refactor）

- [x] 2.1 为迭代式索引、展开扁平化和 5000 节点场景添加失败测试并记录 Red 证据
- [x] 2.2 实现最小树模型与 `@tanstack/react-virtual` 渲染并记录 Green/Regression 证据
- [x] 2.3 重构稳定节点元数据和 ARIA 计算并复跑测试

## 3. 选择与编辑操作（Red → Green → Refactor）

- [x] 3.1 为单选、多选、范围选择、展开和键盘导航添加失败测试及 Red 证据
- [x] 3.2 实现选择、展开、重命名、删除、可见性、锁定和能力限制并记录 Green 证据
- [x] 3.3 为单一新增按钮、右键新增位置与操作意图添加失败测试后实现
- [x] 3.4 为多选拖拽与非法移动添加失败测试后实现操作意图
- [x] 3.5 重构交互状态并复跑组件回归测试
- [x] 3.6 将双击重命名替换为非 Windows Enter、Windows F2，并补充平台键位测试
- [x] 3.7 修复 macOS Ctrl+点击多选菜单冲突，并让默认编辑器应用右键新增子节点位置

### 3.x 执行证据

- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；
  新增平台键位测试后 1 个失败、原有 22 个通过；双击仍直接渲染重命名输入框。
- Green command/result：同一命令 23/23 通过；非 Windows Enter、Windows F2 分别进入编辑，
  双击不再编辑，Space 保留选择语义。
- E2E command/result：`bunx playwright test --project=chromium --grep '使用平台键位开始重命名'`；
  真实新增节点、双击拒绝编辑、平台键位进入编辑和 Enter 提交全流程 1/1 通过。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；新增
  Ctrl 上下文菜单场景后 1 个失败、原有 24 个通过，Ctrl 右键事件错误地将选择替换为单节点。
- Green command/result：同一命令 25/25 通过；Ctrl/Cmd 上下文事件沿用切换选择语义且不显示菜单，
  右键菜单新增以目标节点作为父级。对应真实 Chromium 多选与新增子节点场景均通过。
- Regression command/result：strict validate、lint、typecheck、45 个 Vitest、build、18 个
  Chromium E2E、四包 pack dry-run 和 `git diff --check` 全部通过。

## 4. 检索与视觉（Red → Green → Refactor）

- [x] 4.1 为普通、大小写、全词、正则、组合模式及无效正则添加失败测试和 Red 证据
- [x] 4.2 实现检索、祖先保留、临时展开和可访问错误并记录 Green 证据
- [x] 4.3 使用 Tailwind 实现场景树参考视觉、焦点状态和滚动条并复跑测试
- [x] 4.4 将新增按钮和检索工具区调整为 Unity 式紧凑密度并更新视觉黄金文件
- [x] 4.5 按 VS Code 检索控件进一步压缩尺寸、强化三种模式选中态并修正光标
- [x] 4.6 缩小检索文字并将新增入口改为无边框居中加号
- [x] 4.7 将节点 hover、选中和键盘聚焦拆分为低调的 VS Code 式三态视觉
- [x] 4.8 将节点压缩为 24px 行高，并把三态背景改成左右内缩的圆角胶囊

### 4.x 执行证据

- Red command/result/reason：`bunx playwright test --project=chromium --grep '显示默认场景树外观'`；
  新增尺寸断言首先收到工具栏 48px、期望 40px，确认失败来自尚未实现的紧凑视觉。
- Green command/result：工具栏调整为 40px，新增按钮与检索框调整为 28px，加号图标调整为
  14px；节点文字、展开控件和行尾操作轻量收紧，树行及拖拽命中区保持不变。
- Golden command/result：使用独立 `test:e2e:update -- --grep` 命令更新默认、选中、搜索和
  受影响的拖拽名称胶囊黄金文件；人工检查紧凑尺寸、选中背景、搜索焦点和拖拽预览均清晰。
- Regression command/result：strict validate、lint、typecheck、45 个 Vitest、build、18 个
  Chromium E2E、串行重建后的四包 pack dry-run 和 `git diff --check` 全部通过。
- Red command/result/reason：`bunx playwright test --project=chromium --grep
  '使用普通与组合检索|显示默认场景树外观'`；2/2 按目标行为失败：工具栏仍为 40px 而非
  32px，正则按钮虽然 `aria-pressed=true` 但背景仍透明。
- Green command/result：同一命令 2/2 通过；工具栏调整为 32px，新增按钮和检索框为 24px，
  三个模式按钮具有独立点击区域和蓝色启用态，节点行恢复箭头光标，按钮使用手型光标，
  拖拽启动后才显示抓取光标。
- Golden command/result：以零视觉容差运行独立更新命令，强制重建默认、选中和搜索三张黄金
  文件；人工确认搜索黄金文件同时显示 Aa、全词和正则三个蓝色启用态，随后恢复常规容差。
- Regression command/result：strict validate、lint、typecheck、45 个 Vitest、build 和 18 个
  Chromium E2E 全部通过；受紧凑工具栏影响的多选拖拽黄金文件经 expected/actual/diff 检查后
  使用独立命令同步。
- Red command/result/reason：浏览器视觉断言首先得到检索文字 16px（宿主未分层输入框规则覆盖
  Tailwind 工具类），随后检测到加号中心偏移 1px，均为目标样式尚未满足而失败。
- Green command/result：检索输入与模式按钮固定为 11px，新增按钮移除边框和内边距，14px 加号
  使用块级 SVG 精确居中；尺寸、边框和中心偏移浏览器断言通过。
- Golden command/result：用独立更新命令以零容差重建默认、选中和检索黄金文件，并人工检查
  检索控件、三个可点击模式按钮及无边框加号，随后恢复 0.01 常规视觉容差。
- Final regression：OpenSpec strict、lint、typecheck、47 个 Vitest、build、20 个 Chromium E2E、
  四包 pack dry-run 和 `git diff --check` 全部通过；多选拖拽夹具按同级节点语义修正后并行重复
  5 次全部通过。
- Red command/result/reason：`bunx playwright test --project=chromium --grep '显示默认场景树外观'`；
  三态颜色断言首先在 hover 处失败，实际为旧 `rgb(26, 30, 36)`、期望 VS Code 式
  `rgb(42, 45, 46)`，确认失败来自目标视觉尚未实现。
- Green command/result：重建后同一浏览器场景精确验证 hover `#2a2d2e`、选中 `#37373d`、
  键盘聚焦 `#062f4a` 与 `#007fd4` 内描边；选中态不再显示高亮蓝色侧边条，焦点优先级正确。
- Golden command/result：先以零容差检查选中及拖拽场景的 expected/actual/diff，再通过独立
  `test:e2e:update` 命令更新选中、聚焦、搜索、多选预览和落点黄金文件；人工确认三态层级清晰，
  随后恢复 0.01 常规容差。
- Regression command/result：OpenSpec strict、lint、typecheck、47 个 Vitest、build 和 20 个
  Chromium E2E 全部通过；拖拽父级高亮、落点横线与节点三态保持互不混淆。
- Red command/result/reason：`bunx playwright test --project=chromium --grep '显示默认场景树外观'`；
  新增紧凑行和胶囊几何断言后首先得到旧行高 32px、期望 22px，确认失败来自节点密度和
  选中背景几何尚未实现。
- Green command/result：节点改为 24px 虚拟间距、22px 可见高度、上下 1px 与左右 4px 留白、
  5px 圆角；行尾操作按钮同步压缩至 20px。组件测试按 4/16/4 拖拽命中区校正后 25/25 通过，
  浏览器精确验证相邻节点 Y 间距为 24px。
- Golden command/result：检查紧凑布局的 expected/actual/diff 后，通过独立 `test:e2e:update`
  更新七份黄金文件；使用零容差强制同步小于 1% 的节点几何变化，人工确认选中胶囊、键盘
  焦点、父级高亮和落点横线，随后恢复 0.01 常规容差。
- Regression command/result：OpenSpec strict、lint、typecheck、47 个 Vitest、build 和 20 个
  Chromium E2E 全部通过；5000 节点虚拟化及全部拖拽层级场景保持通过。

## 5. Editor 与示例集成（Red → Green → Refactor）

- [x] 5.1 为默认空树、`sceneTreeProps` 热更新和旧插槽覆盖添加失败测试及 Red 证据
- [x] 5.2 集成 scene-tree、迁移 editor Tailwind 样式并记录 Green/Regression 证据
- [x] 5.3 更新全屏示例与确定性的 5000 节点夹具

## 6. E2E、文档与交付

- [x] 6.1 添加关键场景树流程、5000 节点和现有文本同步 E2E
- [x] 6.2 添加并人工检查默认、选中和检索状态的 Chromium 黄金文件
- [x] 6.3 更新 README、包文档、架构说明和四包发布检查
- [x] 6.4 运行 strict validate、lint、typecheck、test、build、test:e2e 和 pack:dry-run
- [x] 6.5 在本文件记录各行为循环的 Red/Green/Regression 命令与结果并完成清单
- [x] 6.6 为连续新增 20 个节点、单节点编辑和删除同步补充失败 E2E 后完成实现
- [x] 6.7 为场景树纵轴拖拽和无横向滚动补充失败 E2E 后修复

## 7. VS Code 风格拖拽替换（Red → Green → Refactor）

- [x] 7.1 为单选/多选归一化、落点深度、非法位置和同位 no-op 添加失败模型测试
- [x] 7.2 实现无第三方依赖的落点模型并记录 Green/Regression 证据
- [x] 7.3 为静态源节点、Pointer Up 提交、取消和 600ms 展开添加失败组件测试
- [x] 7.4 实现 Pointer Events 状态机、落点横线和边缘纵向滚动
- [x] 7.5 移除 dnd-kit 依赖并更新构建、锁文件和文档
- [x] 7.6 添加单选、多选、层级、静态拖动和自动滚动 E2E
- [x] 7.7 独立生成并人工检查拖拽横线黄金文件
- [x] 7.8 运行完整交付门禁并记录最终证据
- [x] 7.9 为默认编辑器保留受控多选并应用批量移动补充失败 E2E 后完成修复
- [x] 7.10 为节点文字区域稳定启动同层拖拽补充失败测试后修复横向深度计算
- [x] 7.11 为文字选区竞争、单次快速移动和默认节点层级变化补充失败 E2E 后修复
- [x] 7.12 为嵌套首项 before 落点和展开子树横线位置补充失败测试后修复
- [x] 7.13 为 6/20/6 三段落点、父级高亮和单项/多项拖拽预览补充失败测试后实现
- [x] 7.14 修复展开节点底部落点跳到可见子树末尾并补充模型与浏览器回归

### 7.x 执行证据

- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/tree-model.test.ts`；
  新增 3 个用例失败、原有 5 个通过；当前没有选择归一化和按深度计算落点的行为。
- Green command/result：同一命令 8/8 通过；实现可移动选择归一化、祖先去重、横向深度、
  真实横线位置、非法目标和同位 no-op 计算。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；
  新增 4 个组件用例失败、原有 12 个通过；当前没有静态行落点横线、拖动单选、取消清理
  或 600ms 悬停展开行为。
- Green command/result：同一命令 16/16、scene-tree 完整 Vitest 24/24 通过；Pointer Events
  状态机仅在 Pointer Up 提交，支持取消、横线、受控单选、悬停展开和边缘纵向滚动。
- Red command/result/reason：`bunx playwright test --project=chromium --grep '使用静态节点和落点横线拖拽'`；
  用例等待 `Layer 1` 超时；示例尚无嵌套受控拖拽夹具和 move 应用行为。
- Green command/result：嵌套夹具应用受控 move 后，单项静态拖拽、Shift 批量提升层级、
  5000 节点边缘自动滚动和无横向滚动 E2E 均通过；完整 Chromium 回归为 12/12。
- Golden command/result：`bun run test:e2e:update -- --grep '使用静态节点和落点横线拖拽'`；
  新增 `scene-tree-drag-indicator.png`，人工确认源节点静止、保持选中且三级落点横线位于
  `Layer 3` 下方；随后普通 `test:e2e` 比较通过。
- Regression command/result：strict validate、lint、typecheck、37 个 Vitest、build、12 个
  Chromium E2E、四包 pack dry-run 和 `git diff --check` 全部通过；源码、构建配置、包清单
  与锁文件均无 dnd-kit 残留。
- Red command/result/reason：`bunx playwright test --grep '默认编辑器应用多选移动意图'`；
  Shift 选择第二至第四个节点后第二个节点的 `aria-selected` 仍为 `false`；默认示例将受控选择
  压缩为单个 ID，且未在普通页面应用 `move` 操作。
- Green command/result：同一用例 1/1 通过；默认示例保留完整 `selectedIds`，并在 Pointer Up 后
  将批量 move 同步应用到场景树和 Canvas 顺序。
- Regression command/result：strict validate、lint、typecheck、37 个 Vitest、build、13 个
  Chromium E2E（含四份黄金文件）、四包 pack dry-run 和 `git diff --check` 全部通过。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；
  从文字 `gridcell` 的 X=180 开始同层拖动时新增用例失败、原有 18 个通过；绝对 X 被误算为
  子级深度，叶节点无法作为父级导致落点横线消失。
- Green command/result：同一命令 19/19 通过；目标深度改为基于源节点层级和相对水平位移，
  从文字、图标或空白处垂直拖动都保持原层级，约每横移 16px 才改变一级。
- Regression command/result：strict validate、lint、typecheck、38 个 Vitest、build 和 13 个
  Chromium E2E（含四份黄金文件）全部通过；默认 E2E 从真实文字 `gridcell` 启动拖拽。
- Red command/result/reason：`bunx playwright test --grep '从文字区域快速拖动并改变层级'`；
  新增 E2E 在拖动前即失败，节点行的计算样式 `user-select` 为 `auto`；浏览器原生文字选择
  会与快速 Pointer 拖拽竞争，且默认文本节点被标记为不可包含子项。
- Green command/result：同一用例 1/1 通过；节点行禁用原生文字选择，默认组件节点允许包含
  子项，示例受控维护展开状态并在 reparent 后展开目标父节点；一次快速 Pointer Move 后立即
  Pointer Up 仍成功提交，移动节点显示为 `aria-level=3`。
- Regression command/result：strict validate、lint、typecheck、38 个 Vitest、build 和 14 个
  Chromium E2E（含四份黄金文件）全部通过。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/tree-model.test.ts`；
  新增嵌套首项 before 用例失败、原有 7 个通过；期望父级索引 0 和横线 `lineIndex=2`，
  实际被计算为父级末尾索引 2 和 `lineIndex=4`。
- Green command/result：同一命令 8/8 通过；落点模型显式区分 before/after，上半区以当前
  节点为锚点，下半区才从前一节点计算；浏览器 E2E 1/1 验证横线位于嵌套首项上沿，
  松手后节点成为该父级的第一个子项。
- Regression command/result：strict validate、lint、typecheck、39 个 Vitest、build 和 15 个
  Chromium E2E（含四份黄金文件）全部通过。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/tree-model.test.ts`；
  新增父级落点用例失败、原有 8 个通过；中间命中区仍被计算为父级之后的横线落点，未生成
  `{ parentId: targetId, index: children.length }` 操作。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；
  新增拖拽预览和父级高亮用例失败、原有 19 个通过；拖动状态尚未渲染 Portal 预览，也未标记
  `inside` 目标行。
- Green command/result：scene-tree 完整 Vitest 31/31 通过；6px 顶部和底部命中区显示互斥横线，
  中间 20px 仅显示父级整行高亮；单项预览显示名称，多项圆标使用归一化后的实际移动数量，
  Pointer Up 才提交一次 move，取消会立即清理反馈。
- Golden command/result：分别使用独立 `test:e2e:update -- --grep` 命令生成
  `scene-tree-drag-preview-single.png` 和 `scene-tree-drag-preview-multi.png`；人工确认名称胶囊、
  数量圆标、父级整行高亮以及横线状态互斥，随后普通截图比较通过。
- Regression command/result：strict validate、lint、typecheck、43 个 Vitest、build 和 16 个
  Chromium E2E 全部通过；完整回归同时覆盖前插、后插、父级追加、快速 Pointer Move、层级变化、
  自动滚动、取消清理和 5000 节点虚拟化。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/tree-model.test.ts`；
  展开节点底部新增用例失败、原有 9 个通过；低层级请求被解释为整个可见子树之后，横线从
  目标节点下沿跳到最后一个后代之后。
- Green command/result：同一命令 10/10 通过，浏览器场景 1/1 通过；展开节点底部横线紧邻
  目标行，松手后节点成为第一个子项。

## 8. 场景树命令 Hook

- [x] 8.1 Red：为命令位置、批量规范化、复制/剪切/删除和失效目标添加 Hook 测试，并记录预期失败。
- [x] 8.2 Green/Refactor：实现公共 `useSceneTreeCommands` controller 与 `duplicate` 操作意图。
- [x] 8.3 Red：为节点/空白菜单、禁用状态、键盘导航、快捷键隔离和外部 controller 添加组件测试。
- [x] 8.4 Green/Refactor：用 controller 驱动 SceneTree 菜单、快捷键和顶部新增入口。
- [x] 8.5 Red/Green：为示例 duplicate、真实层级顺序及 Canvas/Inspector 同步添加浏览器测试并实现宿主逻辑。
- [x] 8.6 Golden：独立更新并人工检查右键菜单 expected/actual/diff，普通 E2E 比较通过。
- [x] 8.7 文档与发布：更新 README、Changeset、公共声明和包检查。
- [x] 8.8 回归：strict、lint、typecheck、Vitest、build、Chromium E2E、pack dry run 与 diff check 全通过。
- [x] 8.9 Review 修复：键盘命令使用焦点目标、父节点删除同步清理完整业务子树，且右键菜单约束在视口内。

### 8.x 执行证据

- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；
  新增 4 个菜单与快捷键用例失败、原有 25 个通过；旧组件仅有单项“新增节点”菜单且没有
  copy/paste 快捷键。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/use-scene-tree-commands.test.tsx`；
  5/5 因 controller 骨架尚无位置计算、剪贴板和操作发出行为而失败。
- Green command/result：Hook、组件菜单、键盘导航、输入隔离和外部 controller 测试合计
  36/36 通过；scene-tree 完整 Vitest 后续为 46/46 通过。
- Red command/result/reason：`bunx playwright test --project=chromium --grep '打开空白区命令菜单'`；
  根级新增期望 `aria-level=1`、实际为 2，证明 demo 错误地将 null 根目标映射到 Page 1。
- Green command/result：根级插入修正且 demo 保留 Page 1 默认新增锚点；根级菜单、Ctrl 多选复制、
  duplicate 新 ID、层级顺序及 Inspector/Canvas 副本编辑同步浏览器流程通过。
- Golden command/result：`bun run test:e2e:update -- --project=chromium --grep '打开节点命令菜单'`；
  新增 `scene-tree-context-menu.png`，人工检查启用/禁用项、两处分隔线和危险删除视觉；随后
  普通截图比较 1/1 通过。
- Review Red/Green：新增显式命令目标测试首先收到旧选择节点，父级删除 E2E 首先在 Canvas
  留下子节点，视口边缘菜单测试首先超出 8px 安全边距；修正后 scene-tree 48/48 Vitest 和
  三项定向 Chromium 回归全部通过。
- Regression command/result：OpenSpec strict、lint、typecheck、60 个 Vitest、build、26 个
  Chromium E2E（含黄金文件）、四包 pack dry-run 和 `git diff --check` 全部通过；pack 清单
  包含 scene-tree/editor 的 JS、声明文件和 styles.css。

## 9. 内部逻辑分层与完整组件化

- [x] 9.1 为选择、键盘、拖拽状态和坐标换算添加不依赖 DOM 的 characterization 单元测试。
- [x] 9.2 提取纯交互模型，保持现有选择、键盘和拖拽行为不变。
- [x] 9.3 提取交互与拖拽 Hook，并以 fake timers 和可控 RAF 验证副作用生命周期。
- [x] 9.4 拆分 Toolbar、Virtual Row、Context Menu、Drop Indicator 和 Drag Preview 展示组件。
- [x] 9.5 将 `SceneTree` 收敛为受控数据、虚拟化和内部模块的组装入口，公共 API 保持不变。
- [x] 9.6 运行 strict、lint、typecheck、Vitest、build、Chromium E2E、pack dry run 与 diff check，
  并确认无需更新视觉黄金文件。

### 9.x 执行证据

- Characterization Red/Green：新增纯模型骨架后 7/7 测试因目标计算尚未实现而按预期失败；
  完成选择、平台键位、拖拽阈值、三段命中、层级量化、滚动速度和 Portal clamp 后 8/8 通过。
- Hook/Presenter：Pointer Capture、600ms 延迟展开、RAF 清理、虚拟焦点和菜单外部关闭使用
  `renderHook` 验证；Toolbar、Virtual Row 和 Context Menu 使用 Testing Library 验证 ARIA、
  命令顺序和事件透传。scene-tree 包最终 63/63 Vitest 通过。
- Refactor：`scene-tree.tsx` 从 860 行收敛到 202 行，仅保留受控数据、虚拟化与模块连线；
  纯模型、两个副作用 Hook 和四类展示组件均为包内部实现，公共入口未新增导出。
- Regression：OpenSpec strict、lint、typecheck、75 个 Vitest、build、26 个 Chromium E2E、
  四包 pack dry-run 和 `git diff --check` 全部通过；所有既有视觉黄金文件原样比较通过，
  未生成或更新截图。

## 执行证据

- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/tree-model.test.ts`；
  4/4 失败；索引、可见扁平化和检索仍返回空结果。
- Green command/result：同一命令 4/4 通过；迭代式模型和检索实现完成。
- Red command/result/reason：`bun run --cwd packages/scene-tree test -- src/scene-tree.test.tsx`；
  6/6 失败；组件尚无 treegrid、虚拟行、新增按钮与检索控件。
- Green command/result：同一命令 6/6 通过；随后完整 scene-tree 回归为 17/17 通过。
- Red command/result/reason：`bun run --cwd packages/editor test -- src/index.test.tsx`；
  2 个场景失败；Scene Graph 仍显示旧占位且忽略 `sceneTreeProps`。
- Green command/result：同一命令 7/7 通过；默认树、热更新和插槽覆盖完成。
- Red command/result/reason：组合检索 E2E 失败，且新增的无效正则单元断言失败；
  原始非法正则被全词边界包裹后误解析为合法表达式。
- Green command/result：原始正则预校验后模型测试 5/5、功能 E2E 7/7 通过。
- Red command/result/reason：`bunx playwright test e2e/integration.spec.ts:154 --project=chromium`；
  连续新增 20 次后期望 21 行、实际仅 2 行，证明示例仍以单值状态覆盖固定 `text-1`。
- Green command/result：同一 E2E 验证 20 个稳定唯一节点、选择第三项编辑、其他节点不变及
  删除后树与 Canvas 同步减少，1/1 通过。
- Red command/result/reason：`bunx playwright test e2e/integration.spec.ts:180 --project=chromium`；
  拖过面板右边界后节点行横向偏移 240px，证明横向 transform 与自动滚动未受约束。
- Green command/result：当时的旧拖拽实现限制为仅纵向，并对节点行使用 border-box/横向
  裁切；同一 E2E 1/1 通过，完整 Chromium 回归当时为 9/9 通过。
- Regression command/result：`bun run test`；当时全部 29 个 Vitest 测试通过。
- Regression command/result：`bunx playwright test --grep-invert '场景树视觉与样式隔离'`；
  当前 7 个功能 E2E 通过。
- Golden command/result：`bun run test:e2e:update -- --grep '场景树视觉与样式隔离'`；
  生成默认、选中、检索三份 expected，并逐张检查布局、图标、控件和状态。
- Final regression command/result：该阶段 strict validate、lint、typecheck、test、build、
  test:e2e、pack:dry-run 全部通过；当时完整 Chromium E2E 为 9/9 通过。
