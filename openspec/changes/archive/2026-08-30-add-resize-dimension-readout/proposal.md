# 变更：缩放手柄的尺寸读数

## 原因

调研过 AutoCAD 之后确认，动态输入的分界线**不是「命令 vs 拖动」，而是「有没有基点」**：

| 操作 | AutoCAD | 我们 |
| --- | --- | --- |
| `MOVE` 命令 | 有 | 有 |
| 抓夹点拖 | 有（`DYNDIGRIP`，默认全开） | 有（`createStageGripSession` 的 `polar`） |
| 拖对象本体 | **没有**（官方文档：dimension input 只在 `a command prompts` 时出现；社区把这个手势定位成 quick and dirty） | 没有 |
| **拖盒手柄 resize** | **有** | **没有** |

前三条已经对上，第四条差着。而拖角手柄**是有基点的**——对角那个角固定不动，它就是原点，
AutoCAD 正是靠这个给出长度与角度标注。所以这不是「给不出」，是没做。

今天用户改盒的尺寸只有两条路：拖完之后去属性面板读，或者事先把网格调成想要的步长。拖动过程中
屏幕上一个数都没有，而「把这个框做成 200×120」是画大屏时最高频的动作之一。

## 变更内容

- 缩放会话在每次预览发布里带上本次缩放的**原点**与**落点**（世界坐标），与 `rotationPreview`
  同构；非 `resize` phase 为 null。
- Stage 在缩放手势期间用**取点动态输入的同一个纯函数**画出宽与高（`cartesian`）。
- 读数**不可键入**，两个字段的框尾标记恒为 `idle`——光标条是「这里能打字」的记号，
  一个不能打字的框挂上它就是在撒谎。

## 非目标

- **不做可键入。** AutoCAD 那边能打字是因为它的夹点编辑是「点一下 → 松开 → 移动 → 再点一下」，
  按钮并没有按着；我们的 resize 是按住拖动，浏览器焦点不在命令行上，而命令行是动态输入唯一的
  输入端。要补这一档，正确的做法是给手柄加与夹点**同构**的「点亮」态（松手时一步没动则会话
  留着），那是独立的一条，不塞进本变更。
- **不做旋转手柄的角度读数。** `rotationPreview.angleDegrees` 已经在快照里，是自然的下一条，
  但它的标注是角度弧而不是边长标注，呈现要另走一支。
- **不做拖动本体的位移读数。** AutoCAD 也没有，那个手势两边都定位成将就用。

## 影响

- 受影响的规范：`stage`、`stage-engine`
- 受影响的代码：
  - `packages/stage-engine/src/interaction-controller.ts`（快照字段）
  - `packages/stage-engine/src/interaction-kernel/resize-plugin.ts`
  - `packages/stage-engine/src/geometry/`（`(bounds, handle) → 对角`的纯函数）
  - `packages/stage/src/stage-overlay/`（读数的挂载与来源互斥）
