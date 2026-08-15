## 上下文

`TimelineScale`（`compose-animation-panel.tsx`）当前把标尺、片段、关键帧全部按
`timelineRatio(timeMs, durationMs)` 换算成百分比 `left`/`width`，挂在
`.compose-animation-timeline__scale` 上；这个 div 本身宽度由 CSS 决定
（`width: calc(100% - 20px)`，`min-width: 700px`），不受用户控制，外层
`.compose-animation-timeline__scale-scroll` 只在内容超过 `min-width` 时才会出现横向滚动条。
缩放需要让 `.scale` 的实际像素宽度成为一个用户可控、独立于容器宽度的量，同时保持所有已有的
百分比定位逻辑不变——因为片段/关键帧/标尺刻度都已经是"占 `.scale` 宽度的百分之几"，只要
`.scale` 自身宽度变化，它们就会一起按时间比例伸缩，天然满足"片段位置随缩放变化、但片段视觉
尺寸不变"（视觉尺寸如圆角、边框宽度、菱形大小已经是 CSS 里独立于容器宽度的固定 px 值，缩放
改动不涉及它们）。

Stage（`packages/stage/src/stage-surface/compose-stage.tsx`）已经实现了同一套手势约定：
Ctrl/Cmd+滚轮按 `Math.exp(-deltaY * 0.002)` 的指数因子缩放，并以指针所在的世界坐标为锚点求解
新的视口偏移，使得缩放前后指针下方的内容保持对齐；不按修饰键的滚轮做平移。`animation-panel`
架构上不能依赖 `stage-engine`（AGENTS.md 的包边界），因此这里在 `animation-panel-model.ts` 内
本地实现一个仅针对一维时间轴的等价纯函数，复用同样的手势与数学直觉，但不引入跨包依赖。

## 目标/非目标

- 目标：Ctrl/Cmd+滚轮以光标时间点为锚点缩放；普通滚轮/触控板横向平移；提供无需滚轮的缩放入口
  （工具栏按钮或快捷键）；缩放/平移只是本地展示状态，不进入 `ComposeAnimationPanelValue`。
- 非目标：不做"适应窗口"/"重置到默认缩放"之外的额外视图预设；不做垂直方向缩放（轨道行高目前
  已用 `--ap-track-row-height`/`--ap-property-row-height` 响应容器高度，不在本次范围内）；不改变
  `ComposeAnimationClip`、关键帧等任何持久化数据结构。

## 决策

- 决策：新增一个 `pixelsPerMs` 展示状态（`TimelineScale` 内的 `useState`，不进入 Provider
  session），缩放即改变这个值；`.compose-animation-timeline__scale` 的宽度改为
  `Math.max(minWidthPx, durationMs * pixelsPerMs)` 的显式 px 内联宽度，替换当前的
  `width: calc(100% - 20px)`。所有现有的 `timelineRatio` 百分比定位逻辑不变，因为百分比是相对
  `.scale` 自身宽度的，`.scale` 宽度变化后它们自动跟着缩放。
  - 考虑过的替代方案：把缩放状态放进 `ComposeAnimationPanelValue`（可被 Provider 受控）。
    否决原因：缩放是纯展示层的视口概念，不是动画数据；放进共享会话状态意味着受控模式下宿主
    必须同时管理这个和动画数据无关的量，违反"只保存最小且不可派生的状态"的项目约定，也会让
    `ComposeAnimationInspector`（不渲染时间线）无谓地依赖这个字段。
- 决策：新增纯函数 `zoomComposeAnimationTimelineAt(pixelsPerMs, anchorTimeMs, factor)` 与
  `clampComposeAnimationPixelsPerMs(pixelsPerMs, containerWidthPx, durationMs)`，放在
  `animation-panel-model.ts`，用与 Stage 一致的指数因子公式，返回钳制后的新 `pixelsPerMs`；
  滚动位置的锚点保持由 React 层在 wheel 事件里读取 `scaleScrollRef.scrollLeft` 后直接计算写回
  （一维锚点保持只是"锚点时间对应的像素位置在缩放前后不变"，比 Stage 的二维仿射变换简单得多，
  不需要单独抽象出 viewport/matrix 概念）。
  - 考虑过的替代方案：直接导入 `@compose-ui/stage-engine` 的 `zoomViewportAt`。否决原因：
    `stage-engine` 是二维、带旋转/矩阵的通用视口模型，架构边界也明确禁止 `animation-panel`
    依赖它；一维场景硬套二维 API 反而增加认知负担。
- 决策：缩放的钳制下限保证 `durationMs * pixelsPerMs >= 容器可视宽度`（不允许缩小到时间线比
  可视区域还窄，避免出现无意义的空白）；上限给一个绝对值上限（例如相当于"1ms 对应若干像素"的
  量级，具体数值留给实现阶段结合关键帧 10ms 吸附粒度调参，使最大缩放下 10ms 对应的像素距离仍然
  可用但不至于让 300ms 动画撑出几万像素宽的 DOM）。
- 决策：无滚轮场景的缩放入口复用工具栏已有的 `.compose-animation-timeline__button-cluster`
  区域，新增一组缩放按钮（放大/缩小），并支持聚焦时间线区域后用键盘快捷键触发，具体快捷键与
  文案在任务阶段与现有 `messages` i18n 结构一起定稿。

## 风险/权衡

- 风险：`.scale` 从百分比宽度改成显式像素宽度后，容器窗口变化（resize）需要重新读取
  `scaleScrollRef` 的可视宽度来做钳制上下限判断，否则用户缩小窗口后可能出现钳制下限判断过时
  的问题 → 用 `ResizeObserver` 监听 `.scale-scroll` 的可视宽度变化，resize 后重新钳制当前
  `pixelsPerMs`（缩小视口时如果当前缩放低于新的下限，则回弹到下限）。
- 风险：现有依赖"`.scale` 是响应式百分比宽度"的既有测试（例如用
  `getBoundingClientRect` mock 出 `{ left: 0, width: 300 }` 来模拟拖动关键帧的测试）在改为显式
  像素宽度后仍然成立，因为这些测试本来就是通过 mock `getBoundingClientRect` 来控制测试环境下
  的像素宽度，不依赖具体是百分比还是显式宽度撑出来的 → 需要在实现阶段确认这批既有测试在新逻辑
  下依然通过，而不是假设它们自动兼容。
- 权衡：把缩放状态放在组件本地而非 Provider session，意味着如果宿主想要"记住用户上次的缩放级别"
  跨页面/跨会话持久化，本次不提供这个能力（如后续需要，可以在 `localStorage` 或宿主自己的状态
  管理里做，不需要污染 `ComposeAnimationPanelValue`）。

## 迁移计划

纯新增能力，不改变任何现有公共类型或 Provider 契约，无需迁移步骤，也不引入破坏性变更。

## 待解决问题

- 无滚轮缩放入口的具体键盘快捷键（例如是否复用 Stage 的 Ctrl/Cmd+`=`/`-`/`0` 约定）留给实现
  阶段与产品/设计确认，避免和宿主编辑器（`packages/editor`）已注册的全局快捷键冲突。
- 最大缩放级别、默认缩放级别的具体数值留给实现阶段结合关键帧 10ms 吸附粒度调参确定。
