## ADDED Requirements

### Requirement: 画布内原地文字编辑

Stage MUST 为声明了原地文字编辑契约的 Entity 提供画布内编辑：编辑目标以其最终排版样式原地渲染为
可编辑文本，MUST NOT 用浮层输入控件替代——浮层的字形排版与最终渲染不是同一套，宽度对不上会让
所见即所得在编辑瞬间断掉。编辑目标 MUST 获得键盘焦点，并 MUST 在退出会话后把焦点交还 Stage surface。

编辑期间 Stage MUST NOT 发布任何文档事务。退出编辑时 Stage MUST 按内容收敛为最多一条可撤销事务：
内容变化发布一次 Renderer props 设置命令；内容为空发布一次删除该 Entity 的命令；内容未变化不发布
任何命令。

Auto width（Hug）文字在输入过程中 MUST 通过既有 measurement 失效链路实时改变宽度，MUST NOT 引入
第二条测量通道。

#### Scenario: 点击创建后直接输入

- **WHEN** 用户以文字工具点击画布并随即键入内容，然后点击画布其他位置
- **THEN** 画布上显示所键入的文字，且历史中只增加一次文本设置事务
- **AND** Auto width 文字的宽度在键入过程中实时跟随内容

#### Scenario: 双击已有文字改写并提交

- **WHEN** 用户双击一段已有文字，改写内容后按 `Esc`
- **THEN** 文档更新为新内容且该 Entity 保持选中
- **AND** 撤销一次即回到改写前的内容

#### Scenario: 空内容退出时删除文字

- **WHEN** 用户退出编辑时文字内容为空
- **THEN** 该文字 Entity 被删除
- **AND** 撤销可恢复该 Entity

#### Scenario: 内容未变化不产生事务

- **WHEN** 用户进入编辑后没有改动内容就退出
- **THEN** 不产生任何文档事务
- **AND** 历史面板不增加条目

## MODIFIED Requirements

### Requirement: 按约束显示变换手柄

Stage MUST 仅为允许编辑的选区显示对应手柄：free 显示八向，preserve-aspect 显示四角，
horizontal 显示 E/W，vertical 显示 N/S，none 不显示 Resize；rotatable 为 false 时不显示旋转。

处于画布内文字编辑会话时，Stage MUST NOT 为编辑目标显示任何 Resize 或旋转手柄，改为只显示单一
编辑边框以区别于普通选中态。该抑制与 TransformConstraints 的抑制是两条独立规则，叠加生效。

#### Scenario: 动态切换几何限制

- **WHEN** Inspector 修改 TransformConstraints
- **THEN** Stage 手柄和直接操作立即同步
- **AND** 禁用但仍可选择的 Entity 保留选择框

#### Scenario: 编辑态不显示变换手柄

- **WHEN** 一个 free 约束的文字 Entity 进入画布内编辑会话
- **THEN** 八向手柄与旋转手柄都不显示，只显示编辑边框
- **AND** 退出编辑后按其 TransformConstraints 恢复显示手柄
