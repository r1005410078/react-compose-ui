# 变更：多选批量改属性

## 原因

还原一张储能一次接线图时，**属性面板在多选下整个塌成一句话**——「同时选中了多个组件；
只选中一个才能编辑属性」（`docs/oneline-diagram-dogfood-issues.md` 的 O-1）。线条颜色、
线条粗细、端点形状全部不可达，只能一条一条改：一条支路 36 条曲线分三种颜色、母线 19 条线
分三档线宽，全图做了 **75 次**「点空白 → 点中对象 → 开取色器 → 填 HEX → 回车 → Escape」
的六步循环。八条支路靠组件实例复用才没有乘以八；换成一张每条支路都不一样的图，这条就是
**做不下去**。

判据是「一个实施工程师照着接线图画，第一件事是什么」——他要把这一圈线都改成红的。而这
正是这个产品要替他省掉的那种重复工作。

「作用对象是选区，单选是它恰好一个成员的退化情形」这条判断在仓库里已经用过两次（时间线的
关键帧选区、文字样式的四件事）。这次是第三次，用在 Renderer Props 上。

## 变更内容

- **规划住 core**：新增 `planComposeSetRendererProps`，按一组 Entity 把一份 **patch** 合到
  **各自**的 props 上，产出**一条 batch**。合到各自而不是合到某一条的 props 上——拿其中一条的
  整份 props 去覆盖全部，会把别人身上不相干的属性一起改掉（A 线宽 2、B 线宽 5，改个颜色
  B 就变成 2 了），而这个错误在屏幕上要等用户去看 B 的线宽才发现。
- **Renderer Inspector 的上下文携带作用对象**：`ComposeRendererInspectorProps` 增加可选
  `entities`，**缺席即 `[entity]`**——既有物料一行不改，退化情形由构造保证。
- **属性面板认识「混合」**：新增 `mixedPaths`，列出的字段带一个可读的「多个值」标记与
  `data-property-mixed`。**MUST NOT 只靠把值留空表达**：数字框留得空、色板留不空，靠留空
  说这句话会在半数字段上说不出口。
- **多选 Inspector 出共有 Renderer 分组**：选区里的 Renderer **是同一种**时，渲染那个物料
  自己的 Inspector（与单选逐字相同的字段与编辑器），写入整批。**不按 prop 名跨类型取交集**
  ——文字的 `color` 与曲线的 `stroke` 不是一件事，而同名不同义的两个 prop 收进一个字段，
  用户读不出自己在改谁。混合类型时退回今天那句空态。
- **锁定的成员不被写入，并且说出来**：静默跳过等于让锁形同虚设的反面——用户会以为写进去了。

## 影响

- 受影响的规范：`compose-document`（批量 props 规划）、`component-registry`（Inspector 上下文
  的作用对象）、`property-panel`（混合值呈现）、`editor-workspace-layout`（多选 Inspector）
- 受影响的代码：
  - `packages/core/src/renderer-props.ts`：`planComposeSetRendererProps`
  - `packages/component-registry`：`ComposeRendererInspectorProps.entities`
  - `packages/property-panel`：`mixedPaths` 与字段标记
  - `packages/materials/src/material-inspector-kit/renderer-inspectors.tsx`：代表值、混合集合、
    写入扇出
  - `packages/editor/src/inspector/multi-selection-inspector.tsx`：共有 Renderer 分组
