# 变更：把旋转工具拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第三刀
（`rotate-tool`，1600）。两个前置（`transform-planning`、`transform-preview`）已就位，
共享机器变成了可导入的纯函数，因此这一刀只需搬迁 rotate 自身。

抽取过程暴露了契约的两个缺口，都由 rotate 的实际需要驱动：

1. **并发变化中止**。规范要求「并发的文档或布局变化 MUST 中止引用 Entity 的空间手势」，
   现有实现靠内核读 `gesture.type` 枚举手势种类。rotate 一旦进插件，`gesture` 里就没有它，
   旋转中途文档变化将不再中止——与文字编辑守卫同一类的顺序陷阱。
2. **`cancel` 拿不到 ctx**。会话在 claim/update 里发布过快照、捕获过指针，取消时必须自己
   还原，而 `cancel()` 无参。**pan 也有同一问题**：取消后快照停在 `pan` phase。

## 变更内容

- 新增 `rotate-plugin.ts`，优先级 1600 取自 `STAGE_GESTURE_PRIORITY`。
- **BREAKING**（内部协议）`StageSession.cancel` 改为接收 `StagePluginContext`；
  `StageSessionArbiter.cancel` 同步增加 ctx 参数。pan 与 rotate 的 `cancel` 各自发布空闲
  快照并释放指针捕获。
- **新增** `StageSession.isCompatibleWith?(next, nextIndex)` 与
  `StageSessionArbiter.revalidate(next, nextIndex, ctx)`：会话自己判断上下文变化后是否仍然
  成立，内核不再枚举手势种类。省略即视为始终成立（平移、绘制都不该被文档变化打断）。
- legacy 删除 rotate 分支：`begin()` 的 rotate-tool 块、`updateGesture` 的 rotate 分支、
  `startTransform` 的 rotate 建手势分支、`Gesture` 联合的 rotate 变体、提交分支的 rotate 类型。

## 影响

- 受影响的规范：`stage-engine`（Stage 交互插件仲裁：追加会话自检；手势预览与原子提交）
- 受影响的代码：`interaction-kernel/rotate-plugin.ts`（新增）、`kernel-types.ts`、
  `session-arbiter.ts`、`pan-plugin.ts`、`interaction-controller.ts`
