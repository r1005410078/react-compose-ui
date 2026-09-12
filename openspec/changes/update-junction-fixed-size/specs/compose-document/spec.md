## MODIFIED Requirements

### Requirement: 曲线几何经由单一写入漏斗

端点编辑 MUST 通过一条内建命令在同一事务里写入 `Curve` 并重算 `LayoutItem` 的尺寸与
offset，MUST NOT 存在绕开该命令直接写盒或几何的第二个入口。数值 MUST 经
`roundComposeGeometry` 量化。撤销一步 MUST 回到编辑前的几何与盒。

该命令 MUST 覆盖全部 `kind`：弧与多段线的几何写入 MUST 走同一条命令，MUST NOT 各自新开入口。

**该命令 MUST 尊重 `GeometryConstraints.resize`**：`none` 时 MUST 以可判别的问题码拒绝。它重算盒
正是它作为唯一漏斗的定义的一部分，因此不认这个约束时它就是那个约束唯一的漏洞——`entity.transform.set`
早就在拒绝改尺寸，而拖一下夹点绕过了它。拒绝 MUST 与锁定那一支并列，MUST NOT 静默放行。

#### Scenario: 端点编辑同步盒

- **WHEN** 通过命令把线的一个端点移出当前盒
- **THEN** `Curve` 与 `LayoutItem` 在同一事务里更新，盒仍是几何的紧包围盒

#### Scenario: 退化轴不违反盒校验

- **WHEN** 把线编辑成水平线
- **THEN** 盒高钳为 1，文档校验通过，几何点保持精确值

#### Scenario: 撤销一步还原

- **WHEN** 端点编辑后撤销
- **THEN** 几何与盒同时回到编辑前

#### Scenario: 弧与多段线走同一条命令

- **WHEN** 写入一段弧或一条多段线的几何
- **THEN** 使用的是同一条曲线几何写入命令，盒同步为新的紧包围盒

#### Scenario: 尺寸被锁死时拒绝

- **WHEN** 对一个 `resize` 为 `none` 的曲线写入新几何
- **THEN** 命令以可判别的问题码拒绝，`Curve` 与 `LayoutItem` 都不变
