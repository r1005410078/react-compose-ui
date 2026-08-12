# 变更：增加 Group、项目组件与 Unity 风格变体

## 状态

**已批准，等待按本提案重新实施。** 2026-08-03 删除分支中的提交 `135f8f4` 只保留为历史参考；
它基于旧 Editor、Scene Tree 与组件库结构，不是本提案的数据模型或可直接恢复的实现来源。

## 原因

当前 Group 仍被实现成透明 Container，组件库只包含代码 Preset，场景选区不能成为可复用资源，
也没有 Unity Prefab Variant 风格的继承、Apply、Revert 与显式更新工作流。实施工程师需要在保持
ComposeDocument v6 和离线确定渲染的前提下，把一次搭建沉淀为可复用组件和逐层变体。

## 变更内容

- 引入隐藏于 Palette 的 first-class Group；Group 与 Container 使用不同语义、几何约束和图标。
- 新增判别联合的 Component Asset v1、项目组件 Store、混合组件目录和离线解析快照。
- 新增 `component-instance` 叶子物料，以及 Base、Variant、实例覆盖、Apply/Revert 和提示后更新。
- 支持从 Stage/Scene Tree/Command Panel 创建组件，以及把 Scene Tree 普通行拖到资源目录创建组件。
- **BREAKING（编辑器交互）**：普通 Container 不再提供 Ungroup；只有 first-class Group 与可识别的
  历史 Group 兼容结构可以解除分组。
- 保持 ComposeDocument v6、Page Slot、Registry Preset 和既有资源/Stage 拖入协议兼容。

## 影响

- 受影响规范：`stage-engine`、`stage`、`command-transaction`、`component-library`、
  `basic-materials`、`compose-preview`、`scene-tree`、`asset-browser`、`editor-workspace-layout`
- 受影响代码：`@compose-ui/core`、`@compose-ui/stage-engine`、`@compose-ui/stage`、
  `@compose-ui/component-library`、`@compose-ui/materials`、`@compose-ui/preview`、
  `@compose-ui/scene-tree`、`@compose-ui/asset-browser`、`@compose-ui/editor` 与示例应用
- 前置基线：`update-component-library-dock` 的现有左侧工具 Dock；`add-stage-container-drop` 保持独立，
  仅要求组合回归测试
