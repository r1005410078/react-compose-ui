# 变更：使用 Dockview 构建编辑器工作区

## Why

当前 `ComposeEditor` 只是一个语义化容器，示例应用中的画布和属性区使用普通文档流排列，无法验证低代码编辑器所需的场景树、画布、属性检查器和事务日志工作区。引入 Dockview 可以先建立一个 IDE 风格的可嵌入工作区，并用 Edge Groups 固定左、右、底部工具区，同时不提前定义文档 Schema。

## What Changes

- 在 `@compose-ui/editor` 中引入 `dockview-react` 7.x，使用 Dockview 管理编辑器工作区面板。
- 建立四大布局区域：左侧 Scene Graph 场景树、中间画布与画布工具栏、右侧 Component Inspector 属性栏、底部 Transaction Log 与 Command 命令区。
- 左侧、右侧和底部区域必须使用 Dockview Edge Groups，支持调整尺寸、折叠和展开；中央画布使用普通 Dockview 主组并始终保留主要空间。
- 保留 `ComposeEditor` 的 HTML `section` 属性与 `children` 用法，将 `children` 映射为画布内容，并新增场景树、画布工具栏、属性检查器、事务日志和命令区五个可选 React 内容插槽。
- 为 `@compose-ui/editor` 提供显式样式入口，包含 Dockview 基础样式和编辑器工作区样式。
- 将示例应用收敛为全屏 `ComposeEditor`，并通过 E2E 验证四区布局、三个 Edge Groups、“添加并编辑文本”流程以及边缘区的缩放和折叠。
- 首个版本仅维护组件挂载期间的布局状态；不保存或恢复 Dockview 序列化数据。

## Impact

- 受影响的规范：`editor-workspace-layout`（新增）
- 受影响的代码：`packages/editor`、`app`、`e2e/integration.spec.ts`、根依赖锁文件、相关 README
- 新增运行时依赖：`dockview-react@^7.0.2`
- 公共 API：`ComposeEditorProps` 新增 `sceneGraphPanel`、`canvasToolbar`、`inspectorPanel`、`transactionLogPanel`、`commandPanel` 可选插槽；现有 `children` 和 HTML 属性保持兼容
- 样式接入：宿主需要导入 `@compose-ui/editor/styles.css`，并为编辑器容器提供非零高度
