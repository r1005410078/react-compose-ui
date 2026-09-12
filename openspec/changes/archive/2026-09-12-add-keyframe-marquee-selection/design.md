## 上下文

`@compose-ui/animation-panel` 是与文档协议解耦的纯 UI 包：所有操作只改自己的 React 会话，
经 `onValueChange` 快照与 `onAction` 语义动作交给宿主。编辑器的 `use-animation-mode` 把动作翻译
成 `animation.*` 命令并派发，一个动作展开成多条命令时共享 `mergeKey` 合成一次事务。

选择今天是 `selectedKeyframeId: string | null`；关键帧的指针手势挂在每个菱形按钮上（pointer
capture、`getTimeAtClientX` 吸附到次刻度、逐帧 `onMoveKeyframe`）；车道背景上只有一个用于选中
属性轨道的 `lane-hit` 按钮。

## 目标 / 非目标

- 目标：一次手势选中一批关键帧，之后整批拖动、整批删除，撤销各一步。
- 目标：单选的全部既有行为逐像素、逐动作不变（选中态、字段面板、插值段、右键菜单）。
- 非目标：批量改插值 / 值；框选片段；按方向区分的两种判定。

## 决策

- **选区是集合，单选是它的退化情形。**`selectedKeyframeIds: readonly string[]` 替换
  `selectedKeyframeId`，不并存：并存意味着同一份事实两处表示，多选时那一份单值只能是 null 或
  某个凭约定挑出来的「主帧」，而任何一种都会让读它的地方在多选下给出一个说不清的答案。
  Context 上既有的 `selectedKeyframe`（定位好的单个关键帧）保留，语义收窄为「选区恰好一个
  成员时的那一个」，字段面板、插值段选中态与 `addKeyframe` 的目标推断都读它，因此这些地方
  在多选下自然退成「无」。
  考虑过的替代：保留 `selectedKeyframeId` 作为锚点。否掉的理由见上——锚点只在拖动手势里有
  意义，那是手势局部状态，不进会话快照。
- **框选只有「碰到就选」。**画布上区分窗口 / 窗交是因为两种判定各自有真实用途（框住整根导线 /
  抓一把穿过某片区域的线），而关键帧是点，两种判定对点给出同一个答案。判定读的是菱形的
  **命中区**（按钮盒）而不是中心点：用户框的是屏幕上看见的那个菱形，擦到一角也算碰到。
- **框选从车道空白起手，判据是「指针有没有离开过按下点」。**没动过就还原成这次按下本来的
  含义（`lane-hit` 的点击 = 选中属性轨道），与画布「只接管拖，不接管点」同一条判断，不引入
  位移阈值。矩形用 `scaleRef` 的局部坐标记录，横向滚动时矩形跟着内容走。只有渲染出来的
  关键帧参与——折叠的对象轨道看不见，看不见的不该被框到。
- **判定是纯函数。**`resolveComposeAnimationMarqueeSelection(candidates, rect)` 吃一列
  `{ keyframeId, rect }`（React 侧从各菱形按钮量出来、换算到 scale 局部坐标）和矩形，返回
  id 列表；Vitest 覆盖跨轨道、擦边、折叠不参与三种情形。
- **拖动的锚点是按下的那个关键帧，位移作用于全体。**`delta = 解算落点 − 锚点原时间`，对选区每个
  成员 `timeMs + delta`；钳制读**整个选区**：先按越界收（让最早的成员不早于 0、最晚的不晚于
  duration），再逐成员查同轨道未选中的关键帧有没有落在同一时间，有则退回上一帧的合法位移并
  显示既有的 `duplicate-time` 提示。选区内成员共享同一个 delta，因此彼此的次序与间距天然不变、
  也不会互相碰撞。Provider 新增 `moveKeyframes(anchorId, timeMs)`，单帧拖动就是选区一个成员
  的情形，拖动手势**只走这一个入口**；`updateKeyframe` 的 `timeMs` 分支留给字段面板的时间输入。
- **动作形状。**新增 `move-keyframes { items: { propertyId, keyframeId, timeMs }[] }` 与
  `remove-keyframes { items: { propertyId, keyframeId }[] }`。拖动手势一律发 `move-keyframes`
  （单选时 items 长度为 1），`move-keyframe` 保留给字段面板与单个关键帧的语义；两者不是「同一件
  事的两种形状」——前者描述一次手势，后者描述一个字段的写入。编辑器翻译成 N 条命令、共享一个
  `mergeKey`（`animation-move-keyframes:<animationId>`），与 `remove-track-group` 的既有做法相同。
- **`Delete` 只在时间线有焦点时接管。**Stage 的 `edit.delete` 键位挂在 Stage 元素上，两者作用域
  不相交，不需要分级。时间线内的 `Delete` 判据是「选区非空」，不要求焦点恰好在某个关键帧上——
  框选结束时焦点停在 scale 容器上，此时按 `Delete` 正是用户最自然的下一步。
- **右键菜单按选区数量换条目**：按在选区成员上且成员数大于 1 时，「删除此关键帧」换成「删除选中的
  N 个关键帧」；按在未选中的关键帧上照旧只删它自己、不改选区——右键不是选择手势。
- **字段面板多选显示计数、不显示字段。**时间 / 值 / 插值三个字段都只能作用于一个帧，多选下显示
  其中任何一个的值都在说谎；显示「已选 N 个关键帧」让用户知道自己站在哪一档。

## 风险 / 权衡

- `selectedKeyframeId` 是公开类型字段，改名是 BREAKING → 第一方消费者只有 `editor`，
  `use-animation-mode` 的会话状态同步改成数组。
- 逐帧 `move-keyframes` 派发 N 条命令，与今天逐帧 `move-keyframe` 派发一条的合并策略相同；
  选区上百个关键帧时每帧的翻译成本线性增长，本阶段可接受，不预先优化。
- 框选期间关键帧按钮压在矩形上方，指针经过它们不影响手势：矩形所在的 scale 容器持有
  pointer capture。

## 待解决问题

- 无。
