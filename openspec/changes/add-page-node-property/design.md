## 上下文

把页面装进属性并渲染出来，横跨 `property-panel`、`asset-browser`、`component-registry`、
`materials`、`stage`、`preview` 六个包。AGENTS.md 的架构边界中三条直接决定了本设计的形状：

- `property-panel` 不得依赖 `core`、`assets`，因此**不可能**知道「页面引用」是什么。
- `asset-browser` 不得依赖 `core`，因此**不可能**知道 `*.page.json` 是什么。
- `stage` 不得依赖 `preview`，两者也不得依赖 `editor`。

## 目标 / 非目标

- 目标：`node` 属性 editor 支持候选选择、清空与从资源面板拖入。
- 目标：被引用页面在编辑画布与预览中渲染结果一致，且循环引用与超深嵌套被确定性阻断。
- 目标：所有新增 API 可选，省略时既有行为逐字节不变。
- 非目标：不做 `node` 属性指向除页面之外的其他节点种类（端口协议保持中立，但本次只有页面实现）。
- 非目标：不做嵌套渲染的虚拟化；深度上限 + 文档缓存是本次唯一的规模护栏。
- 非目标：不做嵌套内容的就地编辑 —— 嵌套内容在编辑态只读且不参与命中测试。

## 决策

### 决策 1：嵌套页面渲染放 `materials/page-slot`，而不是 `preview` 或 `stage`

需求是 Stage 与 Preview **都**实时渲染被引用页面。`stage` 不得依赖 `preview`，所以嵌套渲染的
React 实现必须落在两者都能依赖的位置。`materials` 满足这一点，且能力充分：

- `materials` 可依赖 `component-registry`，因此可直接用 `ComposeRegistryEntityRenderer` +
  `ComposeEntityPaintLayer` 递归渲染一棵完整实体树 —— 这正是 `preview` 的 `PreviewEntity` 已在做
  的事，无需新算法。
- 由 `page-slot` 的 renderer 自己承担「加载 → 递归渲染」，`stage` 与 `preview` **不新增任何渲染
  代码**，只需把 `ComposePageDocumentLoader` 注入 registry 渲染上下文。
- registry 渲染上下文已有 `mode: 'edit' | 'preview'`，`page-slot` 借它在编辑态把嵌套内容整体设为
  `pointer-events: none`，避免嵌套内容抢 Stage 的命中测试与选择语义。

**副产品**：原先设想的 `component-registry.renderNode` 渲染插槽变得不必要 —— registry 只需多两个
纯端口，渲染职责留在物料侧。

**替代方案：`preview` 与 `stage` 各实现一次嵌套渲染。** 被否决 —— 重复实现两套加载状态机与两套
循环护栏，且两处极易漂移。

### 决策 2：新增稳定引用拖拽载荷，而不是复用现有的 id 载荷

现有 `startNativeDrag` 只写 `application/x-compose-asset-ids`，内容是**可 move 的 entry id**：
根级条目或 `capabilities.move === false` 时该载荷为空，且 entry id 不是跨重命名/移动稳定的引用。
因此新增 `application/x-compose-asset-reference+json`（`{ version: 1, items }`），只要
`canvasItemFor` 产出条目就一定写入。`node` editor 的宿主端口优先解析该载荷，仅在缺失时回退到用
页面目录做 `entryId → pageKey` 映射。旧 MIME 语义不变（仅内部 move）。

页面必须先被纳入「可拖入 Canvas」范围才会写出载荷，这由 `editor` 传入的判定回调实现；附带效果是
页面同时可被 Stage 接收 —— 本次由 `page-slot.assetDrop` 正式接收，不是意外行为。

### 决策 3：`node` editor 通过宿主端口保持领域中立

端口提供候选集合、可读标签解析、可接受的拖拽媒体类型列表与载荷解析入口。面板只做
「类型交集判定 → 交给端口解析 → Schema 校验 → 提交」，永远不知道候选值的领域含义。这沿用
`colorEditor` / `paintEditor` 已建立的 `PropertyPanelEditorPortsContext` seam，不新造机制。

值 Schema 由 `materials` 的 `composeNodePropertySchema()` 提供（`materials` 已依赖 valibot，
`core` 不依赖），读取侧仍用 `core` 的 `readComposePageReference`，保持无框架。

### 决策 4：端口沿既有 `paintEditPort` 路径投递

已验证的现成链路：`component-registry/src/registry/types.ts` → `compose-registry-renderers.tsx`
→ `editor/inspector/entity-inspector.tsx` ← `editor-controller/controller.tsx`，物料 Inspector 再像
现有 `paintEditor` 一样把它传进 `<ComposePropertyPanel nodeEditor={...}>`。不引入第二套机制。

## 风险 / 权衡

- **画布实时嵌套渲染是本次最高风险项**：它是唯一会渗进 Stage 命中测试与选择语义的改动。
  `pointer-events: none` 能挡住指针，但框选、吸附候选、场景树投影与 `createStageSceneIndex` 是否
  会把嵌套实体算进去必须逐项验证 → 「编辑态不抢命中测试」的测试红灯先行，排在实现之前。
- **深度 8 × 扇出的挂载量** → 深度上限 + Store 文档缓存；虚拟化不在范围内。
- **嵌套文档被外部改写导致的重载抖动** → `loader.subscribe` 去抖。
- **`node` editor 是 `property-panel` 的第一个拖放目标** → 必须只在类型交集命中时才
  `preventDefault`，否则会吞掉页面上其他拖放行为。

## 迁移计划

纯增量，无数据迁移。分两个阶段推进（见 `tasks.md`）：先交付 `node` editor 与拖入赋值（此时
`page-slot` 呈占位），再交付嵌套实时渲染。两阶段可独立回滚。

## 待解决问题

- 嵌套页面在编辑画布上是否需要一个「实时渲染 / 占位」的用户级开关，用于超大工程的性能规避。
- `node` 属性未来若需指向页面之外的节点种类，候选来源如何在同一端口内区分。
