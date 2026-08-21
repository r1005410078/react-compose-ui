# 变更：子级进入 Auto Layout 容器时按父级决定交叉轴尺寸

## Why

父容器交叉轴设为「拉伸」后，拖进去的矩形不会被拉伸。

`fix-auto-layout-cross-axis-stretch` 已经修好了 Hug 子级的继承，但那条修复的前提判断有误。它的
design.md 写「多数物料的默认尺寸模式是 Hug」，实际相反：`packages/materials/src/material-preset.ts`
给 Rectangle、Image、SVG 等共享 Preset 一律写 `mode: 'fixed'`，只有 Text 是 Hug。

而 `align-items: stretch` 在 Flexbox 里只对交叉轴尺寸为 auto 的子级生效。子级是 Fixed 时 stretch
是空操作——实测：父级 `alignItems: 'stretch'`、子级 `height: {mode:'fixed', value:20}`，求解后子级
高度仍是 20。因此除 Text 外，用户点「拉伸」永远看不到任何变化，而面板不给任何解释。

## What Changes

- 子级**进入** Auto Layout 容器时，若父级交叉轴对齐会拉伸该子级、而子级交叉轴是 `fixed`，
  则把该轴改写为 `fill`，`value` 保留为原固定值作为回退。两个落点都适用：Stage 的 reparent，
  以及容器启用 Auto Layout 时把已有子级转 Flow 的那条命令——后者是「先放物料再开自动布局」
  这条最常见路径，实施时才发现，提案初稿只写了 reparent。
- 只改写交叉轴：`flexDirection` 为 row/row-reverse 时改 `height`，为 column/column-reverse 时改
  `width`。
- 只在父级 `alignItems` 为 `stretch` **且**子级 `alignSelf` 为 `auto` 时改写。子级显式设过
  `alignSelf` 表示它要跳出父级对齐，MUST NOT 改写。
- 只改写 `fixed`。`hug` 已经能继承父级 stretch，改写会丢失 Hug 意图；`fill` 本就是目标状态。
- 这是一次显式、可见、可撤销的文档写入，**不是**级联：父级此后再改 `alignItems`，已有子级不跟随。
  子级此后自己改尺寸模式，以子级为准。

## 为什么不与既有决定冲突

`fix-auto-layout-cross-axis-stretch` 的 design.md 否决过「父级设为拉伸时自动把子级 Fill 勾上」，三条
理由分别是：父级改回去要不要回滚、用户手动改过要不要记标记、嵌套与批量要不要递归。这三条针对的是
**父级属性变化时反应式级联**。本变更在**子级进入容器的那一刻**一次性写入，父级属性变化不触发任何
写入，因此三条都不成立：没有回滚问题，不需要「是否手动覆盖」标记，也不存在递归。

`createReparentCommand` 已经在做反方向的同类改写——移出 Flow 父级时把 `fill` 烘焙成 `fixed`。本变更
是它的对称补全，不是新引入的机制。

## 影响

- 受影响的规范：`stage-engine`、`basic-materials`
- 受影响的代码：`packages/core`（共享规则 `adoptComposeCrossAxisSizing`）、
  `packages/stage-engine`（reparent）、`packages/materials`（启用 Auto Layout）。
  materials 不能依赖 stage-engine，因此规则下沉到两者共同依赖的 core
- 不改 `ComposeLayoutItem` / `ComposeAxisSizing` 数据结构，不新增文档字段，无迁移
- 行为变化：此后进入 stretch 容器的物料会填满交叉轴。已有文档不受影响，因为不做回溯改写
- 已知副作用：采纳发生在进入容器的瞬间，此时若容器仍是默认的 row，改写的是 `height`；用户随后
  把方向改成 column，`height` 变成主轴，`fill` 的语义从「拉伸」变为 `flexGrow`。首期接受该结果，
  由用户自行把该轴调回 `fixed`；不引入「父级属性变化时回溯改写」的级联
