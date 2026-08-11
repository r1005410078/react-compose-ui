## ADDED Requirements

### Requirement: 无 DOM 文字编辑会话

StageInteractionController MUST 以普通数据 context、event、snapshot 和 effect 支持画布内文字编辑会话，
不得导入 React、DOM、Registry 或 Renderer。会话 MUST NOT 持有文本内容——编辑期间的中间文本是宿主
DOM 层的瞬时状态，Controller 只判定会话的进入、退出与提交时机。

Controller MUST 在以下情形判定进入编辑：`draw-text` 工具以点击（拖拽距离小于阈值）创建文字之后；
select 工具双击一个可原地编辑的 Entity；单选一个可原地编辑的 Entity 时按 `Enter`。Controller MUST 在
以下情形判定退出：`Esc`；在编辑目标之外按下指针；选区变化到其他 Entity；编辑目标从文档中消失。

编辑会话存在期间，Controller MUST 屏蔽该 Entity 的移动、缩放、旋转手势与框选，使指针拖拽不再产生
空间命令。会话的进入与退出 MUST 各自只发布一次 effect，宿主据此持有会话状态并作为 context 回传。

#### Scenario: 绘制提交后进入编辑

- **WHEN** 用户以 `draw-text` 工具在画布上点击而不拖拽，宿主随后回灌本次绘制创建的 Entity
- **THEN** Controller 发布进入编辑会话的 effect，指向该新建 Entity
- **AND** 拖拽创建固定尺寸文字同样进入编辑会话

#### Scenario: 双击已有文字进入编辑

- **WHEN** 用户以 select 工具双击一个可原地编辑的 Entity
- **THEN** Controller 发布进入编辑会话的 effect 且不产生移动命令
- **AND** 双击不可原地编辑的 Entity 时不进入会话

#### Scenario: 编辑期间屏蔽空间手势

- **WHEN** 用户在编辑会话中于编辑目标上按下并拖拽指针
- **THEN** Controller 不产生移动、缩放、旋转或框选命令
- **AND** 在编辑目标之外按下时退出会话

#### Scenario: 目标消失时结束会话

- **WHEN** 编辑目标被撤销、删除或替换导致其不再存在于文档中
- **THEN** Controller 结束会话并发布退出 effect
- **AND** 不产生指向已消失 Entity 的命令

### Requirement: 文字编辑会话的输入协议

Controller 判定编辑会话需要三项它当前拿不到的事实。三者 MUST 全部以普通数据经既有 context/event
协议进入，Controller MUST NOT 为此导入 Registry、DOM 或物料类型。

**连击计数。** 指针按下事件 MUST 携带连击计数，使 Controller 能区分单击与双击。计数由宿主按平台
惯例归一化后传入，Controller MUST NOT 自行计时或持有 DOM 事件。

**可编辑判定。** context MUST 提供「某 Entity 是否可原地编辑」的判定入口，由宿主查询 Registry 后
提供。Controller MUST 只消费该判定结果，MUST NOT 感知 Renderer type 或 prop 名称——prop 名称属于
提交环节，由宿主在退出时向 Registry 查询。

**新建 Entity 回灌。** 宿主处理 `drawing.commit` 创建实体后 MUST 通过 context 回灌本次绘制实际创建的
Entity。Controller MUST 只对 `draw-text` 的绘制消费一次该事实并发布一次进入编辑 effect，MUST NOT 因
context 反复回灌同一事实而重复进入会话，也 MUST NOT 对其他绘制工具的创建进入编辑。

#### Scenario: 按连击计数区分单击与双击

- **WHEN** select 工具在可原地编辑的 Entity 上收到连击计数为 1 的按下
- **THEN** Controller 按普通选择/移动处理，不进入编辑会话
- **AND** 同一 Entity 上连击计数为 2 的按下进入编辑会话

#### Scenario: 可编辑判定只来自 context

- **WHEN** context 判定某 Entity 不可原地编辑
- **THEN** 双击与 `Enter` 都不进入编辑会话
- **AND** Controller 全程未读取 Renderer type、prop 名称或任何 Registry 接口

#### Scenario: 新建回灌只消费一次

- **WHEN** 宿主回灌一次 `draw-text` 绘制创建的 Entity，随后 context 因其他原因多次更新
- **THEN** Controller 只发布一次进入编辑 effect
- **AND** 以 `draw-rectangle` 等其他工具创建时不发布进入编辑 effect
