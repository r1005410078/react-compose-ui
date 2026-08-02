# 设计：收敛视口更新的渲染范围

## 背景与约束

- `viewport` 属于编辑器会话状态，不进入 ComposeDocument、History 或 Operation Log（stage 规范
  「受控无限视口」已经这样规定），因此它的归属可以调整而不触碰文档协议。
- Stage 已经是受控组件：它接收 `viewport` 并通过 `onViewportChange` 请求替换。这个受控契约要
  保留，`@compose-ui/stage` 不得反向依赖 editor。
- 仓库已有一套成熟的「无 DOM 状态源 + `useSyncExternalStore`」模式（`StageInteractionController`），
  新方案应复用它而不是引入第二种状态机风格。

## 方案对比

### 方案 A：只加 memo 边界

给 `ComposeSceneTree`、Inspector、工具栏套 `memo()`，依靠 controller 里已有的 `useMemo` 让 props
引用保持稳定，从而在 viewport 变化时 bail out。

- 优点：改动最小，不动公共 API。
- 缺点：正确性依赖「每一个 prop 都恰好稳定」，任何一处内联箭头函数或新对象都会静默击穿，且
  失效时没有任何信号。controller 本身与宿主仍然每帧重渲。这是一种脆弱的性能约束。

### 方案 B：viewport 变为可订阅会话状态（推荐）

controller 内部持有 viewport store（`getSnapshot`/`subscribe`/`setViewport`）。Stage 与工具栏等
真正依赖 viewport 的组件订阅它；controller 自身不再因 viewport 变化而重渲。

- 优点：渲染范围由订阅关系显式表达，不依赖引用稳定性的偶然结果；与既有 interaction controller
  模式一致；平移帧的 React 工作量与场景规模、面板数量解耦。
- 缺点：`controller.viewport` 的语义变化需要对宿主说明；需要一个新的公共订阅入口。

### 决策

采用方案 B，并把方案 A 的 memo 边界作为补充手段用于其他高频会话状态（选择、hover），而不是
作为 viewport 的主要机制。

## 公共 API 影响

- `controller.viewport` 继续返回当前快照（读取即时正确），但读取它的宿主组件不再自动随 viewport
  重渲。需要跟随的宿主改用订阅入口。
- 新增订阅入口（命名在实现时确定，例如 `useComposeStageViewport(controller)`），返回快照并订阅
  变化。
- `setViewport` 签名不变。

## 回归护栏

- 平移帧不得重渲与 viewport 无关的面板：以「场景树行渲染计数在纯 viewport 更新后不变」断言。
- 平移帧不得重建场景内容：Stage 侧已有测试，保持不变。
- 既有受控契约测试（Stage 只请求更新 viewport x/y、文档与历史不变）必须继续通过。

## 未决问题

- 订阅入口是放在 `@compose-ui/editor` 还是下沉到 `@compose-ui/stage`：Stage 已经是受控组件，
  倾向放在 editor，避免 stage 引入状态源语义。实现前确认。
