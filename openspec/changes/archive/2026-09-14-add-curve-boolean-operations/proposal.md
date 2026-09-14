# 变更：曲线布尔运算——并集、差集、交集、异或与拍平

## 原因

今天把两个形状合成一个形状的办法只有一个：自己用 `PLINE` 沿着想要的轮廓重画一遍。
柜体轮廓要在母线穿过的地方开一个口、设备底板要挖一个安装孔、两块分区要并成一块——
这三件事在图上天天做，而它们都是同一件事：**按另一个形状去改这个形状的轮廓**。

重画一遍的代价不只是慢。用户描出来的那条折线与原来那两个形状**没有任何关系**：角对不齐、
半径对不上，而且原来那两个形状还得手动删掉——漏删一个就会留一块压在下面、再也点不到的墨。

最容易想到的解法是「让形状按压在它上面的东西自动裁切」，**这条错了**，而且这个仓库已经拒绝过
一次：`HATCH` 的提案里写着，让一个对象的 `backgroundPaint` 的含义取决于**别的**对象在哪儿，
会让一条导线穿过设备外框就把它的填充劈成两块。轮廓同理——用户要的是**一次**明确的运算，
不是一条永远生效的规则。

设计稿：`docs/mockups/curve-boolean.html`（含五运算的几何结果、算法流水线、面分类真值表、
活节点与协议的冲突图、工具栏与命令行界面稿、风险表与分阶段）。

## 变更内容

- **新增五条命令**：`UNION`（`UNI`）、`SUBTRACT`（`SU`）、`INTERSECT`（`IN`）、
  `EXCLUDE`（`XOR`）、`FLATTEN`（`FLAT`）。走 `ERASE` 那条**两条次序共用**的状态机：
  已选好对象就当场执行，没选好就提示选择对象。快捷键照抄 Figma 的 `⌥⇧U/S/I/E/F`——
  `alt` 这个修饰符在 `DEFAULT_STAGE_SHORTCUTS` 里一个都没用过，不撞车。
  别名照抄 AutoCAD 的 `UNI`/`SU`/`IN`，`EX` 留给将来的 `EXTEND`，因此异或用 `XOR`。
- **产物是一个普通的 `Curve` Entity，操作数在同一个事务里删掉**，撤销一步全回去。
  **不做 Figma 那样的活布尔节点**：它要求一个节点既是容器又是几何，而 `Curve` MUST NOT 与
  `Hierarchy` 组合；绕开它只能新造一个 Entity 类型，或者拿 `Group` 去当别的用，而后者这个
  仓库已经拒绝过两次（DXF 图层、`HATCH` 自动分组）。判据还有产品的那一半——在这个产品里
  布尔运算之后的下一步是**拖那个新轮廓的顶点**，而活节点恰恰做不到。
- **`core` 新增 `curve-boolean.ts`：面分类法**。把 `curve-region.ts` 已经在用的那套平面细分
  （两两求交切子边、节点合并、叠边去重、半边图最右转向绕环、六方向射线重试）**原样复用**，
  新写的只有三段：枚举全部有界面、给每个面取一个内点问「在哪几个操作数里面」、把保留下来的
  面合并成外环与岛。四条运算之间**没有任何算法差别，只差一个谓词**。
  **不走边裁剪**（Greiner–Hormann 那一类）：它要在每个交点上标「进/出」，而共线重叠边、
  顶点落在对方边身上、两条弧相切各要一条特判——网格吸附让两个矩形共享一条边，正是画柜体
  轮廓时的常态。仓库已经为求面付过这笔账，布尔不该再付第二遍。
- **先把平面图那一段从 `curve-region.ts` 提成 `curve-arrangement.ts`**，`curve-region` 改为
  消费它。这一步 MUST 是纯搬迁、不改一行逻辑，由 70 条既有用例兜底（`curve-region` 26 +
  `curve-intersections` 12 + hatch 三处 32），单独一个提交、单独验一次。
- **`FLATTEN` 不求交**：把每条几何转成一条子路径、拼成一个 `path`。它是布尔失败时用户唯一
  还能走的那条路，也是把一个圆角矩形变成能拖控制手柄的路径的入口——那正是 Figma 用户用
  Flatten 的主要理由。它**恒落 `path`**，是「写入方 MUST 取最窄 kind」那条的**唯一例外**：
  那条规则的理由是「落错 kind 的症状是这条线看起来一样却拖不动顶点」，而 Flatten 的目的
  正是把顶点换成控制手柄。
- **结果的外观、名称与父级取同一个来源**：层序**最靠后**（画在最下面）那个操作数，新 Entity
  插在它原来的位置。取不同来源会让场景树上那一行与画布上那块颜色指向两个不同的对象。
  这也定死了 `SUBTRACT` 的被减数——与 Figma 的「上面的减最下面的」一致，一条规则两处用。
- **旋转与跨父级都支持**：投影走世界空间，结果落成一条 `rotation` 为 0 的新曲线，与 SVG 导入
  「变换在导入期烘进几何」同一条。这与 `HATCH` 跟随拒绝旋转边界不冲突——那条限制的理由是
  每帧重求要读盒快照，而布尔是一次性的、事后不跟随。
- **八种拒绝，互相可分**：选择集不足、含不带几何的对象、含贝塞尔路径（v1 不支持）、含直线
  （没有面积）、操作数锁定、操作数上接着导线（删掉它会让绑定悬空，而悬空引用不让文档非法，
  这个错屏幕上只在 Inspector 里现形）、结果为空、求解退化。「敲了没反应」与敲错字在屏幕上
  无法区分，因此每一种都要有自己的一句话。**结果为空时 MUST NOT 产出一个看不见的 Entity**：
  Figma 在这一档给一个空的布尔节点，那是静默的错。
- **工具栏一格 split button**：按钮面**固定是并集**，`▾` 打开其余四条，分隔线把「改变轮廓的
  四条」与「不改轮廓的 `FLATTEN`」分开。**不做「记住上次用的那个」**——仓库对看不见的状态的
  既有判据是「那个值有没有被印出来」，而一个只有认得图标的人才读得出来的按钮面不算印出来。
- **v1 不做**：贝塞尔操作数（`ComposeOutlinePiece` 只有 segment 与 arc，求交只有线×线、
  线×弧、弧×弧三支，与 `HATCH` 的 v1 边界逐字相同）、活节点与嵌套布尔、描边转轮廓
  （Outline Stroke）、布尔结果的「重新生成」（它没有边界清单可跟随，那是 `Hatch` 的事）。

## 影响

- 受影响的规范：`compose-document`（布尔求解、轮廓收成曲线、拍平合并；最窄 kind 那条加一处
  例外）、`stage-engine`（五条命令、解算与八种拒绝、宿主注入的操作数谓词）、
  `stage`（规划与落地、快捷键、拒绝文案）、`editor-workspace-layout`（绘图与页面货架各一格、
  目录项、split button）
- 受影响的代码：
  - `packages/core/src/curve-arrangement.ts`（新：从 `curve-region.ts` 提出的平面图，纯搬迁）
  - `packages/core/src/curve-region.ts`（改为消费上一项；`composeCurveFromOutline` 从它的尾段提出）
  - `packages/core/src/curve-boolean.ts`（新：枚举面、分类、合并保留面、拍平）
  - `packages/stage-engine/src/commands/curve-boolean.ts`（新：世界投影、解算、八种拒绝）
  - `packages/stage-engine/src/drafting/boolean-commands.ts`（新：五条命令与会话）
  - `packages/stage-engine/src/drafting/drafting-types.ts`（`StageDraftingEffect.boolean`、
    `StageDraftingContext.booleanOperandIssue`、五条命令的提示与拒绝文案）
  - `packages/stage/src/drafting/boolean-plan.ts`（新：建 Entity、删操作数、一个事务）
  - `packages/stage/src/stage-surface/keyboard/stage-shortcuts.ts`（五个 `⌥⇧` 键位与命令映射）
  - `packages/editor/src/stage-toolbar/{stage-toolbar-icons.tsx,toolbar-shelf.ts,default-stage-toolbar.tsx}`
- 不受影响：`Curve` / `Wire` / `Ports` / `Hatch` 协议与 `schemaVersion`，`entity.curve.set` 的
  载荷语义，导线求解与填充跟随，手势插件与仲裁器，十字光标与取点管线（布尔命令不取点）。
- 与在途变更不冲突：本条不动十字光标、网格步长、预览取景与世界轴，落在互不相同的 Requirement 上。
