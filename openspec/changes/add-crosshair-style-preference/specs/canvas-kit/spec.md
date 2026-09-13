## ADDED Requirements

### Requirement: 十字光标样式

共享十字光标 MUST 支持两种样式，由输入上的 `style` 字段给出：`fade`（渐隐）与 `halo`
（晕圈）。`style` 缺席 MUST 等于 `fade`。

**渐隐**：每条臂 MUST 从中心向远端淡出——靠中心一端不透明度最高，远端 MUST 仍可见
（MUST NOT 淡到 0）。渐变 MUST 按用户空间坐标（`userSpaceOnUse`）逐条给出：高度为零的
水平线上按包围盒的渐变方向无定义。渐变 id MUST 对每个组件实例唯一，同一页面上的多个画布
MUST NOT 互相串色。渐变的颜色 MUST 与均匀样式读同一个 token。

**晕圈**：每条臂 MUST 在主线之下再画一条更粗、取画布底色的底线，主线在任何墨色上都因此
可读；同时画拾取框时，框 MUST 同样带晕圈。晕圈线 MUST NOT 带十字线的 `data-*-crosshair-line`
标记——它不是十字线，计数十字线的一方 MUST 仍数到四条。晕圈色 MUST 走自己的 token
（`--compose-canvas-crosshair-halo`），回落到画布底色 token；调用方可按主题覆盖。

两种样式 MUST 共用同一份几何：中心、臂长、在拾取框处断开这三条规则 MUST 不随样式改变。

#### Scenario: 缺席即渐隐

- **WHEN** 输入不带 `style`
- **THEN** 四条十字线各自以渐变描边，没有晕圈线

#### Scenario: 晕圈在主线之下

- **WHEN** `style` 为 `halo` 且画线
- **THEN** 存在四条晕圈线，每条在对应十字线之前绘制
- **AND** 带十字线标记的线仍恰好四条

#### Scenario: 样式不改几何

- **WHEN** 同一输入分别以 `fade` 与 `halo` 绘制
- **THEN** 两次绘制的十字线起点与终点逐条相同
