## 上下文

标尺与网格是同一套世界点阵的两种成像。现在点阵各算一次（`createRulerTicks` 在 stage-engine，
`createVisibleGridAxis` 在 stage），成像规则又不同，于是「同一世界坐标」在屏幕上落到不同像素。

## 目标/非目标

- 目标：两者由同一纯函数产出点阵、共用设备像素取整规则，对齐由构造保证而非靠调参对齐。
- 目标：标尺脱离 React reconcile，平移缩放时不再重建数百个 SVG 节点。
- 非目标：网格改 canvas、标尺可配置刻度密度、标尺单位切换、打印/导出标尺。

## 决策

- **点阵下沉到 stage-engine**：`createRulerTicks` 与网格轴共用一个 `createAxisLattice(step,
  offset, viewportOffset, zoom, minSpacing)`，只有 `minSpacing` 阈值不同（标尺按可读性，网格按
  2px）。stride 均为二次幂，保证标尺刻度始终是网格线的子集。
- **取整规则**：线统一以「坐标为左边界、向右覆盖 1 CSS px」绘制（canvas 用 `fillRect`，
  而非以坐标为中心的 `stroke`），与 CSS gradient 的 `[pos, pos+1)` 语义一致。点阵首线按
  设备像素取整；`screenStep` 为分数时后续线无法逐条对齐设备像素（CSS 平铺的固有限制），
  此时两者仍落在同一位置，只是同样带抗锯齿。该规则以纯函数形式提供并单测，两侧共用。
- **Canvas 生命周期**：canvas 尺寸跟随 ResizeObserver 与 dpr 变化重设 backing store；绘制在
  viewport/选区/指针变化时调度到一次 rAF，避免 pointermove 触发多次重绘。
- **可访问性**：容器 div 保留 `role` 与 `aria-label`；canvas 是 `aria-hidden` 的纯装饰层。标尺
  本身不承载可聚焦语义，现有键盘路径不经过它。
- **指针游标线**：指针位置属于瞬时视图状态，留在 Stage 组件本地 state，不进文档、不进历史。

## 风险/权衡

- 失去 DOM 可查询性：刻度位置无法再用选择器断言。以「纯点阵单测 + 黄金图」替代，前者覆盖
  数值正确性，后者覆盖成像；这也是现在唯一能验证半像素问题的手段。
- Canvas 文本渲染与 SVG 有细微差异：字体、字重与 letter-spacing 需按现有 `styles.css` 的
  `9px ui-monospace` 复刻，黄金图会捕捉差异。
- 去掉次刻度是可感知的视觉变化：与 Figma 一致，但若后续需要密集刻度，需重新评估。

## 迁移计划

标尺是 Stage 内部实现，宿主无需迁移。`data-world-value` 仅被本仓 e2e 使用，随本变更一起改写。
