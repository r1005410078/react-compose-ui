## ADDED Requirements

### Requirement: 画布可编辑路径覆盖层

`ComposeStage` MUST 支持可选的 `editablePath` 世界坐标几何，并在 Overlay 中渲染虚线轨迹、
体现速度快慢的等时采样点、切线连杆与手柄，以及关键帧顶点标记。渲染顺序 MUST 位于选区框之下、
吸附参考线之上。切线手柄 MUST 只在 `smooth` 顶点或当前活动顶点上显示。手柄的命中区
MUST 独立于可见尺寸放大。省略 `editablePath` 时 Stage 外观与行为 MUST 完全不变。

#### Scenario: 显示轨迹与速度

- **WHEN** 宿主传入一条包含缓入缓出段的可编辑路径
- **THEN** 画布显示连接各顶点的虚线轨迹
- **AND** 等时采样点在段两端密集、中间稀疏

#### Scenario: 切线手柄的显示条件

- **WHEN** 路径包含 `corner` 与 `smooth` 两种顶点且没有活动顶点
- **THEN** 只有 `smooth` 顶点显示切线连杆与手柄
- **WHEN** 宿主把某个 `corner` 顶点标记为活动
- **THEN** 该顶点也显示切线手柄

#### Scenario: 未传入路径时不变

- **WHEN** 宿主不传 `editablePath`
- **THEN** Overlay 不渲染任何路径元素

### Requirement: 画布路径编辑手势上报

`ComposeStage` MUST 把路径顶点与切线手柄的拖动结果以带阶段的世界坐标回调上报给宿主，
并 MUST 提供顶点双击切换回调。Stage MUST NOT 因为路径编辑派发任何编辑命令，
路径几何的事实来源始终在宿主。

#### Scenario: 拖动顶点上报世界坐标

- **WHEN** 用户拖动一个路径顶点并松手
- **THEN** 宿主收到该顶点的开始、移动与结束回调，结束回调携带最终世界坐标
- **AND** Stage 自身没有修改文档

#### Scenario: 双击顶点上报切换

- **WHEN** 用户双击一个路径顶点
- **THEN** 宿主收到该顶点的切换回调

#### Scenario: Shift 修饰键随手势上报

- **WHEN** 用户按住 Shift 拖动切线手柄
- **THEN** 每次移动回调都带有 Shift 已按下的修饰键状态
