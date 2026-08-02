# 变更：紧凑颜色、渐变与图片 Paint Picker

## 原因

现有 Paint Picker 只能编辑颜色与渐变，无法复用既有稳定资源引用作为 Canvas 或 Entity 背景图片。

## 变更内容

- 新增可持久化的 `image` ComposePaint，并由 Stage、Preview 与实体背景层统一渲染。
- 保持色块触发的紧凑 Popover，在同一面板内提供纯色、渐变和图片页签。
- 通过宿主注入的图片选择/上传适配器连接资源系统，不让共享组件依赖 Asset Browser。
- 当 Editor 已配置 Asset Provider 时自动派生完整图片库、分页选择与上传能力，同时保留显式适配器覆盖。
- 补全 2–8 个渐变色标的完整生命周期，以及线性、径向、角向三类几何编辑。

## 影响

- 受影响规范：compose-document、components、compose-preview。
- 受影响包：core、components、component-registry、stage、preview、editor、materials、property-panel、app。
