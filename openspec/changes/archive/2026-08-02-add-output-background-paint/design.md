## 上下文

实体 Appearance 已在 v5 使用 `ComposePaint`，但固定输出边界仍只保存 `ComposeColor`。Canvas Inspector
因此走普通 color renderer，Stage 使用 SVG `<rect fill>`，Preview 使用 CSS `backgroundColor`，两条
渲染路径都无法表达已有的渐变模型。

## 目标与非目标

- 目标：让 Canvas 输出背景和实体背景使用相同的可持久化 Paint 协议，并在 Editor、Stage、Preview
  得到一致的渐变结果。
- 目标：Canvas Inspector 使用已有 Paint Picker 的紧凑单层模式。
- 非目标：提供图像、噪声、资源、Figma Libraries、颜色对比度分析或输出背景的 Stage 控制柄。
- 非目标：向 v5 validator 增加 `backgroundColor` 兼容别名或隐式迁移。

## 决策

- 决策：替换 `ComposeOutputSettings.backgroundColor`，而不是保存两个字段。输出背景必须只有一个事实来源，
  否则事务、undo/redo、Stage 和 Preview 可见结果容易发生分叉。
- 决策：复用 Core `ComposePaint` 和共享的 registry Paint layer 描述，不在 Editor/Preview 各自解析
  CSS 渐变。输出背景没有 Entity Transform，描述使用归一化输出边界坐标。
- 决策：Canvas Inspector 使用现有 Property Panel `paint` semantic renderer；它不接入 Entity 的
  `ComposePaintEditPort`，因此不会错误激活 Stage 实体手柄或图层取色。
- 考虑过的替代方案：仅在 UI 中把渐变临时转换为 CSS。该方案无法写入严格 JSON、undo/redo 或 Preview，
  因此不采用。

## 风险与权衡

- v5 输出 JSON 字段替换是破坏性变更 → validator 明确拒绝旧字段，proposal 与 README 说明宿主转换方式。
- Stage 的 output rect 目前是 SVG 色块 → 输出 Paint 需渲染为独立、不可交互的背景层，保持 Entity pointer
  命中与输出检查行为不变。
- 紧凑内嵌色盘会改变 Picker 布局 → 添加组件测试和 Editor E2E 覆盖，且不改变现有 Solid 字段的 Picker。

## 迁移计划

1. 宿主读入既有文档时，在 Core 校验前将 `output.backgroundColor` 显式转换为等价的 Solid Paint。
2. 升级后所有新保存的文档只写 `output.backgroundPaint`。
3. 若出现问题，宿主可在保存边界把 Solid Paint 显式转换回旧字段；库不提供双协议运行路径。
