## MODIFIED Requirements

### Requirement: ECS 结构命令

Reparent 与 Duplicate MUST 接受开始 Layout Snapshot，并按目标 parent Layout 决定 positioning、offset
与 Fill 转换；Group/Ungroup MUST 为 Flow 目标返回稳定不可用原因。

子级进入 Auto Layout 容器时，若父级 `alignItems` 为 `stretch`、子级 `alignSelf` 为 `auto` 且子级交叉轴
尺寸模式为 `fixed`，命令 MUST 把该交叉轴改写为 `fill` 并保留原固定值作为回退。改写 MUST 只作用于交叉
轴，MUST NOT 作用于 `hug` 或 `fill`，也 MUST NOT 在父级 `alignItems` 后续变化时重新触发。

#### Scenario: Scene Tree 跨布局移动
- **WHEN** 节点从 free parent 移入 Layout、在 Layout 间移动或移出到 free parent
- **THEN** 分别得到 Flow、保持 Flow、或烘焙 Absolute 的确定 LayoutItem
- **AND** 一个 Undo 恢复 parent、index 与全部原 authoring 值

#### Scenario: 固定尺寸子级进入拉伸容器
- **WHEN** 交叉轴为 `fixed` 的子级进入 `alignItems: stretch` 且自身 `alignSelf` 为 `auto` 的容器
- **THEN** 该子级的交叉轴尺寸模式变为 `fill`，原固定值保留为回退值
- **AND** 主轴尺寸模式保持不变

#### Scenario: 子级显式对齐时不改写尺寸
- **WHEN** 子级 `alignSelf` 不是 `auto`，或父级 `alignItems` 不是 `stretch`
- **THEN** 子级的交叉轴尺寸模式保持原样
- **WHEN** 子级交叉轴是 `hug` 或 `fill`
- **THEN** 命令不改写该轴

#### Scenario: 父级此后改变对齐不回溯
- **WHEN** 子级已按上述规则改写为 `fill`，随后父级 `alignItems` 改为非 stretch
- **THEN** 已有子级的尺寸模式不被自动改回，用户可自行调整
