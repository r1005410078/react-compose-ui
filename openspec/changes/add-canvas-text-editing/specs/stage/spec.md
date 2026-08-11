## ADDED Requirements

### Requirement: 画布内原地文字编辑

Stage MUST 为声明了原地文字编辑契约的 Entity 提供画布内编辑：编辑目标以其最终排版样式原地渲染为
可编辑文本，MUST NOT 用浮层输入控件替代——浮层的字形排版与最终渲染不是同一套，宽度对不上会让
所见即所得在编辑瞬间断掉。编辑目标 MUST 获得键盘焦点，并 MUST 在退出会话后把焦点交还 Stage surface。

以文字工具创建的文字 MUST 以空内容进入编辑，MUST NOT 保留 Preset 的占位文案——占位文案会逼用户
先全选删除再打字。

`draw-text` 的绘制预览 MUST 只显示一根与行高等高、落在按下点的光标，MUST NOT 显示占位文案、尺寸
标注或任何边框：文字只按点创建、尺寸由内容决定，边框会暗示一块用户控制不了的区域，尺寸标注会
暗示一个用户改不了的数字，而占位文案等于承诺一段并不会存在的内容——松手即消失，看起来就是闪了
一下。

编辑期间 Stage MUST NOT 发布任何文档事务。退出编辑时 Stage MUST 按内容收敛为最多一条可撤销事务：
内容为空发布一次删除该 Entity 的命令；内容非空且有变化发布一次 Renderer props 设置命令；内容非空且
未变化不发布任何命令。

判定顺序 MUST 是「先看是否为空，再看是否变化」：点击创建的文字本就是空的，若「未变化」优先，
用户点完立刻退出就会在文档里留下一个看不见也选不中的空文字。因此内容为空时 MUST 删除，无论用户
是否敲过字。

Auto width（Hug）文字在输入过程中 MUST 通过既有 measurement 失效链路实时改变宽度，MUST NOT 引入
第二条测量通道。由于编辑期间文档不变，Stage MUST 把编辑中的文本写入 Registry 的编辑中值覆盖通道，
使渲染与测量看到同一个值；退出编辑时 MUST 清除覆盖，MUST NOT 让覆盖值残留到下一次会话之外。

Stage 作为 Controller 的宿主，MUST 供给编辑会话所需的三项事实：把指针事件的连击计数归一化后随
`pointer.down` 传入；向 Registry 查询后以 context 提供「某 Entity 是否可原地编辑」的判定；处理
`drawing.commit` 创建实体后，以 context 回灌本次绘制实际创建的 Entity。提交时 Stage MUST 向 Registry
查询该 Entity 的可编辑 prop 名称，MUST NOT 按物料类型硬编码 prop 名。

#### Scenario: 编辑中文本经覆盖通道驱动渲染与测量

- **WHEN** 用户在编辑会话中逐字键入
- **THEN** Stage 只更新编辑中值覆盖，不派发任何文档命令
- **AND** 退出会话后覆盖被清除，Entity 回到 authored props 的呈现

#### Scenario: 点击创建后直接输入

- **WHEN** 用户以文字工具点击画布并随即键入内容，然后点击画布其他位置
- **THEN** 编辑一开始就是空内容，画布上只显示所键入的文字而没有占位文案
- **AND** 历史中只增加一次文本设置事务，且 Auto width 宽度在键入过程中实时跟随内容

#### Scenario: 双击已有文字改写并提交

- **WHEN** 用户双击一段已有文字，改写内容后按 `Esc`
- **THEN** 文档更新为新内容且该 Entity 保持选中
- **AND** 撤销一次即回到改写前的内容

#### Scenario: 空内容退出时删除文字

- **WHEN** 用户退出编辑时文字内容为空
- **THEN** 该文字 Entity 被删除
- **AND** 撤销可恢复该 Entity

#### Scenario: 绘制预览只显示光标

- **WHEN** 用户以文字工具在画布上按下并保持，随后拖动
- **THEN** 预览自始至终只有一根落在按下点的光标，没有边框、尺寸标注或占位文案
- **AND** 光标的位置与高度不随拖动改变，松手后画布上不出现一闪而过的文字

#### Scenario: 点击创建后未输入即退出不留残余

- **WHEN** 用户以文字工具点击创建文字后一个字都没敲就退出编辑
- **THEN** 该空文字 Entity 被删除，文档中不留下不可见的残余
- **AND** 撤销可恢复它

#### Scenario: 内容未变化不产生事务

- **WHEN** 用户进入编辑后没有改动**非空**内容就退出
- **THEN** 不产生任何文档事务
- **AND** 历史面板不增加条目

## MODIFIED Requirements

### Requirement: 按约束显示变换手柄

Stage MUST 仅为允许编辑的选区显示对应手柄：free 显示八向，preserve-aspect 显示四角，
horizontal 显示 E/W，vertical 显示 N/S，none 不显示 Resize；rotatable 为 false 时不显示旋转。

处于画布内文字编辑会话时，Stage MUST NOT 为编辑目标显示任何 Resize 或旋转手柄，改为只显示单一
编辑边框以区别于普通选中态。该抑制与 TransformConstraints 的抑制是两条独立规则，叠加生效。

边缘命中区两端 MUST 只在存在可见角手柄时让出空间：让位是为了不压住角手柄，没有角手柄时继续让位
会让十几像素高的选区把 E/W 命中区算成零高度，边根本抓不住。

#### Scenario: 动态切换几何限制

- **WHEN** Inspector 修改 TransformConstraints
- **THEN** Stage 手柄和直接操作立即同步
- **AND** 禁用但仍可选择的 Entity 保留选择框

#### Scenario: 无角手柄时边缘命中区不再让位

- **WHEN** 一个只允许水平缩放的选区高度只有十几像素
- **THEN** E/W 边缘命中区占满选区高度，可以正常抓取
- **AND** 存在角手柄的选区仍为角手柄让出两端空间

#### Scenario: 编辑态不显示变换手柄

- **WHEN** 一个 free 约束的文字 Entity 进入画布内编辑会话
- **THEN** 八向手柄与旋转手柄都不显示，只显示编辑边框
- **AND** 退出编辑后按其 TransformConstraints 恢复显示手柄
