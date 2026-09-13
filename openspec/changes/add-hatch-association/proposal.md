# 变更：填充跟着边界走

## 原因

已落地的 `HATCH` 是**手动**关联的：边界动了，填充停在原处，Inspector 标一句「已过期」，
按一下「重新生成」才跟上。`add-hatch-command` 把「自动关联怎么做」整条留在了「待定」第一条，
理由不是工作量——是它有一个**没有答案的问题**：边界动了之后落点可能落进另一块面，
于是形状会在用户没碰这块填充的情况下整个换掉。

本变更回答它，并把「跟不跟随」从一个布尔开关换成**三档**，每一档在屏幕上都说得出来。
设计稿：`docs/mockups/drafting-hatch-assoc.html`。

## 变更内容

- `Hatch` 加一个可选字段 `boundaryIds`：围出这块面的那几个 Entity。**缺席即不跟随**，
  因此已落地的填充行为逐字不变、不需要迁移，协议版本不变。
- 跟随挂在**事务提交**上：事务的 `targetIds` 与 `boundaryIds` 有交集才为那几块重求一遍，
  交集为空时一次都不跑。结果并进**同一个事务**，撤销一步边界与填充一起回去。
- 结果分三档：**清单相同即跟随**（静默）、**清单不同即过期**（不替用户换形状）、
  **求不出即失效**（保留原几何 + 画断口）。
- 落点改成「这块面的身份」：跟随成功后重取到**最大内切圆的圆心**，离每一条边界都最远。
  Inspector 上那一行随之从「取点」改口成「锚点」。
- Inspector 加「断开关联」：删掉 `Hatch`，它变回一条普通闭合多段线。
  **不加「跟不跟随」开关**——那会造出一块看不见的状态。
- **不做**自动分组（填充落地时顺手建一个 Group 包住边界）。

## 影响

- 受影响的规范：`compose-document`、`stage`、`basic-materials`
- 受影响的代码：`core/hatch.ts`、`core/curve-region.ts`（新增选点纯函数）、
  `stage/drafting/drafting-entity.ts`（落地时存清单）、`stage` 的事务后置钩子、
  `component-registry` 的 `ComposeHatchEditPort`（加 `detach`）、
  `materials/hatch/inspector.tsx`
- 不受影响：`resolveComposeCurveRegion`、`Curve` 协议与版本号、`HATCH` 命令与它的两支、
  层序、色板、图标、命令行、光标与徽标
