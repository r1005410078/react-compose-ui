# 变更：合成组件实例的单一产品表面

## Why

组件实例在协议上必须是「页面宿主壳 + 嵌套组件文档」两层，这与引用式组件、覆盖与源同步匹配。
但实现与交互曾把两层协议直接暴露给用户，造成：

1. 选中实例时右侧叠两个完整属性面板（双标题、双搜索栏、重复分组）。
2. Stage 与实例内 `NestedEntity` 的 overflow / 盒样式路径不一致，圆角在组件文档内正确、在实例上丢失。
3. Rectangle 等 Material 用 CSS 默认填色盖住 Appearance，实例上出现「蓝底漏出、无圆角」的双层色块。
4. 宿主若仍可编辑 Appearance / 固定尺寸，与「几何与外观跟组件根」的契约互相打架。

问题不在拆掉引用壳，而在：**协议可双层，用户模型必须单层**。

## What Changes

- **编辑器 Inspector**：选中组件实例时，宿主身份字段与组件根视觉/布局字段 MUST 合成**一个**
  Entity Inspector 外壳（单一标题、单一 PropertyPanelRoot）；禁止再叠第二个完整面板。
- **字段分工固化**：宿主侧仅名称、位置相关、可见性、锁定；尺寸、外观、裁剪、Auto Layout、
  容器结构 MUST 走组件根编辑入口并写入实例覆盖。根侧 MUST 隐藏与宿主重复的名称、Transform、
  LayoutItem、可见性、锁定。
- **共享场景壳**：Stage Scene、Preview 与 component-instance 嵌套实体 MUST 共用同一套
  Appearance + overflow/clip 盒样式语义，避免第三条渲染路径分叉。
- **Appearance 唯一视觉源（形状类）**：Rectangle 等以 Appearance 表达填色/圆角的物料，
  Material DOM MUST NOT 再铺默认不透明底色盖住 Appearance。
- **宿主视觉壳**：页面上的 component-instance 宿主 MUST 不贡献可见外观层（透明/忽略宿主
  Appearance 绘制）；用户可见像素来自嵌套文档解析结果。
- **保持不变**：ComposeDocument v6、单根、根不可删/移、覆盖代数、封闭子树、八层上限、
  有条件自动同步；**不**恢复暴露属性，**不**引入 Detach 或稳定参数契约（另案）。

## Impact

- 受影响规范：`basic-materials`、`editor-workspace-layout`、`component-registry`、`stage`、
  `compose-preview`
- 受影响代码：`@compose-ui/editor`（EntityInspector / controller 合成）、
  `@compose-ui/materials`（component-instance NestedEntity、Rectangle 样式）、
  `@compose-ui/component-registry`（共享 scene style / 可选 shell 辅助）、
  Stage / Preview 消费方对齐
- 前置基线：`update-component-instance-contract`（几何跟根、单根复用、自动同步）
- 破坏性：无协议字段破坏；可能有宿主 Appearance 在实例上不可编辑/不可见的交互变化（符合既有几何契约）
