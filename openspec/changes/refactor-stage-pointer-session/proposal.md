# 变更：把指针会话生命周期切成独立 Hook

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 5 的第五刀，也是这一轮最大的一块。
「一次指针交互从按下到结束」是 `ComposeStageReady` 里最纠缠的部分：七个 ref、十一个回调、
一个卸载 effect、一个 JSX 处理器，散在文件的五处，中间还夹着与它无关的资源拖入与效果分派。

它同时也是 Stage 里最容易出错的一段——迟到的 rAF 回调、跨会话的 window 事件、浏览器单方面
收走 Pointer capture，三类竞态都要在这里挡住。这些判定必须能被当成一件事读。

## 变更内容

- 新增 `use-stage-pointer-session.ts`（517 行）：会话类型、七个 ref、按下归一化（含连击计数）、
  capture 接管与归还、window 路由安装、逐帧推进、结束/取消、卸载清理、capture 丢失处理。
- `compose-stage.tsx` 2034 → 1621 行。

## 两处必须由宿主决定、因此留在外面的

- **临时平移的结束**。失去 capture 而被迫取消时它也该停，但它属于键盘能力。Hook 通过
  `onCaptureLostAbort` 回调交给宿主，而不是自己去认识「临时平移」这个概念。
- **`onLostPointerCapture` 的宿主透传**。宿主的同名 prop 必须先于内部处理调用，这个顺序
  是既有契约。

宿主这一侧多了一个 `stopTemporaryPanRef`：键盘 Hook 必须排在剪贴板之后声明，而指针会话排在
最前，两者构成声明顺序上的环。用 ref 打破它是诚实的做法——指针会话只在事件发生时读取，
不在渲染期读取，因此这个间接层没有引入新的时序假设。

## 影响

- 受影响的规范：`stage`（适配层组织）
- 受影响的代码：`stage-surface/compose-stage.tsx`、新增 `use-stage-pointer-session.ts`
- 用户可见行为：无。既有测试与 e2e 一行不改，133 项单测与 99 条 e2e 一次通过。
