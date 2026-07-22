## 1. OpenSpec 与操作轨道（Red → Green → Refactor）

- [x] 1.1 Strict validate 新增 binding、操作轨道和结构重映射需求
- [x] 1.2 Red：锁定窄列溢出、宽列槽位、上下文菜单和 32/36/96px clamp
- [x] 1.3 Green：实现统一 row action model、操作轨道和菜单
- [x] 1.4 Refactor：统一现有 presence/reset/array/record 操作定义并复跑回归

## 2. 绑定协议与解析（Red → Green → Refactor）

- [x] 2.1 Red：锁定变量过滤、绑定/解绑/reset、解析回退、modified/errors 和只读语义
- [x] 2.2 Green：实现公共绑定类型、受控配置、默认选择器和纯解析函数
- [x] 2.3 Refactor：复用目标解析、根 Schema 校验、焦点和无障碍状态

## 3. 自定义 Renderer 与结构变化（Red → Green → Refactor）

- [x] 3.1 Red：锁定复合 renderer 子目标与数组/record/union 地址变化
- [x] 3.2 Green：实现 binding target descriptor/controller 与结构地址重映射
- [x] 3.3 Refactor：统一内置 `value` target 和自定义 target 解析路径

## 4. 示例、文档与 E2E（Red → Green → Refactor）

- [x] 4.1 Red：锁定 Rectangle 与 ECharts 绑定后 Canvas 联动及 trigger 可见性
- [x] 4.2 Green：增加页面/全局变量夹具、组件 bindings 和 effective Canvas value
- [x] 4.3 Docs/Visual：更新包文档、根 README 与必要视觉黄金文件
- [x] 4.4 Regression：运行 strict validate、lint、typecheck、test、build、Chromium E2E、pack dry run 和 diff check

## 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test`；新增 4 条测试按目标失败，
  当前 36px 操作列仍直接渲染并裁剪三个数组项按钮，操作列上限仍由剩余面板宽度决定且超过 96px，
  行上下文菜单、绑定入口和 `resolvePropertyBindings` 均不存在；原有 35 条测试继续通过。
- Action rail Green command/result：`bun run --cwd packages/property-panel test`；窄列溢出、96px 三槽、
  完整上下文菜单及原集合操作回归共 38 条通过，仅保留绑定协议 Red 失败。
- Binding Red command/result/reason：`bun run --cwd packages/property-panel test`；绑定解析、选择器、
  renderer 子目标均已通过，新增的 modified/errors/reset 场景按预期失败，证明筛选尚未纳入绑定状态。
- Binding Green command/result：`bun run --cwd packages/property-panel typecheck && bun run --cwd packages/property-panel test`；
  类型检查通过，43 条组件与 Schema 测试全部通过。
- Structural Red command/result/reason：`bun run --cwd packages/property-panel test -- -t "结构操作维护绑定地址"`；
  新增数组移动/删除和 record/union 场景 2 条均因 binding `onChange` 未调用而失败。
- Structural Green command/result：`bun run --cwd packages/property-panel typecheck && bun run --cwd packages/property-panel test -- -t "结构操作维护绑定地址"`；
  类型检查及 2 条地址重映射测试通过。
- E2E Red command/result/reason：`bun run test:e2e`；27 条既有用例通过，新增绑定用例暴露 Playwright
  label 非精确匹配、未先 hover 的隐藏 trigger 命中，以及新视觉基线缺失；均为测试选择器与明确的
  hover 交互前置条件，不涉及字面值提交。
- E2E Green command/result：`bun run test:e2e:update`；Rectangle X/Opacity/Color、ECharts title/data、
  trigger hover/常显和变量选择器视觉在 Chromium 中通过，38 条 E2E 全部通过并更新基线。
- Regression command/result：`openspec validate add-property-bindings --strict && bun run lint && bun run typecheck && bun run test && bun run build && bun run pack:dry-run && git diff --check`；
  OpenSpec strict validation、全仓 lint/typecheck/test/build、全部包 pack dry run 与 diff check 通过，
  其中 `@compose-ui/property-panel` 共 47 条组件与 Schema 测试通过。
- Final Chromium command/result：`bun run test:e2e`；构建成功，属性绑定、ECharts 子目标、操作轨道及
  既有编辑器/场景树回归共 39 条 Chromium E2E 全部通过。

## 5. 绑定能力显式启用（Red → Green → Refactor）

- [x] 5.1 Spec：将内置字段绑定从默认启用修正为 Schema metadata 显式 opt-in
- [x] 5.2 Red：锁定未声明字段无入口、外部地址不生效，以及声明字段继续可绑定
- [x] 5.3 Green：统一属性树与纯解析器的目标可用性判断并更新示例声明
- [x] 5.4 Docs/Regression：更新使用文档并运行完整质量门禁

### 5.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test -- -t "未声明字段不启用变量绑定"`；
  1/1 按目标失败，未声明 binding metadata 的 `标题` 仍自动渲染“绑定 标题”入口，证明内置叶子仍是
  默认启用而非显式 opt-in。收紧自定义字段授权后复跑同一命令再次 1/1 按目标失败：仅声明
  `bindingTargets`、但 Schema 未授权的 point renderer 仍收到 binding controller。
- Green command/result：`bun run --cwd packages/property-panel typecheck && bun run --cwd packages/property-panel test`；
  类型检查和全部属性面板测试通过。属性树只为 `enabled: true` 的字段创建入口，纯解析器把未声明地址
  作为 `unknown-target` 回退字面值；自定义字段同时要求 metadata 授权和显式 `bindingTargets`。
- Regression command/result：两个 OpenSpec change strict validation、全仓 lint/typecheck/test/build、5 个公共包
  pack dry run 与 `git diff --check` 全部通过；补齐显式启用 Scenario 映射后 property-panel 最终 48/48。
  非更新模式 `bun run test:e2e` 39/39 通过，Rectangle 与 ECharts 绑定交互及现有视觉基线无回归。

## 6. 绑定槽位防遮挡（Red → Green → Refactor）

- [x] 6.1 Spec：锁定绑定入口独立占位、变量名展示和窄目标退化行为
- [x] 6.2 Red：增加公共 trigger 槽位、控件几何、复合 renderer 和 ECharts 防遮挡测试
- [x] 6.3 Green：实现正常流绑定槽位并移除绝对定位与 padding 补偿
- [x] 6.4 Refactor：统一示例 renderer 的逻辑目标布局并补充 CSS 变量文档
- [x] 6.5 Visual/Regression：更新视觉基线并运行完整质量门禁

### 6.x 执行证据

- Red command/result/reason：`bun run --cwd packages/property-panel test -- -t "绑定入口不遮挡原控件|把宿主自定义 trigger 包裹"`；
  2/2 按目标失败，默认与宿主自定义 trigger 均不存在独立 `.property-panel__binding-slot`，绑定按钮仍直接
  位于控件容器中，证明正常流槽位和防遮挡结构尚未实现。
- Green command/result：同一条定向组件测试 2/2 通过，随后 `bun run --cwd packages/property-panel test`
  50/50 通过；默认和宿主自定义 trigger 均进入正常流 slot，未声明字段不产生目标容器。
- Geometry command/result：定向 Chromium 用例中 Rectangle 与 ECharts 的输入和 trigger 边界不相交，
  Position X 在绑定前后保持相同 X 坐标与宽度，复合目标按容器宽度退化为仅图标；仅新增的已绑定视觉
  基线按预期因文件尚不存在而失败。
- Visual command/result：`bun run test:e2e:update` 更新默认、resize、picker、ECharts 和新增的
  `property-panel-bound.png`；人工检查确认普通目标显示省略变量名，X/Y 紧凑目标只显示图标，原控件、
  单位、色块和选择箭头均未被覆盖。更新模式 39/39 通过。
- Regression command/result：两个 OpenSpec change strict validation、`bun run lint`、`bun run typecheck`、
  `bun run test`、`bun run build`、`bun run pack:dry-run`、非更新模式 `bun run test:e2e` 与
  `git diff --check` 全部通过；属性面板 51/51、Chromium 39/39。

## 7. UE4 紧凑常显绑定入口（Red → Green → Refactor）

- [x] 7.1 Spec：绑定入口改为始终可见，并锁定仅图标的紧凑 UE4 几何
- [x] 7.2 Red：锁定未 hover 时可见、`36px` 槽位、`20px` 按钮和隐藏变量名
- [x] 7.3 Green：实现常显紧凑槽位并同步默认、自定义 renderer 样式
- [x] 7.4 Visual/Regression：更新视觉基线并运行完整质量门禁

### 7.x 执行证据

- Red command/result/reason：`bun run test:e2e -- --grep "宿主加载属性面板样式"`；1/1 按目标失败，
  Chromium 实测普通绑定槽仍为 `72px` 而规范要求 `36px`，证明旧槽位确实占用了过多编辑空间。
- Green command/result：同一定向用例 1/1 通过，未 hover 槽位 opacity 为 `1`，普通槽宽 `36px`、
  按钮高 `20px`；Rectangle 绑定交互用例同时通过，隐藏变量名后输入边界仍不与 trigger 相交。
- Visual result：强制刷新默认、resize、已绑定、picker 与 ECharts 基线；人工检查确认 Position X/Y
  使用 `20px` 紧凑槽，普通 Color/Opacity 和 ECharts 使用 `36px` 仅图标槽，所有入口常显且不遮挡控件。
- Regression command/result：两个 OpenSpec change strict validation、全仓 lint/typecheck/test/build、
  5 个公共包 pack dry run 与 `git diff --check` 全部通过；property-panel 51/51，非更新模式 Chromium
  E2E 40/40 通过。
