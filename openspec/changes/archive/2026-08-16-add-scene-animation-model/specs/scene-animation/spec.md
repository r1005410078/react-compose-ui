## ADDED Requirements

### Requirement: 独立场景动画包

系统 MUST 提供 `@compose-ui/animation` 包，无 React、无 DOM，只依赖 `@compose-ui/core`。
包 MUST 承载 `Animation` ECS Component 协议、轨道与关键帧类型、插值与采样、运动路径几何、
动画校验与全部动画命令 handler。包 MUST NOT 依赖 `editor`、`stage`、`preview`、
`animation-panel` 或任何 UI Context。

#### Scenario: 包边界

- **WHEN** 检查包的依赖声明
- **THEN** 运行时依赖只有 `@compose-ui/core`
- **AND** 源码中不出现 React、DOM 或浏览器 API

### Requirement: Entity 动画 Component

被动画的 Entity MUST 通过 PascalCase 的 `Animation` Component 承载自己的关键帧轨道，
轨道按所属动画 ID 分组。一条轨道 MUST 以相对 Entity 的属性路径标识被动画的属性，并声明
`valueKind` 为 `number`、`vector2` 或 `color` 之一。轨道 MUST NOT 冗余保存 `entityId`，
也 MUST NOT 拥有独立于路径的标识——同一动画分组内路径即唯一键。
关键帧 MUST 按 `timeMs` 升序排列且同一时间点至多一个。

#### Scenario: 动画数据随 Entity 复制

- **WHEN** 用户复制粘贴一个带 `Animation` Component 的 Entity
- **THEN** 新 Entity 携带同样的轨道与关键帧，不需要任何额外搬迁逻辑

#### Scenario: 删除 Entity 一并移除其动画

- **WHEN** 用户删除一个带 `Animation` Component 的 Entity 后撤销
- **THEN** 删除时该 Entity 的动画随之消失，撤销后完整恢复

#### Scenario: 位置轨道是单条 vector2 轨道

- **WHEN** 为 Entity 的 `['LayoutItem','offset']` 建立轨道
- **THEN** 该轨道的 `valueKind` 为 `vector2`，每个关键帧的 `value` 是 `{ x, y }`
- **AND** 空间切线作为该关键帧自身的 `spatial` 字段存在，不需要第二条轨道承载

#### Scenario: 关键帧携带出向插值

- **WHEN** 读取任意关键帧的 `interpolation`
- **THEN** 它描述该帧到下一帧之间的插值，取值为 `hold`、`linear` 或带四元控制点的 `cubic`
- **AND** 轨道最后一个关键帧的 `interpolation` 仍然存在但不参与求值

### Requirement: 动画数据校验

包 MUST 导出对整份文档的动画校验入口，并以稳定机器码报告问题。校验 MUST 覆盖轨道路径非空、
同一动画分组内路径不重复、关键帧时间在所属动画 `[0, durationMs]` 内、同一轨道内关键帧时间
不重复且升序、关键帧值形状与 `valueKind` 一致、插值与空间切线形状合法，以及 Component 中
存在文档清单里没有的动画分组。命令 handler MUST 在写入前校验自己的输入并拒绝非法命令。
采样器遇到非法数据 MUST 静默跳过而不是抛错。

#### Scenario: 同一轨道出现重复时间

- **WHEN** 一条轨道内两个关键帧的 `timeMs` 相同
- **THEN** 校验报告 `keyframe.duplicate-time`，问题路径定位到该 Entity 该轨道

#### Scenario: 关键帧值与 valueKind 不符

- **WHEN** 一条 `valueKind: 'number'` 的轨道里出现值为 `{ x, y }` 的关键帧
- **THEN** 校验报告 `keyframe.value-kind-mismatch`

#### Scenario: 关键帧超出动画时长

- **WHEN** 关键帧的 `timeMs` 为负数或大于所属动画的 `durationMs`
- **THEN** 校验报告 `keyframe.out-of-range`

#### Scenario: 悬空动画分组

- **WHEN** 某 Entity 的 `Animation` Component 中存在文档清单里不存在的动画 ID 分组
- **THEN** 校验报告悬空分组，但采样与命令不因此失败

#### Scenario: 坏数据不让采样崩溃

- **WHEN** 对一份含非法关键帧值的文档在任意时刻采样
- **THEN** 该轨道被跳过，其余轨道正常求值，且不抛出异常

### Requirement: 动画采样器

包 MUST 提供纯函数采样器，在给定毫秒位置求值单条轨道，并把整条动画在该时刻的全部采样值
套用到文档上返回新文档。采样 MUST 遵守 `hold` 保持前值、`linear` 线性、
`cubic` 按 `cubic-bezier` 重映射时间三种语义；播放头位于首帧之前或末帧之后时 MUST 钳制到端点值。
套用结果中未被任何轨道命中的 Entity MUST 保持原对象引用。

#### Scenario: hold 插值在段内保持前值

- **WHEN** 轨道在 0 ms 有值 `0` 且插值为 `hold`，在 100 ms 有值 `10`
- **THEN** 在 50 ms 与 99 ms 求值都得到 `0`
- **AND** 在 100 ms 求值得到 `10`

#### Scenario: 播放头超出关键帧范围

- **WHEN** 轨道首帧在 100 ms、末帧在 300 ms，播放头在 0 ms 或 500 ms
- **THEN** 分别返回首帧值和末帧值，而不是外推

#### Scenario: 颜色按分量插值

- **WHEN** 一条 `color` 轨道从 `#000000FF` 线性过渡到 `#FFFFFF00`
- **THEN** 在中点求值得到红绿蓝分量与 alpha 都取中间值的颜色

#### Scenario: 未被动画的 Entity 保持引用相等

- **WHEN** 文档有 10 个 Entity，动画只命中其中 1 个，在任意时刻套用动画
- **THEN** 另外 9 个 Entity 在结果文档中与输入文档是同一个对象引用

### Requirement: 运动路径几何求值

包 MUST 能把一条 `vector2` 轨道求值为运动路径几何，输出关键帧顶点、每个顶点的入向与出向切线
端点、按弧长采样的折线，以及体现速度快慢的等时采样点。相邻关键帧任一端为 `smooth` 时，
路径段 MUST 按三次贝塞尔求值，控制点为起点加出向切线与终点加入向切线；
两端都是 `corner` 时 MUST 退化为直线段。

#### Scenario: corner 顶点之间是直线

- **WHEN** 两个相邻关键帧的 `spatial` 缺省或 `mode` 均为 `corner`
- **THEN** 该段折线只包含两个端点，等时采样点均匀分布在直线上

#### Scenario: smooth 顶点产生弯曲路径

- **WHEN** 起点关键帧的 `spatial.mode` 为 `smooth` 且出向切线非零
- **THEN** 该段折线偏离两端连线，且偏离方向与出向切线一致

#### Scenario: 等时采样点疏密体现速度

- **WHEN** 一段使用 `cubic` 插值做缓入缓出
- **THEN** 等时采样点在段两端密集、中间稀疏

### Requirement: 动画编辑命令

包 MUST 提供可注入事务运行时的动画命令 handler，覆盖动画清单的创建、删除与配置，
关键帧的写入、删除、移动时间、设置插值与设置空间切线，以及轨道删除。所有命令 MUST 通过标准
`DocumentPatch` 修改文档，从而参与既有事务、撤销与重做。写入关键帧的命令 MUST 是 upsert：
目标 Entity 没有 `Animation` Component 时创建，目标轨道不存在时创建，目标时间已有关键帧时
替换其值。删除动画的命令 MUST 同时清理所有 Entity 上对应的分组。

#### Scenario: 首次打点自动建立 Component 与轨道

- **WHEN** 对一个尚无 `Animation` Component 的 Entity 属性派发关键帧写入命令
- **THEN** 该 Entity 新增 `Animation` Component，内含对应动画分组与一条绑定该路径的轨道
- **AND** 轨道包含一个位于命令时间的关键帧

#### Scenario: 同一时间再次打点替换值

- **WHEN** 对已有 200 ms 关键帧的轨道在 200 ms 再次派发写入命令
- **THEN** 该关键帧的值被替换，轨道关键帧数量不变

#### Scenario: 撤销打点恢复原文档

- **WHEN** 用户打了一个关键帧后撤销
- **THEN** 文档回到打点前的状态，若该次打点创建了 Component 则 Component 一并消失

#### Scenario: 移动关键帧到已占用时间被拒绝

- **WHEN** 把一个关键帧移动到同一轨道内另一个关键帧已占据的时间
- **THEN** 命令被拒绝并返回 `keyframe.duplicate-time`，文档不变

#### Scenario: 删除动画清理所有 Entity 分组

- **WHEN** 三个 Entity 都参与了某条动画，用户删除该动画
- **THEN** 文档清单中该条消失，三个 Entity 的 `Animation` Component 中对应分组一并移除
- **AND** 分组清空后 `Animation` Component 本身被移除，不留空壳
