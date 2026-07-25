# 变更：重写 Stage 网格、标尺、吸附与滚动导航

## 原因

现有 Stage 只有固定 32 世界单位的单层视觉网格，缺少网格实际吸附、标尺、世界原点轴、
可持久化辅助线和可操作滚动条；resize 也没有接入现有智能吸附。大屏实施工程师因此无法用
统一刻度完成精确布局，也难以在无限世界中判断坐标和导航位置。

## 变更内容

- **BREAKING** 将 `ComposeDocument` 升级为仅支持 `schemaVersion: 2`，新增必填 `canvas` 设置与
  全局世界坐标辅助线，不提供 v1 迁移。
- 为画布配置和辅助线新增可逆内置命令，使其进入 History 与 Operation Log。
- 按 Godot 2D 编辑器语义重写网格、标尺、世界原点轴、选择尺寸标记、辅助线与动态滚动条。
- 让 move 与 resize 同时支持网格、节点和辅助线吸附，并提供确定性优先级与临时关闭行为。
- 在默认 Stage 工具栏加入吸附快捷开关和可校验的设置弹层。

## 影响

- 受影响的规范：compose-document、command-transaction、stage、editor-workspace-layout、
  compose-preview
- 受影响的代码：`@compose-ui/core`、`@compose-ui/stage`、`@compose-ui/editor`、
  `@compose-ui/preview`、示例应用和 E2E 黄金文件
