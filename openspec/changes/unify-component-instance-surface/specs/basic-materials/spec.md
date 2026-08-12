## MODIFIED Requirements

### Requirement: 关联组件实例物料

materials MUST 提供隐藏于基础 Palette 的 `component-instance` Preset；实例保存稳定引用、
appliedLineage、resolvedSnapshot 和 instanceOverrides。实例的 LayoutItem 与 GeometryConstraints
MUST 从组件根派生：根允许 Resize 时实例同样允许，尺寸、外观、裁剪与 Auto Layout 的编辑 MUST 写入
实例覆盖并以组件根为目标，不修改组件源。页面上的宿主 Entity MUST 以透明外观与 Hug 尺寸承载
嵌套文档，MUST NOT 再绘制一层与组件根竞争的可见填色。实例内部 Entity MUST 可在宿主编辑期被
投影、选中并按实例层稳定操作结构编辑，且 MUST 保持在实例子树边界内。component-instance 嵌套
实体的 Appearance、overflow/clip 盒样式语义 MUST 与 Stage / Preview 中同构 Entity 一致，使得
组件文档内编辑的颜色与圆角在实例中可复现。

#### Scenario: 离线渲染已保存快照

- **WHEN** Provider 不可用但实例含合法 resolvedSnapshot
- **THEN** Stage 与 Preview 继续渲染快照并显示离线状态

#### Scenario: 实例暴露组件根属性

- **WHEN** 组件根是允许 Resize 的容器
- **THEN** 实例可被 Resize，且尺寸、外观、裁剪与 Auto Layout 在 Inspector 中可编辑
- **AND** 编辑结果保存为以组件根为目标的实例结构操作

#### Scenario: 实例层结构覆盖

- **WHEN** 用户在实例内部删除、reparent、reorder 实体或增删非基础 Component
- **THEN** 实例只保存与 Variant 同构的稳定结构操作，并按 Base → Variant 链 → 实例结构操作解析

#### Scenario: 拒绝越界结构编辑

- **WHEN** 操作试图删除或 reparent 组件根、删除基础 Component，或把内部实体移出实例子树
- **THEN** 操作被稳定拒绝，实例保持上一个合法状态

#### Scenario: 嵌套组件保护

- **WHEN** 组件嵌套形成循环或超过八层
- **THEN** Renderer 停止递归、释放已创建 Runtime 并呈现可访问错误状态

#### Scenario: 实例嵌套实体圆角与填色一致

- **WHEN** 组件源中某叶子 Entity 的 Appearance 含非零 borderRadius 与非默认 solid 填色
- **AND** 页面上的 component-instance 渲染该快照且无覆盖该字段
- **THEN** 嵌套实体盒应用相同 borderRadius 与填色
- **AND** 叶子盒 overflow 为 hidden，使圆角裁剪内部 Material 层

#### Scenario: 宿主不贡献第二层填色

- **WHEN** 页面渲染合法 component-instance
- **THEN** 用户可见的填色与圆角来自嵌套文档解析结果
- **AND** 宿主 Entity 不以不透明 Appearance 再铺一层盖住或露出第二套色块

## ADDED Requirements

### Requirement: 形状类 Material 不得覆盖 Appearance 填色

形状类基础物料（至少包含 Rectangle）的 Renderer 根节点 MUST NOT 使用不透明 CSS 默认背景覆盖 Entity Appearance。填色、圆角与阴影 MUST 由共享 Appearance / Paint 层表达；Material 仅承担内容占位或非填色职责。默认视觉值 MUST 写在 Preset/seed 的 Appearance 上，不得依赖 Material 样式表中的第二套默认色。

#### Scenario: Rectangle 改色不被 Material CSS 盖住

- **WHEN** Rectangle Entity 的 Appearance.backgroundPaint 为非默认 solid 色且 borderRadius 非 0
- **AND** Stage、Preview 或 component-instance 嵌套路径渲染该 Entity
- **THEN** 可见填色与 computed 背景反映 Appearance 色值
- **AND** Material 根节点不绘制与 Appearance 冲突的默认蓝底

#### Scenario: Rectangle 默认外观来自 seed Appearance

- **WHEN** Registry 从默认 rectangle Preset 创建 seed
- **THEN** Appearance 含明确的默认 solid 填色与 borderRadius
- **AND** 渲染不依赖 Material CSS 变量提供填色
