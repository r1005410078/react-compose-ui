# layout-engine Specification

## Purpose
TBD - created by archiving change add-layout-runtime-v6. Update Purpose after archive.
## Requirements
### Requirement: 无 React 的增量 Layout Runtime

Layout Runtime MUST 接受 core measurement port，为 Hug leaf 安装同步 Yoga measure/baseline callback，
并在 port revision 变化时只 dirty 对应 leaf 与祖先。缺少结果或测量失败 MUST 使用 axis value 并产生
Snapshot diagnostic，不得抛弃其余布局。

#### Scenario: 异步测量完成后重排
- **WHEN** Hug leaf 首次使用 fallback，随后 measurement port 发布新的 ready revision
- **THEN** Runtime 重新测量受影响 leaf 并生成新 Snapshot revision
- **AND** 文档引用、TransactionRuntime 与历史保持不变

#### Scenario: 测量失败并恢复
- **WHEN** 自定义 measurer 抛错后输入或准备 revision 改变并返回合法尺寸
- **THEN** 首次 Snapshot 使用 fallback 与 diagnostic，后续 Snapshot 使用恢复尺寸并清除 diagnostic
- **AND** 其他未受影响子树不被重建

### Requirement: 确定的运行时状态

Runtime MUST 以 loading、ready 或 error 描述引擎状态，允许注入 loader，并在失败时保留明确错误而
不是生成旧 Transform fallback。

`ready` 状态里的文档与快照 MUST 是**同一次求解的一致对**，订阅方 MUST 能把它们直接配对使用。
导线解算 MUST 发生在这一对之内：先解布局、再按快照解算导线几何、再把导线自己的盒补回快照。
导线是绝对定位，改它的盒不影响任何其他 Entity 的求解，因此 MUST NOT 触发二次求解。

**求解 MUST NOT 分散到各个渲染入口**：导线解算既改文档又改快照，两者分头产出会让命中读到的盒
与渲染画出的几何差一帧，而这类偏差只在拖动符号的那一瞬出现、极难复现。Runtime 是唯一同时握有
两者的地方。

#### Scenario: Yoga 加载失败
- **WHEN** 注入的 engine loader 拒绝
- **THEN** Runtime 进入 error 并通知订阅方
- **AND** 不产生伪 Snapshot 或文档事务

#### Scenario: 导线随实例位置在同一对里更新
- **WHEN** 一个被导线绑定的实例改变位置后 Runtime 重新求解
- **THEN** `ready` 状态的文档里导线端点已落在端口新位置
- **AND** 同一状态的快照里导线的盒与该几何一致

### Requirement: Auto Layout 交叉轴拉伸继承

Layout Runtime MUST 让 Flow 子级的 `alignSelf: auto` 按标准 Flexbox 语义继承父级 `alignItems`，
包括交叉轴为 Hug 的子级——Hug 交叉轴 MUST 保持未设置（Yoga auto）状态，MUST NOT 无条件覆盖为
`flex-start` 或任何其他固定值。子级显式设置了非 `auto` 的 `alignSelf` 时 MUST 优先于父级
`alignItems` 生效，这是子级跳出父级拉伸的唯一途径，不需要额外的数据字段或级联写入。

#### Scenario: 父级拉伸时 Hug 子级跟随拉伸

- **WHEN** 容器 `alignItems` 为 `stretch`，其一个 Flow 子级交叉轴为 Hug 且 `alignSelf` 为 `auto`
- **THEN** 该子级交叉轴尺寸拉伸到容器可用空间
- **AND** 不需要修改该子级的 `LayoutItem` 数据即可生效

#### Scenario: 子级显式对齐方式优先于父级拉伸

- **WHEN** 容器 `alignItems` 为 `stretch`，其一个 Flow 子级显式设置 `alignSelf` 为 `flex-start`
- **THEN** 该子级按自身设置对齐，不拉伸
- **AND** 同容器内其他 `alignSelf` 为 `auto` 的子级仍正常拉伸

#### Scenario: 父级为非拉伸对齐时 Hug 子级保持内容尺寸

- **WHEN** 容器 `alignItems` 为 `flex-start`、`center` 或 `flex-end`，其一个 Flow 子级交叉轴为 Hug
  且 `alignSelf` 为 `auto`
- **THEN** 该子级交叉轴尺寸由内容决定，按父级对齐方式定位，不被拉伸

### Requirement: 手势期预览求解通道

Layout Runtime MUST 提供瞬态预览求解入口：宿主提交预览文档后 Runtime 发布带预览标记的
Snapshot；清除预览或收到下一次正式 `updateDocument` 时 MUST 回到最后一次正式提交的求解结果。
预览求解 MUST NOT 产生文档事务、MUST NOT 改变正式提交状态，Yoga 对象仍 MUST NOT 进入公共 API。

#### Scenario: 预览求解不污染提交态

- **WHEN** 宿主在 resize 手势期间提交预览文档并在取消时清除预览
- **THEN** 预览期间发布带预览标记的 Snapshot，清除后订阅方收到最后一次正式提交的 Snapshot
- **AND** TransactionRuntime 与历史全程无新增条目

#### Scenario: 正式提交隐式终止预览

- **WHEN** 预览生效期间到达一次正式 `updateDocument`
- **THEN** Runtime 按正式文档求解并发布不带预览标记的 Snapshot
- **AND** 此前的预览状态被丢弃

### Requirement: 增量重解性能

Runtime 重新求解时 MUST 跳过对象引用未变且父级 Layout 未变的 Entity 的样式重写与重新测量，
measurement 结果 MUST 按输入缓存（port revision 失效仍走既有失效路径），单次重解成本 MUST 与
变更子树规模成正比而不是文档 Entity 总量。发布 Snapshot 时对值未变的 box MUST 复用上一
Snapshot 的对象，使订阅方的相等性检查生效。

#### Scenario: 单节点变更不重写全树样式

- **WHEN** 提交的新文档中只有一个 Entity 及其祖先链的对象引用发生变化
- **THEN** 引用未变的 Entity 不经历样式重写，也不重新调用 measurement port
- **AND** 求解结果与全量重写路径一致

#### Scenario: 未变化 box 保持引用相等

- **WHEN** 一次重解后某 Entity 的布局结果数值与上一 Snapshot 相同
- **THEN** 新 Snapshot 中该 Entity 的 box 与上一 Snapshot 是同一对象
- **AND** 数值变化的 box 仍产生新的冻结对象

### Requirement: 网格容器的预解算

Layout Runtime MUST 为每个 `type: 'grid'` 的容器把格坐标解成绝对矩形：读容器的 Layout 与各
Flow 子级的 `GridItem`，经 core 的网格求解器算出每个子级相对容器内容盒的绝对矩形，再把该子级
作为**绝对定位**节点喂给 Yoga（显式 position 与 width / height）。

列宽 MUST 由容器**内容盒**宽度推出（已扣除边框与内边距），因此这一步 MUST 排在容器自身尺寸
可知之后——也就是排在一趟 Yoga 求解**之后**，而不是写样式之前。

**MUST 迭代到稳定，MUST NOT 固定只跑一趟。**一趟不够的是**嵌套网格**：内层容器的列宽要按它
自己的内容宽算，而它作为格中子级根本没有轴尺寸——那个宽度要等外层把格矩形写进去、再求解一次
才存在。只跑一趟时内层读到的宽度是 0，十二列全塌成 0 宽，屏幕上是一排只剩间距的细条，而且
改跨度不起任何作用（每一格都是 0 宽）。这个缺陷在单层网格上完全看不出来：单层里容器的宽度
在第一趟求解之后就已经成立。

收敛判据 MUST 是「这一趟写入的值与上一趟不同」，MUST NOT 是「这一趟写了东西」——后者恒为真，
循环永不终止。趟数 MUST 有上界：一个没有上界的循环在数值恰好来回摆动时会挂死整个编辑器。
每多一层嵌套多要一趟，再加一趟确认不再变化。

容器为 Hug 时其内容高度 MUST 取网格解算出的总行高（含行间距与内边距）。**容器自己也是格中
子级时 MUST NOT 写回 Hug 高度**：那一档它的盒**就是**外层给它的格矩形，两边都写会让两个高度
在相邻两趟里互相覆盖，收敛循环因此停不下来。

格中子级的 `LayoutItem.width` / `height` MUST NOT 参与求解——盒就是格矩形。其 `mode` 取值
MUST 被忽略而不是拒绝：切换布局类型是一次编辑，中间态不应让求解失败。

Snapshot 的 box MUST 与 flex 子级同形，订阅方 MUST NOT 需要区分两者。Yoga 对象仍
MUST NOT 进入公共 API。

#### Scenario: 格坐标解成绝对矩形

- **WHEN** 一个 12 列、行高 48、间距 6 的网格容器里有一张 `{x: 4, y: 0, w: 4, h: 2}` 的卡
- **THEN** Snapshot 里该卡的 box 左边等于内容盒左边加四个列步长，高度等于两行加一个行间距
- **AND** 该 box 与 flex 子级的 box 在结构上没有区别

#### Scenario: Hug 容器的高度由行数决定

- **WHEN** 网格容器高度为 Hug，其中最下面一张卡占到第 5 行
- **THEN** 容器内容高度等于 6 行加 5 个行间距
- **AND** 卡片被删除导致行数减少时，容器在下一次求解后收缩

#### Scenario: 忽略格中子级的轴尺寸模式

- **WHEN** 格中子级的 `LayoutItem.width.mode` 是 `fill` 或 `hug`
- **THEN** 求解仍按格矩形给出盒，不产生诊断也不失败

#### Scenario: 容器变宽时列宽跟着变

- **WHEN** 网格容器的宽度从 752 改为 900，列数与行高不变
- **THEN** 每张卡的宽度按新列宽重新解出，格坐标与行高不变

#### Scenario: 嵌套网格按外层排出来的宽度分列

- **WHEN** 一个网格容器本身是外层网格的子级，它的格矩形宽 6 列
- **THEN** 它内部的卡片按**那个宽度**推出的列宽解出，而不是按它 `LayoutItem` 上与网格无关的
  固定值
- **AND** 卡片的宽度明显大于「每格 0 宽时只剩间距」的那个退化值

#### Scenario: 三层嵌套逐层按真实宽度分列

- **WHEN** 网格容器嵌套三层，每层的格矩形都比外一层窄
- **THEN** 每一层的列宽都按它上一层排出来的宽度推出
- **AND** 最内层的卡片没有塌成只剩间距的细条

