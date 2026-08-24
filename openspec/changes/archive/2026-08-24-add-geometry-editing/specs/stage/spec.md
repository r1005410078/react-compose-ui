# stage 规范增量

## ADDED Requirements

### Requirement: 曲线几何编辑会话

`ComposeStage` MUST 提供曲线的几何编辑会话：select 工具下双击一个带 `Curve` 的未锁定 Entity
MUST 进入该会话，`Escape`、在空白处按下、切换工具或选中别的 Entity MUST 退出。会话状态 MUST
住在 Stage 自己这里，与画布内文字编辑同构；宿主 MUST NOT 需要为进入或退出接线。

会话期间 MUST 显示该 Entity 的夹点，并 MUST 复用既有的可编辑路径覆盖层与路径手势通道，
MUST NOT 另写一套顶点渲染或拖拽。

会话期间 MUST NOT 为该 Entity 显示任何 Resize 或旋转手柄。盒的角手柄与角顶点几乎压在同一个
像素上，两个含义叠在一起谁也点不准。该抑制与文字编辑那条是同构的两条独立规则。

会话期间 MUST 绘制十字光标并收走系统光标，判定 MUST 与绘图命令取点期间共用同一个解析结果。

拖动夹点 MUST 先经与绘图命令**同一条**落点解算（特征点捕捉、正交、网格），移动阶段 MUST 只
更新本地预览，结束阶段 MUST 派发一条 `entity.curve.set`。落点越出当前盒时 MUST NOT 钳制——
盒与几何由该命令重新归一化，撤销一步 MUST 回到原几何。

会话期间，正在编辑的那个 Entity MUST NOT 参与特征点捕捉：它自己的端点就在指针底下，不排除
的话夹点会被吸回原处，用户要把指针拖出容差半径才动得了。悬停的捕捉标记与落点解算 MUST 读
同一份排除表，否则会出现「标记在这里、点落在那里」。

曲线绘制手势结束后 MUST 直接进入该 Entity 的几何编辑会话。绘图**命令**产出的 Entity
MUST NOT 自动进入：命令仍握着光标与提示，两个正在取点的东西叠在一起会让 `Escape` 的含义
说不清。

宿主传入 `editablePath` 时 MUST NOT 进入几何编辑会话：覆盖层至多渲染一条路径，而两条路径
指向不同的事实。

#### Scenario: 双击曲线进入并显示夹点

- **WHEN** select 工具下双击一条未锁定的直线曲线
- **THEN** 图面显示它的两个端点夹点
- **AND** 该 Entity 的 Resize 与旋转手柄都不显示

#### Scenario: 拖端点把轴对齐的线掰成斜的

- **WHEN** 在非 100% 缩放下双击一条水平直线，把它的一个端点拖到另一个高度并松手
- **THEN** 文档里该曲线的两个端点不再等高
- **AND** 只产生一条可撤销记录，撤销后回到水平

#### Scenario: 拖夹点时不被自己吸住

- **WHEN** 拖动一个夹点，指针仍在该夹点的捕捉容差之内
- **THEN** 落点跟着指针走，不被该曲线自己的端点吸回原处

#### Scenario: 退出会话恢复手柄

- **WHEN** 几何编辑会话中按下 `Escape`
- **THEN** 夹点消失，该 Entity 按其 TransformConstraints 恢复显示手柄

#### Scenario: 画完曲线停在几何编辑里

- **WHEN** 用曲线绘制工具拖出一条新曲线并松手
- **THEN** 新 Entity 被选中并处于几何编辑会话，图面显示它的夹点

#### Scenario: 宿主运动路径优先

- **WHEN** 宿主已传入 `editablePath`，用户双击一条曲线
- **THEN** 不进入几何编辑会话，图面仍只渲染宿主那条路径

## MODIFIED Requirements

### Requirement: 按约束显示变换手柄

Stage MUST 仅为允许编辑的选区显示对应手柄：free 显示八向，preserve-aspect 显示四角，
horizontal 显示 E/W，vertical 显示 N/S，none 不显示 Resize；rotatable 为 false 时不显示旋转。

处于画布内文字编辑会话时，Stage MUST NOT 为编辑目标显示任何 Resize 或旋转手柄，改为只显示单一
编辑边框以区别于普通选中态。处于曲线几何编辑会话时同样 MUST NOT 显示，改为显示该曲线的夹点。
这三条抑制与 TransformConstraints 的抑制是彼此独立的规则，叠加生效。

边缘命中区两端为角手柄让出的空间 MUST 随可用长度收缩并至少保留 8px 可抓长度：固定让位会让十几
像素高的选区把 E/W 命中区算成零高度，边根本抓不住。

#### Scenario: 动态切换几何限制

- **WHEN** Inspector 修改 TransformConstraints
- **THEN** Stage 手柄和直接操作立即同步
- **AND** 禁用但仍可选择的 Entity 保留选择框

#### Scenario: 短选区的边缘命中区仍可抓取

- **WHEN** 选区高度只有十几像素
- **THEN** E/W 边缘命中区仍保留可抓长度，不会被让位挤成零高度
- **AND** 足够长的选区仍为角手柄让出两端 8px

#### Scenario: 编辑态不显示变换手柄

- **WHEN** 一个 free 约束的文字 Entity 进入画布内编辑会话
- **THEN** 八向手柄与旋转手柄都不显示，只显示编辑边框
- **AND** 退出编辑后按其 TransformConstraints 恢复显示手柄

#### Scenario: 几何编辑态不显示变换手柄

- **WHEN** 一条 free 约束的曲线进入几何编辑会话
- **THEN** 八向手柄与旋转手柄都不显示，改为显示它的夹点
- **AND** 退出后按其 TransformConstraints 恢复显示手柄

### Requirement: 画布可编辑路径覆盖层

`ComposeStage` MUST 支持可选的 `editablePath` 世界坐标几何，并在 Overlay 中渲染虚线轨迹、
体现速度快慢的等时采样点、切线连杆与手柄，以及关键帧顶点标记。路径层 MUST 渲染在选区
变换手柄之上——关键帧顶点常与对象角点重合，压在手柄之下将无法拖动；吸附参考线等瞬时
反馈仍保持最上层。切线手柄 MUST 只在 `smooth` 顶点或当前活动顶点上显示。手柄的命中区
MUST 独立于可见尺寸放大。

覆盖层 MUST 至多渲染一条路径。Stage 自己的曲线几何编辑会话 MUST 经由同一层渲染夹点，
而 MUST NOT 另立一层；宿主传入的路径 MUST 优先，此时 MUST NOT 进入几何编辑会话。

宿主省略 `editablePath` 且没有几何编辑会话时，Stage 外观与行为 MUST 完全不变。

#### Scenario: 显示轨迹与速度

- **WHEN** 宿主传入一条包含缓入缓出段的可编辑路径
- **THEN** 画布显示连接各顶点的虚线轨迹
- **AND** 等时采样点在段两端密集、中间稀疏

#### Scenario: 切线手柄的显示条件

- **WHEN** 路径包含 `corner` 与 `smooth` 两种顶点且没有活动顶点
- **THEN** 只有 `smooth` 顶点显示切线连杆与手柄
- **WHEN** 宿主把某个 `corner` 顶点标记为活动
- **THEN** 该顶点也显示切线手柄

#### Scenario: 未传入路径且不在几何编辑时不变

- **WHEN** 宿主不传 `editablePath`，也没有几何编辑会话
- **THEN** Overlay 不渲染任何路径元素

### Requirement: 画布路径编辑手势上报

`ComposeStage` MUST 把路径顶点与切线手柄的拖动结果以带阶段的世界坐标回调上报给宿主，
并 MUST 提供顶点双击切换回调。**宿主传入的**路径几何，其事实来源始终在宿主，Stage
MUST NOT 为它派发任何编辑命令。

这条约束 MUST NOT 被读成「一切顶点拖动都由宿主写入」：它成立的理由是运动路径的事实是关键帧，
Stage 不认识那套协议。曲线几何就是文档本身，因此 Stage 自己的几何编辑会话 MUST 直接派发
`entity.curve.set`，与它为 resize、move 与绘制派发命令一致。

#### Scenario: 拖动顶点上报世界坐标

- **WHEN** 用户拖动一个宿主传入路径的顶点并松手
- **THEN** 宿主收到该顶点的开始、移动与结束回调，结束回调携带最终世界坐标
- **AND** Stage 自身没有修改文档

#### Scenario: 双击顶点上报切换

- **WHEN** 用户双击一个宿主传入路径的顶点
- **THEN** 宿主收到该顶点的切换回调

#### Scenario: Shift 修饰键随手势上报

- **WHEN** 用户按住 Shift 拖动切线手柄
- **THEN** 每次移动回调都带有 Shift 已按下的修饰键状态

#### Scenario: 几何编辑的夹点由 Stage 写入

- **WHEN** 用户在几何编辑会话里拖动一个夹点并松手
- **THEN** Stage 派发一条 `entity.curve.set`
- **AND** 宿主没有收到路径编辑回调
