# 变更：建立 v6 Auto Layout 运行时

## 原因

现有 v5 `Layout` 只保存 Inspector authoring 数据，Stage、Preview 和 Stage Engine 仍把
`Transform.position/size` 当作唯一几何事实，无法可靠实现 Auto Layout。继续叠加覆盖逻辑会形成
文档坐标、DOM 布局和编辑几何三套事实来源。

## 变更内容

- **BREAKING**：升级唯一受支持的文档协议为 `ComposeDocument v6`，拆分旋转与布局盒意图。
- 提供显式、纯函数式 v5→v6 迁移器；运行时不保留 v5 双路径。
- 新增 `@compose-ui/layout-engine`，封装 `yoga-layout@3.2.1` WASM、增量 Yoga 树和不可变
  `ComposeLayoutSnapshot`。
- Stage Engine、Stage、Editor 与 Preview 统一消费 Layout Snapshot；DOM 继续使用 absolute box。
- 首阶段交付 Fixed + Flow/Absolute Flex、padding、双轴 gap、wrap 和对齐 Inspector。

## 影响

- 受影响规范：compose-document、layout-engine（新增）、stage-engine、stage、compose-preview、
  basic-materials、editor-workspace-layout、command-transaction、pages。
- 受影响代码：core 文档/命令、全新 layout-engine、Stage 几何与交互适配、Registry scene style、
  Materials Inspector、Editor controller、Preview 与页面解析。
- 依赖：新增官方 `yoga-layout@3.2.1`，只由 layout-engine 直接依赖并异步加载。

