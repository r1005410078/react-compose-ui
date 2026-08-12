## 1. Inspector 合成表面

- [x] 1.1 [Red → Green] 选中 component-instance 时仅一个 EntityInspector 外壳与一个属性搜索框；名称输入只出现一次
  - Result: controller 内宿主 + 根 sections 合成；compose-editor 不再叠第二个完整面板
- [x] 1.2 [Red → Green] 宿主隐藏 Appearance/Clip/GeometryConstraints/Hierarchy/Layout；根隐藏 Transform/LayoutItem/Visibility/Lock 与 identity
  - Result: 改外观/布局写入根覆盖通路（沿用 instanceRootSelection.dispatch）
- [x] 1.3 单元测试锁定 chrome=sections / extraSections 合成行为

## 2. 嵌套渲染与 Appearance 唯一源

- [x] 2.1 [Red → Green] NestedEntity 与 Stage/Preview 对齐 leaf overflow:hidden 与容器分轴 overflow
  - Result: 实例内圆角裁剪与组件文档一致
- [x] 2.2 [Red → Green] Rectangle Material 背景透明；填色/圆角仅来自 Appearance
  - Result: 组件内改红+圆角 → 保存/同步后实例一致，无默认蓝底盖层
- [x] 2.3 审计 Text/Image/SVG 是否存在同类「CSS 默认填色盖 Appearance」；有则同批修或列 follow-up
  - Result: Text 仅文字色变量、Image/SVG/Shape 无实体填色盖层；仅 Rectangle 曾有蓝底，已透明化
- [x] 2.4 （可选）抽取共享 overflow/scene shell 辅助，Stage 与 NestedEntity 共用，禁止第三份复制
  - Result: `composeEntityOverflowStyle` 在 component-registry；Stage / Preview / NestedEntity 共用

## 3. 宿主视觉壳

- [x] 3.1 确认创建实例与 assetDrop 宿主 Appearance 为透明，Hug 尺寸
  - Result: component-instance preset / createComposeComponentInstanceEntity 使用 TRANSPARENT_APPEARANCE + Hug
- [x] 3.2 宿主 Stage 节点不绘制可感知的第二层填色（透明壳 + 仅 content 可见）
  - Result: 透明 Appearance + 嵌套 content inset:0；宿主不再贡献竞争填色

## 4. 端到端与文档

- [x] 4.1 e2e：嵌套矩形 overflow/圆角/Material 透明（在「实例暴露组件根属性」场景扩展断言）
- [x] 4.2 e2e：选中实例 → 单一 entity-inspector 与单一 searchbox、名称 count=1
- [x] 4.3 同步 README / Agents 中与「实例双面板」相关的过时描述（若有）
  - Result: 仓库无「双面板」文档表述；提案 design 已记录产品单层心智

## 5. 验证

- [x] 5.1 受影响包 typecheck + 单元测试通过（editor / materials / component-registry / preview / stage）
- [x] 5.2 相关 `bun run test:e2e` 场景通过
  - Result: `实例暴露组件根属性且可 Resize` e2e 通过（合成面板 + overflow/圆角/Material 透明）
