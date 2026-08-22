## ADDED Requirements

### Requirement: 曲线是带盒的普通 Entity

曲线 Entity MUST 保留全部五个必备 Component（Composition、Transform、LayoutItem、
Visibility、Lock），几何 MUST 住在可选的 `Curve` 内建 Component 上，几何点 MUST 使用
盒局部坐标。位置的事实来源 MUST 保持 `LayoutItem.offset`，形状的事实来源是 `Curve`，
盒尺寸是几何的派生（紧包围盒，退化轴钳到 1）。

`Curve` MUST 与 Renderer 组合，MUST NOT 与 Hierarchy 组合。`schemaVersion` MUST NOT 因
本能力改变；不含 `Curve` 的既有文档校验结果 MUST 保持不变。

#### Scenario: 曲线 Entity 校验通过

- **WHEN** 校验一个带五个必备 Component、Renderer 与合法 `Curve` 的 Entity
- **THEN** 校验通过，`schemaVersion` 仍为 7

#### Scenario: 非法组合被拒绝

- **WHEN** 校验一个 `Curve` 与 Hierarchy 组合、或缺少 Renderer、或几何点非有限数的 Entity
- **THEN** 校验失败并给出稳定机器码

#### Scenario: 既有文档不受影响

- **WHEN** 校验一份不含 `Curve` 的既有 v7 文档
- **THEN** 校验结果与本能力引入前逐字一致

### Requirement: 曲线几何经由单一写入漏斗

端点编辑 MUST 通过一条内建命令在同一事务里写入 `Curve` 并重算 `LayoutItem` 的尺寸与
offset，MUST NOT 存在绕开该命令直接写盒或几何的第二个入口。数值 MUST 经
`roundComposeGeometry` 量化。撤销一步 MUST 回到编辑前的几何与盒。

#### Scenario: 端点编辑同步盒

- **WHEN** 通过命令把线的一个端点移出当前盒
- **THEN** `Curve` 与 `LayoutItem` 在同一事务里更新，盒仍是几何的紧包围盒

#### Scenario: 退化轴不违反盒校验

- **WHEN** 把线编辑成水平线
- **THEN** 盒高钳为 1，文档校验通过，几何点保持精确值

#### Scenario: 撤销一步还原

- **WHEN** 端点编辑后撤销
- **THEN** 几何与盒同时回到编辑前
