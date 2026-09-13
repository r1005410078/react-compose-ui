## Why

A 在顶点模式里、有一个**点亮的热夹点**时，双击 B 想切到 B 的顶点模式，结果是：第一下把 A 的
顶点放到光标底下（热夹点的取点语义），第二下正好落在刚放下的那个夹点上，B 永远进不去——A 既
没取消，几何还被改了。而热夹点常常是不经意点亮的：在一个夹点上点一下、没动，它就亮了。

## What Changes

- 热夹点下按在**别的 Entity** 身上、且落点**没吸上任何特征点**：取消夹点会话（不改几何），
  选中那个 Entity。吸上了特征点（捕捉标记亮着）照旧取点——「把这个角对到那个角上」靠它；
  落在自己身上或空白处照旧取点。
- `stage-engine` 的 `drafting.point` 效果多带一个 `hit`：宿主要知道这一下落在谁身上。

## Impact

- 受影响规范：`stage`（顶点取点是一条命令会话）、`stage-engine`（取点效果携带命中）。
- 受影响代码：`stage-engine/drafting/drafting-point-plugin.ts`、`stage-engine/interaction-controller.ts`、
  `stage/drafting/use-stage-drafting.ts`、`stage/stage-surface/entity-creation/use-stage-effect-dispatch.ts`。
- 协议不变。行为变更只在「热夹点 + 点到别的 Entity 身上 + 没吸上」这一档。
