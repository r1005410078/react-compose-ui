# 变更：画布拖拽支持跨容器移动与同容器内重排

## Why

当前 Stage 的 `move` 手势只做两件事：普通节点在原父级内改坐标；Flow 子项一旦被拖动，
`packages/core/src/builtin-commands.ts` 的 `appendSpatialTransformPatches` 无条件把它烘焙成 Absolute
（`operation === 'move' && item.positioning === 'flow'` 一旦成立就写死 `positioning: 'absolute'`）。
这是 `stage/spec.md`「直接移动缩放与旋转」需求里明文规定的行为：「Stage MUST 在拖动...时把它转换为
Absolute 后移动，不得在 Stage 重排 Flow」。

由此产生两个实测体验问题：

1. **画布上拖不进容器。** 把一个节点拖到容器上方松手，它只是坐标重叠的兄弟节点，不会真的成为该容器
   的子级。reparent 目前只存在于场景树拖拽（`packages/scene-tree/src/use-scene-tree-drag.ts`）和外部
   资源拖入（`packages/stage-engine/src/interaction-controller.ts` 的 `externalDrop`）两条路径，画布
   内部的普通 move 手势完全没接。
2. **Auto Layout 容器里，拖一下就变 Position。** 只要移动量非零，Flow 子级立刻被焊死成 Absolute，
   哪怕用户只是想把它挪到相邻两个兄弟中间做个重排。Figma 的等价场景是拖拽时显示插入指示线做原地
   重排，退出 flow 是一个独立的显式开关（Ignore Auto Layout），跟拖拽动作本身不绑定。

两者共享同一段代码路径——`move` 手势的 finish 分支，以及落点容器的判定——因此放在同一份变更里。

## What Changes

### 1. 画布拖拽跨容器移动（reparent）

- Stage `move` 手势新增落点判定：取指针下最深的合法容器（复用既有 `containerAtPoint`），但
  **必须排除被拖动 Entity 自身与其全部后代**。`containerAtPoint` 目前没有排除参数，这是本变更唯一
  需要新增的底层索引能力。
- **默认不 reparent。** 只有指针进入目标容器包围盒内部达到规定比例（不贴边）时，才判定为「意图进入」
  并把该容器记为候选目标，Pointer Up 才提交 reparent。这是为了不重蹈 Figma「自动吸入太激进」的覆辙
  ——他们的用户论坛长期在要求关掉这个行为。判定只用几何比例这一个条件，不叠加停留计时（理由见
  design.md）。
- Reparent 落地时沿用 `createReparentCommand` 现有的 `targetManagesFlow` 判定（进 Layout 容器给
  Flow，进普通容器给 Absolute）。**不在拖拽手势里新增「要不要参与 flow」的分支**——拖入后若想让它变成
  不参与排队的覆盖层，用 Inspector 已有的 Flow/Absolute 切换二次调整，拖拽只负责选对父级。
- Pointer Up 只提交一次 reparent 命令；Escape、失去指针捕获或候选目标失效（自身/后代/锁定/无
  Hierarchy）时不提交，沿用既有手势原子性保证。

### 2. Auto Layout 容器内原地重排

- 容器 `flexWrap` 为 `nowrap` 时，画布内拖拽 Flow 子级在**同一容器内部**移动，沿主轴比较指针位置与
  各兄弟中点得到插入位置，只提交一次改变 `Hierarchy.childIds` 顺序的命令，**不烘焙 Absolute、不碰
  LayoutItem**。这与场景树同父级排序的语义完全一致（`editor-workspace-layout/spec.md`「同父级 Flow
  排序 MUST 只修改 Hierarchy 顺序」），且和场景树走同一个 `moveEntity` 命令，`core` 无需改动。
- 拖出该容器边界之外时，才按现有规则烘焙成 Absolute——触发条件从"移动量非零"改为"离开容器"。
- 容器 `flexWrap` 为 `wrap` 或 `wrap-reverse` 时**维持现状**：拖动即烘焙 Absolute。二维环绕布局下用
  指针位置反推插入序号存在真实歧义（不像单轴或场景树列表那样有唯一解），首期不勉强解决，避免引入
  复杂且脆弱的启发式判定。

## 首期边界

- reparent 与容器内重排都只处理单一目标容器；跨越多层嵌套容器的「穿透式」拖拽沿用「指针下最深容器」
  的既有语义，不做额外的层级穿越提示。
- 不引入 Figma 式的「按住某个键退出容器/跳过某一层」修饰键交互，首期只用几何判定意图。
- `flexWrap: wrap` 容器内重排不在本次范围内。
- 多选拖拽的批量 reparent 规则（相对顺序保持、祖先/后代去重）沿用场景树已经验证过的规则，不重新
  设计一套。
- 不改变 move 拖动过程中被拖动目标自身的选中框与变换手柄呈现，只新增候选容器的高亮。
