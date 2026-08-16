## 1. 缩放/平移纯模型

- [x] 1.1 Red：为 `zoomComposeAnimationTimelineAt`（锚点保持）与
  `clampComposeAnimationPixelsPerMs`（上下限钳制，含容器宽度变化后回弹）编写 `animation-panel-model.test.ts`
  用例。
  - 记录：另加 `panComposeAnimationTimeline` 的 Red 用例（设计阶段拆出的平移纯函数，tasks 未单列但
    与缩放纯函数同属本节范围）。
- [x] 1.2 Green：在 `animation-panel-model.ts` 实现这两个纯函数。
- [x] 1.3 确定并写死最大/最小缩放级别的具体数值（结合 10 ms 关键帧吸附粒度调参），补充边界用例。
  - 结果：上限 `MAX_PIXELS_PER_MS = 20`（300 ms 动画撑出 6000 px，10 ms 吸附粒度仍有 200 px 可用）；
    下限动态等于"总宽度 = 可视宽度"，随容器宽度变化。14 项模型测试全部通过。

## 2. TimelineScale 改用显式像素宽度

- [x] 2.1 Red：为"`.scale` 宽度随缩放变化、片段与关键帧仍按时间比例定位"编写组件测试。
- [x] 2.2 Green：`TimelineScale` 引入本地 `pixelsPerMs` state；`.compose-animation-timeline__scale`
  的宽度从 CSS 百分比改为内联像素宽度 `Math.max(可视宽度, durationMs * pixelsPerMs)`。
  - 记录：`pixelsPerMs` 状态与测量逻辑实际放在父组件 `ComposeAnimationTimeline`（工具栏缩放按钮的
    归属地），通过 props 传给 `TimelineScale`，而不是 `TimelineScale` 内部私有状态——两处都需要
    读写同一份缩放状态，父组件持有更符合项目"状态放在需要它的最近公共祖先"的约定。
- [x] 2.3 确认既有依赖 `getBoundingClientRect` mock 的测试（拖动关键帧、片段等）在新宽度模型下
  仍然通过；不通过则按新模型调整 mock 方式，而非放宽断言。
  - 结果：全部沿用不变，无需调整——这些测试本就直接 mock `.scale` 的 `getBoundingClientRect`，
    不依赖 CSS 还是行内样式撑出宽度。

## 3. 滚轮手势

- [x] 3.1 Red：为 Ctrl/Cmd+滚轮缩放（锚点保持）、不带修饰键的滚轮横向平移编写组件测试
  （`fireEvent.wheel`）。
- [x] 3.2 Green：`TimelineScale` 绑定 `onWheel`，按修饰键区分调用缩放纯函数或平移
  `scaleScrollRef.scrollLeft`。
- [x] 3.3 用 `ResizeObserver` 监听 `.scale-scroll` 可视宽度变化，resize 后重新钳制当前
  `pixelsPerMs`。
  - 记录：沿用 `packages/stage`（`compose-stage.tsx`）已有的 `ResizeObserver` 容错模式——挂载时先
    同步测一次，`typeof ResizeObserver === 'undefined'` 时跳过 observer（jsdom 无 ResizeObserver）。
    回弹钳制没有用 `useEffect` 里 setState，而是改成渲染期条件性 setState：本仓库
    `react-hooks/set-state-in-effect` 规则把 effect 内的 setState 判定为 error，这是
    Task 7 最终评审修复轮已经验证过的同一个约束，这次直接照搬了那次验证过的写法。
- [x] 3.4 Red→Green：标尺主刻度步长按当前 `pixelsPerMs` 反推，保持相邻标签的最小可读像素间距，
  缩放时自动变密/变疏（合并进本次改动前，`createTimeMarkers` 只按总时长切成固定约 8 段，缩放后
  标尺完全不变，是用户实测发现的缺口，补进本节）。
  - 结果：候选步长表从 `[100,200,500,1000,2000,5000]` 扩展为 1-2-5 十进制级数
    `[10,20,...,100000]`，按 `MIN_MARKER_SPACING_PX(56) / pixelsPerMs` 反推所需步长；
    `pixelsPerMs` 未测出时（挂载瞬间）退回旧的"总时长/8"启发式，不影响任何既有测试。
    组件测试新增 1 项，共 47 项通过；额外用 Playwright 对着真实 Storybook 截图确认默认铺满宽度时
    主刻度为 20 ms 步长、放大后细化到 10 ms 步长下限，无标签重叠。

## 4. 不依赖滚轮的缩放入口

- [x] 4.1 Red：为工具栏缩放按钮（或键盘快捷键）的可访问名称、点击/按键后缩放级别变化编写测试。
- [x] 4.2 Green：在工具栏 `.compose-animation-timeline__button-cluster` 新增缩放控件，接入两个
  locale 的 i18n 文案。
- [x] 4.3 确认新控件与宿主编辑器（`packages/editor`）已注册的全局快捷键无冲突。
  - 结果：本轮只实现了工具栏按钮，未新增键盘快捷键（design.md 的"待解决问题"已把具体快捷键绑定
    列为留待后续、避免与宿主快捷键冲突的开放项）——spec 要求"工具栏按钮或键盘快捷键"二选一，
    按钮已单独满足该要求，因此没有快捷键需要做冲突检查。

## 5. 视觉尺寸不受影响的回归验证

- [x] 5.1 编写测试验证：放大/缩小后片段条、关键帧菱形、拖动手柄的计算样式（高度/边框/圆角）
  与缩放前一致，只有 `left`/`width` 随缩放变化。
  - 结果：断言片段条/关键帧的行内 style 只含位置相关字段（`left`/`width`），`height`/`borderRadius`
    始终为空字符串（即完全来自样式表，未被任何行内样式覆盖）。

## 6. 验证

- [x] 6.1 运行 `packages/animation-panel` 的 `lint`/`typecheck`/`test`/`build`。
  - 结果：全部通过；测试 46/46（模型 14 + 组件 32，含本次新增的 8 项模型测试与 5 项组件测试）。
- [x] 6.2 `openspec validate add-animation-timeline-zoom --strict`。
- [x] 6.3 人工验证：在 Storybook 中缩放到上下限、resize 浏览器窗口后确认边界回弹、缩放后片段条
  粗细与参考图一致。
  - 结果：用仓库自带的 `@playwright/test` 写了一次性驱动脚本（未提交，用完即删），实际启动
    Storybook（独立端口，未影响已在运行的其他实例）并对 `Animation/ComposeAnimationPanel` Default
    故事做了 Ctrl+滚轮放大、普通滚轮平移、工具栏缩小按钮点击、持续缩小到下限四组操作，每步截图
    确认：放大后可视区域正确收窄到局部时间区间；平移只改变可视位置不改变 `.scale` 宽度；缩小到
    下限后完全回到与初始铺满宽度一致的状态（`scrollWidth` ≈ `clientWidth`，无空白）；片段条与
    关键帧在所有缩放级别下的行内样式都只有 `left`/`width` 百分比，没有覆盖高度或圆角。未做真实
    浏览器窗口 resize 的可视化确认（该路径已由组件测试里对 `containerWidthPx` 回弹钳制的断言覆盖，
    机制与挂载测量共用同一段代码）。

## 7. 用户实测反馈的三处缺陷（矮高度真实宿主面板）

用户在真实宿主（而非 Storybook 默认 300px 高的示例容器）中用矮高度底部面板实测后反馈了三处问题；
用同一套 Playwright 手段，临时在 stories 文件里加了矮高度/多轨道两个诊断 Story（验证完即删除，
不进最终 diff）逐一复现定位。

- [x] 7.1 诊断并修复：`.scale-scroll` 出现不必要的纵向滚动条。
  - 根因：播放头两端的菱形手柄（`<span>`/`<i>`）用 `transform: translate(...) rotate(45deg)`
    做旋转装饰，本来就设计成略微探出 `.scale` 盒子边界；但 `.scale-scroll` 是双轴
    `overflow: auto`，任何探出 `.scale` 的像素都会被计入其可滚动区域，实测精确测得底部菱形
    多出 7.36px，从而出现一条几像素高、毫无意义的纵向滚动条。
  - 修复：把播放头外框从贴合竖线的 1px 宽改为 16px 宽并设 `overflow: hidden`，竖线本身移到
    `::before` 里画——外框足够宽，两端菱形手柄的横向视觉不会被裁到只剩 1px 的细线；外框的
    `top:0; bottom:0` 精确对齐 `.scale` 的上下边界，纵向裁切恰好发生在边界处。用 Playwright 实测
    确认修复后 `scaleScroll.scrollHeight === scaleScroll.clientHeight`（无溢出），在默认与放大
    多个缩放级别下均成立；多轨道场景下 `scrollHeight` 精确等于标尺高度加各轨道行高之和，不再有
    多余的 7px。
- [x] 7.2 诊断并修复：标尺次刻度（小刻度）看不清。
  - 根因：`.ruler::after` 用 `repeating-linear-gradient` 画次刻度，步长硬编码 `3.333%`（固定
    30 等分），只在旧的"总时长/8 段"启发式恰好对上 300ms/100ms 步长时凑巧看着合理；本次改动让
    主刻度步长随缩放变化后，次刻度这个固定 30 等分和主刻度完全脱节——不同缩放级别下次刻度既不
    对应任何整数毫秒，也和主刻度标签的位置无关，视觉上杂乱。
  - 修复：`createTimeMarkers` 额外返回选中的主刻度步长 `stepMs`；`ComposeAnimationTimeline` 用
    `timelineRatio(stepMs / 5, durationMs)` 把"主刻度步长的 1/5"换算成百分比，通过行内
    `--ruler-minor-step` 自定义属性传给 `.ruler`，CSS 里的 `repeating-linear-gradient` 步长从硬编码
    `3.333%` 改为 `var(--ruler-minor-step, 3.333%)`（保留旧值做兜底）。新增组件测试验证该自定义
    属性在缩放前后确实变化；用 Playwright 截图确认放大后次刻度随之变密、始终对应整数毫秒。
- [x] 7.3 诊断并修复：轨道名列表（左栏 `.track-list`）与关键帧轨道（右栏 `.scale-scroll`）曾是
  两个独立的纵向滚动容器，滚动其中一个不会带动另一个，用户反馈的"左右不对齐"正是这个问题被
  滚轮缩放功能间接放大后更容易触发（默认单轨道演示数据不会遇到，需要轨道数量超出可视高度才会
  触发）。复现证据：用 Playwright 在 6 轨道场景下实测，滚动左栏后左栏行的位置整体上移，右栏车道
  行的位置纹丝不动，两者彻底错开。
  - 修复：本变更收尾时一并重排双栏结构（提交 768427f）。纵轴的唯一滚动者是新的 `.board-scroll`，
    左栏 `.track-list` 改为 `overflow: visible` 高度随内容、右栏 `.scale-scroll` 只保留横向滚动
    （`overflow-y: clip`），两栏同属一个纵向滚动容器因而必然同步。这同时闭合了
    `update-animation-panel-foundation`（已归档）`tasks.md` 第 5 节"滚动对齐"记录的架构限制。
  - 回归：jsdom 测试 `双栏共用垂直滚动 / 左右两栏同属一个纵向滚动容器` 守结构前提（jsdom 不做
    布局）；真实布局由 Storybook Story `ScrolledManyTracks` 在 Chromium 下守住——断言内容确实
    纵向溢出、两栏各自都不再拥有独立纵向滚动、滚动 board 后左行与右车道的纵向距离不变。
    红绿验证：临时把 `.track-list` 改回 `overflow-y: auto; max-height: 120px` 该 Story 失败，
    恢复后 50 项全通过。
