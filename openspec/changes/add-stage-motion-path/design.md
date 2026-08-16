## 上下文

`AGENTS.md` 规定 `@compose-ui/stage` 不得依赖 `editor`，`@compose-ui/stage-engine` 只能依赖
`core`。虽然动画模型落在 `core` 里、技术上 Stage 可以 import，但让 Stage 认识关键帧会把动画
语义扩散到一个本职是"空间编辑适配层"的包里。

仓库里已有一个完全同构的先例：Paint 编辑。Inspector 打开渐变编辑时，宿主把
`paintEditing` 传给 `ComposeStage` → `StageInteractionContext.paintEditing` →
引擎产出 `StagePaintHandle[]` 与 `{ kind: 'paint-handle' }` 命中 → Overlay 画手柄。
本变更照抄这条链路，只是把"渐变控制柄"换成"路径顶点与切线"。

## 目标/非目标

- 目标：选中的 Entity 若有位置动画，画布上显示可编辑轨迹；拖顶点改关键帧值，
  拖切线改路径弯曲；双击切换 corner / smooth。
- 非目标：不做路径上的关键帧插入与删除、不做多 Entity 同时显示路径、不做路径吸附、
  不做时间线曲线图编辑器。

## 决策

### 决策：Stage 收到的是算好的世界坐标几何，不是轨道

`ComposeStage` 新增的是 `editablePath`：一份顶点 + 切线端点 + 折线 + 等时采样点的纯几何。
顶点 ID 对 Stage 是不透明字符串。手势结果通过回调回传世界坐标，由 `editor` 决定它意味着
"改哪个关键帧的什么"。

考虑过的替代方案：**把 `ComposeAnimationTrack` 直接传给 Stage** —— Stage 就必须知道
`valueKind`、空间切线语义和"位置在 `LayoutItem.offset`"这些文档知识，违反分层。

因为传的是通用几何，类型命名用 `StageEditablePath` 而非 `StageMotionPath`：这一层确实可以
被将来的矢量路径编辑复用。

### 决策：拖动过程只更新预览，松手才派发命令

`onEditablePathChange` 带 `phase: 'start' | 'move' | 'end'`。`move` 阶段 `editor` 只更新本地
预览几何，`end` 阶段才派发一条带 `meta.mergeKey` 的命令。这样一次拖拽在撤销栈里是一条记录，
而不是几十条。

### 决策：等时采样点与弧长折线分开输出

折线用于画轨迹，需要按弧长细分才平滑；采样点用于表达速度，必须按**时间**等分，
两者的点集不同。合并成一个数组会让 Overlay 无法区分。

### 决策：切线手柄只在 smooth 顶点或当前选中顶点上显示

corner 顶点全部显示手柄会让多关键帧路径变成一团线。选中顶点即使是 corner 也显示手柄，
用户拖动它即隐式切换为 smooth。

### 决策：Shift 约束切线对称，双击切换 corner / smooth

与常见矢量编辑器一致。smooth 时 Shift 拖动一侧切线，另一侧保持共线等长；
双击顶点在 corner 与 smooth 间切换，切到 corner 时把两侧切线清零。

## 风险/权衡

- **路径与选区 chrome 重叠** → 路径层渲染在变换手柄之上：关键帧顶点就在对象 offset 角点，
  与 nw 缩放手柄必然重合（e2e 实测手柄拦截了顶点拖动），压在手柄之下顶点将永远拖不动。
  吸附参考线是拖拽期间的瞬时反馈，仍渲染在所有编辑 chrome 之上。
  顶点菱形与时间线的关键帧菱形同形，建立视觉呼应。
- **顶点密集时命中困难** → 命中半径独立于可见尺寸放大，沿用现有端点手柄
  `LINE_ENDPOINT_HIT_RADIUS = 10` 的做法；切线手柄的命中优先级高于顶点，
  否则重叠时永远选不到切线。
- **拖顶点与拖对象本体的手势冲突** → `path-handle` 命中优先级高于 `entity`，
  与 `paint-handle` 的现有处理一致。

## 迁移计划

新增可选属性，不传 `editablePath` 时 Stage 行为完全不变。

## 待解决问题

- 路径显示是否要跟随"仅显示选中对象"之类的过滤开关，等动画模式的显示选项成型后再定。
