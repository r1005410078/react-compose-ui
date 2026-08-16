## 1. 规范与测试映射

- [x] 1.1 严格校验 `property-panel` 增量规范，并确认与活动中的页面 setup 绑定变更无冲突。
  - Validation command/result：`openspec validate update-property-binding-entry --strict` 通过；活动中的
    `add-page-setup-runtime` 只增加 binding source/宿主授权/binding-only 需求，不修改本变更涉及的入口布局。
- [x] 1.2 为每个新增或修改 Scenario 建立 `OpenSpec: property-panel / ... / ...` 测试映射。
  - 操作轨道四个 Scenario 分别由 `binding-entry-model.test.ts` 的三个同名 cases 与
    `compose-property-panel.test.tsx` 的同名上下文菜单 suite 覆盖。
  - 内置字段授权、兼容变量、编辑区零 slot、persistent 状态、多子目标变量标识、搜索、解绑/reset、安全回退和
    只读状态均由 `compose-property-panel.test.tsx` 的精确 `OpenSpec` case 或紧邻注释映射。
  - 复合数值与 renderer 自动入口由 `semantic-editors.test.tsx`、
    `compose-property-panel.test.tsx` 的精确 `OpenSpec` case 覆盖；ECharts title/data 的独立选择器入口与真实
    Canvas 联动由 `integration.spec.ts` 的紧邻 `OpenSpec` 注释覆盖。

## 2. 操作轨道绑定规划（Red → Green → Refactor）

- [x] 2.1 Red：为单目标直达、多目标聚合、普通动作竞争、bound/invalid 优先级和操作列扩展编写纯规划测试，
  记录当前没有行级 binding 规划的预期失败。
  - Red command/result/reason：`bun run --cwd packages/property-panel test -- src/binding-entry-model.test.ts`；
    4 个测试中 3 个按目标失败，现有规划只处理普通 actions，分别返回 `bindingEntry: 'none'`，未生成
    combined/direct/targets 绑定入口及最高严重度状态。
- [x] 2.2 Green：实现最小纯规划模型，让 36px 与扩大操作列的组合测试通过。
  - Green command/result：`bun run --cwd packages/property-panel test -- src/binding-entry-model.test.ts`，
    4/4 通过；规划现在区分 direct/targets/combined，并按 invalid > bound > literal 聚合状态。
- [x] 2.3 Refactor：统一普通动作、聚合入口和上下文菜单数据，不改变既有 reset/presence/集合动作语义。
  - Refactor result：`RowActionRail` 以同一组排序后的 actions 与 binding target actions 驱动直达、聚合、
    溢出和行上下文菜单；新增右键绑定目标回归后定向测试 77/77 通过。

## 3. 单目标状态显隐（Red → Green → Refactor）

- [x] 3.1 Red：用 Testing Library 覆盖未绑定入口的 hover/focus 可见状态、bound/invalid 常显、只读禁用、
  变量选择与焦点恢复；记录当前编辑区常驻 slot 导致的预期失败。
  - Red command/result/reason：`bun run --cwd packages/property-panel test -- src/property-panel/compose-property-panel.test.tsx -t
    "绑定入口不占用编辑区|自定义 trigger 放入统一操作列|已绑定和错误入口常显|Renderer 无需放置绑定入口|把绑定计入修改和错误筛选"`；
    5/5 按目标失败，当前 trigger 仍位于编辑区 slot，字段没有聚合状态/显隐属性，绑定与 reset 也没有进入
    36px 聚合入口。
- [x] 3.2 Green：把内置单目标入口移入操作列，移除编辑区 binding slot，并保持现有受控 bind/unbind 语义。
  - Green command/result：`bun run --cwd packages/property-panel test -- src/property-panel/compose-property-panel.test.tsx
    src/semantic-editors/semantic-editors.test.tsx src/binding-entry-model.test.ts`，77/77 通过；绑定、换绑、解绑和
    reset 继续走原受控回调。
- [x] 3.3 Refactor：统一字段 `data-binding-state`、tooltip、ARIA description 与主题状态样式。
  - Refactor result：字段与入口统一暴露 `literal | bound | invalid`；literal 为 contextual，bound/invalid
    为 persistent，输入只读状态另有字段内侧状态条，Dark/Light 均有状态样式。

## 4. 多子目标聚合（Red → Green → Refactor）

- [x] 4.1 Red：覆盖 Vector2/Size 与宿主 renderer 的聚合目标顺序、独立绑定/解绑、错误状态和同级字面编辑，
  记录当前每个子输入各自渲染常驻 trigger 的预期失败。
  - Red command/result/reason：同一条定向 Testing Library 命令中 `Renderer 无需放置绑定入口` 按目标失败；
    renderer 已只读取 `targets` 且未调用 `renderTrigger()`，当前操作列为空，证明面板尚未根据 descriptors
    自动生成按 X/Y 顺序排列的聚合入口。
- [x] 4.2 Green：实现聚合目标菜单并由 Property Panel 自动渲染 renderer descriptors；删除
  `PropertyPanelRendererBindingController.renderTrigger()`，迁移第一方 semantic editor、materials 与示例 renderer。
  - Green result：宿主 point renderer 自动得到 X/Y 聚合菜单；Vector2 独立绑定 X 后 X 只读、Y 保持可编辑；
    property-panel 77/77、materials 62/62 通过。
- [x] 4.3 Refactor：抽离聚合菜单焦点和状态模型，保持 picker override 与 target `getTarget()` 公共能力。
  - Refactor result：纯 `binding-entry-model.ts` 负责容量与最高严重度规划；menu/picker 关闭恢复入口焦点；
    config 级 picker/直接单目标 trigger override 保留，renderer controller 仅保留 `targets/getTarget()`。

## 5. 浏览器几何与视觉（Red → Green → Refactor）

- [x] 5.1 Red：增加 Playwright 断言，证明启用绑定不会减少单值、X/Y、W/H 控件宽度，未绑定入口在普通状态
  不显示而 hover/focus 显示，bound/invalid 常显。
  - Red evidence：3.1 的 pre-implementation 定向运行 5/5 失败；旧实现由
    `--pp-binding-slot-width: 36px` 与 `.property-panel__binding-target` 两列网格固定缩窄输入。随后把同一
    单值几何与 contextual hover/focus 契约加入 Chromium 流程，并在 semantic renderer 测试锁定 X/Y、W/H
    聚合入口与编辑区零 slot；未伪造一次独立的浏览器 Red 运行。
- [x] 5.2 Green：完成操作列、聚合菜单和 Dark/Light 样式，更新经人工核对的 Inspector 视觉黄金文件。
  - Green command/result：`bunx playwright test --grep "Controller 驱动的默认组合|完整示例 renderer"`，
    2/2 通过；人工对照 SVG Inspector expected/actual/diff，确认输入区扩宽、普通未绑定入口收纳且焦点行入口
    仍显示，无裁切或错位后更新 `svg-material-inspector.png`。
- [x] 5.3 Refactor：检查窄面板、调整操作列宽度、键盘反向导航和选择器关闭焦点恢复。
  - Refactor result：36px combined 与 64/96px 逐步直达由纯规划测试覆盖；contextual 入口保持 Tab 顺序并
    由 `focus-within/focus-visible` 显示，Escape 或 picker 关闭恢复原入口。

## 6. 文档与回归

- [x] 6.1 更新 Property Panel README 的 renderer binding 示例、公共 API 与迁移说明。
  - Docs result：示例改为仅用 `getTarget()`；记录自动操作列、聚合菜单、状态显隐、controller
    `renderTrigger()` 删除和 config 级直接单目标 override 的保留范围。
- [x] 6.2 运行 `openspec validate update-property-binding-entry --strict`、`bun run lint`、
  `bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 与 `git diff --check`，并记录
  Red/Green/Regression 实际证据。
  - Regression result：OpenSpec strict validate 通过；lint/architecture 通过；typecheck 40/40；test 39/39
    Turbo tasks（含 Property Panel 99、materials 62、Chromium Storybook 44）；build 21/21；完整 Playwright
  35/35；`git diff --check` 通过。沙箱内首次 Storybook test 因禁止监听 `::1` 返回 EPERM，授权本地临时
    端口后同一命令全绿，不属于产品失败。

## 7. 变量控件与三图标操作列（Red → Green → Refactor）

- [x] 7.1 Red：补充纯操作轨道测试，覆盖默认三槽中的绑定 + 重置、超过三项后最后一个槽位为更多图标，
  以及窄列的聚合回退；记录现有 36px 单槽规划的失败证据。
  - Red command/result/reason：`bun run --cwd packages/property-panel test -- src/binding-entry-model.test.ts
    src/property-panel/compose-property-panel.test.tsx src/semantic-editors/semantic-editors.test.tsx`；77 个用例中
    6 个按目标失败。纯规划在 76px 仍只得 2 个槽位，绑定后仍渲染 readonly input、操作入口仍为“更换绑定”，
    证明默认三图标与变量标识/解绑尚未实现。
- [x] 7.2 Green：将默认操作列调整为三图标宽度，更新容量规划与 RowActionRail，使重置按优先级直接显示，
  超额项目收纳进最后一个更多图标。
  - Green result：默认操作列为 76px，规划器以 22px 图标、2px 间隙计算三个槽位；有四项时前两项直达、
    第三槽变为更多图标并收纳其余项目。`packages/property-panel` 99/99 通过。
- [x] 7.3 Refactor：确认 presence 等既有紧凑控件、禁用项、行上下文菜单、分隔线 resize 和焦点恢复不回归。
  - Refactor result：普通动作、绑定、解绑与更多菜单统一使用容量规划；36px 窄列仍聚合，resize 后会重新规划，
    disabled/readOnly 与菜单关闭后的焦点恢复保持原语义。
- [x] 7.4 Red：为内建文本/数字、semantic 多子目标和 materials 文本 renderer 编写测试：绑定后原控件被变量
  标识替换、标识可换绑、操作列按钮可解绑且解绑后恢复字面控件；记录当前只读 input 的失败证据。
  - Red command/result/reason：同一条定向命令中，内建标量、Vector2 X 与 materials 文本均保留 readonly input，
    找不到变量标识或“解绑”按钮；失败由既有只读预览行为导致，而非测试或环境错误。
- [x] 7.5 Green：实现 `ComposePropertyPanelBoundValue` 并接入内建、第一方 semantic editor 与 materials
  renderer；已绑定单目标的默认操作列入口改为解绑图标。
  - Green result：变量标识显示变量名与有效值预览、点击可换绑；内建标量、Vector2 子目标、Node editor 与
    Text renderer 解绑后都会恢复原字面控件。已绑定单目标在操作列中显示图标化“解绑”。
- [x] 7.6 Refactor：更新 README/API TSDoc 与 i18n，复核 custom `renderTrigger` 的未绑定兼容范围和只读/
  无效变量的可访问状态。
  - Refactor result：新增中英文换绑/解绑文案和 `ComposePropertyPanelBoundValue` 公共 TSDoc；custom
    `renderTrigger` 仅在未绑定直接目标时使用，变量标识与解绑按钮均遵循 readOnly/invalid 的可访问状态。
- [x] 7.7 浏览器验证：增加 Inspector Chromium 断言与经人工核对的视觉黄金，覆盖三图标、更多图标、变量
  标识和解绑恢复字面控件；完成后运行 OpenSpec、包级及全仓质量门禁。
  - Regression result：定向 Chromium 交互 2/2、受影响视觉用例通过；更新并人工核对
    `svg-material-inspector.png` 与 `auto-layout-hug-content.png`。`bun run lint`、`bun run typecheck`
    （40/40）、`bun run test`（39/39，含 Storybook 44）、`bun run build`（21/21）和
    `bun run test:e2e`（35/35）均通过；`openspec validate update-property-binding-entry --strict` 和
    `git diff --check` 通过（OpenSpec 的遥测网络 flush 警告不影响校验结果）。

## 8. 审阅收口

- [x] 8.1 明确多 target 菜单、单槽组合菜单与三槽普通操作的边界，并写出可观察的直接操作优先级。
  - Docs result：proposal、design、增量 spec 与 Property Panel README 一致说明：多 target 使用目标菜单，只有
    单槽且与普通操作竞争时使用组合菜单；直接槽位固定为 binding、存在性/新增、重置、删除、移动的顺序。
- [x] 8.2 为所有修改后的 Scenario 补充精确的 `OpenSpec` 测试标题或紧邻映射，并让 ECharts Scenario 与示例的
  title/data 两个实际字段保持一致。
  - Regression command/result：`bun run --cwd packages/property-panel test -- src/binding-entry-model.test.ts
    src/property-panel/compose-property-panel.test.tsx src/semantic-editors/semantic-editors.test.tsx`，3 个文件、78 个
    用例通过；`bunx playwright test --grep "在 Stage 中渲染 ECharts Canvas"`，目标 Chromium 流程通过。
- [x] 8.3 重新运行变更校验与空白检查。
  - Validation command/result：`openspec validate update-property-binding-entry --strict`、`git diff --check` 通过。

## 9. 编辑列优先的默认比例（Red → Green → Refactor）

- [x] 9.1 Red：把常见 365px Inspector 的默认属性名列断言改为 120px，保留 76px 三图标操作列，并记录旧
  160px 默认值的失败证据。
  - Red command/result/reason：`bun run --cwd packages/property-panel test -- src/property-panel/compose-property-panel.test.tsx -t
    "默认优先给编辑列分配空间"`；1 个用例按目标失败，separator 的 `aria-valuenow` 为 `160` 而非预期 `120`，
    证明旧默认值挤压了中间编辑列。
- [x] 9.2 Green：将 Root 与独立 Panel 的默认/恢复属性名列宽统一为 120px，并将 CSS fallback 同步为该值。
  - Green command/result：`bun run --cwd packages/property-panel test -- src/property-panel/compose-property-panel.test.tsx -t
    "默认优先给编辑列分配空间|拖动时分别更新属性名列和操作列|宿主收窄时重新 clamp"`，3/3 通过；365px
    内容区默认分配为 120px / 169px / 76px。
- [x] 9.3 Refactor：提取共享的列宽/最小宽度常量，并同步 README、proposal、design 和三列布局增量规范。
  - Refactor result：默认、恢复、ResizeObserver 与 ARIA 边界使用同一组常量；三图标操作轨道保持 76px，
    中间编辑列获得默认优先级。

## 10. 对齐 UE4 的紧凑操作列尺寸修订

- [x] 10.1 评审反馈：22px 图标与 76px 默认操作列偏大，且 React 初始 state 仍停在 34px（=1 槽），
      导致绑定入口与重置被迫合并为单槽聚合菜单。对齐 UE4 Details 面板改为默认放下两个图标。
- [x] 10.2 图标与列宽改为 16px 按钮 / 12px 字形 / 38px 默认操作列；槽位换算改为
      `floor((actionWidth - 2) / 18)`，38px 两槽、56px 三槽，上限仍为 3，列宽区间 32–96px 不变。
      字形先后试过 12px、10px，10px 在 26px 行高里辨识度不足，最终定在 12px；按钮与列宽只按
      两槽布局收窄一次。
- [x] 10.3 更新受影响的列宽与槽位测试，并新增“绑定入口与重置在默认两槽中同时直接可见”。
  - Result：`bun run --filter @compose-ui/property-panel test` 101/101 通过；更窄的操作列把空间还给
    属性名列，clamp 测试的宿主宽度相应从 280px 收到 260px 才继续触发属性名列压缩。
- [x] 10.4 同步 README、proposal、design 与增量规范中的三图标/76px 表述，并更新 4 张 Inspector 黄金图。
  - Result：`bunx playwright test --update-snapshots` 后 `bun run test:e2e` 35/35 通过；365px 内容区
    默认分配改为 120px / 207px / 38px。
