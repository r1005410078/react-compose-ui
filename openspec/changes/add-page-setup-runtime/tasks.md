## 1. 协议与迁移

- [x] 1.1 页面包装格式行为循环：为新页面文件解析/序列化、旧裸 v6 页面显式迁移、非法 setup 引用和空白页面创建添加 `OpenSpec: compose-document / 页面文件约定 / ...` 测试；实现 Core 协议并整理公共类型与 TSDoc。
  - Red command/result/reason：`cd packages/core && bun run test -- src/page/page-file.test.ts src/ecs-document.test.ts`，8 个新场景失败；原因是尚无 `ComposePageFile` 及显式迁移 API。
  - Green command/result：同一定向命令通过，18 个相关测试通过。
  - Regression command/result：`bun run test`，39/39 Turbo 测试任务通过。
- [x] 1.2 Bindings Component 行为循环：覆盖合法顶层 Prop 引用、非法 shape、没有 Renderer 的 Entity 和未知 Prop 保留，实现校验、默认查询与文档往返。
  - Red command/result/reason：`cd packages/core && bun run test -- src/ecs-document.test.ts`，Bindings 场景因 ECS Component 尚未定义而失败。
  - Green command/result：定向测试通过，合法与非法 shape 都按协议处理。
  - Regression command/result：`bun run test`，39/39 通过。
- [x] 1.3 Page Store 行为循环：覆盖聚合读写、setup 关联/解除、revision 冲突、缓存失效和聚合 Loader，迁移 `@compose-ui/pages` API 与测试夹具。
  - Red command/result/reason：`cd packages/pages && bun run test -- src/page-store.test.ts`，9 个聚合页面场景失败；Store 仍只读写裸 document。
  - Green command/result：同一定向命令 25 个测试通过。
  - Regression command/result：`bun run test`，39/39 通过。

## 2. Script Runtime

- [x] 2.1 State/Computed 行为循环：以 `Object.is`、microtask 合并、动态依赖切换和只读 Computed 为 Red，完成无 React 的 Signal 核心与 scheduler。
  - Red command/result/reason：`cd packages/script-runtime && bun run test -- src/reactivity.test.ts`，新包和响应式原语不存在。
  - Green command/result：定向 reactivity 测试全部通过。
  - Regression command/result：`cd packages/script-runtime && bun run test`，14 个测试通过；根测试 39/39 通过。
- [x] 2.2 Effect 生命周期行为循环：覆盖立即运行、重跑前 cleanup、反向 dispose、异常隔离和循环上限，实现 Effect owner。
  - Red command/result/reason：同一 reactivity 定向命令中 effect 场景因缺少 owner/cleanup scheduler 失败。
  - Green command/result：`bun run test -- src/reactivity.test.ts`，State/Computed/Effect 场景全部通过。
  - Regression command/result：Script Runtime 14 个测试和根测试全部通过。
- [x] 2.3 setup 作用域行为循环：覆盖普通值、State、Computed、Function 分类，非法返回、缺失 setup、独立页面实例和 dispose 后迟到更新，实现 `ComposePageScriptScope`。
  - Red command/result/reason：`cd packages/script-runtime && bun run test -- src/scope.test.ts`，Scope API 与快照订阅不存在。
  - Green command/result：定向 Scope 测试通过，快照对 `useSyncExternalStore` 保持稳定引用。
  - Regression command/result：Script Runtime 14 个测试和根测试全部通过。
- [x] 2.4 受信任 JavaScript Loader 行为循环：覆盖稳定资源读取、revision 重载、URL 回收、CSP/语法/媒体类型错误和可替换 Loader，实现默认同 Realm ESM adapter；明确 TypeScript 不支持。
  - 测试分层：jsdom 不能用 Node 动态 `import()` 解析 blob URL，Vitest 覆盖资源、媒体类型、revision、URL 回收、诊断和端口替换；真实 ESM/CSP 路径由 Playwright 纵向流程验证，没有引入 `eval` 或转译回退。
  - Red command/result/reason：`cd packages/script-runtime && bun run test -- src/module-loader.test.ts`，Loader/Resolver 端口尚未定义。
  - Green command/result：定向 Loader 测试全部通过。
  - Regression command/result：`bun run test:e2e`，34/34 通过，包含真实 `.setup.js` 导入、语法错误与重载。
- [x] 2.5 创建 `@compose-ui/script-runtime` 公共入口、构建配置、README、packageDocumentation 与架构检查；包不依赖 React、Editor、Stage 或 Preview，并已接入根 pack dry-run 和 changeset 发布范围。

## 3. Registry 与运行时 Props

- [x] 3.1 Prop Contract 行为循环：覆盖 value/method 定义、重复/非法 Prop、旧 Renderer 兼容和 validator 异常隔离，扩展实例级 Registry。
  - Red command/result/reason：`cd packages/component-registry && bun run test -- src/registry/registry.test.ts`，4 个 Prop Contract 场景失败；definition 尚无 contract。
  - Green command/result：Registry 定向测试通过。
  - Regression command/result：Component Registry 全包测试与根测试通过。
- [x] 3.2 Props 解析行为循环：覆盖 value 覆盖、字面 fallback、method 注入、缺失导出、kind 不匹配、同步异常与 rejected Promise 诊断，实现纯绑定 resolver。
  - Red command/result/reason：`cd packages/component-registry && bun run test -- src/registry/runtime-props.test.ts`，resolver 尚不存在。
  - Green command/result：定向 runtime props 测试通过。
  - Regression command/result：Component Registry 全包测试和 Stage/Preview 集成测试通过。
- [x] 3.3 Renderer 适配行为循环：类型/渲染测试证明 authored/runtime props 分离的公共契约，并迁移 Registry renderer bridge、Materials 与宿主示例。
  - Red command/result/reason：Registry/Materials 定向测试因 renderer 仅接受 JSON authored props 而失败。
  - Green command/result：`cd packages/component-registry && bun run test` 与 `cd packages/materials && bun run test` 通过。
  - Regression command/result：根测试 39/39、构建 21/21 通过。
- [x] 3.4 测量失效行为循环：覆盖依赖 value export 更新、`affectsMeasurement: false`、method 忽略与脚本重载，接入 measurement adapter 的精确 invalidation。
  - Red command/result/reason：`cd packages/component-registry && bun run test -- src/renderer-measurement/renderer-measurement.test.tsx`，响应式绑定不会使测量缓存失效。
  - Green command/result：定向命令 5/5 通过；只订阅会影响测量的 value export。
  - Regression command/result：Stage/Preview/Page Slot 重建 adapter 的集成测试和 E2E 重载流程通过。

## 4. Property Panel 与 Editor

- [x] 4.1 Binding-only target 行为循环：覆盖 method row、kind 过滤、搜索、绑定/换绑/解绑、只读和缺失导出错误，扩展 Property Panel 受控 API 与无障碍交互。
  - Red command/result/reason：`cd packages/property-panel && bun run test -- src/binding-target-row.test.tsx`，新 binding-only target 场景失败；组件不存在。
  - Green command/result：定向 binding row 测试通过，Property Panel 全包 90 个测试通过。
  - Regression command/result：根测试 39/39 通过。
- [x] 4.2 文档绑定事务行为循环：证明用户绑定操作只修改 Entity Bindings、可以 undo/redo 且不改 authored Props，接入 Registry Inspector 聚合。
  - Red command/result/reason：`cd packages/editor && bun run test -- src/inspector/renderer-bindings-inspector.test.ts`，缺少 Bindings 事务规划器。
  - Green command/result：定向 Inspector 事务测试通过。
  - Regression command/result：Editor 128 个测试和根测试通过。
- [x] 4.3 页面 setup 资源行为循环：覆盖创建、打开、更换、解除、只读 Provider、页面 revision 冲突和创建脚本后页面写入失败，通过既有 Asset Browser 扩展与页面标签完成工作流。
  - Red command/result/reason：`cd packages/editor && bun run test -- src/pages/page-workspace.test.tsx`，资源菜单无 setup 关联操作，Page Store 也不保存关联。
  - Green command/result：Page workspace 定向测试通过，包括创建/解除与 revision 重载竞态。
  - Regression command/result：Editor 128 个测试和 E2E 34/34 通过。
- [x] 4.4 页面作用域查看行为循环：覆盖 value/method 分类、实时值、诊断、脚本 dirty 保存和成功 revision 重载，提供可访问的页面返回成员面板。
  - Red command/result/reason：Page workspace/Scope 定向测试因无 scope session 与快照订阅而失败。
  - Green command/result：Editor Page workspace 和 Script Runtime Scope 定向测试通过。
  - Regression command/result：E2E 证明保存后重载、诊断与旧 scope cleanup，34/34 通过。

## 5. Stage、Preview 与嵌套页面

- [x] 5.1 Stage 行为循环：覆盖 setup value 首帧、State 更新、绑定 fallback、普通编辑模式 method no-op 和卸载 cleanup，注入页面 scope 而不让 Stage 依赖 Editor。
  - Red command/result/reason：`cd packages/stage && bun run test -- src/stage-surface/compose-stage.test.tsx`，Stage 尚无 `scriptScope` 端口。
  - Green command/result：Stage 定向响应式 Prop/method no-op 测试通过，Stage 全包 34 个测试通过。
  - Regression command/result：页面计数器 E2E 中 Stage 首帧、热重载、fallback 与 cleanup 通过。
- [x] 5.2 Preview 行为循环：覆盖点击 method 更新 State、方法异常隔离、独立 Preview 实例和 dispose，组合默认/宿主 Script Runtime。
  - Red command/result/reason：`cd packages/preview && bun run test -- src/compose-preview/compose-preview.test.tsx`，Preview 仅渲染 authored props，不拥有独立 scope。
  - Green command/result：Preview 全包 18 个测试通过，包含双实例隔离与 method 更新。
  - Regression command/result：计数器 E2E 证明 Preview 更新不污染 Stage scope。
- [x] 5.3 Page Slot 行为循环：覆盖同一页面两个 Slot 的 State 隔离、嵌套卸载、脚本 revision 重载、循环/深度护栏和缺失 setup 资源，迁移页面聚合 Loader。
  - Red command/result/reason：`cd packages/materials && bun run test -- src/page-slot/page-slot.test.tsx`，Page Slot 共享静态 document 且无嵌套 scope。
  - Green command/result：Page Slot 定向隔离测试与既有循环/深度/缺失页面护栏测试通过，Materials 全包 58 个测试通过。
  - Regression command/result：Page Slot 的 Stage/Preview E2E 与 StrictMode 回归通过。
- [x] 5.4 E2E 纵向流程：创建带 setup 的计数页面，将 `num` 绑定 Text、`onAdd` 绑定 Button，验证 Stage 实时值、Preview 点击更新、脚本保存重载、错误 fallback 和页面切换 cleanup。
  - Red command/result/reason：`bunx playwright test -g "页面计数器纵向流程"`，初始失败于页面/setup 协议与运行时接线缺失。
  - Green command/result：该定向 E2E 1/1 通过。
  - Regression command/result：`bun run test:e2e`，完整 34/34 通过。

## 6. 文档、示例与门禁

- [x] 6.1 更新示例 Provider 和全部页面夹具为新页面包装格式，增加自包含 `.setup.js` 计数器示例；示例状态不作为公共 API。
- [x] 6.2 更新根 README、受影响包 README、AGENTS 与 `openspec/project.md`，记录视觉模板模型、包边界、受信任脚本风险、页面迁移和首期非目标。
- [x] 6.3 运行 `openspec validate add-page-setup-runtime --strict`、受影响包测试、`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 与 `git diff --check`，并把实际结果记录到本文件。
  - 结果：OpenSpec strict validate 通过；受影响包定向测试全部通过；lint 通过；typecheck 40/40；test 39/39；build 21/21；E2E 34/34；`git diff --check` 通过。
  - 备注：OpenSpec 已返回 `Change 'add-page-setup-runtime' is valid`；随后的 PostHog telemetry 因沙箱无网络无法上报，不影响验证结果与退出码 0。

## 7. Props 绑定收敛

- [x] 7.1 协议与解析行为循环：以 Core/Registry 测试覆盖 `rendererProps.fields` 形状、空绑定拒绝、字段覆盖、严格回退和方法包装，再实现协议与 resolver。
  - Red command/result/reason：Core ECS/Bindings 与 Registry runtime props 定向测试在旧 `{ version: 1, props }` 草案和字段直接覆盖 authored Props 的实现上失败。
  - Green command/result：Core 定向测试通过 `rendererProps.fields` JSON 往返、严格 issue path、空绑定拒绝和命令删除；Registry 通过字段 fallback 与 Editor/Preview method 包装。
  - Refactor：解析收敛为 authored Props 基础值加逐字段覆盖；已撤回的 `rendererProps.object` 被严格视为未知字段。
- [x] 7.2 订阅与测量行为循环：覆盖字段 State/Computed 精确刷新、测量失效，再迁移 Stage、Preview、Page Slot 与 measurement adapter。
  - Green command/result：Stage、Preview、Component Registry measurement 定向测试通过字段响应式更新、method 安全边界、精确测量失效和卸载订阅清理。
  - Regression command/result：完整 Playwright 中 Stage 保持 method no-op，Preview 安全执行字段 `onClick` 并驱动 value 更新；Page Slot 与既有测量回归通过。
- [x] 7.3 Property Panel 行为循环：覆盖宿主授权顶层完整字段、复合字段标题入口和 binding-only 候选 validator，再实现公共受控 API 与无障碍交互。
  - Red command/result/reason：数组类型的 ECharts `values` 已被宿主授权，但 Property Panel 只在标量字段调用绑定目标 Hook，因此标题没有可见绑定操作。
  - Green command/result：数组、对象等复合字段在分组标题固定显示字段级绑定入口，候选按完整字段 Schema 过滤；通用面板默认显式 opt-in 规则不变。
- [x] 7.4 Editor Inspector 行为循环：覆盖 Renderer Props 显式分类、非空“高级”、字段内联、fallback 行、锁定和 Undo/Redo，再实现 binding port 与文档命令。
  - Red command/result/reason：分类测试证明 Editor 曾硬编码“内容”，且在所有 Contract 已分类时仍渲染空“高级”。
  - Green command/result：Editor 直接渲染 Definition 声明的分类，未分类 Contract 与旧 Inspector 进入“高级”；没有未分类内容时隐藏该分组，不再出现通用“内容”、独立“数据绑定”或“绑定整个 Props”。
  - Refactor：自定义 Inspector 只经 Property Panel 无关的 binding port 消费变量快照、authored/base/resolved Props、当前分类与变更操作；绑定事务保持 `Renderer.props` 引用和值不变。
- [x] 7.5 Materials 与示例行为循环：补齐第一方和示例 Renderer 的公开 Prop Contract、共享 validator/Schema 来源及字段绑定 E2E。
  - Red command/result/reason：Prop Contract 完整性与 Inspector 测试最初发现 Text、Image、SVG、Page Slot、Action Button 和 ECharts 的公开顶层 Props 未全部声明，示例仍只有字段绑定。
  - Green command/result：第一方 Inspector 从 feature-local Schema/validator 构造编辑与绑定校验，示例 setup 分别返回 value 与 `onClick` 成员并逐字段绑定。
  - Regression correction：Text 显式拆为“文本/排版”，Image、SVG、Page Slot 与示例 Renderer 声明各自分类；fontSize、fontFamily、fontWeight、letterSpacing、lineHeight 均保留 Schema 类型控件并在同一行追加绑定入口。测试同时证明 Inspector 只渲染当前分类、编辑单字段不会把其他显示默认值写入 authored Props，浏览器核对确认行高默认值稳定显示为 `28.8 px`。
  - E2E command/result：`bunx playwright test e2e/integration.spec.ts -g "页面计数器纵向流程"`，1/1 通过 value/method 字段绑定、脚本 revision、错误 fallback 与 cleanup；Counter 页面种子只写入 `rendererProps.fields`，不再因已撤回的 `object` 字段而无法打开。
  - ECharts correction：`values` 数组使用完整字段 Schema 校验，并在“图表”分类的“数据”标题直接显示绑定入口；浏览器回归同时证明该 Renderer 不渲染空“高级”。
- [x] 7.6 同步 README、包文档与项目上下文，运行 OpenSpec strict validate、定向测试、lint、typecheck、全量 test、build、E2E 和 diff check，并记录实际结果。
  - 文档：根 README、Core、Component Registry、Editor、Property Panel、Materials、Stage、Preview README、OpenSpec proposal/design/spec 与 `openspec/project.md` 已同步。
  - 门禁：OpenSpec strict validate 通过；受影响包定向/全包测试通过；`bun run lint` 通过；`bun run typecheck` 40/40；`bunx turbo run test --concurrency=1` 39/39（含 44 个 Chromium Storybook 用例；串行运行避开无关 Monaco 固定超时的资源争用）；`bun run build` 21/21；`bun run test:e2e` 35/35；Counter 与 ECharts 字段绑定回归通过，Text 分类与类型控件浏览器回归 1/1，页面脚本与 SVG 分类视觉黄金图已核对并更新。
