# 变更：仪表盘网格布局

## 原因

大屏的仪表盘区域今天没有合适的排法。**Auto Layout 排不出来**——它是一条轴上的序列，而
「这张在左上、那张占两行、右边一列窄的」是二维的摆放。**绝对定位排得出来，但改不动**：
客户现场要求「把告警挪到左上、趋势拉宽一点」，实施工程师得手算另外五张卡的坐标，而这正是
这个产品要替他省掉的那一类工作。

`ComposeLayout` 从一开始就是联合类型（今天只有 `flex` 一个成员），Inspector 的 `+` 菜单
也从第一天起就是**菜单**（`LayoutActionMenu` 收 `items` 数组，至今只有一项）——这两处都为
第二种布局留好了位置。

交互设计稿：`docs/mockups/grid-layout.html`。

## 变更内容

- 新增 `grid` 布局类型：`ComposeLayout` 的第二个成员，保存列数、行高、两轴间距、四边内边距
  与重力开关。容器高度仍按既有 Hug / Fixed 规则。
- 新增可选 `GridItem` Component（`{x, y, w, h}` 单位是**格**，可选 `minW`/`minH`），
  挂在格中子级上。**缺席即不在格中**，与 `Ports`、`Curve`、`Frame` 是同一条判断。
- **无需迁移、协议版本不变**：两者都是可选新增，缺席时既有文档逐像素不变。
- 新增 core 纯函数网格求解器：碰撞检测、向下推挤、重力上浮。**住 `core` 而不是
  `layout-engine`**——`stage-engine` 要用它算「松手会落在哪一格」，而那个包不依赖
  `layout-engine`。判据与 `curve-geometry.ts` 逐字相同。
- Layout Runtime 增加网格预解算 pass：格坐标解成绝对矩形后交给 Yoga 的绝对定位节点。
  渲染、命中、捕捉、场景树、动画与导线求解**一行不改**——它们读的是 Snapshot 的绝对 box。
- **BREAKING（行为）**：Stage 的实时布局求解从「只有 resize」扩大到「resize 与网格内的
  move」。网格里拖动时兄弟必须实时推开，否则它退化成一个已经有了的能力（网格吸附）。
- 格中子级的拖动与缩放走**格坐标**而不是像素 offset；一次手势（含被推挤的兄弟）MUST 是
  一条事务，撤销一步全回去。
- Inspector：`+` 菜单加第二项、引导卡改为二选一、容器侧「布局」分组的网格档、子级侧
  「几何」分组的**第三档**（网格坐标顶掉位置/自身对齐，尺寸降为只读）。
  项间距与内边距两个 editor 直接复用 flex 的。
- 不做：响应式列数收缩、按比例的行高、交换式推挤、GridStack 的 `locked`
  （与既有 `Lock` Component 撞词）。理由见 `design.md`。

## 影响

- 受影响的规范：`compose-document`、`layout-engine`、`stage-engine`、`stage`、
  `basic-materials`
- 受影响的代码：`packages/core`（协议 + 求解器）、`packages/layout-engine`（预解算）、
  `packages/stage-engine/src/gesture-planning` 与 `hit-testing`、
  `packages/stage/src/stage-surface`（覆盖层 + 预览求解接线）、
  `packages/materials/src/flex-layout` 与 `material-inspector-kit`
- 依赖：无新增外部依赖
- 不在本变更内：网格容器的嵌套（一块网格里再放一块网格照常可用，但不为它做任何特殊处理）
