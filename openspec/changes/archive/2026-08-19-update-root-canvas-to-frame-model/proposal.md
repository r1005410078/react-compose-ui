# 变更：以一等 Frame 取代隐式 Canvas 根

## 原因

隐式 Canvas 根已经在事实上扮演一个 Entity：它拥有输出尺寸、`backgroundPaint`、全局辅助线、
`document.animations` 动画清单，以及一个专属 Inspector（输出尺寸/背景、页面脚本、动画绑定），
却不能被选中、不能嵌套、不能复用。与此同时 Container、组件文档单根、Page Slot 引用页在做几乎
相同的事——有尺寸、有背景、是坐标原点、是裁剪边界。结果是同一件事有五套解释：Preview 被迫维护
document 与 frame 两条渲染路径，组件文档只能"单根任意 Entity"并且明确不支持动画，模板没有承载对象。

本变更把这五个概念收敛成一个：**Frame**。

## 变更内容

- **BREAKING** `ComposeDocument` 升到 v7：删除 `document.output` 与 `document.animations`；
  `rootIds` 收敛为「一个或多个 Frame」，非 Frame Entity 不得出现在根层级；`canvas.guides`
  从世界坐标移入 Frame 局部坐标。
- **新增 `Frame` Component**：拥有 `Frame` Component 的 Hierarchy Entity 即为 Frame。Frame 不是新
  Preset 也不是新 Entity 类型——「把容器升格为画板/组件根」是加一个 Component，符合 ECS 组合语义。
- **Frame 是六重隔离边界**：坐标原点、独立布局求解 Runtime、裁剪、动画时间轴、脚本作用域、
  预览与导出单位。跨过 Frame 边界，以上六件事全部重置。
- **新增 `Animations` Component**：动画清单从 `document.animations` 移到 Frame 上；关键帧轨道
  仍留在被动画 Entity 的 `Animation` Component（协议不变）。轨道路径 MUST NOT 跨越 Frame 边界。
  组件根是 Frame，因此**组件免费获得动画能力**，原「组件文档不提供动画入口」的限制消失。
- **新增跨 Frame 轨道重定位命令**：跨 Frame 拖拽在同一事务中把被拖动子树的轨道搬迁到目标 Frame，
  关键帧逐字段保持；目标已有同名动画时要求显式选择分组，不静默合并。
- **BREAKING** `Component Asset` 升到 v2：单根必须是 Frame（原为任意 Entity）。Base/Variant
  操作代数、`instanceOverrides`、`实例ID/内部ID` 复合寻址均不变。
- **BREAKING** `ComposePageFile` 升到 2：新增 `defaultFrameId`；动画文件引用从页面级
  `animation` 移到 Frame 级。
- **组件实例与 Page Slot 统一**为「对一个 Frame 的引用嵌套」，共用同一套渲染、寻址与隔离规则。
- **模板不引入新机制**：模板即一个 Frame 资产，直接复用 component-library 既有的 Base/Variant、
  Apply/Revert 与 detach 语义。
- Preview 只有一种目标——一个 Frame；`fit`/`alignment` 是 Preview 的 props 而非文档字段。
- Stage 的无限画布退化为纯视口概念，不再承载任何内容语义。
- 提供 v6→v7、Component v1→v2、PageFile 1→2 的**显式单向迁移**，无静默兼容。

## 非目标

- 不改变 `Animation` Component 的轨道/关键帧/插值协议。
- 不改变 Base/Variant 操作代数与实例覆盖模型。
- 不引入 Rive 式状态机（State Machine），本期动画仍是单条时间线清单。
- 不提供裸露的「升格为 Frame」按钮（见 design.md 的产品约束）。

## 影响

- 受影响的规范：`compose-document`、`compose-preview`、`component-library`、`scene-animation`、
  `pages`、`stage`、`editor-workspace-layout`
- 受影响的代码：`packages/core`（v7 schema、Frame/Animations Component、拓扑约束、迁移器）、
  `packages/materials`（Frame Preset/Renderer、实例与 Page Slot 统一）、
  `packages/animation`（清单归属、跨 Frame 校验、动画文件绑定位置）、
  `packages/preview`（删除双路径、`fit`/`alignment`）、
  `packages/stage`（多 Frame 边界、跨 Frame 拖拽坐标转换、辅助线局部化）、
  `packages/editor`（Frame Inspector 取代 Canvas Inspector、动画模式跟随选中 Frame）、
  `packages/property-panel`、`packages/component-library`、`packages/pages`、
  `packages/scene-tree`、`packages/layout-engine`、`e2e/integration.spec.ts`
- 依赖：本变更建立在 `add-animation-asset-and-mode-switcher`（已实现、未归档）之上，其页面级
  `ComposePageFile.animation` 由本变更移到 Frame 级。两者**在本变更完成后一并归档**，归档顺序
  为先 `add-animation-asset-and-mode-switcher` 后本变更，使 `specs/` 最终反映 Frame 级绑定。
