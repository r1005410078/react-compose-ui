## MODIFIED Requirements

### Requirement: Container 物料与容器能力

Container Preset 与容器能力 MUST 为 v6 创建 Hierarchy、Layout、Clip、LayoutItem、rotation-only
Transform 和 Appearance。Layout Inspector MUST 编辑明确 Flex 值、padding 与双轴 gap；LayoutItem
Inspector MUST 编辑 Fixed sizing、Flow/Absolute、offset、margin 与 alignSelf。
Container Preset 的默认尺寸 MUST 为 `320×240`，使拖入或点击创建的容器在默认缩放下不铺满视口；
默认外观 MUST 使用深色背景与深色描边，使新建容器不需要先改一次背景就能与深色大屏一致；
容器物料图标 MUST 使用井号（`#`）字形，以区别于 rectangle 物料。

#### Scenario: 把既有子项转换为 Flow
- **WHEN** 用户在 Layout Inspector 对含 Absolute 直接子项的 Container 执行转换
- **THEN** 一个 batch 按 Hierarchy 顺序把全部直接子项设为 Flow
- **AND** Undo 一次恢复全部原 LayoutItem，后代和未知 Component 不变

#### Scenario: 从物料面板拖入容器
- **WHEN** 用户把 Container 物料拖入画布
- **THEN** 创建的容器尺寸为 `320×240`
- **AND** 默认背景为深色，无需额外改动即可承载深色大屏内容
