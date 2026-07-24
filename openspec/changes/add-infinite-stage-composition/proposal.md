# 变更：新增无限 Stage 编排系统

## Why

编辑器中央区域目前只渲染宿主 `children`，没有正式组件注册协议、Frame 输出边界或直接操纵能力。
命令事务内核稳定后，需要一条从组件库拖入、Stage 操作、场景树/属性联动、撤销审计到 Preview
的完整纵向流程。

## What Changes

- 新增 `@compose-ui/component-registry`，由宿主注册默认 JSON props、React renderer 和可选
  Inspector renderer。
- 新增 `@compose-ui/stage`，以 DOM Scene Layer 渲染 React 组件，以 SVG Overlay 渲染选择、
  变换、吸附与拖入反馈。
- 提供无限视口、多 Frame、组件库拖入、框选、多选、移动、缩放、旋转、吸附和 group/ungroup。
- 在 `@compose-ui/editor` 新增受控 controller 组合 Stage、SceneTree、History、Inspector、
  CommandPanel 和 ComponentPalette，并保留现有插槽兼容。
- 扩展 `@compose-ui/preview`，使用同一文档与注册表渲染指定 Frame。
- 将示例迁移为完整 Stage 编排纵向流程，并增加浏览器交互与视觉黄金测试。

## Impact

- 依赖变更：`add-command-transaction-runtime` 必须先获批并实现
- 受影响的规范：新增 `component-registry`、`stage`、`compose-preview`；修改
  `editor-workspace-layout`
- 受影响的代码：新增 `packages/component-registry`、`packages/stage`，修改
  `packages/editor`、`packages/preview`、`app`、根配置与文档
- 公共 API：新增注册表、Stage、ComponentPalette、编辑器 controller 和文档驱动 Preview
