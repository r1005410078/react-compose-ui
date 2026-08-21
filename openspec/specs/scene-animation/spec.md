# scene-animation Specification

## Purpose
TBD - created by archiving change add-scene-animation-model. Update Purpose after archive.
## Requirements
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

#### Scenario: 关键帧值与 valueKind 不符

- **WHEN** 一条 `valueKind: 'number'` 的轨道里出现值为 `{ x, y }` 的关键帧
- **THEN** 校验报告 `keyframe.value-kind-mismatch`

#### Scenario: 关键帧超出动画时长

- **WHEN** 关键帧的 `timeMs` 为负数或大于所属动画的 `durationMs`
- **THEN** 校验报告 `keyframe.out-of-range`

#### Scenario: 悬空动画分组

- **WHEN** Entity 的 `Animation` 引用了其所属 Frame `Animations` 清单中不存在的分组 id
- **THEN** 校验报告悬空分组并定位到该 Entity 与分组 id，但采样与命令不因此失败

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

### Requirement: 动画文件格式

`@compose-ui/animation` MUST 提供 Compose Animation 文件协议：文件只包含动画清单与
变量绑定（id、名称、时长、播放模式、bindings），MUST NOT 包含关键帧轨道——轨道仍存放
在被动画 Entity 的 `Animation` Component 上。文件 MUST 按**所属根 Frame** 分区承载清单，
分区键 MUST 是该 Frame 的 Entity id；一份文件 MAY 只承载一块场景的分区（编辑器默认的
一场景一文件），也 MAY 承载多块场景的分区（既有共享文件），两种形态 MUST 遵守同一套
解析、校验与序列化规则。
包 MUST 导出文件后缀与 media type 常量、按名称后缀识别动画文件的谓词、issue 式解析入口、
序列化入口与默认文件构造器；解析 MUST 拒绝未知版本、非法形状与非法清单并报告结构化 issue，
序列化与解析 MUST 可无损往返。文件版本 MUST 升到 2，并 MUST 提供 1→2 的显式单向迁移：
把单条清单放进该页面激活 Frame 的分区。动画文件是静态权威：宿主打开页面时把各分区水合进
对应 Frame 的 `Animations.items` 会话镜像，保存时把各镜像的变化回写其绑定的文件；本协议保持
无 React、无 DOM，仅依赖 core。

#### Scenario: 序列化与解析往返

- **WHEN** 宿主用多块场景的清单与绑定构造动画文件并序列化后再解析
- **THEN** 解析结果与原始清单逐字段相等且没有 issue
- **AND** 每条清单仍归属于原来的那个 Frame 分区

#### Scenario: 单场景文件同样合法

- **WHEN** 宿主构造只含一块场景分区的动画文件并序列化后再解析
- **THEN** 解析成功且该分区清单逐字段相等，不产生任何 issue

#### Scenario: 拒绝非法动画文件

- **WHEN** 解析入口收到未知版本、缺失清单或清单字段非法的内容
- **THEN** 返回结构化 issue 而不抛出异常，也不产生部分解析结果

#### Scenario: 按名称识别动画文件

- **WHEN** 宿主用文件名谓词过滤资源目录
- **THEN** 只有携带动画文件后缀的条目被识别为动画文件，无需 Provider 理解 media type

#### Scenario: 动画文件 1 到 2 显式迁移

- **WHEN** 宿主对只含单条 `animation` 的 v1 动画文件执行显式迁移，并给出目标 Frame id
- **THEN** 得到 version 2 文件，原清单出现在该 Frame 的分区里
- **AND** 普通解析对 v1 文件返回结构化 issue，且迁移不修改输入

#### Scenario: 只取目标场景的分区

- **WHEN** 预览或发布以某一块场景为目标渲染
- **THEN** 只有该 Frame 分区的清单参与播放
- **AND** 同一文件中其他场景的清单不影响该次渲染

### Requirement: Frame 动画关联写入

Frame MUST 支持可选的动画稳定资源引用：`Animations.source` 保存 providerId、assetKey 与
scope。解析 MUST 容忍字段缺失并归一化为 null，非 null 时 MUST 校验引用形状。多个 Frame
MAY 持有指向同一个文件的引用；宿主 MUST 能以关联、更换和解除三种操作原子改写**单个 Frame**
的引用，且 MUST NOT 因此改动其他 Frame 的引用。实现 MUST NOT 解析动画文件内容、
MUST NOT 根据文件名隐式猜测动画关系，也 MUST NOT 因解除引用自动删除动画资源。

`Animations.source` 是**文档状态**，因此 `@compose-ui/animation` MUST 提供一条改写它的文档
命令，使关联/更换/解除成为普通可撤销事务并立即对运行时文档生效。该命令 MUST 保留同一
Component 上的 `items`——`Animations` 整体写入，只写一半就会丢掉另一半。宿主 MUST NOT 要求
目标 Frame 已经存在于**上次保存**的页面文件中：刚创建、尚未保存的场景 MUST 同样可以绑定。

#### Scenario: 旧文档容缺解析

- **WHEN** 解析一个 `Animations` 不含 `source` 的既有文档
- **THEN** 解析成功且动画引用归一化为 null，清单与轨道不受影响

#### Scenario: 关联稳定动画引用

- **WHEN** 宿主把一个可引用动画文件关联到某个 Frame
- **THEN** `Animations.source` 写入其 providerId、assetKey 与持久性 scope
- **AND** 动画文件随后重命名或移动不改变该关联

#### Scenario: 解除动画不删除资源

- **WHEN** 用户解除某 Frame 当前的动画引用
- **THEN** `Animations.source` 被清空且轨道保持不变
- **AND** 原动画文件仍由 Asset Provider 保留

#### Scenario: 绑定写入保留清单

- **WHEN** 对一个已有清单的 Frame 关联或解除动画文件
- **THEN** 该 Frame 的 `Animations.items` 逐条保持不变

#### Scenario: 绑定可撤销

- **WHEN** 用户关联一个动画文件后撤销
- **THEN** `Animations.source` 回到关联前的值
- **AND** 动画文件资源不被删除

