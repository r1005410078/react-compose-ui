# Stage 规范增量

## MODIFIED Requirements

### Requirement: 受控工具模式与专属选区反馈

Stage MUST 接受受控的 `tool` 值并按它改变手势语义。工具集 MUST 只包含**没有其他入口**的
动作：`select`、`scale`、`rotate`、`draw-container` 与 `draw-text`。

以下工具值 MUST NOT 存在，因为各自都有严格不弱的既有入口：`marquee`（`select` 在空白处
拖拽即框选）、`move`（`MOVE` 命令能键入精确位移）、`pan`（空格与中键是随时可用的临时覆盖，
不占用工具状态）、`draw-line`、`draw-rectangle`、`draw-circle`、`draw-arrow`（各有对应的
绘图命令，且命令那一套严格更强——能键入精确坐标、能捕捉、能正交、能中途放弃上一点）。

**制图几何 MUST 只有命令一套入口。**留着绘制工具会让同一件事有两套机制，还会让一处已知的
仲裁器冲突**用鼠标就能触发**：取点插件（`drafting-point`，1650）高于绘制（`draw`，1000），
两者同时武装时 `pointerdown` 被前者吃掉，拖动永远起不来。

`draw-container` 与 `draw-text` MUST 保留：它们不是制图几何，没有命令等价物，也不与取点插件
争抢——它们本来就是拖一个盒出来。

`select` 工具在空白处拖拽 MUST 框选，判定由拖拽方向归约得出（见 stage-engine 的框选判定
Requirement）。MUST NOT 存在任何可以覆盖方向的模式参数或宿主开关。

Stage MUST 为当前工具提供专属选区反馈：`scale` 显示缩放手柄，`rotate` 显示旋转手柄，
绘制工具显示落点预览。

**单选一条带 `Curve` 的 Entity 且工具是 `select` 时，选区 MUST 画它的几何轮廓，MUST NOT 画
选区矩形、Resize 手柄或边缘命中带。**判据是**盒是不是这个对象的轮廓**：矩形、图片、容器的盒
就是它们的轮廓，文字占满自己的盒，而一条对角线的包围盒里绝大部分是空的——那个矩形宣称了对象
并不占据的面积，且比线本身显眼得多。线越接近 45 度它越大，拖端点时还一直在变。

这条判据 MUST NOT 被读成「给曲线开特例」：同一句话在矩形上的答案就是画盒，在文字编辑态上的
答案是画盒但去掉填充。它也 MUST NOT 扩大到非曲线 Entity。

轮廓 MUST 与几何编辑会话画的是**同一条几何**（同一个派生入口），MUST NOT 另写一份——两份
实现的分叉症状是「双击前后线的轮廓差半个像素」，而那种偏移只在特定缩放下现形。几何编辑态下
它 MUST 由可编辑路径层绘制，选区层 MUST 让位：两层各画一条会重叠出一条更粗的线。覆盖层
MUST 保持不认识文档：世界折线由宿主派生后传入。

**`scale` 与 `rotate` 工具下 MUST 照旧画盒**与各自的手柄。盒不是错的，它只是不是轮廓；用户
明确在做盒操作时，盒就是他正在操作的那个东西。曲线的整体缩放能力因此没有消失，只是从「随时
都在」变成「进那个工具」，而两个工具都已存在。

**多选 MUST 照旧画整体包围盒**，MUST NOT 逐对象改画轮廓。多选框回答的是「这一堆的范围」，
那是一个用户接下来真的会操作的矩形，它不宣称任何单个对象的轮廓。

几何编辑会话 MUST 在轮廓之外**再加**夹点与十字光标，两态因此可区分；轮廓本身在两态都画，
进出会话时对象的呈现只**增减夹点**，不整体换一套。AutoCAD 把选中与夹点
合成一态是因为它没有单独的顶点模式；本产品有，而「能不能拖出一个新形状」必须一眼可辨。

#### Scenario: select 在空白处拖拽即框选

- **WHEN** 当前工具是 `select`，用户从空白处拖出一个矩形
- **THEN** 按拖拽方向归约出的判定选中命中的节点

#### Scenario: 专属选区反馈

- **WHEN** 当前工具是 `rotate`
- **THEN** 选区显示旋转手柄而不是缩放手柄

#### Scenario: 选中曲线不画包围盒

- **WHEN** `select` 工具下单选一条斜线曲线
- **THEN** 图面不绘制选区矩形，也不绘制 Resize 手柄

#### Scenario: 轮廓沿几何而不是沿盒

- **WHEN** `select` 工具下单选一条斜线曲线
- **THEN** 绘制的轮廓落在线身上；包围盒四角处没有轮廓

#### Scenario: scale 工具下盒与手柄回来

- **WHEN** 选中同一条曲线并切到 `scale` 工具
- **THEN** 图面绘制选区矩形与缩放手柄

#### Scenario: 非曲线 Entity 不受影响

- **WHEN** `select` 工具下单选一个矩形 Entity
- **THEN** 图面照旧绘制选区矩形与 Resize 手柄

#### Scenario: 多选仍画整体包围盒

- **WHEN** 同时选中一条曲线与一个矩形 Entity
- **THEN** 图面绘制覆盖两者的整体包围盒，而不是逐对象的轮廓

## ADDED Requirements

### Requirement: 宿主可以从自己的 chrome 启动一条命令会话

Stage MUST 提供命令式句柄 `ComposeStageHandle`，其 `startCommand(commandId)` MUST 启动与在
命令行敲下该名字**完全相同**的会话，MUST NOT 另走一条构造上下文、推进状态机的路径。

理由与 `runComposeCommandImmediately` 只有一处实现是同一条：命令行那条路已经处理了三种拒绝
（词不在表里、词在表里但此刻不可用、会话进行中的非法输入），另写一份必然只实现其中一两种，
同一条命令会在不同入口给出不同结果。

会话状态 MUST 仍住在 Stage，句柄 MUST NOT 暴露它——状态由 `onActiveCommandChange` 单向上报
（结束时报 `null`），两个方向各自单一。搬走会话意味着提示、预览与捕捉标记要逐帧回传。

句柄 MUST NOT 做成受控 prop（例如 `pendingCommandId` 加一次消费握手）：那把一个**事件**建模
成状态，同一个按钮连点两次要靠 nonce 才能再次触发，而「挂着一个待启动的命令」这个中间态在
任何时刻都不描述真实世界的任何东西。

#### Scenario: 句柄启动的会话与敲名字的同一条

- **WHEN** 宿主调用 `startCommand('RECTANGLE')`
- **THEN** 命令行进入与敲 `RECTANGLE` 后完全一致的提示状态

#### Scenario: 会话结束时上报 null

- **WHEN** 一条由句柄启动的会话被 `Escape` 取消
- **THEN** `onActiveCommandChange` 收到 `null`
