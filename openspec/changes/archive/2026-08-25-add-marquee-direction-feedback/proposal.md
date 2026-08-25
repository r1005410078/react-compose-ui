# 框选的两个方向要看得出来，也要真的不一样

## Why

实测（探针跑完即删）。画一个矩形，两个方向各拖一次、都只框住它的一半：

```
左→右 拖动中   mode=intersect  fill=rgba(54,135,255,0.1)  stroke=rgb(54,135,255)  dash=4,3
左→右 选中数   1
右→左 拖动中   mode=intersect  fill=rgba(54,135,255,0.1)  stroke=rgb(54,135,255)  dash=4,3
右→左 选中数   1
```

**两个方向逐字相同。**颜色、虚实、判定，一处不差。

两半各有一个原因：

### 一、判定：方向决定不是默认的

`directional` 这套代数一直都在（`resolveMarqueeHitTest`：起点在左等价 `contain`，起点在右
等价 `intersect`），但编辑器的初值是 `'intersect'`（`controller.tsx`），引擎的
`DEFAULT_STAGE_MARQUEE_MODE` 也是 `'intersect'`。**不去工具栏菜单里手动选「方向决定」，
方向就什么都不做。**功能在，可达不到——这与「能力不可发现」是同一类毛病。

### 二、呈现：两种判定共用一个颜色

样式表里只有一条差异——`intersect` 加 `stroke-dasharray`。填充与描边都是同一个蓝。虚实是
**唯一**的区分，而它在拖动中的细边框上分辨率很低，尤其在密集图纸上。

AutoCAD 把这件事交给两个各自独立的系统变量：`WINDOWAREACOLOR`（左→右，蓝）与
`CROSSINGAREACOLOR`（右→左，绿），透明度由 `SELECTIONAREAOPACITY` 控制。颜色是主区分，
虚实是副区分。

## What Changes

- **默认判定改成 `directional`**：引擎的 `DEFAULT_STAGE_MARQUEE_MODE` 与编辑器的初值一起改。
  菜单三项都留着——用户仍然可以钉死一种判定，改的只是初值。
- **两种判定各有自己的颜色**：包含（窗口）保持蓝，相交（窗交）换成绿，填充与描边一起换。
  颜色**按当前生效判定**给，与模式无关——钉死 `intersect` 时它一直是绿的，那正是当前生效的
  判定。虚实边框保留：颜色回答「哪一种」，虚实是同一句话的第二遍，密集图纸上两条都用得上。
- 颜色进 token（明暗两套），不硬编码在 marquee 规则里。

## Impact

- 规范：`stage-engine` 的「框选判定模式协议」MODIFIED（默认值）、`stage` 的「选择与框选」
  MODIFIED（呈现按判定分色）、`editor-workspace-layout` 的「框选工具与判定模式菜单」
  MODIFIED（初值）。
- 代码：`packages/stage-engine`（默认值）、`packages/stage`（样式与 token）、
  `packages/editor`（初值）。
- 破坏性：**是一处行为变化**。今天从右往左拖与从左往右拖结果相同，改后从左往右只选**完全
  框住**的对象。这正是这一刀要的，但它会让既有用例里「随手拖个框选中部分重叠对象」的写法
  失效——需要逐条确认方向。

## Non-Goals

- **不做套索**（AutoCAD 2015+ 的按住拖出自由形状）。它是第三种取框方式，与这一刀的判定与
  呈现无关。
- **不做选择区域透明度的用户设置**（`SELECTIONAREAOPACITY`）。眼下没有第二个消费者要它，
  按「没有消费者的字段不进协议」不加。
- **不改选择的累加语义**。替换 + Shift 累加不动，这一刀只管判定与呈现。
- **不改 `contain` 用世界 AABB 判定这条既有近似**（旋转节点的 AABB 大于实际图形，因此
  `contain` 对它偏严格）。那是另一条已记录的取舍，与方向无关。
