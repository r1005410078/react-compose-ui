# Change: 恢复基础语义属性编辑器并统一 Canvas 与物料 Inspector

## Why

Canvas 和基础物料的属性表单目前各自定义输入控件，常用的尺寸、颜色、可见性和复合坐标行为不一致，无法复用已存在的属性面板绑定、校验和可访问性能力。

## What Changes

- 在 `@compose-ui/property-panel` 发布默认可用的语义 editor：`vector2`、`size`、`angle`、`opacity`、`corner-radius`、`stroke-width`、`visibility`、`color`、`alignment`、`map`；实例 renderer 可以按相同 ID 覆盖默认实现。
- 为 Size 提供可选预设选择，并让 W/H 与预设属于同一个语义属性；Color 通过共享 Shadcn Picker 展示颜色和完全透明状态，不显示 CSS 文本值。
- 将 Frame、Rectangle、Text、Image、SVG Inspector 适配到语义复合值，并为全部物料暴露 Visibility。
- 将 Canvas Inspector 的输出尺寸迁移为 Map：左列 Key 选择“常见尺寸”或“自定义尺寸”，右列 Value 显示六个桌面预设或 W/H；背景保持 Color。不改变 `output.configure` 命令、文档 Schema 或持久化数据。
- 同步更新包 README 和受影响架构说明。

## Impact

- Affected specs: `components`、`property-panel`、`basic-materials`、`editor-workspace-layout`
- Affected code: `packages/components`、`packages/property-panel`、`packages/materials`、`packages/editor` 及其测试、样式和文档
- Public API: 新增稳定 editor ID、Size preset metadata、Map metadata、renderer 左列插槽与 `ComposeColorPicker`；不破坏既有受控属性面板 API。
