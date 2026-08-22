## ADDED Requirements

### Requirement: 绘图模式提供对象编辑命令

绘图命令集 MUST 包含 `MOVE`（别名 `M`）、`COPY`（别名 `CO`）与 `ERASE`（别名 `E`），
三条命令 MUST 复用 `@compose-ui/commands` 的四态推进，MUST NOT 另实现一套命令会话。

`MOVE` 与 `COPY` MUST 共用同一条「取对象 → 取基点 → 取位移点」状态机，唯一差别是放下一个
落点之后 `MOVE` 收束、`COPY` 以 `prompt` 携带 `commit` 继续等下一个落点。`COPY` 连续放置时
位移 MUST 始终以**最初的基点**为起点，MUST NOT 改用上一个副本的落点。

三条命令 MUST 支持「先选后执行」：启动上下文里已有选择集时跳过选择步骤；`ERASE` 在这种
情形下 MUST 以 `null` 提示表达「没有要等的输入」，由宿主立刻推进。

#### Scenario: MOVE 取三步之后产出位移

- **WHEN** 启动 `MOVE`，依次给出一批对象、一个基点与一个位移点
- **THEN** 产出一次针对这批对象的位移，且会话结束

#### Scenario: COPY 连续放置

- **WHEN** 启动 `COPY` 取基点后连续给出两个落点
- **THEN** 产出两份副本，两份的位移都相对最初的基点，且会话在第二个落点之后仍在等待

#### Scenario: 先选后执行的 ERASE 无需等待输入

- **WHEN** 启动上下文里已有选择集时启动 `ERASE`
- **THEN** 会话的提示为 `null`

#### Scenario: 没有对象时取消

- **WHEN** 在选择步骤直接确认且一个对象都没有
- **THEN** 会话取消，不产出任何变更

### Requirement: 绘图命令的选择集输入是替换而不是并入

绘图命令会话收到 `selection` 输入时 MUST 用它**替换**自己记住的目标集合，MUST NOT 并入。

选择集在 Stage 中已经存在且归宿主所有（选中框、属性面板、场景树联动、Esc 清空都读它）。
会话再攒一份会在移出操作上分叉：宿主那份少了两个，会话那份仍是三个，用户看着两个对象
被移出而命令仍然作用在三个上。

#### Scenario: 后一次选择覆盖前一次

- **WHEN** 会话先后收到两批不同的对象标识
- **THEN** 命令作用的目标是后一批

#### Scenario: 收到空选择后确认即取消

- **WHEN** 会话收到空的选择集后确认
- **THEN** 会话取消，不产出任何变更

### Requirement: 选择语义按上下文标记分流

`StageInteractionContext` MUST 提供 `selectionMode`，取值 `'replace'`（默认）与 `'accumulate'`。
点选与框选两条路径 MUST 读同一个标记，MUST NOT 各自判断模式。

- `'replace'`：无修饰键点击换成命中的那一个，Shift 点击切换；无修饰键框选换成框内，Shift 框选并入。
- `'accumulate'`：无修饰键点击**加入**，Shift 点击**移出**；无修饰键框选**并入**，Shift 框选**移出**。

`'accumulate'` 下的顺序 MUST 按首次加入的先后保持稳定——选择集会喂给命令，而命令把它当作
一个序列。

#### Scenario: 累加模式下点击第二个对象不丢掉第一个

- **WHEN** `selectionMode` 为 `'accumulate'` 时依次点击两个 Entity
- **THEN** 两个都在选择集里

#### Scenario: 累加模式下 Shift 点击移出

- **WHEN** `selectionMode` 为 `'accumulate'` 时 Shift 点击一个已在选择集中的 Entity
- **THEN** 该 Entity 被移出，其余不变

#### Scenario: 默认仍是页面语义

- **WHEN** 未指定 `selectionMode` 时依次点击两个 Entity
- **THEN** 只有后点的那个在选择集里

#### Scenario: 框选读同一个标记

- **WHEN** `selectionMode` 为 `'accumulate'` 时在已有选择集之上无修饰键框选
- **THEN** 框中的对象并入原选择集

### Requirement: 编辑命令与拖动手势共用提交漏斗

`MOVE` 提交 MUST 走与拖动、resize、rotate 相同的几何提交漏斗，产出**一条**变换命令，
因此多选移动 MUST 只占一步撤销。

`MOVE` MUST NOT 复用拖动预览的激活阈值、平移吸附与落点解析：基点与位移点已经各自经过点输入
管线，再吸附一次会改写键入的坐标；落点解析会把纯平移变成跨父级重挂载。

#### Scenario: 多选移动只占一步撤销

- **WHEN** 用 `MOVE` 同时移动三个对象后撤销一次
- **THEN** 三个对象全部回到原位

#### Scenario: 键入位移不被吸附改写

- **WHEN** 网格吸附开启时用键入的相对坐标给出位移
- **THEN** 对象正好位移这个量

#### Scenario: 小位移仍然生效

- **WHEN** 给出的位移小于拖动手势的激活阈值
- **THEN** 位移照样提交

### Requirement: 复制命令的落点偏移可配置

`createDuplicateCommand` 对同父级绝对定位根节点施加的固定偏移 MUST 可由调用方覆盖，
默认值 MUST 保持不变。

固定偏移的语义是「复制一份别正好盖住原件」；`COPY` 有真实位移，叠加固定偏移会让每一个副本
都错开一个常量。

#### Scenario: 调用方给出偏移

- **WHEN** 以显式偏移复制一个绝对定位 Entity
- **THEN** 副本落在原位置加该偏移处

#### Scenario: 缺省行为不变

- **WHEN** 不给偏移复制一个绝对定位 Entity
- **THEN** 副本落在原来的默认错开位置
