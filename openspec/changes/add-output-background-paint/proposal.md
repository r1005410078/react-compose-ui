# 变更：输出背景支持结构化 Paint

## 原因

Canvas Inspector 的“输出背景”仍保存为纯色 `output.backgroundColor`，因此 Editor 在该入口只能打开
`ComposeColorPicker`；它与实体 Appearance 已支持的渐变背景形成不一致，也无法在 Stage 与 Preview
中持久化和渲染输出级渐变。

## 变更内容

- **BREAKING** 将 `ComposeOutputSettings.backgroundColor: ComposeColor` 替换为
  `backgroundPaint: ComposePaint`，默认值仍是透明 Solid Paint；v5 不保留双字段或迁移兼容路径。
- Canvas Inspector 的“输出背景”改用既有 `paint` 属性编辑器和单层 `ComposePaintPicker`，允许
  Solid、Linear、Radial、Angular 四种已支持 Paint。
- Stage 与 Preview 使用共享 Paint 描述渲染输出背景；输出级 Paint 不启用实体的渐变控制柄或取色会话。
- 将 Paint Picker 收紧为单层嵌入式色盘，渐变色标和 Solid 共用同一面板，不新增资源填充、颜色库、对比度或其它 Figma 专有功能。

## 影响

- 受影响规范：compose-document、command-transaction、components、editor-workspace-layout、
  compose-preview、stage。
- 受影响包：core、components、editor、preview、stage，以及使用文档 fixture 的测试和示例应用。
- 宿主保存的旧 `output.backgroundColor` v5 文档将被严格校验拒绝；由宿主在边界转换为
  `backgroundPaint: { kind: 'solid', color }`。
