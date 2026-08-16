# 变更：动画时间线支持滚轮缩放与横向平移

## 原因

动画时间线当前的水平比例完全由容器宽度决定（`.compose-animation-timeline__scale` 用
`calc(100% - 20px)` 加 `min-width: 700px`），没有独立于窗口大小的缩放能力。时长较长或关键帧
密集时，用户既放大不了局部区间做精细调整，也没有统一的横向导航手势——与 Stage
（`packages/stage`）已有的 Ctrl/Cmd+滚轮缩放、普通滚轮平移的手势约定不一致，学习成本被分散到
两套习惯。

## 变更内容

- 时间线区域新增独立于容器宽度的缩放状态：按住 Ctrl/Cmd 滚动鼠标滚轮以光标所在时间点为锚点
  放大/缩小；不按修饰键的滚轮/触控板滚动做横向平移，与 Stage 手势约定保持一致。
- 缩放只改变标尺、关键帧轨道、动画片段在时间轴上的位置与宽度（仍按时间比例换算），不改变
  片段条、关键帧菱形、拖动手柄等元素自身的视觉尺寸（圆角、边框宽度、菱形/手柄的像素大小保持
  不变）。
- 提供不依赖鼠标滚轮的缩放方式（工具栏按钮或键盘快捷键），满足无法使用滚轮手势的用户。
- 缩放与平移只影响当前 React 会话内的显示状态，不写入 `ComposeAnimationPanelValue`、
  不产生 Provider 的 `onValueChange` 事件、不影响关键帧的实际时间数据。
- 缩放状态在合理范围内钳制（不能无限放大导致标尺失去意义，也不能缩小到小于容器宽度导致左侧
  出现空白）。

## 影响

- 受影响规范：`animation-panel`（新增缩放与平移相关需求）。
- 受影响代码：`packages/animation-panel/src/animation-panel/compose-animation-panel.tsx`
  （`TimelineScale` 的定位计算改用显式像素宽度而非纯百分比）、
  `packages/animation-panel/src/animation-panel/animation-panel-model.ts`（新增纯函数：缩放钳制、
  以锚点为中心求解新滚动位置）、`packages/animation-panel/src/styles.css`。
- 不影响 `ComposeAnimationPanelValue`、`ComposeAnimationPanelProvider` 的公共状态契约；纯展示层
  改动。
