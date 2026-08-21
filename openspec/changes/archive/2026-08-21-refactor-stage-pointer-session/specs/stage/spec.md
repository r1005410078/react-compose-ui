## ADDED Requirements

### Requirement: 指针会话生命周期是一条独立能力

从 `pointerdown` 归一化到会话结束的全部状态与判定 MUST 住在独立的 Hook 模块，包含连击计数、
Pointer capture 的接管与归还、window 路由、逐帧推进与取消清理。

会话 MUST 以单调递增的 generation 判等，MUST NOT 只凭 `pointerId` 判断消息归属——同一个
`pointerId` 可以先后属于两次会话，迟到的 rAF 回调、window 事件与 capture 丢失通知都可能跨越
会话边界抵达。

#### Scenario: 过期消息不误伤新会话

- **WHEN** 上一次会话的 rAF 回调在新会话开始后才执行
- **THEN** 该回调被丢弃，新会话的状态不受影响

#### Scenario: 主动释放与被动丢失可区分

- **WHEN** 会话主动归还 Pointer capture，浏览器随之派发 lostpointercapture
- **THEN** 该通知被识别为自身释放的回声而消费掉，不被当作手势中断

### Requirement: 手势路由装在 window 的捕获阶段

指针移动、抬起与取消的监听 MUST 装在 window 的捕获阶段，MUST NOT 只依赖 React 事件树。

宿主在自己的根节点上调用 `stopPropagation` 是合法的，但 React 树内的监听会因此漏掉手势的
最终点，而漏掉 `pointerup` 意味着手势永远结束不了。

#### Scenario: 宿主阻止冒泡不影响手势结束

- **WHEN** 宿主在根节点的指针处理里阻止事件继续传播
- **THEN** 手势仍能收到最终点并正常提交
