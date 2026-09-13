# 变更：场景预览默认铺满那块屏

## 原因

预览里场景的默认 `fit` 是 `contain`。屏幕比例与场景比例不同时（整屏形态的默认屏幕就是
浏览器视口，几乎从不等于场景的 16:9），它会在两条边留出台面的棋盘格——而**那块屏上本来
不会有那两条边**：交付出去的大屏是整块亮着的，用户看到的两条格子带不对应任何真实的东西。

`fill` 不是答案：两轴各自拉伸会改变每一个图形的形状，那是用户从未画过的样子。

## 变更内容

- `defaultFitForTargetKind('scene')` 由 `contain` 改为 `cover`：两轴比例取**较大者**等比
  缩放，两条边都不留台面，较松的那一轴等量溢出并被屏幕盒子裁掉（`overflow: hidden` 已在
  `frameFitStyle` 里就位，不必新增）。
- 组件那一档（`none`）一个字不改。
- 代价写在明处：场景边缘的一圈内容会被裁掉，裁多少由屏幕比例决定。要看完整的场景就把屏幕
  尺寸选成场景自己的尺寸——那一档 `cover` 与 `contain` 给出同一个答案。

## 附带修掉的缺陷

`fit` 量的那个 wrapper 是 `height: 100%`，而它的父节点 `ComposePreview` 根 `<section>` 高度
天生是 auto，百分比高度因此退化成 auto、wrapper 贴着 `Frame.size.height`。症状是**纵轴比例
恒等于 1**：`contain` 取较小者，于是场景只会缩小、永远不放大，而整屏预览的读数写着 1:1，
看起来像是刻意的。`fit` 生效时根节点现在撑满宿主盒子。没有这一条，改成 `cover` 也只会得到
`max(x, 1)`——另一种错。

## 影响

- 受影响 specs：`compose-preview`
- 受影响代码：`packages/preview/src/preview-dialog/screen-size.ts`、
  `packages/preview/src/compose-preview/compose-preview.tsx`、`e2e/preview-fullscreen.spec.ts`
- 非破坏性：`fit` 仍是宿主可覆盖的呈现参数，协议与公共 API 形状不变。
