## ADDED Requirements

### Requirement: 忽略 Auto Layout 开关

几何 Inspector MUST 为父级是 Layout 容器的 Entity 提供「忽略 Auto Layout」开关，作为
Flow↔Absolute 的唯一显式转换入口；父级不是 Layout 容器时 MUST NOT 显示该开关。

开启（脱流）MUST 在单条事务内：把 `positioning` 切为 `absolute`，offset 从当前布局 box 反算使
视觉位置不变，并把 fill 轴烘焙为 fixed（值取当前求解尺寸），与 reparent 移出 Flow 的既有烘焙
规则一致。关闭（回流）MUST 在单条事务内把 `positioning` 切回 `flow`，保持当前 `childIds` 位置
不变，并按进入 Auto Layout 容器的既有交叉轴采纳规则处理 axis sizing。两个方向 MUST 均可一次
undo 恢复。

#### Scenario: 开启开关脱流且视觉位置不变

- **WHEN** 用户对 Auto Layout 容器内的 Flow 子级开启「忽略 Auto Layout」
- **THEN** 一条事务把该子级切为 Absolute，offset 反算自当前布局 box，fill 轴烘焙为 fixed
- **AND** 切换前后子级在画布上的视觉位置一致，undo 一次恢复

#### Scenario: 关闭开关回流并采纳容器规则

- **WHEN** 用户对已脱流的子级关闭「忽略 Auto Layout」
- **THEN** 一条事务把该子级切回 Flow，`childIds` 位置不变
- **AND** axis sizing 按进入容器的既有采纳规则改写，undo 一次恢复

#### Scenario: 非 Auto Layout 父级不显示开关

- **WHEN** 选中 Entity 的父级不是 Layout 容器
- **THEN** 几何 Inspector 不渲染「忽略 Auto Layout」开关
- **AND** 其余几何字段呈现不受影响
