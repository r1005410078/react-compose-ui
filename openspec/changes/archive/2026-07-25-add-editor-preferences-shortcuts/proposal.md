# 变更：编辑器设置中心与可配置快捷键

## Why

编辑器左下角已经保留设置入口，但当前不能交互；主题、界面语言和快捷键也只能依赖固定实现。
同时 Stage 的 Space 临时平移无法从节点或 Frame 上可靠开始，失焦后还可能残留按键状态。实施
工程师需要在不污染页面文档的前提下调整当前编辑器实例的操作习惯和显示偏好。

## What Changes

- 激活左下角设置按钮，提供编辑器范围内的 VS Code 式模态设置弹框、分类搜索、焦点陷阱和
  键盘关闭行为。
- 在 `@compose-ui/editor` 新增受控或实例内非受控的主题、语言与快捷键偏好公共协议。
- 新增独立 `@compose-ui/ui-context` 包，通过可嵌套 Theme/I18n Provider 向所有第一方工作区
  组件注入主题、语义 token、语言和消息覆盖，避免独立包反向依赖 editor。
- 为默认工作区提供 Dark、Light、System 主题，以及简体中文和 English 内建文案。
- 支持单键或单个组合键重新绑定、清除、恢复和冲突检查，并保留只读手势说明。
- 修复并泛化 Stage 临时平移，使它可以从空白、Frame 或节点上开始，且不会改变文档与选择。
- 为 Stage、SceneTree、History、CommandPanel、PropertyPanel、OperationLog、基础材料 Inspector
  和默认 Palette 提供共享 Context 消费，同时保留可选 locale 兼容属性和独立包默认行为。

## Impact

- 受影响的规范：ui-context、editor-preferences、editor-workspace-layout、stage、scene-tree、
  history、command-panel、property-panel、operation-log、basic-materials
- 受影响的代码：`@compose-ui/editor`、`@compose-ui/stage`、`@compose-ui/scene-tree`、
  `@compose-ui/history`、`@compose-ui/command-panel`、`@compose-ui/property-panel`、
  `@compose-ui/operation-log`、`@compose-ui/materials`、新共享包、示例应用与 E2E 黄金图
- 不影响：`ComposeDocument` schema、TransactionRuntime、History 时间线、日志数据协议与
  Preview 输出
