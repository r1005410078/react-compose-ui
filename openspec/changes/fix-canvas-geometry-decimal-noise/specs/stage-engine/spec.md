## MODIFIED Requirements

### Requirement: Headless 绘制会话

StageInteractionController MUST 通过普通数据 context、event、snapshot 与 effect 支持 draw preview 和
`drawing.commit`，不得读取 Registry、Renderer props、React 或 DOM。绘制 geometry MUST 在世界坐标中
规范化，pointermove MUST 不 dispatch，pointerup MUST 最多请求一个 commit effect，取消 MUST 丢弃 preview。

绘制的**起点与终点 MUST 各自吸附**，且 MUST 复用 resize 的同一套规则：智能候选优先、无候选时
回退网格、按住 Cmd 时整体禁用。只吸附终点 MUST NOT 视为满足本项——起点不吸附时宽高同样不是
网格倍数。吸附 MUST 发生在 Shift 等长宽约束之前，使约束后的正方形/正圆边长仍是网格倍数。吸附生效时绘制
终点角 MUST 落在吸附结果上而不是光标裸坐标上——这与 resize 的既有行为一致：光标只是引导，
被拖动的那条边落在网格线或智能候选上。

#### Scenario: 绘制 preview 与提交

- **WHEN** draw tool 从 surface 开始拖拽并正常松手
- **THEN** snapshot 在拖拽中发布预览 bounds，松手时发出包含 tool、bounds 与合法 parent 命中的 commit effect
- **AND** Engine 不创建 Entity 或读取 Preset 内容

#### Scenario: 绘制吸附到网格

- **WHEN** 网格吸附开启（步进 8），用户在缩放不是 100% 的视口里拖出一个矩形，
  起止世界坐标都不是 8 的倍数
- **THEN** preview 与 `drawing.commit` 的 bounds 四条边都落在 8 的倍数上，宽高因此也是 8 的倍数

#### Scenario: 绘制吸附到智能候选

- **WHEN** 绘制终点落在某个既有节点边线的吸附阈值内
- **THEN** 该轴吸附到这条边线而不是网格，并发布对应的吸附参考线

#### Scenario: Cmd 临时禁用绘制吸附

- **WHEN** 用户按住 Cmd 绘制
- **THEN** 起点与终点都不吸附，bounds 为原始世界坐标

#### Scenario: Shift 锁定正方形与正圆

- **WHEN** 用户使用 rectangle 或 circle 工具拖拽，并在 pointermove 与 pointerup 时按住 Shift
- **THEN** preview 与 `drawing.commit` MUST 使用相同的等宽高 bounds，**吸附后的落点** MUST 保持为
  绘制终点角（吸附生效时该角落在网格线上而不是光标裸坐标上，与 resize 一致），负向拖拽仍保持正确象限
- **AND** 约束只存在于 Headless Engine；松开 Shift 后恢复常规矩形或椭圆 bounds

#### Scenario: 绘制被取消

- **WHEN** draw gesture 收到 Escape、pointercancel、window blur 或失去有效 pointer capture
- **THEN** draw preview 被清理且不存在 commit 或 command dispatch effect

## ADDED Requirements

### Requirement: 手势几何写入的精度上限

`toComposeTransform` 是 Stage 几何写回文档的唯一转换入口，它 MUST 把 position、size 与 rotation
量化到统一的几何精度（2 位小数）。

该量化的目的是掐掉浮点残渣：世界坐标由 `(屏幕 - 视口) / zoom` 得到，非整数 zoom 会留下
`82.96874999999991` 这类 14 位尾数，它既不是用户的输入也不是有意义的精度。对于父级缩放传导到
子级、旋转后的 AABB 这类**真正无法避免小数**的路径，量化 MUST 保证结果是一个确定的 2 位小数。

量化 MUST NOT 作用于布局求解结果：Yoga 解出的 box 与 Hug 的文字测量宽度本就是真实小数，
且不进入文档。

#### Scenario: 掐掉浮点残渣

- **WHEN** 一次手势得到的世界坐标为 `82.96874999999991`
- **THEN** 写进文档的值为 `82.97`

#### Scenario: 已经是整数的值不变

- **WHEN** 一次吸附后的手势得到的世界坐标为 `80`
- **THEN** 写进文档的值仍为 `80`，MUST NOT 变成 `80.00` 之类的字符串或引入误差
