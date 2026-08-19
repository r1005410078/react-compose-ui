## ADDED Requirements

### Requirement: 新建落点解析

`@compose-ui/stage-engine` MUST 提供无 React、无 DOM 的落点解析原语：判定一个 Entity 是否是
容器类（拥有 `Hierarchy` 且不是 Group），以及把一个包围盒钳制进给定 Frame 尺寸的纯函数。
钳制 MUST 保持宽高不变、只平移左上角；Entity 在某一轴上大于 Frame 时该轴 MUST 钳到 0。
既有的落点建议解析 MUST 接受一个回退 Frame 参数，使无命中目标时的落点是宿主给出的激活
场景而不是 `rootIds` 中的第一块。

#### Scenario: 钳制完全在场景之外的包围盒

- **WHEN** 一个 100×50 的包围盒位于 `(2000, -300)`，目标 Frame 尺寸为 1280×720
- **THEN** 结果为 `(1180, 0)`，宽高不变

#### Scenario: 钳制大于场景的包围盒

- **WHEN** 一个 2000×1000 的包围盒需要钳进 1280×720 的 Frame
- **THEN** 结果左上角为 `(0, 0)`，宽高不变

#### Scenario: 无命中目标时落点解析为回退 Frame

- **WHEN** 宿主传入激活场景作为回退 Frame 并请求无命中目标的落点
- **THEN** 落点父级是该激活场景，而不是 `rootIds` 中的第一块场景
