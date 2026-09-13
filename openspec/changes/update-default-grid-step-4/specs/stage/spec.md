## MODIFIED Requirements

### Requirement: 自适应网格标尺与世界原点

Stage MUST 在 24px 顶部和左侧 ruler 内显示随 viewport 与 canvas grid 更新的正负世界坐标，
并在 surface 显示细网格、主网格、红色 X 轴与绿色 Y 轴。画布网格投影间距达到 2 CSS px
时 MUST 显示每条配置网格线；更密时 MUST 只按二次幂 stride 抽稀为原网格子集。视觉抽稀
MUST NOT 改变实际 snap step，标尺仍可按独立可读性阈值抽稀。

标尺 MUST 由 Canvas 2D 绘制，画布网格 MUST 继续由 CSS 多层 gradient 绘制。两者 MUST 共用
同一个纯点阵函数与同一套设备像素取整规则：一条线覆盖以其世界坐标为左边界的那一个设备像素列。
标尺刻度 MUST 始终是画布网格线的子集。标尺 MUST 同时绘制细刻度与带数字的刻度：细刻度按不粘连阈值抽稀，数字按可读性阈值抽稀，
两者与画布网格出自同一点阵，因此细刻度必然落在网格线上、数字刻度必然落在细刻度上。
数字 MUST 在其所属刻度线上居中，两轴一致。

#### Scenario: 平移缩放标尺网格

- **WHEN** viewport 平移、缩放或 grid step/offset/primaryLineEvery 改变
- **THEN** ruler label、tick、细线与主线在相同世界位置对齐
- **AND** 一份 8 单位网格（举例的步长，与默认值无关）在 75% 与 25% 缩放时分别显示 6px 与 2px 细线
- **AND** 更低缩放只隐藏部分原始格线，节点仍吸附到原始配置刻度

#### Scenario: 刻度线与网格线落在同一位置

- **WHEN** 在 devicePixelRatio 为 1、2 或 3 且缩放为任意比例下渲染
- **THEN** 同一世界坐标的标尺刻度线与画布网格线覆盖同一条 1 CSS px 带
- **AND** 点阵首线按设备像素取整，因此屏幕间距为整数设备像素时每条线都不跨列模糊

#### Scenario: 分数间距下仍保持两者一致

- **WHEN** 缩放使网格屏幕间距不是整数设备像素
- **THEN** 标尺与网格仍落在同一位置，二者的抗锯齿表现一致
- **AND** 系统 MUST NOT 只对其中一方取整而使两者分离

#### Scenario: 刻度数字居中于刻度线

- **WHEN** 标尺绘制任意一条带数字的刻度
- **THEN** 数字的水平中心与该刻度线重合，垂直标尺旋转后仍以刻度线为中心

#### Scenario: 保留细刻度层级

- **WHEN** 标尺在任意缩放下渲染
- **THEN** 细刻度以更短的线绘制，带数字的刻度更长，落在主网格线上的刻度用更亮的颜色
- **AND** 三者的左边界规则一致，均与画布网格线重合

#### Scenario: 显示世界原点交叉

- **WHEN** 世界 `(0,0)` 位于或移入可视 surface
- **THEN** 红色水平 X 轴与绿色垂直 Y 轴在该点交叉
- **AND** 轴线随 viewport 变换且位于节点内容下方

#### Scenario: 标记选择尺寸

- **WHEN** 存在单选或多选并进行 move、resize 或 rotate 预览
- **THEN** 顶部和左侧 ruler 实时标记世界 AABB 起止位置
- **AND** 分别显示最多两位小数的宽度与高度
