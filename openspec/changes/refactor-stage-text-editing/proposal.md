# 变更：把原地文字编辑切成独立 Hook

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 5 的第四刀。原地文字编辑是
`ComposeStageReady` 里剩下的能力中边界最清楚的一条：进入、逐字符更新测量覆盖、退出时按内容
收敛为至多一条事务。它的状态、四个回调与派生值散在文件的四处，而已有四条 e2e 专门盯着它。

## 变更内容

- 新增 `use-stage-text-editing.ts`：会话状态、`isTextEditable`、`contentReflowsWithWidth`、
  进入/更新/退出，以及 authored 文本派生。`entityEditableText` 一并迁入。
- `compose-stage.tsx` 相应减去这四处，2129 → 2034 行。

## 一条被这一刀验证出来的约束

Hook 的回调**引用稳定不是性能优化，是正确性要求**。

第一版把宿主传入的 `restoreFocus` 放进了 `exitTextEditing` 的依赖数组。宿主每次渲染都新建
这个箭头函数，于是 `exitTextEditing` 每帧换身份，进而让宿主的效果处理表每帧重建——
**七条既有用例当场失败**：线段端点拖动提交不出事务、框选选不中、路径顶点上报 `cancel` 而
不是 `end`。这些手势会把上下文变化判成「该中止了」。

修法是让 `restoreFocus` 也从内部的「最新值」ref 里读，不进依赖数组。这条约束现在写在 Hook
的 TSDoc 里，因为它从签名上看不出来。

## 影响

- 受影响的规范：`stage`（适配层组织）
- 受影响的代码：`stage-surface/compose-stage.tsx`、新增 `use-stage-text-editing.ts`
- 用户可见行为：无。既有测试与 e2e 一行不改。
