# CAD 选择集与手势仲裁

## Why

路线图 6c。到目前为止 CAD 画布上**空闲时点击什么都不做**——点击的含义完全由活动命令决定。
这挡住了所有编辑类命令：AutoCAD 的编辑命令要么用已经选好的对象，要么自己提示「选择对象」，
两条路都要求先有选择集。

这也是**仲裁器第一次真正有价值的地方**。在此之前 CAD 的三种输入（画布取点、命令行、功能键）
互不竞争，用仲裁器只是仪式。加上选择集之后，同一次左键按下有三种互斥含义：交给活动命令当
一个点、点中图元、在空白处拉框。谁赢必须是**声明出来的优先级**，不是 `if` 的书写顺序。

## What Changes

### 命中：距离而不是包围盒

`@compose-ui/cad` 新增 `selection/`：

- `findCadHit(document, point, tolerance)`：判据是**点到线段的距离**。直线没有盒模型——一条
  对角线的包围盒里绝大部分是空的，按矩形命中会让两条交叉线互相「挡住」对方。这正是 CAD 不
  复用 Stage `SceneIndex` 的原因（那边 `getWorldBounds` 返回的是矩形）。
- 同距时取**后画的**：`rootIds` 靠后即视觉上更靠上。
- `findCadEntitiesInRect(document, rect, mode)`：`window` 只选完全落在框内的，`crossing` 选
  与框相交或落在框内的。

### 框选方向决定判定模式

**左→右是窗口（实线框，全包含才选中），右→左是交叉（虚线框，碰到就选中）。** 这条是 AutoCAD
的招牌行为，也是画接线图时最常用的一招——从右往左划一刀就能抓住穿过某个区域的所有导线。

### 选择集代数按 AutoCAD，不按页面编辑器

- 点中图元：**加入**选择集（AutoCAD 默认累积，不需要按 Shift）
- Shift + 点中图元：**移出**选择集
- 框选结果：加入选择集
- 单击空白（没有拉出框）：**清空**选择集
- Esc：有活动命令则取消命令，否则清空选择集

累积是 AutoCAD 的默认（`PICKADD`），与页面编辑器「点一下换一个」相反。这是刻意的：用户说过
CAD「跟画页面是完全不同的风格」，在选择集这种高频动作上折中只会两边都不像。

### 三个插件，一张优先级表

`@compose-ui/cad` 新增 `interaction/`，绑定 `@compose-ui/interaction-kernel`：

| 优先级 | 插件 | 何时接管 |
| --- | --- | --- |
| 30 | `cad.command-point` | 活动命令正等待取点 → 把点交给命令，`consumed` |
| 20 | `cad.select` | 命中了图元 → 更新选择集，`consumed` |
| 10 | `cad.marquee` | 空白处按下 → 开一次框选会话 |

插件是纯状态机，不认识命令会话：它们发出 `command-point` 效果，由宿主过一遍点求解管线
（捕捉 > 正交 > 网格）再喂给会话。几何留在原地，插件只决定**指针归谁**。

### ERASE：把「先选后执行 / 先执行后选」跑通

`E↵` 是最小的能证明这条语义的命令：

- 已经选好对象 → 直接提交删除，不再提示。
- 没选 → 提示「选择对象」，此时点选与框选的结果喂给命令，`↵` 提交。

`@compose-ui/commands` 因此增加一种输入 `selection`。本包仍不认识文档：id 只是字符串。

## 中键平移仍留在图面上

平移改的是视口，而视口是画布的 React state，不是内核状态。把它做成插件要把视口塞进内核
context 再加一种视口效果，为一个不与任何人竞争的中键手势付这个代价不值。

但**指针归属必须单线**：图面上所有按下先问仲裁器（它只在左键上判定），只有 `declined` 才
走平移分支。两个独立的指针拥有者才是真正会出问题的写法。

## 本刀不做

夹点编辑、MOVE/COPY 等真正的编辑命令、极轴追踪、动态输入浮层、选择集的属性面板。
ERASE 的作用是打通语义，不是铺开命令集。

指针会话（Stage 那 519 行三类竞态防护）**没有抽出来**——理由见 tasks.md 的发现记录。

## Impact

- Affected specs: `cad-document`、`command-transaction`
- Affected code: `packages/cad/src/selection/`（新增）、`packages/cad/src/interaction/`（新增）、
  `packages/cad/src/command/`、`packages/commands/src/command/`、`packages/cad-canvas/src/`、
  `AGENTS.md`
- `@compose-ui/cad` 增加对 `@compose-ui/interaction-kernel` 的依赖
