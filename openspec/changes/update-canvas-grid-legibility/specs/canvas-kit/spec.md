## MODIFIED Requirements

### Requirement: 网格与标尺共用同一点阵

画布网格与标尺刻度 MUST 由同一个纯点阵函数与同一套设备像素取整规则产出，使同一世界坐标落到
同一个设备像素列。线宽 MUST 为一个设备像素（`1 / devicePixelRatio` CSS px），两者一致。
标尺刻度 MUST 始终是画布网格线的子集。

投影间距不足以逐条显示时 MUST 按二次幂 stride 抽稀为原网格的子集，MUST NOT 整片隐藏网格。
视觉抽稀 MUST NOT 改变实际吸附步长。

#### Scenario: 刻度是网格线的子集

- **WHEN** 在任意缩放与设备像素比下渲染
- **THEN** 每一条标尺刻度都落在一条网格线上

#### Scenario: 抽稀不改变吸附

- **WHEN** 缩放使部分格线被抽稀隐藏
- **THEN** 图元仍吸附到原始配置的步长

#### Scenario: 带宽以设备像素表达

- **WHEN** 在 devicePixelRatio 为 1、2 或 3 下求某条线的像素带
- **THEN** 带宽乘以 devicePixelRatio 恒等于 1
- **AND** 带的左边界落在整数设备像素上
