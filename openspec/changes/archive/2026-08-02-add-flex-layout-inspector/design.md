## Context

当前 ECS 使用独立 `Hierarchy` 表达拓扑，Stage/Preview 根据 `Transform` 绝对定位后代。
`@compose-ui/property-panel` 已支持实例级自定义 renderer 和可变高度字段行，Materials 可以继续
使用 Schema 提供搜索、受控校验和提交语义。设计稿要求布局分组在现有约 400px Inspector 中使用
两行三列卡片，中文标题下显示 CSS 属性名，并把整体状态和重置放入分组标题栏。

## Goals / Non-Goals

- Goals:
  - 建立可扩展的 `Layout` Component，并先支持 `type: "flex"`。
  - 让 Container Inspector 可以编辑并持久化浏览器一致的 Flex 容器值。
  - 提供贴合设计稿、可访问、响应面板列宽变化的图标控件和实时预览。
  - 让 Registry Component Inspector 以可选协议扩展分组标题栏，而不是让 Editor 判断 Layout。
- Non-Goals:
  - 不改变 Stage、Preview、Transform、Hierarchy 或子项几何。
  - 不实现 `flex-grow`、`flex-shrink`、`flex-basis`、`order`、`align-self` 等子项属性。
  - 不实现 Grid、独立 `row-gap`/`column-gap`、单位选择或变量绑定。

## Decisions

### Layout 文档协议

- 新增可选内建 Component Key `Layout`；存在时必须与 `Hierarchy` 同时出现。
- 公共 `ComposeLayout` 首版是 `ComposeFlexLayout`，使用以下 JSON：

```ts
interface ComposeFlexLayout {
  readonly type: 'flex'
  readonly flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  readonly flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse'
  readonly alignContent:
    | 'normal' | 'flex-start' | 'center' | 'flex-end'
    | 'space-between' | 'space-around' | 'stretch'
  readonly justifyContent:
    | 'normal' | 'flex-start' | 'center' | 'flex-end'
    | 'space-between' | 'space-around' | 'space-evenly'
  readonly alignItems:
    | 'normal' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
  readonly gap: number
}
```

- `gap` 必须为有限非负数，未来渲染时解释为 CSS 像素；面板只显示数字。
- 默认值为 `row`、`nowrap`、三个对齐字段均为 `normal`、`gap: 0`，与浏览器初始语义一致。
- `createDefaultComposeFlexLayout()` 每次返回独立 JSON；`isValidComposeLayout()` 供 Core、Registry
  和宿主复用。
- 新 Container Preset 与“容器”能力都创建 `Layout`。旧 v5 Entity 缺少该 Component 仍合法且不显示
  布局分组，不做静默迁移或 Schema 版本升级。

### Inspector、标题栏与预览

- Materials 注册 order 紧跟 `Transform` 的 `Layout` Component Definition 和 Inspector。
- 属性卡片固定为两行三列：第一行方向、换行、间距；第二行多行、主轴、交叉轴。
- zh-CN 卡片使用简短中文标题并在下一行显示标准 CSS 属性名；en-US 使用英文标题和同一 CSS 属性名。
- 枚举字段使用受控 radiogroup 图标按钮；方向 4 项、换行 3 项保持单排，多行和主轴的 6 个非
  `normal` 项使用 3×2，交叉轴的 5 个非 `normal` 项使用 3+2。当前值为 `normal` 时不选中任何图标；
  再次点击多行、主轴或交叉轴的当前选项会取消选择并恢复 `normal`。
- 图标使用统一 20×20 坐标系和浏览器 DevTools 的语义顺序；在面板中统一显示为 18px，并根据当前
  `flex-direction` 旋转主轴、交叉轴和换行示意。DevTools 未提供的 `wrap-reverse` 继续作为第三项，
  使用 wrap 图形沿交叉轴镜像表达。
- 图标按钮支持点击、Tab、方向键、禁用/只读、焦点环和 `aria-checked`；可访问名称本地化。
- `gap` 使用无 unit、无 binding metadata 的数字输入；无效或负数只保留草稿，不派发命令。
- Inspector 通过 `entity.component.update` 一次提交完整 `Layout`，保留标准事务 merge key。
- `ComposePropertyPanelSection` 接受可选 `actions`；`ComposeComponentDefinition` 接受可选
  `inspectorHeaderActions`，Registry 提供与正文 Inspector 一致的隔离适配器。Editor 只组合协议，
  不识别 `Layout`。
- Layout 标题栏右侧始终显示 `display: flex` 和重置按钮；重置恢复完整默认 Layout，在默认状态或
  只读状态禁用。
- 实时预览作为 Schema 字段列表后的 Materials 自有全宽区域。它直接把当前 Flex 值应用到内部
  三节点容器，并显示“Flex 容器”、`direction · wrap · gap` 摘要和主轴/交叉轴标签。

### 渲染边界

- Stage 与 Preview 不导入布局解析器、不输出 `display:flex`，仍按现有 Transform/Hierarchy 语义渲染。
- Inspector 预览是唯一使用 CSS Flex 的位置；编辑 `Layout` 只改变文档 JSON、历史记录和该预览。

## Compatibility and Risks

- 旧文档兼容：`Layout` 可选，缺失时行为不变。
- 以前作为“未知 Component”保存的非法 `Layout` 数据会在新 Core 中被严格拒绝；这是把该 Key 提升为
  内建协议后的预期收紧。
- “容器”能力新增所有权字段后，移除旧能力实例时 `Layout` 可能不存在；批处理必须允许该删除子命令
  成为 noop，同时正常移除旧的 `Hierarchy`/`Clip`。
- Stage/Preview 暂时忽略已保存布局，Inspector 必须明确依靠内部预览反馈，避免暗示画布已经生效。
