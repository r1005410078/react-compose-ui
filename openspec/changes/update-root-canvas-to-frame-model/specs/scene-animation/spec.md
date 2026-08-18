## ADDED Requirements

### Requirement: 动画清单归属 Frame

`@compose-ui/animation` MUST 把动画清单读写在 Frame Entity 的 `Animations` Component 上，
MUST NOT 依赖任何文档级 `animations` 字段。一条动画 MUST 只属于一个 Frame，其轨道 MUST 只能
寻址该 Frame 内、且不跨越任何嵌套 Frame 边界的 Entity。包 MUST 导出「给定 Entity 求其所属 Frame」
的纯函数供命令与校验共用。

#### Scenario: 组件 Frame 拥有独立动画

- **WHEN** 用户在组件文档的根 Frame 上创建动画并为其后代打关键帧
- **THEN** 清单写入该 Frame 的 `Animations`，轨道写入对应后代的 `Animation`
- **AND** 宿主页面的根 Frame 清单不发生任何变化

#### Scenario: 求 Entity 所属 Frame

- **WHEN** 对一个位于嵌套 Frame 内三层深处的 Entity 调用所属 Frame 求解
- **THEN** 返回最近的祖先 Frame，而不是文档的根 Frame

### Requirement: 嵌套 Frame 只暴露播放控制

宿主 Frame MUST NOT 对嵌套 Frame（组件实例、Page Slot）内部的 Entity 建立轨道或写入关键帧。
宿主对嵌套 Frame 的唯一动画能力 MUST 是播放控制：play、pause、seek 与播放模式。命令 handler
MUST 在写入前拒绝任何指向嵌套 Frame 内部的轨道命令，并返回稳定 issue。

#### Scenario: 拒绝对实例内部打关键帧

- **WHEN** 用户下钻进组件实例内部并尝试为某个内部 Entity 建立轨道
- **THEN** 命令被拒绝并返回稳定 issue
- **AND** 宿主文档与撤销历史不发生变化

#### Scenario: 控制嵌套播放

- **WHEN** 宿主对某个组件实例发出 seek 到 200 ms
- **THEN** 该实例内部按其自身动画在 200 ms 采样
- **AND** 宿主 Frame 的播放头不受影响

### Requirement: 跨 Frame 轨道重定位命令

`@compose-ui/animation` MUST 导出轨道重定位命令，把一个 Entity 及其后代携带的轨道从源 Frame
的动画分组搬迁到目标 Frame。命令 MUST 保持关键帧的 `timeMs`、值、插值与空间切线逐字段不变，
MUST 在目标 Frame 缺少对应动画时按源动画的名称、`durationMs` 与播放模式创建一条新动画，
并 MUST 在目标 Frame 已存在同名动画时要求宿主显式给出目标分组 id 而不是静默合并。命令 MUST
可与结构变更组成单个事务，并 MUST 在撤销时同时还原两侧 Frame 的清单与轨道。

#### Scenario: 搬迁到没有对应动画的 Frame

- **WHEN** 宿主把一个携带 `位置` 轨道的 Entity 从 Frame A 搬到 Frame B，B 没有同名动画
- **THEN** B 的 `Animations` 新增一条继承 A 源动画名称、时长与播放模式的动画，轨道挂在该分组下
- **AND** 关键帧的时间、值、插值与空间切线与搬迁前逐字段相同

#### Scenario: 目标存在同名动画时要求显式分组

- **WHEN** 目标 Frame 已存在与源动画同名的动画且宿主未指定目标分组 id
- **THEN** 命令返回稳定 issue 要求显式选择或新建分组
- **AND** 两侧 Frame 的清单与轨道均未被修改

#### Scenario: 搬迁与结构变更共享撤销

- **WHEN** 宿主把重定位命令与重设父级命令组成一个事务并撤销
- **THEN** Entity 归属、源 Frame 清单、目标 Frame 清单与全部轨道一并还原
- **AND** 撤销历史中只出现一个条目

## MODIFIED Requirements

### Requirement: 动画数据校验

包 MUST 导出对整份文档的动画校验入口，并以稳定机器码报告问题。校验 MUST 覆盖轨道路径非空、
同一动画分组内路径不重复、关键帧时间在所属动画 `[0, durationMs]` 内、同一轨道内关键帧时间
不重复且升序、关键帧值形状与 `valueKind` 一致、插值与空间切线形状合法、Entity 的动画分组存在于
其所属 Frame 的 `Animations` 清单中，以及轨道所属 Entity 与清单所属 Frame 之间不跨越任何嵌套
Frame 边界。命令 handler MUST 在写入前校验自己的输入并拒绝非法命令。采样器遇到非法数据 MUST
静默跳过而不是抛错。

#### Scenario: 同一轨道出现重复时间

- **WHEN** 一条轨道内两个关键帧的 `timeMs` 相同
- **THEN** 校验报告 `keyframe.duplicate-time`，问题路径定位到该 Entity 该轨道

#### Scenario: 轨道跨越 Frame 边界

- **WHEN** 某 Entity 被移动进一个嵌套 Frame，但其轨道仍属于外层 Frame 的动画分组
- **THEN** 校验报告稳定的跨 Frame issue，路径定位到该 Entity、该分组与边界 Frame
- **AND** 采样器跳过该轨道而不抛错

#### Scenario: 分组不在所属 Frame 清单中

- **WHEN** Entity 的 `Animation` 引用了其所属 Frame `Animations` 清单中不存在的分组 id
- **THEN** 校验报告稳定的孤立分组 issue 并定位到该 Entity 与分组 id
