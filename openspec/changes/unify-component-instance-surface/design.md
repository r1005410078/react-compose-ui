## 上下文

`update-component-instance-contract` 已收敛协议：删除暴露属性、任意单根、实例几何跟随组件根、
有条件自动同步。协议层「宿主壳 + 嵌套文档」仍然必要。本变更只处理**产品表面与渲染路径**，
不改覆盖代数与 Asset schema。

已观察到的缺陷路径：

- `compose-editor` 将 `inspectorPanel` 与完整 `instanceRootInspector` 纵向叠加。
- `NestedEntity` 未应用与 Stage/Preview 一致的 leaf `overflow: hidden`，圆角无法裁剪子层。
- `.compose-material--rectangle` 曾用 CSS 默认蓝底盖住 Appearance。

## 目标/非目标

### 目标

- 用户选中实例时：一个选中框语义、一个属性面板外壳、一套可编辑的根视觉属性。
- 同一 Appearance 在「页面实体 / 组件文档 / 页面实例嵌套」下颜色与圆角行为一致。
- 形状类 Material 不成为第二套填色事实源。
- 用可回归测试锁定上述行为。

### 非目标

- Detach、跨 Provider Variant、稳定参数/暴露属性回归。
- ComposeDocument v7 或合并宿主 Entity 与组件根为同一持久化节点。
- 放宽八层上限或改写覆盖操作代数。
- 为所有物料重做视觉系统（仅约束「Appearance 表达填色」的形状类，以 Rectangle 为标杆）。

## 决策

### 1. 协议双层，产品单层

保留宿主 Entity + 嵌套 Runtime。对外合成：

| 表面 | 来源 |
|---|---|
| 场景树默认行 | 宿主实例一行；展开后才是内部实体 |
| 选中框（未下钻） | 宿主外框 ≡ 根尺寸（Hug） |
| Inspector | 单外壳；宿主字段 + 根字段分区拼进同一 Root |
| 可见像素 | 仅嵌套文档（解析覆盖后） |

### 2. Inspector 合成方式

在 `useComposeEditorController` 产出的 `inspectorPanel` 内完成合成：

- 宿主 `EntityInspector`：`chrome="full"`，`hiddenComponentKeys` 排除 Appearance / Clip /
  GeometryConstraints / Hierarchy / Layout（及一切应以根为事实源的键）。
- 根：`chrome="sections"`，`hideIdentity`，隐藏 Transform / LayoutItem / Visibility / Lock。
- `compose-editor` **不得**再追加第二个完整 EntityInspector。

`instanceRootInspector` 可保留为 sections 片段供自定义宿主，默认路径已内嵌。

### 3. 共享场景壳语义

不强制立刻抽成单一 React 组件，但 MUST 满足行为等价：

- leaf：`overflow: hidden`（圆角裁剪 Material / Paint 子层）
- container：按 `resolveComposeOverflow` 分轴映射（与 Preview/Stage 一致）
- 盒几何与 Appearance：`composeEntitySceneStyle` / PaintLayer 同源

优先在 component-instance 与 Stage 共用 registry 已有 style 辅助；若复制 overflow 逻辑，
必须抽到 registry 或 materials 的单一实现并两边引用。

### 4. Appearance 唯一填色源（Rectangle）

- Material 根节点背景 MUST 为 transparent（或等价不绘制填色）。
- 填色、圆角、阴影来自 Entity 壳 Appearance + PaintLayer。
- 默认 Appearance 值（如默认蓝）仍写在 seed 的 Appearance 上，不写在 CSS 变量盖层。

### 5. 宿主不贡献可见外观

- 创建/落盘实例时宿主 Appearance 保持透明（既有 preset）。
- 渲染宿主时不得用宿主 Appearance 再铺一层不透明底；尺寸 Hug，视觉由嵌套 content `inset:0` 承担。

## 风险/权衡

| 风险 | 缓解 |
|---|---|
| 合成 Inspector 后自定义 `slots.inspector` 宿主行为变化 | 文档说明默认路径；slots 全量替换时宿主自管 |
| 抽共享 shell 触及 Stage 回归面 | 先行为对齐 NestedEntity，再可选抽取；Stage 现有 e2e 守门 |
| 去掉 Material 默认底后旧截图/测试依赖蓝 CSS | 更新断言为 Appearance / computed style |
| 与未归档的 `update-component-instance-contract` 增量叠写 | 本变更以「契约已落地」为前提；main 规范归档时合并全文 |

## 迁移计划

- 无 Asset schema 变更，无静默数据迁移。
- 运行中文档：宿主若残留非透明 Appearance，渲染层忽略或强制透明绘制即可，不必改写历史 JSON
  （可选后续清理）。

## 待解决问题

- 无。稳定参数契约另案。
