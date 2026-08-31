## ADDED Requirements

### Requirement: junction Preset 是接线节点

Materials MUST 发布 `junction` Entity Preset，作为 `curve` 物料的**第五个起点**：它 MUST 组合
`Curve`（扫掠 360 的弧，即整圆）、填实的 `Appearance.backgroundPaint`，以及一个 `Ports`——单个
端口，位置在盒心。

MUST NOT 为它注册第二个 Renderer 类型。整圆是扫掠 360 的弧、矩形是四顶点的闭合多段线，这是同一
条判断的第三次应用：另立类型会让归一化、平移、距离、特征点、渲染与校验六条路径各多一支逐字相同
的实现。

**身份 MUST 由 `Composition.presetId` 承担，MUST NOT 按几何反推**：一个被填实的小整圆与用户自己
画的一个实心圆点在几何上一模一样，而后者要的确实是一个圆。这与圆角手柄的判据同源。

默认直径 MUST 由导线线宽推出（约 3 倍），MUST NOT 是一个与线宽无关的绝对值：线粗了而点没跟着粗，
点就被线盖住。

默认填色 MUST 取自接入时那条导线的 `stroke`，因此红色一次回路上是红点。这是接入那一刻的一份**快照**，
此后 MUST NOT 跟随导线改变——做成跟随会让同一份事实有两处来源，而节点可能连着颜色各不相同的支路。

`junction` MUST 默认隐藏于 Palette：从 Palette 拖出来的节点不连着任何导线，而一个不表达任何连接的
实心点读不出意图。默认隐藏 MUST 只影响 Palette 呈现，MUST NOT 影响 Registry 注册、接入命令产出或
文档反序列化。

#### Scenario: 节点与导线共用同一个 Renderer

- **WHEN** Registry 从 Wire Preset 与 junction Preset 各创建一个 seed
- **THEN** 两者的 Renderer 类型相同，且都带 `Curve` Component
- **AND** Registry 中不存在专为节点注册的 Renderer 类型

#### Scenario: 节点是填实的整圆并带一个端口

- **WHEN** Registry 从 junction Preset 创建一个 seed
- **THEN** 它的 `Curve` 是扫掠 360 的弧
- **AND** 它的 `Appearance.backgroundPaint` 是不透明填色
- **AND** 它的 `Ports.items` 恰好有一项，位置在盒心

#### Scenario: 直径跟着线宽

- **WHEN** 以两种不同线宽的导线各接出一个节点
- **THEN** 线宽大的那个节点直径更大

#### Scenario: 默认不出现在 Palette

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** junction 不出现在 Palette 中
- **AND** 它仍可由接入命令与 Registry API 正常创建
