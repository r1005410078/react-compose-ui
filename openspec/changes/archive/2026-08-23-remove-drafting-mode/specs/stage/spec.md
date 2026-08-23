## REMOVED Requirements

### Requirement: 绘图模式改变输入方式而不改变对象世界

**Reason**: 绘图模式取消。它提供的四样（命令行、点输入管线、捕捉、绘图命令）没有一样需要
模式承载，而模式本身与动画互斥、把同一件事拆成两套、并让能力不可发现。能力恒开的部分由下面
的「绘图能力恒开」承接。

**Migration**: 无文档迁移——模式是会话状态。宿主去掉 `ComposeStageProps.drafting` 即可，
绘图能力自动恒开。

### Requirement: 绘图模式使用 CAD 选择语义

**Reason**: 第二套选择语义随模式一起删除。原先的理由是「用户的肌肉记忆来自 AutoCAD」，
而这条前提已被推翻（用户不熟 AutoCAD，判据换成「任务需要什么」）。任务需要的只是「能选中
多个」，Shift 累加就够，且与用户其余时间的习惯一致。

**Migration**: 命令的多选改用 Shift 点击累加，能力不变。

### Requirement: 绘图模式的编辑命令产出普通文档变更

**Reason**: 内容仍然成立，但标题里的「绘图模式」已不存在。以下面同名去前缀的要求重新写入，
避免规范里留下一个已删概念的名字。

**Migration**: 无。

## ADDED Requirements

### Requirement: 绘图能力恒开

Stage MUST 恒定提供绘图能力，MUST NOT 由任何模式开关控制：命令行 MUST 常驻可见并随时接受
命令名；绘图与编辑命令 MUST 随时可启动；取点 MUST 走既有的点输入管线并显示捕捉标记与橡皮筋
预览。

绘图能力 MUST NOT 与动画开关互斥：动画开关打开时 MUST 仍能启动并完成一条绘图命令。动画改变
的是「拖动的结果落在哪里」，与「用什么方式输入」是两根正交的轴。

光标 MUST 按**当前是否在取点**切换：命令等待取点时是十字光标，其余时候是常规光标；
MUST NOT 由一个全局模式决定。

绘图命令产出的 Entity MUST 与工具栏拖拽创建的完全同类，在场景树、属性面板、动画与撤销里
MUST 没有任何差别。命令会话状态 MUST 住在 Stage：提示文本、预览几何与捕捉标记是同一份状态的
三种呈现。

#### Scenario: 动画开关打开时仍能画线

- **WHEN** 用户打开动画开关，然后在命令行键入 `LINE` 并取两个点
- **THEN** 命令正常完成并产出一条线
- **AND** 动画开关仍处于打开状态

#### Scenario: 命令行随时可用

- **WHEN** 编辑器处于默认状态，用户没有做任何模式切换
- **THEN** 命令行可见并接受命令名

#### Scenario: 光标跟随取点而不是模式

- **WHEN** 没有命令在跑
- **THEN** 图面使用常规光标
- **WHEN** 一条命令开始等待取点
- **THEN** 图面使用十字光标

#### Scenario: 画出的对象不特殊

- **WHEN** 用命令画出一条线
- **THEN** 该线出现在场景树中、可被选中、可撤销

### Requirement: 编辑命令产出普通文档变更

`MOVE` / `COPY` / `ERASE` MUST 派发普通文档命令：位移与画布拖动落到同一条提交漏斗，复制产出
普通 Entity，删除走既有的删除命令。三者 MUST 全部可撤销，且多选 MUST 只占一步撤销。

命令 MUST NOT 产出任何只有命令才认识的中间状态或私有字段。

#### Scenario: 移动后可撤销

- **WHEN** 用 `MOVE` 移动一条线后撤销
- **THEN** 线回到原位，撤销历史只消耗一步

#### Scenario: 复制产出普通 Entity

- **WHEN** 用 `COPY` 复制一条线
- **THEN** 副本出现在场景树中并与原件同类

#### Scenario: 删除走既有命令

- **WHEN** 用 `ERASE` 删除选中的对象
- **THEN** 对象被删除且可撤销

## MODIFIED Requirements

### Requirement: 受控工具模式与专属选区反馈

Stage MUST 接受受控的 `tool` 值并按它改变手势语义。工具集 MUST 只包含**没有其他入口**的
动作：`select`、`scale`、`rotate` 与各 `draw-*` 绘制工具。

以下四个工具值 MUST NOT 存在，因为各自都有严格不弱的既有入口：`marquee`（`select` 在空白处
拖拽即框选）、`move`（`MOVE` 命令能键入精确位移）、`pan`（空格与中键是随时可用的临时覆盖，
不占用工具状态）、`draw-line`（`LINE` 命令产出 `Curve` Entity）。

`select` 工具在空白处拖拽 MUST 按当前判定模式框选；判定模式 MUST 由宿主受控，MUST NOT 被任何
模式或工具切换偷偷改写。

Stage MUST 为当前工具提供专属选区反馈：`scale` 显示缩放手柄，`rotate` 显示旋转手柄，
绘制工具显示落点预览。

#### Scenario: select 在空白处拖拽即框选

- **WHEN** 当前工具是 `select`，用户从空白处拖出一个矩形
- **THEN** 按当前判定模式选中命中的节点

#### Scenario: 判定模式不被工具切换改写

- **WHEN** 用户把判定模式设为包含，然后切换工具再切回
- **THEN** 判定模式仍是包含

#### Scenario: 专属选区反馈

- **WHEN** 当前工具是 `rotate`
- **THEN** 选区显示旋转手柄而不是缩放手柄

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。container 工具在拖拽距离小于有效阈值时 MUST 回退到 Container Preset 的默认尺寸并以按下点为左上角，MUST NOT 创建退化尺寸的容器。

line MUST NOT 出现在绘制工具里：`LINE` 命令产出 `Curve` Entity，而拖拽绘制产出的是 shape 物料的线，两者是同一件事的两种表示。留下的是命令那一种。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击绘制容器回退默认尺寸

- **WHEN** 用户使用 container 工具在 surface 上单击而没有产生有效拖拽距离
- **THEN** Stage 以按下点为左上角、按 Container Preset 默认尺寸创建容器

#### Scenario: 没有 line 绘制工具

- **WHEN** 宿主枚举可用的绘制工具
- **THEN** 其中不包含 line
- **AND** 用户仍可用 `LINE` 命令画线
