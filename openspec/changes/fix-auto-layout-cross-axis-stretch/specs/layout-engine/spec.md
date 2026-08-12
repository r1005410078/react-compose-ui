## ADDED Requirements

### Requirement: Auto Layout 交叉轴拉伸继承

Layout Runtime MUST 让 Flow 子级的 `alignSelf: auto` 按标准 Flexbox 语义继承父级 `alignItems`，
包括交叉轴为 Hug 的子级——Hug 交叉轴 MUST 保持未设置（Yoga auto）状态，MUST NOT 无条件覆盖为
`flex-start` 或任何其他固定值。子级显式设置了非 `auto` 的 `alignSelf` 时 MUST 优先于父级
`alignItems` 生效，这是子级跳出父级拉伸的唯一途径，不需要额外的数据字段或级联写入。

#### Scenario: 父级拉伸时 Hug 子级跟随拉伸

- **WHEN** 容器 `alignItems` 为 `stretch`，其一个 Flow 子级交叉轴为 Hug 且 `alignSelf` 为 `auto`
- **THEN** 该子级交叉轴尺寸拉伸到容器可用空间
- **AND** 不需要修改该子级的 `LayoutItem` 数据即可生效

#### Scenario: 子级显式对齐方式优先于父级拉伸

- **WHEN** 容器 `alignItems` 为 `stretch`，其一个 Flow 子级显式设置 `alignSelf` 为 `flex-start`
- **THEN** 该子级按自身设置对齐，不拉伸
- **AND** 同容器内其他 `alignSelf` 为 `auto` 的子级仍正常拉伸

#### Scenario: 父级为非拉伸对齐时 Hug 子级保持内容尺寸

- **WHEN** 容器 `alignItems` 为 `flex-start`、`center` 或 `flex-end`，其一个 Flow 子级交叉轴为 Hug
  且 `alignSelf` 为 `auto`
- **THEN** 该子级交叉轴尺寸由内容决定，按父级对齐方式定位，不被拉伸
