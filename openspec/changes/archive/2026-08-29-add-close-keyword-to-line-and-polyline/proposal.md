# 变更：LINE 与 PLINE 的闭合关键字，关键字可点

## 原因

画元器件外框时最后一步几乎总是「回到起点」。今天用户只能自己把最后一个点对到第一个点上——
靠端点捕捉能对准，但那是一次多余的瞄准，而且开放折线与闭合折线在文档里是两种东西
（`closed` 是布尔），肉眼分不出来。

同时，命令提示里的 `[放弃(U)]` 今天**只能打字母**。协议已经有 `ComposeCommandKeyword`
（带 `key` 与已本地化的 `label`），把它渲染成可点的 chip 是纯呈现层增益。

SDD 3.2 已确认这两条。

## 变更内容

- `LINE` 新增 `C` 闭合：从当前点画一段回到**第一个点**，然后结束。
- `PLINE` 新增 `C` 闭合：置 `closed: true` 并提交，之后不再等下一个点——闭合本身就是结束信号。
- `ComposeCommandLine` 把 `prompt.keywords` 渲染成可点按钮，点击等同键入那个字母。

## 非目标

- `LINE` 的 `U`（放弃上一段）。它等于一次**文档撤销**，而 Stage 今天没有撤销端口
  （`ComposeStageProps` 里没有），需要先引入一条注入通道。单列一刀。

## 影响

- 受影响的规范：`stage-engine`、`components`
- 受影响的代码：
  - `packages/stage-engine/src/drafting/line-command.ts`
  - `packages/stage-engine/src/drafting/shape-commands.ts`
  - `packages/stage-engine/src/drafting/drafting-types.ts`（`closeKeyword` 文案）
  - `packages/components/src/command-line/command-line.tsx`
  - `packages/stage/src/stage-i18n.ts`
