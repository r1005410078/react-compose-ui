# 变更：收纳属性绑定入口

## 原因

当前每个可绑定逻辑输入都会在编辑控件旁常驻约 36px 的链条按钮。单值字段已经会明显压缩输入宽度，
Vector2、Size 等多子目标控件还会重复占位，使 Inspector 在常见窄侧栏中难以阅读和编辑。右侧属性操作列
已经为行级动作保留稳定空间，但绑定入口没有复用它。

## 变更内容

- 把字段绑定入口从编辑控件旁的独立常驻槽位移入现有右侧属性操作列，不再减少输入控件可用宽度。
- 未绑定入口只在属性行 hover、行内 focus 或入口自身 focus 时显示；已绑定和解析错误状态始终显示，
  并继续提供完整 tooltip、ARIA 与选择器信息。
- 单目标且没有其他竞争动作时，入口直接打开变量选择器；存在多个绑定子目标或重置、存在性、集合动作时，
  使用状态感知的聚合菜单列出目标和其他行操作，避免操作列溢出。
- 多子目标入口按目标显示未绑定、已绑定和错误状态，并允许分别选择、换绑和解绑；原输入继续用只读状态与
  轻量视觉提示表达有效值来自绑定。
- 已绑定的内建控件与第一方 renderer 控件改为显示变量标识，而非继续显示只读的字面输入；变量标识可打开
  选择器换绑，操作列中的单目标入口则改为紧凑的解绑图标。
- 默认操作列改为容纳三个 22px 图标。普通操作、绑定和重置按确定优先级直接显示；一旦总数超过三个，最后
  一个可见槽位固定显示“更多”图标并收纳余下操作，确保重置不会因单槽聚合而不可见。
- **BREAKING**：自定义 renderer 不再通过
  `PropertyPanelRendererBindingController.renderTrigger()` 决定入口布局；Property Panel 根据 renderer
  的 binding target descriptors 统一生成行级聚合入口。renderer 继续通过 `targets`/`getTarget()` 读取
  各子目标的 literal、effective、binding 与错误状态。

## 影响

- 受影响的规范：`property-panel`
- 受影响的代码：`packages/property-panel`、`packages/materials`、示例自定义 renderer 与 E2E
- 公共 API 增加：`ComposePropertyPanelBoundValue`，供宿主 renderer 以统一变量标识替换其已绑定子控件
- 公共 API 迁移：删除 `PropertyPanelRendererBindingController.renderTrigger()`，宿主 renderer 移除手工
  插入 `.property-panel__binding-target`/`.property-panel__binding-slot` 的代码
- 文档同步：更新 `packages/property-panel/README.md`，说明自动行级入口、聚合目标和状态显隐规则
