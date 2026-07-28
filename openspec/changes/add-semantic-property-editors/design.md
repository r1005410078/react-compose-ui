## Context

属性面板已经拥有 Valibot 校验、受控提交、只读/重置、变量绑定和自定义 renderer registry，但基础物料与 Canvas 仍以各自的扁平字段和局部 renderer 实现相同的交互。旧示例中的基础 renderer 没有成为第一方包能力。

## Goals / Non-Goals

- Goals：在 `property-panel` 内提供稳定、可覆盖的基础语义编辑器；让 Canvas 与五种基础物料使用同一语义；通过共享 Picker 保留既有文档、命令、事务和 CSS 字符串数据的读取兼容性。
- Non-Goals：不新增 ComposeDocument 字段、不引入跨面板系统剪贴板、不为尚无文档字段的 Alignment 写入数据、不把 editor 反向依赖引入 property-panel。

## Decisions

### 默认 registry 与宿主覆盖

`ComposePropertyPanel` 为每个实例构造有效 registry：宿主 `renderers` 排在内建 renderer 前，并以相同 ID 排除对应内建项。registry 不使用模块级可变状态。`PropertyPanelRendererProps` 接收 schema metadata 已解析出的字段显示名，内建 renderer 不需要自行猜测路径文案。

### 语义值与绑定

`vector2` 与 `size` 接收对象值，分别声明稳定的 `x`/`y` 与 `width`/`height` binding targets。其他基础 renderer 保持单一 `value` target。它们通过现有 `commit` 进入同一套完整 Schema 校验、只读、重置和焦点语义。

### Size 预设

Size metadata 可声明 `{ value, width, height }` 列表。若 Size schema 还包含一个 picklist `preset` 字段，renderer 在同一属性内容区同时呈现 preset 和 W/H：选择预设原子更新三个字段，手动宽高只要不再命中预设就写回 `custom`。option label 继续来自 Schema metadata 的 `optionLabels`，不会把显示文案重复存入 preset 配置。

### 单键分支 Map

`map` 是单行、固定结构的分支键值对，不替代可增删键的 Valibot `record`。它要求
`v.variant('key', [...])` 的每个分支精确声明 `{ key: literal string, value: schema }`：Key control
通过 renderer `labelComponent` 放入属性左列，Value control 由 `renderInlineValue` 在右列复用现有
renderer。父 metadata 的 `optionLabels` 提供 Key 显示名，`mapValueDefaults` 在自动初值不满足分支
Schema 时提供有效 Value。Map 不声明变量绑定目标；其 Value 仍可使用无绑定的内建或宿主 renderer。

### Color Picker 与兼容读取

`@compose-ui/components` 提供由 Shadcn CLI 生成的 Base UI Popover 源码组合的 `ComposeColorPicker`，受控输入为既有 CSS 字符串，输出只可能是小写不透明 HEX 或 `transparent`。属性行和弹层不显示 CSS 文本。非 HEX/transparent 的存量色仍作为 CSS 色块预览，色盘从安全回退色开始；用户首次主动选择后才替换该存量值。Color 仍通过 Property Panel 的统一 Schema 校验、只读、重置与绑定链路提交。

### 领域适配

Materials Inspector 的表单值可以组合为 `position`、`size`、`rotation`、颜色、阴影 offset 与 `visible` 等语义字段；发送命令前适配回既有 transform、style、props 和 `node.set-visibility` payload。Canvas 临时 Inspector 值以 `outputSize: { key, value }` Map 与 `backgroundColor` 表达。切换 Key 只切换瞬时 UI 状态，不派发命令；选择常见尺寸或提交自定义 W/H 仍只派发一次 `output.configure`，并在 Undo/Redo 或宿主更新后由当前 W/H 重新推导 Key 与 Value。

## Risks / Trade-offs

- 复合 renderer 会增加 schema introspection：仅在包内读取 Valibot object entry，公共 API 仍只暴露 renderer contracts。
- CSS Color 没有浏览器外完整解析器：非 HEX/transparent 值可继续预览但无法在色盘内精确复原，用户首次选择会归一化为 HEX 或透明。
- Materials adapter 重组表单字段：以现有 material command 测试确保 mutation、transaction label 与 legacy Rectangle fallback 保持兼容。

## Migration Plan

1. 建立带 OpenSpec 映射的 Red 测试。
2. 实现内建语义 editor 与 registry 合并，先使基础 renderer 测试转绿。
3. 分别迁移 Materials 和 Canvas，并验证命令 payload、undo/redo 与焦点。
4. 更新 README/架构说明，运行严格校验与受影响包及仓库验证。

## Open Questions

- 无。常见尺寸固定为当前六个桌面尺寸；Alignment 先作为未来 Schema 可用的基础 editor。
