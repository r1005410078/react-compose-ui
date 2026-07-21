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
