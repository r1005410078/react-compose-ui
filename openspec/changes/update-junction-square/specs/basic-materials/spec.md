## MODIFIED Requirements

### Requirement: junction Preset 是接线节点

Materials MUST 发布 `junction` Entity Preset，作为 `curve` 物料的**第五个起点**：它 MUST 组合
`Curve`（四顶点的闭合多段线，即填满盒的方块）、填实的 `Appearance.backgroundPaint`，以及一个
`Ports`——单个端口，位置在盒心。

**方块而不是圆点是一条画法上的决定**：圆点是 KiCad 与多数原理图工具的画法，方块是端子类符号的
画法。判据在领域里而不在代码里，因此这里只记结果。代价记在明处：`vertex` 夹点也是方块——两者不会
落在同一个对象上（接线点进不了几何编辑会话），且一个是墨、一个是 chrome，但这是一处同形。换回圆
则会与取点期间显现的**端口记号**（实心小圆）同形，而接线点自己的端口就在它的盒心。没有一种形状
是白拿的。

MUST NOT 为它注册第二个 Renderer 类型。整圆是扫掠 360 的弧、矩形是四顶点的闭合多段线，这是同一
条判断的第三次应用：另立类型会让归一化、平移、距离、特征点、渲染与校验六条路径各多一支逐字相同
的实现。**这条判断同时说明换形状不欠这六条路径任何东西**——两种形状都在它的允许集里。

**身份 MUST 由 `Composition.presetId` 承担，MUST NOT 按几何反推**：一个被填实的小方块与用户自己
画的一个实心小矩形在几何上一模一样，而后者要的确实是一个矩形。这与圆角手柄的判据同源。推论：
MUST NOT 按**渲染出来的元素标签**认接线点——那是几何的派生物，不是身份。

默认边长 MUST 由导线线宽推出（约 3 倍），MUST NOT 是一个与线宽无关的绝对值：线粗了而点没跟着粗，
点就被线盖住。

**尺寸因此不是作者的意图，接线点 MUST 声明 `GeometryConstraints`**：`resize: 'none'`、
`rotatable: false`、`movable: true`。一个由别处推出来的量不该配八个手柄——鼠标动得了却没有意义的
控件比没有更糟。**转它同样不该给**：形状与尺寸同源，都不是作者写下的；而一个转过 45° 的接线点在
图上读作菱形，那是另一个符号。挪 MUST 保留：挪接头是接线图上的常规操作。

这条 MUST NOT 被读成「曲线又关掉 resize 了」。曲线的盒自由是已经定下来的决定（几何按 `viewBox`
与盒的比例呈现），其余四个起点一个字节不变。接线点不同的地方有两处：它的尺寸由导线线宽推出而不是
由用户写下，以及改它会**静默**弄坏绑定的落点（见下一条）。

**接线点的端口 MUST 恒在盒心。**这条不变量由「盒改不了」推出而不是另外声明：`Ports.position` 是
Entity 局部坐标、建出来时写成 `{size/2, size/2}`，而端口读取不按盒缩放——盒一旦被改，方块的视觉
中心就与三条支路汇聚的那个点分家，而两者在屏幕上逐像素相同，直到用户挪一下符号才现形。放开
`resize` 的人 MUST 同时回答端口怎么跟。

默认填色 MUST 取自接入时那条导线的 `stroke`，因此红色一次回路上是红方块。这是接入那一刻的一份
**快照**，此后 MUST NOT 跟随导线改变——做成跟随会让同一份事实有两处来源，而节点可能连着颜色各不
相同的支路。

`junction` MUST 默认隐藏于 Palette：从 Palette 拖出来的节点不连着任何导线，而一个不表达任何连接的
实心块读不出意图。默认隐藏 MUST 只影响 Palette 呈现，MUST NOT 影响 Registry 注册、接入命令产出或
文档反序列化。

#### Scenario: 节点与导线共用同一个 Renderer

- **WHEN** Registry 从 Wire Preset 与 junction Preset 各创建一个 seed
- **THEN** 两者的 Renderer 类型相同，且都带 `Curve` Component
- **AND** Registry 中不存在专为节点注册的 Renderer 类型

#### Scenario: 节点是填实的方块并带一个端口

- **WHEN** Registry 从 junction Preset 创建一个 seed
- **THEN** 它的 `Curve` 是闭合的四顶点多段线，四个顶点就是盒的四个角
- **AND** 它的 `Appearance.backgroundPaint` 是不透明填色
- **AND** 它的 `Ports.items` 恰好有一项，位置在盒心

#### Scenario: 接线点改不了尺寸也转不了

- **WHEN** 选中一个接线点并尝试改它的尺寸或旋转
- **THEN** 操作被拒绝，几何不变
- **AND** 移动它照常生效

#### Scenario: 其余四个曲线起点照旧自由

- **WHEN** 选中一条普通曲线、箭头、圆或矩形并改尺寸
- **THEN** 照常生效——本条只作用于接线点

#### Scenario: 边长跟着线宽

- **WHEN** 以两种不同线宽的导线各接出一个节点
- **THEN** 线宽大的那个节点边长更大

#### Scenario: 默认不出现在 Palette

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** junction 不出现在 Palette 中
- **AND** 它仍可由接入命令与 Registry API 正常创建
