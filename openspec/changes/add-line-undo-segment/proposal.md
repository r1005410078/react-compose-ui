# 变更：LINE 的参考点跟着文档走，并补上 `U` 放弃上一段

## 原因

`LINE` 画 a→b→c 之后按 `Control+Z`，b-c 那一段被撤销了，但**橡皮筋的起点仍停在 c**。会话的
`previous` 是它自己的状态，文档在它脚下变了而它不知道——下一个点会从一个已经不存在的地方连
出去。

同时 `LINE` 一直没有「放弃上一段」：画错一段只能整条 `Escape` 重来，而 `PLINE` 早就有 `U`。

## 变更内容

- **会话的参考点跟着文档走**：本次会话建出来的最后一个 Entity 不在文档里了，会话就回退一个点。
  外部撤销、别人删掉它、任何路径都算。
- `LINE` 新增 `U` 关键字：回退一个点，并删掉那一段。
- `StageDraftingEffect` 新增 `undoLastCreated`。

## 非目标

- **`U` 不是一次文档撤销**，是一次删除。SDD 3.2 当初写的是「就是一次文档撤销」，但 Stage 没有
  撤销端口，而引入一条只为这一个关键字服务的端口不划算；删除走的是 `ERASE` 已经在用的那条路。
  代价是历史里留下「新建 + 删除」两条而不是零条。
- 不拦截 `Control+Z`。它仍然是编辑器的撤销，Stage 只是**跟上**它的结果——这样任何改动文档的
  路径都自动被覆盖，而不是只覆盖那一个键。

## 影响

- 受影响的规范：`stage-engine`、`stage`
- 受影响的代码：
  - `packages/stage-engine/src/drafting/line-command.ts`
  - `packages/stage-engine/src/drafting/drafting-types.ts`
  - `packages/stage/src/drafting/use-stage-drafting.ts`
