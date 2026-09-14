## ADDED Requirements

### Requirement: Renderer 声明可读尺寸下限

`ComposeRendererDefinition` MUST 允许声明 `minimumLegibleSize`（屏幕像素，`width` 与 `height`
各自可选）：Stage 据此在 Entity 的世界包围盒乘缩放于**声明的每一轴**都低于阈值时不建节点。
字段缺席 MUST 表示「永远可读」，该 Renderer 永不因细节被裁。Registry MUST 原样透出这份声明，
MUST NOT 自己解释它——多小算读不出来只有物料自己说得出，而判定属于 Stage。

#### Scenario: 只声明一轴

- **WHEN** 一个 Renderer 只声明 `height`
- **THEN** 判定只看高度，宽度不参与

#### Scenario: 未声明

- **WHEN** 一个宿主自定义 Renderer 没有声明 `minimumLegibleSize`
- **THEN** 它在任何缩放下都被渲染
