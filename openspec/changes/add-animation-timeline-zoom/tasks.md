## 1. 缩放/平移纯模型

- [ ] 1.1 Red：为 `zoomComposeAnimationTimelineAt`（锚点保持）与
  `clampComposeAnimationPixelsPerMs`（上下限钳制，含容器宽度变化后回弹）编写 `animation-panel-model.test.ts`
  用例。
- [ ] 1.2 Green：在 `animation-panel-model.ts` 实现这两个纯函数。
- [ ] 1.3 确定并写死最大/最小缩放级别的具体数值（结合 10 ms 关键帧吸附粒度调参），补充边界用例。

## 2. TimelineScale 改用显式像素宽度

- [ ] 2.1 Red：为"`.scale` 宽度随缩放变化、片段与关键帧仍按时间比例定位"编写组件测试。
- [ ] 2.2 Green：`TimelineScale` 引入本地 `pixelsPerMs` state；`.compose-animation-timeline__scale`
  的宽度从 CSS 百分比改为内联像素宽度 `Math.max(可视宽度, durationMs * pixelsPerMs)`。
- [ ] 2.3 确认既有依赖 `getBoundingClientRect` mock 的测试（拖动关键帧、片段等）在新宽度模型下
  仍然通过；不通过则按新模型调整 mock 方式，而非放宽断言。

## 3. 滚轮手势

- [ ] 3.1 Red：为 Ctrl/Cmd+滚轮缩放（锚点保持）、不带修饰键的滚轮横向平移编写组件测试
  （`fireEvent.wheel`）。
- [ ] 3.2 Green：`TimelineScale` 绑定 `onWheel`，按修饰键区分调用缩放纯函数或平移
  `scaleScrollRef.scrollLeft`。
- [ ] 3.3 用 `ResizeObserver` 监听 `.scale-scroll` 可视宽度变化，resize 后重新钳制当前
  `pixelsPerMs`。

## 4. 不依赖滚轮的缩放入口

- [ ] 4.1 Red：为工具栏缩放按钮（或键盘快捷键）的可访问名称、点击/按键后缩放级别变化编写测试。
- [ ] 4.2 Green：在工具栏 `.compose-animation-timeline__button-cluster` 新增缩放控件，接入两个
  locale 的 i18n 文案。
- [ ] 4.3 确认新控件与宿主编辑器（`packages/editor`）已注册的全局快捷键无冲突。

## 5. 视觉尺寸不受影响的回归验证

- [ ] 5.1 编写测试验证：放大/缩小后片段条、关键帧菱形、拖动手柄的计算样式（高度/边框/圆角）
  与缩放前一致，只有 `left`/`width` 随缩放变化。

## 6. 验证

- [ ] 6.1 运行 `packages/animation-panel` 的 `lint`/`typecheck`/`test`/`build`。
- [ ] 6.2 `openspec validate add-animation-timeline-zoom --strict`。
- [ ] 6.3 人工验证：在 Storybook 中缩放到上下限、resize 浏览器窗口后确认边界回弹、缩放后片段条
  粗细与参考图一致。
