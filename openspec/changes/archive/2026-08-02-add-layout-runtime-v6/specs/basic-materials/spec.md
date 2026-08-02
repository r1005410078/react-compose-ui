## ADDED Requirements

### Requirement: Container 物料与容器能力

Container Preset 与容器能力 MUST 为 v6 创建 Hierarchy、Layout、Clip、LayoutItem、rotation-only
Transform 和 Appearance。Layout Inspector MUST 编辑明确 Flex 值、padding 与双轴 gap；LayoutItem
Inspector MUST 编辑 Fixed sizing、Flow/Absolute、offset、margin 与 alignSelf。

#### Scenario: 把既有子项转换为 Flow
- **WHEN** 用户在 Layout Inspector 对含 Absolute 直接子项的 Container 执行转换
- **THEN** 一个 batch 按 Hierarchy 顺序把全部直接子项设为 Flow
- **AND** Undo 一次恢复全部原 LayoutItem，后代和未知 Component 不变

