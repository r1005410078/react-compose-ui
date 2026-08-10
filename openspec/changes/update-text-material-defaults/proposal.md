# 变更：对齐 Figma 的 Text 默认值与自动尺寸

## Why

当前 Text 以 24px 深色文字和固定 280×72 尺寸创建，选区大幅超过文字内容，与设计工具中单击创建自动尺寸文字、拖拽创建固定文本框的预期不一致。

## What Changes

- 新建 Text 采用 Inter Regular 12px、白色、自动行高、左上对齐、原始大小写和无装饰的默认基线。
- Text Preset 及文字工具单击创建 `Hug × Hug` 的文本；文字工具拖拽创建精确范围的 `Fixed × Fixed` 文本框。
- Text Renderer 新增水平/垂直对齐、大小写与文字装饰属性；Renderer、isolated measurement 和 Inspector 共享同一语义。
- 既有文档不迁移：显式文字属性保留；缺失颜色回退白色，缺失新增排版字段使用原有的居中、原始大小写和无装饰视觉行为。

## Impact

- 受影响规范：`basic-materials`、`stage`
- 受影响代码：`packages/materials/src/text`、Text Inspector、`packages/stage/src/stage-surface`、Stage drawing preview 与相关测试
- 公共 API：Text Renderer Props Contract 增加 `textAlign`、`verticalAlign`、`textCase`、`textDecoration`；v6 文档不增加 Component 或迁移版本
