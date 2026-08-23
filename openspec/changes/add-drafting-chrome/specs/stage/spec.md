# stage 增量

## ADDED Requirements

### Requirement: 绘图模式的十字光标与 CAD 同形

绘图模式的十字光标 MUST 使用 `canvas-kit` 的共享组件，MUST NOT 自带第二份实现。因此它 MUST
与 CAD 画布遵守同一套形态规则：没有活动命令时同时绘制十字线与拾取框、命令等待取点时只绘制
十字线、命令等待选择对象时只绘制拾取框、既不取点也不选对象时不绘制并交还系统指针；十字线
MUST 在拾取框处断开。

拾取框半边长 MUST 取自 Stage 已有的命中常量而 MUST NOT 另立一个数。与 CAD 不同，Stage 的
点选是 DOM 驱动的——命中容差由各物料自己的透明加宽 stroke 决定，**没有一个全局的点选容差**。
因此 v1 的框按线状物料那条 stroke 的半宽绘制：那是绘图模式下唯一真实存在的容差。CAD 规范里
「框边缘压住即命中」那条保证在 Stage **暂时不成立**，直到命中测试收敛出单一容差为止；这一点
MUST 记录在案，MUST NOT 用一个看起来对的数字掩盖过去。

十字光标 MUST 钉在**解算之后**的落点上，与橡皮筋终点、捕捉标记同一位置——让它跟着裸光标走，
用户会看见十字线与最终落点差着几个像素，而那正是他要对齐的地方。

隐藏系统光标的作用域 MUST 覆盖整个图面子树而不只是图面本身：任何自带 `cursor` 的后代（锁定
节点、编辑中的标签）都会把系统箭头露出来，屏幕上于是有两个光标。

十字光标 MUST 绘制在场景与编辑 Overlay **之上**。

#### Scenario: 取点时只有十字线

- **WHEN** 绘图命令正等待取点
- **THEN** 只绘制十字线，拾取框消失

#### Scenario: 选择对象时只有拾取框

- **WHEN** 绘图命令正等待选择对象
- **THEN** 只绘制拾取框，十字线消失

#### Scenario: 十字线压在场景内容之上

- **WHEN** 指针移到一个已有 Entity 上方
- **THEN** 十字线绘制在该 Entity 之上而不是被它遮住

#### Scenario: 光标钉在解算后的落点

- **WHEN** 指针落在某个特征点的捕捉容差内
- **THEN** 十字光标中心与捕捉标记重合，而不在光标裸坐标上

#### Scenario: 拾取框尺寸取自既有命中常量

- **WHEN** 绘图命令正等待选择对象
- **THEN** 拾取框的边长等于线状物料命中 stroke 的宽度
- **AND** 该尺寸不随缩放改变

### Requirement: 绘图命令的宿主入口

Stage MUST 通过命令式 handle 暴露 `runDraftingCommand(id)`，使宿主能启动一条绘图命令；
MUST NOT 做成受控 prop——启动命令是事件而不是状态，受控化要求宿主维护一个只为触发而存在的
计数器，且严格模式下的重放会重复启动命令。

绘图模式关闭时调用 `runDraftingCommand` MUST 无副作用。

Stage MUST 通过 `onDraftingCommandChange` 上报当前活动命令的标识（无活动命令时为 `null`），
使宿主的工具栏能表达按下态。MUST NOT 回传整个 prompt——会话状态住在 Stage 是既有决定。

#### Scenario: 宿主启动命令

- **WHEN** 宿主调用 `runDraftingCommand('LINE')`
- **THEN** 命令行进入该命令的第一个提示
- **AND** `onDraftingCommandChange` 上报 `'LINE'`

#### Scenario: 命令结束后回到无活动命令

- **WHEN** 一条命令提交或被中止
- **THEN** `onDraftingCommandChange` 上报 `null`

#### Scenario: 设计模式下入口无副作用

- **WHEN** Stage 不在绘图模式而宿主调用 `runDraftingCommand('LINE')`
- **THEN** 文档不变，也不出现命令提示

## MODIFIED Requirements

### Requirement: 受控工具模式与专属选区反馈

Stage MUST 支持受控的 `select`、`move`、`scale`、`rotate`、`pan`、`draw-container`、
`draw-rectangle`、`draw-arrow`、`draw-circle` 与 `draw-text` 工具，并通过既有
`onToolChange` 请求切换。`select` MUST 保持普通选择箭头、四角缩放和本体移动；`move` 激活时才显示
红 X/绿 Y 移动 gizmo；`scale` 与 `rotate` MUST 只暴露各自变换命中。

`draw-line` MUST NOT 再是合法工具：它的几何是盒的对角线，角度完全由盒的长宽比决定，而绘图
模式的 `LINE` 有显式端点、捕捉与特征点，是严格更强的表达。`draw-circle` 与 `draw-arrow`
MUST 保留——前者画的是椭圆、后者带端点 marker，绘图模式的曲线两样都表达不了，去掉是丢能力
而不是合并。

#### Scenario: 选择工具显示四角与边缘缩放

- **WHEN** 可 resize 的 Entity 在 select 工具中被选中
- **THEN** Overlay 只渲染四个角上的小方块
- **AND** 选择框边缘的 hover 提供对应方向 resize cursor，而不显示中点方块

#### Scenario: 精确移动工具显示轴 gizmo

- **WHEN** move 工具激活且存在可移动的选择
- **THEN** Overlay 在选择的左上显示向右的红 X 与向下的绿 Y gizmo
- **AND** 拖动任一轴只修改相应坐标轴，切换到其他工具后 gizmo 消失

#### Scenario: 旋转与缩放工具隔离命中

- **WHEN** 用户分别激活 scale 或 rotate 工具
- **THEN** 前者只能启动 resize，后者只能启动 rotate
- **AND** select 与 pan 的既有选择和视口行为不被拦截

#### Scenario: 既有 Line Entity 不受影响

- **WHEN** 文档里已有一个 Line Entity
- **THEN** 它照常渲染、可选中、可编辑属性
- **AND** 资源拖入仍能映射到 Line Preset

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。container 工具在拖拽距离小于有效阈值时 MUST 回退到 Container Preset 的默认尺寸并以按下点为左上角，MUST NOT 创建退化尺寸的容器。

line 的拖拽绘制 MUST 交给绘图模式的 `LINE` 命令。Line Preset 本身 MUST 保留：既有文档里的
Line Entity 要继续渲染，资源拖入的映射也仍要认得它。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击绘制容器回退默认尺寸

- **WHEN** 用户使用 container 工具在 surface 上单击而没有产生有效拖拽距离
- **THEN** Stage 以按下点为左上角、按 Container Preset 的默认尺寸创建容器
- **AND** 不创建 1×1 或其他退化尺寸的容器

#### Scenario: 点击或拖拽绘制文字

- **WHEN** 用户使用 text 工具点击 surface
- **THEN** Stage 在点击点创建保留 Text Preset `hug × hug` 轴的文字，初始预览使用 Text 的默认回退尺寸
- **AND** Layout measurement 完成后选区贴合实际文字内容
- **WHEN** 用户使用 text 工具拖拽 surface
- **THEN** Stage 创建两轴为 `fixed` 且使用精确拖拽 bounds 的 text box
- **AND** Escape、pointercancel 或无效 geometry 不创建 Entity

#### Scenario: 画线改由绘图模式承担

- **WHEN** 用户要在页面上画一条线
- **THEN** 入口是绘图模式的 `LINE` 命令，设计模式的形状菜单里不再有「线」
