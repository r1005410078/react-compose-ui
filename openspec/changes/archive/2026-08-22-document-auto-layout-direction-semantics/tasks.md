# 任务

## 1. 规范

- [x] 1.1 `Auto Layout 按需启用` 正文补上「改写只发生在启用当刻，此后不级联」
- [x] 1.2 正文写清不修的理由与代价，使下一个人遇到的是决定而不是空白
- [x] 1.3 补 Scenario：方向变化不回退采纳时改写的尺寸模式

## 2. 测试

- [x] 2.1 用例：采纳得到 `height: fill` 后把父级改为 column，子项 LayoutItem 逐字不变
- [x] 2.2 用例：该次编辑只写入父级 Layout，`targetIds` 与 patch 都不含子项
- [x] 2.3 用例：同一个子项在新方向下的「应采纳轴」已经与它实际是 fill 的那个轴分离
      ——这正是含义发生变化的机制

## 3. 验证

- [x] 3.1 `bun run lint`
- [x] 3.2 `bun run typecheck`
- [x] 3.3 `bun run test`
- [x] 3.4 `bun run build`
- [x] 3.5 `bun run test:e2e`

## 4. 实施中的发现与偏离

- [x] 4.1 **断言写错了事务形状**：先写成 `result.entry.patches`，实际 `CommandDispatchResult`
      的 committed 分支给的是 `transaction`，正向补丁在 `transaction.forward`。改对之后顺带
      把 `targetIds` 也断言上——级联一旦被加进来，两条会同时变红，而不是只有一条。
- [x] 4.2 **第二条用例锁的是机制而不是结果**：直接对 `adoptComposeCrossAxisSizing` 喂同一个
      已采纳的子项与翻转后的 layout，证明「应采纳的轴」已经换成 width，而 fill 还留在 height。
      这比只断言「子项没变」更接近问题本身——它显示的是含义如何分离的，下一个人读用例就能
      看懂为什么这条债不是 bug。
- [x] 4.3 实现一行没动。`adoptComposeCrossAxisSizing` 本来就只在启用当刻被调用，这一刀只是
      把这个事实从「碰巧如此」变成「写下来并有测试」。
