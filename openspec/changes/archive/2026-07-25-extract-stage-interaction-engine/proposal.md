# 变更：提取独立 Stage Interaction Engine

## 原因

Stage 当前在单个 React 组件中同时处理 DOM 输入、坐标换算、手势状态、吸附、预览与文档命令，
使拖拽和分组空间逻辑难以独立测试、复用和演进。Palette 外部拖入又使用另一套 controller，
导致同一编辑器存在两条交互生命周期。

## 变更内容

- 新增无 React、无 DOM 的 `@compose-ui/stage-engine` 公共包，承载坐标、场景索引、吸附、
  滚动范围、手势 reducer/session、Palette 外部拖入和空间命令规划。
- `@compose-ui/stage` 只保留 React/DOM 输入适配和 DOM Scene + SVG/DOM Overlay 渲染。
- Editor 为每个实例创建一个 `StageInteractionController`，由 Stage 与 ComponentPalette 共享。
- SceneTree reparent 与 Stage group/ungroup/transform 使用 stage-engine 的同一空间命令工厂。
- **BREAKING** 删除 Stage 的几何/命令重导出、`StageDragController`、`dragController` prop 和
  Editor controller 的 `dragController` 字段，不提供兼容入口。
- ComposeDocument v2、core 命令 payload、可见交互、事务原子性和 Preview 输出保持不变。

## 影响

- 受影响规范：stage-engine、stage、editor-workspace-layout、command-transaction
- 受影响代码：packages/stage-engine、packages/stage、packages/editor、app、包文档与发布配置
